// =====================================================================
// PROMEMORIA AUTOMATICI — eseguito da GitHub Actions (.github/workflows/promemoria.yml)
// Rapportino settimanale:
//   sabato 10:00  → email agli uffici che non hanno ancora inserito nulla della settimana in corso
//   lunedì 9:30   → ultimo promemoria, il giorno della riunione, a chi manca ancora la settimana appena chiusa
// Rapportino mensile (solo se il mensile è aperto agli uffici e il mese ha una scadenza
// fissata in Report mensile → Panoramica), ogni volta alle 10:00:
//   3 giorni prima della scadenza → email agli uffici che non hanno inserito nulla
//   il giorno prima               → ultimo promemoria agli uffici ancora mancanti
//   il giorno dopo                → all'amministratore generale, chi manca, chi è incompleto e chi è in ritardo
// Le regole del calendario sono in scripts/promemoria-calendario.mjs.
// Le email partono dal Gmail indicato in GMAIL_UTENTE. Ogni email viene inviata una volta
// sola (tabella promemoria_inviati); se Gmail è occupato lo script aspetta e riprova.
//
// Variabili richieste: SUPABASE_URL, SUPABASE_SERVICE_KEY, GMAIL_UTENTE,
// GMAIL_PASSWORD_APP, SITO_URL. Facoltative: TIPO (forza sabato | lunedi |
// mensile_3giorni | mensile_vigilia | mensile_riepilogo; "automatico" = come l'orario
// programmato: è quello che manda l'orologio di Supabase, supabase/PROMEMORIA_PUNTUALI.sql), MESE (AAAA-MM, per i tipi
// mensili forzati; se manca, il mese appena concluso), EMAIL_PROVA (manda tutto solo
// a questo indirizzo, senza registrare l'invio).
// =====================================================================
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import {
  aggiungiGiorni, aggiungiMesi, chiaveMensile, dalAl, inItalia, inServizio, oraMensile,
  promemoriaMensiliDiOggi, settimanaDelPromemoria, statoMensile, tipoSettimanale, ultimoRitardo, TIPI_MENSILI, TIPI_SETTIMANALI,
} from './promemoria-calendario.mjs'

const env = (nome, obbligatoria = true) => {
  const v = process.env[nome]?.trim()
  if (obbligatoria && !v) throw new Error(`Manca la variabile ${nome}`)
  return v || null
}

const adesso = inItalia(new Date())
const oggi = adesso.data
// "automatico" (avvio dall'orologio di Supabase) vale come l'esecuzione programmata: decide l'orario
const tipoForzato = env('TIPO', false) === 'automatico' ? null : env('TIPO', false)
if (tipoForzato && ![...TIPI_SETTIMANALI, ...TIPI_MENSILI].includes(tipoForzato)) throw new Error(`TIPO non valido: ${tipoForzato}`)

// Finché i segreti non sono inseriti su GitHub (passo 8 di docs/GUIDA_SETUP.md), le esecuzioni
// programmate si fermano senza errore, così GitHub non manda email di errore ogni giorno.
const segretiMancanti = ['SUPABASE_SERVICE_KEY', 'GMAIL_UTENTE', 'GMAIL_PASSWORD_APP'].filter((n) => !process.env[n]?.trim())
if (segretiMancanti.length && !tipoForzato) {
  console.log(`Promemoria non ancora configurati (mancano ${segretiMancanti.join(', ')}): nessun invio.`)
  process.exit(0)
}
const emailProva = env('EMAIL_PROVA', false)
const sito = env('SITO_URL')

