// =====================================================================
// PROMEMORIA AUTOMATICI — eseguito da GitHub Actions (.github/workflows/promemoria.yml)
//   venerdì 16:00  → email agli uffici che non hanno ancora inserito nulla
//   domenica 10:00 → secondo promemoria agli uffici ancora mancanti
//   lunedì 7:30    → a ogni amministratore, l'elenco di chi non ha compilato nella sua città
// Le email partono dal Gmail dedicato ai rapportini. Ogni promemoria viene
// inviato una volta sola (tabella promemoria_inviati).
//
// Variabili richieste: SUPABASE_URL, SUPABASE_SERVICE_KEY, GMAIL_UTENTE,
// GMAIL_PASSWORD_APP, SITO_URL. Facoltative: TIPO (forza venerdi|domenica|lunedi),
// EMAIL_PROVA (manda tutto solo a questo indirizzo, senza registrare l'invio).
// =====================================================================
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const env = (nome, obbligatoria = true) => {
  const v = process.env[nome]?.trim()
  if (obbligatoria && !v) throw new Error(`Manca la variabile ${nome}`)
  return v || null
}

// ---------- Ora italiana e settimana ----------
const ora = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome', weekday: 'short', hour: 'numeric', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
}).formatToParts(new Date()).reduce((o, p) => ({ ...o, [p.type]: p.value }), {})
const oggi = `${ora.year}-${ora.month}-${ora.day}`
const giornoSett = ora.weekday          // Mon, Tue, …
const oraRoma = Number(ora.hour)

function lunediDi(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}
const aggiungiGiorni = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const formattaData = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })

/** Quale promemoria tocca adesso (GitHub può partire in ritardo: si accetta una finestra di 3 ore) */
function tipoDaOrario() {
  if (giornoSett === 'Fri' && oraRoma >= 16 && oraRoma < 19) return 'venerdi'
  if (giornoSett === 'Sun' && oraRoma >= 10 && oraRoma < 13) return 'domenica'
  if (giornoSett === 'Mon' && oraRoma >= 7 && oraRoma < 10) return 'lunedi'
  return null
}

const tipo = env('TIPO', false) ?? tipoDaOrario()
if (!tipo) {
  console.log(`Fuori dagli orari dei promemoria (${giornoSett} ore ${oraRoma} in Italia): nessun invio.`)
  process.exit(0)
}
if (!['venerdi', 'domenica', 'lunedi'].includes(tipo)) throw new Error(`TIPO non valido: ${tipo}`)

const settimana = tipo === 'lunedi' ? aggiungiGiorni(lunediDi(oggi), -7) : lunediDi(oggi)
const intervallo = `${formattaData(settimana)} – ${formattaData(aggiungiGiorni(settimana, 6))}`
const emailProva = env('EMAIL_PROVA', false)
const sito = env('SITO_URL')

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

// Evita doppi invii (salvo le prove)
if (!emailProva) {
  const { error } = await db.from('promemoria_inviati').insert({ tipo, settimana })
  if (error?.code === '23505') { console.log(`Promemoria "${tipo}" della settimana ${settimana} già inviato.`); process.exit(0) }
  if (error) throw new Error(error.message)
}

const [citta, uffici, utenti, metriche, rilevazioni] = await Promise.all([
  tutte('citta', 'id, nome'),
  tutte('uffici', 'id, nome, citta_id', (q) => q.eq('attivo', true)),
  tutte('utenti', 'nome_utente, ruolo, citta_id, ufficio_id, email_promemoria', (q) => q.eq('attivo', true)),
  tutte('metriche', 'codice, tipo', (q) => q.eq('attiva', true)),
  tutte('rilevazioni', 'ufficio_id, metrica, risultato', (q) => q.eq('settimana', settimana).not('risultato', 'is', null)),
])
const attivita = metriche.filter((m) => m.tipo === 'attivita').map((m) => m.codice)

function stato(ufficioId) {
  const compilate = new Set(rilevazioni.filter((r) => r.ufficio_id === ufficioId).map((r) => r.metrica))
  if (compilate.size === 0) return 'mancante'
  return attivita.every((c) => compilate.has(c)) ? 'completo' : 'parziale'
}
const indirizzi = (lista) => [...new Set(lista.flatMap((u) => (u.email_promemoria ?? '').split(',')).map((e) => e.trim()).filter(Boolean))]

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
const pulsante = `<p><a href="${sito}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Apri Rapportini Settimanali</a></p>`

try {
  if (tipo === 'venerdi' || tipo === 'domenica') {
    const mancanti = uffici.filter((u) => stato(u.id) === 'mancante')
    for (const u of mancanti) {
      const dest = indirizzi(utenti.filter((x) => x.ufficio_id === u.id && x.ruolo === 'ufficio'))
      if (dest.length === 0) { console.log(`· ${u.nome}: nessuna email per i promemoria, saltato`); continue }
      const sollecito = tipo === 'domenica' ? 'Ultimo promemoria: ' : ''
      await invia(dest, `${sollecito}inserisci i dati della settimana (${intervallo})`,
        `<p>Ciao ${u.nome},</p>
         <p>non risultano ancora inseriti i dati della settimana <strong>${intervallo}</strong>.</p>
         <p>Ti chiediamo di compilarli entro <strong>domenica sera</strong>: lunedì si fa la riunione.</p>
         ${pulsante}<p style="color:#666;font-size:13px">Messaggio automatico, non rispondere.</p>`)
      console.log(`✓ ${u.nome} → ${dest.join(', ')}`)
    }
    console.log(`Uffici mancanti: ${mancanti.length} · email inviate: ${inviate}`)
  } else {
    for (const c of citta) {
      const ufficiCitta = uffici.filter((u) => u.citta_id === c.id)
      const admin = indirizzi(utenti.filter((x) => x.citta_id === c.id && (x.ruolo === 'admin_citta' || x.ruolo === 'admin_generale')))
      if (ufficiCitta.length === 0 || admin.length === 0) continue
      const elenco = (s) => ufficiCitta.filter((u) => stato(u.id) === s).map((u) => u.nome).sort()
      const mancanti = elenco('mancante'), parziali = elenco('parziale')
      const lista = (titolo, nomi) => nomi.length ? `<p><strong>${titolo} (${nomi.length}):</strong></p><ul>${nomi.map((n) => `<li>${n}</li>`).join('')}</ul>` : ''
      await invia(admin, `${c.nome}: ${mancanti.length === 0 ? 'tutti gli uffici hanno compilato' : `${mancanti.length} uffici senza dati`} (${intervallo})`,
        `<p>Riepilogo compilazione di <strong>${c.nome}</strong> per la settimana <strong>${intervallo}</strong>:</p>
         <p>Hanno compilato ${ufficiCitta.length - mancanti.length} uffici su ${ufficiCitta.length}.</p>
         ${lista('Nessun dato inserito', mancanti)}${lista('Dati incompleti', parziali)}
         ${pulsante}`)
      console.log(`✓ Riepilogo ${c.nome} → ${admin.join(', ')}`)
    }
  }
} catch (e) {
  // Se l'invio fallisce, si cancella la registrazione così il prossimo tentativo riprova
  if (!emailProva) await db.from('promemoria_inviati').delete().eq('tipo', tipo).eq('settimana', settimana)
  throw e
}
