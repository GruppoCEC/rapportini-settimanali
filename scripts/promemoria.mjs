// =====================================================================
// PROMEMORIA AUTOMATICI — eseguito da GitHub Actions (.github/workflows/promemoria.yml)
// Rapportino settimanale:
//   venerdì 16:00  → email agli uffici che non hanno ancora inserito nulla
//   domenica 10:00 → secondo promemoria agli uffici ancora mancanti
// Rapportino mensile (solo se il mensile è aperto agli uffici e il mese ha una scadenza
// fissata in Report mensile → Panoramica), ogni volta alle 10:00:
//   3 giorni prima della scadenza → email agli uffici che non hanno inserito nulla
//   il giorno prima               → ultimo promemoria agli uffici ancora mancanti
//   il giorno dopo                → all'amministratore generale, chi manca, chi è incompleto e chi è in ritardo
// Le regole del calendario sono in scripts/promemoria-calendario.mjs.
// Le email partono dal Gmail dedicato ai rapportini. Ogni promemoria viene
// inviato una volta sola (tabella promemoria_inviati).
//
// Variabili richieste: SUPABASE_URL, SUPABASE_SERVICE_KEY, GMAIL_UTENTE,
// GMAIL_PASSWORD_APP, SITO_URL. Facoltative: TIPO (forza venerdi | domenica |
// mensile_3giorni | mensile_vigilia | mensile_riepilogo), MESE (AAAA-MM, per i tipi
// mensili forzati; se manca, il mese appena concluso), EMAIL_PROVA (manda tutto solo
// a questo indirizzo, senza registrare l'invio).
// =====================================================================
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import {
  aggiungiGiorni, aggiungiMesi, chiaveMensile, inItalia, inServizio, lunediDi, oraMensile,
  promemoriaMensiliDiOggi, statoMensile, tipoSettimanale, ultimoRitardo, TIPI_MENSILI, TIPI_SETTIMANALI,
} from './promemoria-calendario.mjs'

const env = (nome, obbligatoria = true) => {
  const v = process.env[nome]?.trim()
  if (obbligatoria && !v) throw new Error(`Manca la variabile ${nome}`)
  return v || null
}

const adesso = inItalia(new Date())
const oggi = adesso.data
const tipoForzato = env('TIPO', false)
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

/**
 * Esegue un promemoria una volta sola: lo registra prima di inviare (salvo le prove)
 * e, se l'invio fallisce, cancella la registrazione così il prossimo tentativo riprova.
 */
async function unaVolta({ tipo, settimana }, invio) {
  if (!emailProva) {
    const { error } = await db.from('promemoria_inviati').insert({ tipo, settimana })
    if (error?.code === '23505') { console.log(`Promemoria "${tipo}" del ${settimana} già inviato.`); return }
    if (error) throw new Error(error.message)
  }
  try {
    await invio()
  } catch (e) {
    if (!emailProva) await db.from('promemoria_inviati').delete().eq('tipo', tipo).eq('settimana', settimana)
    throw e
  }
}

// ---------- Invio ----------
const posta = nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 465, secure: true,
  auth: { user: env('GMAIL_UTENTE'), pass: env('GMAIL_PASSWORD_APP') },
})
let inviate = 0
async function invia(destinatari, oggetto, html) {
  if (destinatari.length === 0) return
  const a = emailProva ? [emailProva] : destinatari
  await posta.sendMail({
    from: `"Rapportini Settimanali" <${env('GMAIL_UTENTE')}>`,
    to: a.join(', '),
    subject: emailProva ? `[PROVA → ${destinatari.join(', ')}] ${oggetto}` : oggetto,
    html,
  })
  inviate++
}
const pulsante = `<p><a href="${sito}" style="display:inline-block;background:#0057A3;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Apri Rapportini Settimanali</a></p>`
const firma = '<p style="color:#666;font-size:13px">Messaggio automatico, non rispondere.</p>'