const formattaData = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
const conGiorno = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
const nomeMese = (mese) => new Date(`${mese}T12:00:00Z`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
const dataOraItaliana = (istante) => { const x = inItalia(istante); return `${formattaData(x.data)} alle ${x.orario}` }


// ---------- Dati ----------
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'), { auth: { persistSession: false } })

async function tutte(tabella, colonne, filtro = (q) => q) {
  const righe = []
  for (let da = 0; ; da += 1000) {
    const { data, error } = await filtro(db.from(tabella).select(colonne)).range(da, da + 999)
    if (error) throw new Error(`${tabella}: ${error.message}`)
    righe.push(...data)
    if (data.length < 1000) return righe
  }
}

const [citta, uffici, utenti] = await Promise.all([
  tutte('citta', 'id, nome'),
  tutte('uffici', 'id, nome, citta_id', (q) => q.eq('attivo', true)),
  tutte('utenti', 'nome_utente, ruolo, citta_id, ufficio_id, email_promemoria', (q) => q.eq('attivo', true)),
])
const indirizzi = (lista) => [...new Set(lista.flatMap((u) => (u.email_promemoria ?? '').split(',')).map((e) => e.trim()).filter(Boolean))]
// anche l'amministratore di città che è un ufficio riceve i promemoria del suo ufficio
const emailUfficio = (u) => indirizzi(utenti.filter((x) => x.ufficio_id === u.id))

// ---------- Invio ----------
const posta = nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 465, secure: true,
  auth: { user: env('GMAIL_UTENTE'), pass: env('GMAIL_PASSWORD_APP') },
})
const PAUSA_TRA_EMAIL = 2                 // secondi: Gmail non gradisce le raffiche di email
const ATTESE_SE_GMAIL_OCCUPATO = [30, 90, 180]   // secondi prima di ogni nuovo tentativo
const pausa = (secondi) => new Promise((ok) => setTimeout(ok, secondi * 1000))
let inviate = 0
const scartate = []   // email rifiutate da Gmail per sempre (es. indirizzo sbagliato)

/** Invia un'email; se Gmail risponde "riprova più tardi" (codici 4xx) aspetta e riprova */
async function inviaConPazienza(destinatari, oggetto, html) {
  const a = emailProva ? [emailProva] : destinatari
  for (let tentativo = 0; ; tentativo++) {
    try {
      await posta.sendMail({
        from: `"${MITTENTE}" <${env('GMAIL_UTENTE')}>`,
        to: a.join(', '),
        subject: emailProva ? `[PROVA → ${destinatari.join(', ')}] ${oggetto}` : oggetto,
        html,
      })
      inviate++
      await pausa(PAUSA_TRA_EMAIL)
      return
    } catch (e) {
      const temporaneo = e.code !== 'EAUTH' && (!e.responseCode || (e.responseCode >= 400 && e.responseCode < 500))
      if (!temporaneo || tentativo >= ATTESE_SE_GMAIL_OCCUPATO.length) throw e
      const attesa = ATTESE_SE_GMAIL_OCCUPATO[tentativo]
      console.log(`  Gmail occupato (${e.responseCode ?? e.code}): riprovo tra ${attesa} secondi`)
      await pausa(attesa)
    }
  }
}

/**
 * Invia un promemoria a un destinatario una volta sola. Ogni email si registra in
 * promemoria_inviati (salvo le prove): se l'esecuzione si interrompe a metà, quella
 * successiva manda solo le email che mancano, senza doppioni.
 */
async function inviaUnaVolta({ tipo, settimana }, { id, chi }, destinatari, oggetto, html) {
  const chiave = { tipo: `${tipo}|${id}`, settimana }
  if (!emailProva) {
    const { error } = await db.from('promemoria_inviati').insert(chiave)
    if (error?.code === '23505') { console.log(`· ${chi}: già inviato`); return false }
    if (error) throw new Error(error.message)
  }
  try {
    await inviaConPazienza(destinatari, oggetto, html)
    return true
  } catch (e) {
    if (!emailProva) await db.from('promemoria_inviati').delete().eq('tipo', chiave.tipo).eq('settimana', settimana)
    // indirizzo rifiutato per sempre: si segnala e si passa agli altri; altrimenti (Gmail giù, password errata) ci si ferma
    if (e.code === 'EENVELOPE' && e.responseCode >= 500) { scartate.push(`${chi} (${destinatari.join(', ')}): ${e.response}`); return false }
    throw e
  }
}
const perUfficio = (u) => ({ id: `ufficio-${u.id}`, chi: u.nome })

// =====================================================================
// TESTI DELLE EMAIL — per cambiare le parole basta modificare questa sezione.
// Tono deciso da Davide: "voi", cordiale, senza firma; chi ha problemi può rispondere.
// =====================================================================
const MITTENTE = 'Rapportini Gruppo CEC'

const pulsante = (testo) => `<p style="margin:24px 0"><a href="${sito}" style="display:inline-block;background:#0057A3;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${testo}</a></p>`
const aiuto = '<p style="color:#666;font-size:13px">Avete difficoltà a inserire i dati? Rispondete pure a questa email.</p>'
const pagina = (contenuto) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:600px">${contenuto}</div>`

const TESTI = {
  // Settimanale: sabato alle 10 (primo) e lunedì alle 9:30, giorno della riunione (ultimo)
  settimanale: ({ tipo, ufficio, settimana }) => {
    const ultimo = tipo === 'lunedi'
    return {
      oggetto: `${ultimo ? 'Ultimo promemoria' : 'Promemoria'}: dati della settimana ${settimana}`,
      html: pagina(`
        <p>Buongiorno,</p>
        <p>per l'ufficio <strong>${ufficio}</strong> non risultano ancora inseriti i dati della settimana <strong>${settimana}</strong>.</p>
        <p>${ultimo
          ? 'Oggi c\'è la riunione: vi chiediamo di inserirli <strong>subito, prima che inizi</strong>.'
          : 'Vi chiediamo di inserirli <strong>entro domenica sera</strong>, così saranno pronti per la riunione di lunedì.'}</p>
        ${pulsante('Inserisci i dati della settimana')}${aiuto}`),
    }
  },

  // Mensile: 3 giorni prima e il giorno prima della scadenza, alle 10
  mensileUfficio: ({ vigilia, ufficio, mese, giorno, entro, blocca }) => ({
    oggetto: vigilia ? `Scade domani: rapportino di ${mese}` : `Promemoria: rapportino di ${mese}, scadenza ${giorno}`,
    html: pagina(`
      <p>Buongiorno,</p>
      <p>per l'ufficio <strong>${ufficio}</strong> non risulta ancora inserito il <strong>rapportino mensile di ${mese}</strong>.</p>
      <p>La scadenza è ${vigilia ? '<strong>domani</strong>, ' : ''}<strong>${entro}</strong>.
         ${blocca ? 'Dopo la scadenza l\'inserimento si chiude.' : 'Dopo la scadenza potrete ancora inserirlo, ma risulterà in ritardo.'}</p>
      <p>Lo trovate nel menu <strong>Inserisci mese</strong>.</p>
      ${pulsante('Inserisci il rapportino del mese')}${aiuto}`),
  }),

  // Mensile: il giorno dopo la scadenza, solo all'amministratore generale
  mensileRiepilogo: ({ mese, entro, blocca, mancanti, perCitta }) => ({
    oggetto: `Rapportino di ${mese}: ${mancanti === 0 ? 'tutti gli uffici hanno inserito' : mancanti === 1 ? '1 ufficio senza dati' : `${mancanti} uffici senza dati`}`,
    html: pagina(`
      <p>Buongiorno,</p>
      <p>ecco come è andato il <strong>rapportino mensile di ${mese}</strong>. La scadenza era <strong>${entro}</strong>${blocca ? ' e ora l\'inserimento è chiuso per gli uffici' : ''}.</p>
      ${perCitta}
      ${pulsante('Apri il report mensile')}`),
  }),
}

// ---------- Rapportino settimanale ----------
// I numeri inseriti dal database per completare le settimane con il rapportino mensile
// (011_settimane_dal_mensile.sql, colonna da_mensile) non contano: l'ufficio va comunque avvisato.
async function scrittiDagliUffici(settimana) {
  try {
    return await tutte('rilevazioni', 'ufficio_id', (q) => q.eq('settimana', settimana).not('risultato', 'is', null).eq('da_mensile', false))
  } catch (e) {
    if (!/da_mensile/.test(e.message)) throw e
    return tutte('rilevazioni', 'ufficio_id', (q) => q.eq('settimana', settimana).not('risultato', 'is', null))   // 011 non ancora eseguita
  }
}

async function settimanale(tipo) {
  const settimana = settimanaDelPromemoria(tipo, oggi)
  const intervallo = dalAl(settimana, aggiungiGiorni(settimana, 6))
  const conDati = new Set((await scrittiDagliUffici(settimana)).map((r) => r.ufficio_id))
  const mancanti = uffici.filter((u) => !conDati.has(u.id))
  for (const u of mancanti) {
    const dest = emailUfficio(u)
    if (dest.length === 0) { console.log(`· ${u.nome}: nessuna email per i promemoria, saltato`); continue }
    const { oggetto, html } = TESTI.settimanale({ tipo, ufficio: u.nome, settimana: intervallo })
    if (await inviaUnaVolta({ tipo, settimana }, perUfficio(u), dest, oggetto, html)) console.log(`✓ ${u.nome} → ${dest.join(', ')}`)
  }
  console.log(`Settimana ${intervallo}: uffici mancanti ${mancanti.length}`)
}