// ---------- Rapportino settimanale ----------
async function settimanale(tipo) {
  const settimana = lunediDi(oggi)
  const intervallo = `${formattaData(settimana)} – ${formattaData(aggiungiGiorni(settimana, 6))}`
  await unaVolta({ tipo, settimana }, async () => {
    const rilevazioni = await tutte('rilevazioni', 'ufficio_id', (q) => q.eq('settimana', settimana).not('risultato', 'is', null))
    const conDati = new Set(rilevazioni.map((r) => r.ufficio_id))
    const mancanti = uffici.filter((u) => !conDati.has(u.id))
    for (const u of mancanti) {
      const dest = emailUfficio(u)
      if (dest.length === 0) { console.log(`· ${u.nome}: nessuna email per i promemoria, saltato`); continue }
      const sollecito = tipo === 'domenica' ? 'Ultimo promemoria: ' : ''
      await invia(dest, `${sollecito}inserisci i dati della settimana (${intervallo})`,
        `<p>Ciao ${u.nome},</p>
         <p>non risultano ancora inseriti i dati della settimana <strong>${intervallo}</strong>.</p>
         <p>Ti chiediamo di compilarli entro <strong>domenica sera</strong>: lunedì si fa la riunione.</p>
         ${pulsante}${firma}`)
      console.log(`✓ ${u.nome} → ${dest.join(', ')}`)
    }
    console.log(`Settimana ${intervallo}: uffici mancanti ${mancanti.length}`)
  })
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
  const entro = `${formattaData(scadenza.giorno)} alle ${scadenza.orario}`
  await unaVolta(chiaveMensile(tipo, mese, scadenza.giorno), async () => {
    const stati = await statiDelMese(mese, scadenza)

    if (tipo !== 'mensile_riepilogo') {
      const mancanti = stati.filter((s) => s.stato === 'mancante').map((s) => s.ufficio)
      const vigilia = tipo === 'mensile_vigilia'
      for (const u of mancanti) {
        const dest = emailUfficio(u)
        if (dest.length === 0) { console.log(`· ${u.nome}: nessuna email per i promemoria, saltato`); continue }
        await invia(dest, `${vigilia ? 'Scade domani: ' : ''}rapportino mensile di ${titolo}, da inserire entro il ${entro}`,
          `<p>Ciao ${u.nome},</p>
           <p>non risultano ancora inseriti i numeri del <strong>rapportino mensile di ${titolo}</strong>.</p>
           <p>La scadenza è ${vigilia ? '<strong>domani</strong>, ' : ''}il <strong>${entro}</strong>.
              ${scadenza.blocca ? 'Dopo la scadenza l\'inserimento si chiude.' : 'Dopo la scadenza potrai ancora inserirli, ma risulteranno in ritardo.'}</p>
           <p>Li trovi nel menu <strong>Inserisci mese</strong>.</p>
           ${pulsante}${firma}`)
        console.log(`✓ ${u.nome} → ${dest.join(', ')}`)
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
      return `<h3 style="margin-bottom:4px">${c.nome}</h3>
        <p style="margin-top:0">Hanno inserito ${totale - mancanti.length} uffici su ${totale}.</p>
        ${lista('Nessun dato inserito', mancanti)}
        ${lista('Rapportino incompleto', elenco(qui((s) => s.stato === 'parziale')))}
        ${lista('Inserito o modificato dopo la scadenza', elenco(qui((s) => s.ritardo), (s) => `${s.ufficio.nome} — ${dataOraItaliana(s.ritardo)}`))}`
    }).join('')
    const nMancanti = stati.filter((s) => s.stato === 'mancante').length
    await invia(admin, `Rapportino mensile di ${titolo}: ${nMancanti === 0 ? 'tutti gli uffici hanno inserito' : `${nMancanti} uffici senza dati`}`,
      `<p>Riepilogo del <strong>rapportino mensile di ${titolo}</strong>. La scadenza era il <strong>${entro}</strong>${scadenza.blocca ? ' (inserimento chiuso per gli uffici)' : ''}.</p>
       ${perCitta}${pulsante}`)
    console.log(`✓ Riepilogo mensile ${titolo} → ${admin.join(', ')}`)
  })
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
  console.log(`Oggi (${adesso.giorno} ${oggi}, ore ${adesso.ora} in Italia) non tocca nessun promemoria.`)
} else {
  for (const fai of daFare) await fai()
  console.log(`Email inviate: ${inviate}`)
}