// ---------- Rapportino mensile ----------
async function mensileAperto() {
  const { data, error } = await db.from('impostazioni').select('valore').eq('chiave', 'mensile_aperto').maybeSingle()
  if (error) throw new Error(error.message)
  return data?.valore === 'si'
}

/** Stato di ogni ufficio nel mese: mancante | parziale | completo, più l'eventuale ritardo */
async function statiDelMese(mese, scadenza) {
  const [voci, persone, valori] = await Promise.all([
    tutte('voci_mensili', 'codice, solo_ruolo', (q) => q.eq('attiva', true)),
    tutte('persone', 'id, ufficio_id, data_inizio, data_fine'),
    tutte('valori_mensili', 'persona_id, ufficio_id, voce, valore, aggiornato_il', (q) => q.eq('mese', mese)),
  ])
  return uffici.map((u) => {
    const suoi = valori.filter((v) => v.ufficio_id === u.id)
    return {
      ufficio: u,
      stato: statoMensile(persone.filter((p) => p.ufficio_id === u.id), suoi, voci, mese),
      ritardo: ultimoRitardo(suoi, scadenza.scadenza),
    }
  })
}

async function mensile({ tipo, mese, scadenza }) {
  const titolo = nomeMese(mese)
  const entro = `${conGiorno(scadenza.giorno)} alle ${scadenza.orario}`
  const chiave = chiaveMensile(tipo, mese, scadenza.giorno)
  const stati = await statiDelMese(mese, scadenza)

  if (tipo !== 'mensile_riepilogo') {
    const mancanti = stati.filter((s) => s.stato === 'mancante').map((s) => s.ufficio)
    const vigilia = tipo === 'mensile_vigilia'
    for (const u of mancanti) {
      const dest = emailUfficio(u)
      if (dest.length === 0) { console.log(`· ${u.nome}: nessuna email per i promemoria, saltato`); continue }
      const { oggetto, html } = TESTI.mensileUfficio({ vigilia, ufficio: u.nome, mese: titolo, giorno: conGiorno(scadenza.giorno), entro, blocca: scadenza.blocca })
      if (await inviaUnaVolta(chiave, perUfficio(u), dest, oggetto, html)) console.log(`✓ ${u.nome} → ${dest.join(', ')}`)
    }
    console.log(`Mensile ${titolo} (${tipo}): uffici mancanti ${mancanti.length}`)
    return
  }

  // Riepilogo del giorno dopo: solo all'amministratore generale, Roma e Milano insieme
  const admin = indirizzi(utenti.filter((x) => x.ruolo === 'admin_generale'))
  if (admin.length === 0) { console.log('Nessun amministratore generale con email per i promemoria: riepilogo non inviato'); return }
  const elenco = (filtro, testo = (s) => s.ufficio.nome) => stati.filter(filtro).sort((a, b) => a.ufficio.nome.localeCompare(b.ufficio.nome)).map(testo)
  const lista = (titoloLista, nomi) => nomi.length ? `<p><strong>${titoloLista} (${nomi.length}):</strong></p><ul>${nomi.map((n) => `<li>${n}</li>`).join('')}</ul>` : ''
  const perCitta = citta.map((c) => {
    const qui = (f) => (s) => s.ufficio.citta_id === c.id && f(s)
    const totale = stati.filter(qui(() => true)).length
    if (totale === 0) return ''
    const mancanti = elenco(qui((s) => s.stato === 'mancante'))
    return `<h3 style="margin:20px 0 4px;color:#0057A3">${c.nome}</h3>
      <p style="margin-top:0">Hanno inserito ${totale - mancanti.length} uffici su ${totale}.</p>
      ${lista('Nessun dato inserito', mancanti)}
      ${lista('Rapportino incompleto', elenco(qui((s) => s.stato === 'parziale')))}
      ${lista('Inserito o modificato dopo la scadenza', elenco(qui((s) => s.ritardo), (s) => `${s.ufficio.nome} — ${dataOraItaliana(s.ritardo)}`))}`
  }).join('')
  const nMancanti = stati.filter((s) => s.stato === 'mancante').length
  const { oggetto, html } = TESTI.mensileRiepilogo({ mese: titolo, entro, blocca: scadenza.blocca, mancanti: nMancanti, perCitta })
  if (await inviaUnaVolta(chiave, { id: 'riepilogo', chi: 'Riepilogo' }, admin, oggetto, html)) console.log(`✓ Riepilogo mensile ${titolo} → ${admin.join(', ')}`)
}

/** Scadenza del mese per un invio forzato a mano; nelle prove, se manca, si usa la proposta (il 5 del mese dopo alle 23:59) */
async function scadenzaPerProva(mese) {
  const { data, error } = await db.from('scadenze_mensili').select('mese, scadenza, blocca').eq('mese', mese).maybeSingle()
  if (error) throw new Error(error.message)
  let s = data
  if (!s) {
    if (!emailProva) throw new Error(`Nessuna scadenza fissata per ${nomeMese(mese)}: fissala in Report mensile → Panoramica`)
    const giorno = `${aggiungiMesi(mese, 1).slice(0, 8)}05`
    const scadenza = [`${giorno}T21:59:00Z`, `${giorno}T22:59:00Z`].find((iso) => inItalia(iso).orario === '23:59')
    s = { mese, scadenza, blocca: false }
    console.log(`Prova: ${nomeMese(mese)} non ha una scadenza, uso la proposta (${formattaData(giorno)} alle 23:59)`)
  }
  const { data: giorno, orario } = inItalia(s.scadenza)
  return { ...s, giorno, orario }
}

// ---------- Settimane dei mesi appena finiti, completate con il rapportino mensile ----------
// Serve quando un ufficio ha inserito il mensile prima che finisse l'ultima settimana del mese.
{
  const { error } = await db.rpc('ricostruisci_mesi_recenti')
  if (error) console.log(`Settimane dal rapportino mensile non ricalcolate: ${error.message}`)
}

// ---------- Cosa tocca adesso ----------
const daFare = []
if (tipoForzato) {
  if (TIPI_SETTIMANALI.includes(tipoForzato)) daFare.push(() => settimanale(tipoForzato))
  else {
    const mese = env('MESE', false) ? `${env('MESE', false).slice(0, 7)}-01` : aggiungiMesi(`${oggi.slice(0, 7)}-01`, -1)
    if (!/^\d{4}-\d{2}-01$/.test(mese)) throw new Error(`MESE non valido: ${env('MESE', false)} (scrivi AAAA-MM, es. 2026-09)`)
    if (!emailProva && !(await mensileAperto())) throw new Error('Il rapportino mensile non è ancora aperto agli uffici (mensile_aperto = no)')
    if (emailProva && !(await mensileAperto())) console.log('Prova: il mensile non è ancora aperto agli uffici, invio lo stesso')
    const scadenza = await scadenzaPerProva(mese)
    daFare.push(() => mensile({ tipo: tipoForzato, mese, scadenza }))
  }
} else {
  const tipo = tipoSettimanale(adesso)
  if (tipo) daFare.push(() => settimanale(tipo))
  if (oraMensile(adesso)) {
    if (await mensileAperto()) {
      // si guardano i mesi vicini: la scadenza di solito è all'inizio del mese dopo
      const meseOggi = `${oggi.slice(0, 7)}-01`
      const scadenze = await tutte('scadenze_mensili', 'mese, scadenza, blocca',
        (q) => q.gte('mese', aggiungiMesi(meseOggi, -3)).lte('mese', meseOggi))
      for (const p of promemoriaMensiliDiOggi(oggi, scadenze)) daFare.push(() => mensile(p))
    } else console.log('Rapportino mensile non ancora aperto agli uffici: nessun promemoria mensile.')
  }
}

if (daFare.length === 0) {
  console.log(`Oggi (${adesso.giorno} ${oggi}, ore ${adesso.orario} in Italia) non tocca nessun promemoria.`)
} else {
  for (const fai of daFare) await fai()
  console.log(`Email inviate: ${inviate}`)
  if (scartate.length) throw new Error(`Gmail ha rifiutato ${scartate.length} email (controlla l'email per i promemoria in Amministrazione):\n${scartate.join('\n')}`)
}
