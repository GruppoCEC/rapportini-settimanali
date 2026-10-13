// =====================================================================
// ACCOUNT DEGLI UFFICI IN BLOCCO
//
//   node scripts/crea-account.mjs                          → prova: controlla l'elenco, non crea nulla
//   node scripts/crea-account.mjs --esegui                 → crea gli account mancanti
//   node scripts/crea-account.mjs --reimposta-password     → prova: mostra chi riceverebbe una nuova password
//   node scripts/crea-account.mjs --reimposta-password --esegui
//                                                          → nuove password per gli account già esistenti
//
// Legge import/account.csv (ufficio;citta;nome_utente;email_promemoria;note)
// e scrive import/CREDENZIALI.csv con nome utente, password e un messaggio
// pronto da inviare a ogni ufficio.
// Password: nome dell'ufficio + 4 cifre casuali (es. somalia-4821): riconoscibile
// per l'ufficio, ma non indovinabile dai colleghi.
//
// Serve la chiave SEGRETA di Supabase nel file .env.local (mai su GitHub, mai in chat):
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY=sb_secret_...
// =====================================================================
import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const ESEGUI = process.argv.includes('--esegui')
const REIMPOSTA = process.argv.includes('--reimposta-password')
const SITO = 'https://gruppocec.github.io/rapportini-settimanali/'
const CITTA = { roma: 1, milano: 2 }
const BOM = '﻿'   // fa leggere bene gli accenti a Excel

// ---------- configurazione ----------
const env = { ...process.env }
if (existsSync('.env.local')) {
  for (const riga of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = riga.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m && !env[m[1]]) env[m[1]] = m[2]
  }
}
const url = env.VITE_SUPABASE_URL
const chiave = env.SUPABASE_SERVICE_KEY
if (!url || !chiave || chiave === 'INCOLLA_QUI') {
  console.error('Mancano VITE_SUPABASE_URL e/o SUPABASE_SERVICE_KEY nel file .env.local (vedi le istruzioni in cima a questo file).')
  process.exit(1)
}
const db = createClient(url, chiave, { auth: { persistSession: false, autoRefreshToken: false } })

// ---------- elenco ----------
const righe = readFileSync('import/account.csv', 'utf8').replace(BOM, '').split(/\r?\n/).filter((r) => r.trim())
const [intestazione, ...dati] = righe
if (!/^ufficio;citta;nome_utente;email_promemoria/i.test(intestazione)) {
  console.error('import/account.csv: la prima riga deve essere "ufficio;citta;nome_utente;email_promemoria;note"')
  process.exit(1)
}
const voci = dati.map((r, i) => {
  const [ufficio, citta, nomeUtente, email] = r.split(';').map((x) => (x ?? '').trim())
  return { riga: i + 2, ufficio, citta, cittaId: CITTA[citta.toLowerCase()], nomeUtente: nomeUtente.toLowerCase(), email: email || null }
})

/** Nome utente senza trattini + 4 cifre casuali: "circonvallazione-appia" → "circonvallazioneappia-4821" */
const password = (nomeUtente) => `${nomeUtente.replace(/[^a-z0-9]/g, '')}-${String(randomInt(0, 10000)).padStart(4, '0')}`

// ---------- controlli ----------
const [{ data: uffici, error: e1 }, { data: utenti, error: e2 }] = await Promise.all([
  db.from('uffici').select('id, nome, citta_id'),
  db.from('utenti').select('nome_utente, email, ruolo, ufficio_id, auth_id'),
])
if (e1 || e2) { console.error('Impossibile leggere il database:', (e1 ?? e2).message); process.exit(1) }

const problemi = []
const visti = new Set()
for (const v of voci) {
  v.ufficioRec = uffici.find((u) => u.nome === v.ufficio && u.citta_id === v.cittaId)
  if (!v.cittaId) problemi.push(`riga ${v.riga}: città "${v.citta}" sconosciuta (Roma o Milano)`)
  else if (!v.ufficioRec) problemi.push(`riga ${v.riga}: l'ufficio "${v.ufficio}" non esiste a ${v.citta} sulla piattaforma`)
  if (!/^[a-z0-9][a-z0-9.-]{2,29}$/.test(v.nomeUtente)) problemi.push(`riga ${v.riga}: nome utente "${v.nomeUtente}" non valido`)
  if (visti.has(v.nomeUtente)) problemi.push(`riga ${v.riga}: nome utente "${v.nomeUtente}" ripetuto`)
  visti.add(v.nomeUtente)
  if (v.email && !/^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/.test(v.email)) problemi.push(`riga ${v.riga}: email "${v.email}" non valida`)
  v.utente = utenti.find((u) => u.nome_utente === v.nomeUtente)
  v.ufficioHaAccount = v.ufficioRec && utenti.some((u) => u.ufficio_id === v.ufficioRec.id && u.ruolo === 'ufficio')
}
if (problemi.length) {
  console.error(`Ci sono ${problemi.length} problemi in import/account.csv, correggili e riprova:\n- ${problemi.join('\n- ')}`)
  process.exit(1)
}

// ---------- credenziali ----------
function scriviCredenziali(risultati) {
  const cella = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`
  const messaggio = (v) => `Ciao! Da questa settimana i rapportini si inseriscono sulla piattaforma: ${SITO}  Nome utente: ${v.nomeUtente}  Password: ${v.password}  (puoi cambiarla cliccando sul nome dell'ufficio in alto a destra). Scadenza: domenica sera.`
  const csv = ['Ufficio;Città;Nome utente;Password;Email promemoria;Esito;Messaggio da inviare']
  for (const v of risultati) {
    csv.push([v.ufficio, v.citta, v.nomeUtente, v.password ?? '', v.email ?? '', v.esito, v.password ? messaggio(v) : ''].map(cella).join(';'))
  }
  writeFileSync('import/CREDENZIALI.csv', BOM + csv.join('\r\n'))
  const ok = risultati.filter((v) => v.password).length
  console.log(`\nFatto per ${ok} account su ${risultati.length}. Credenziali in import/CREDENZIALI.csv (aprilo con Excel o Numbers).`)
  console.log('Le password non sono salvate da nessun\'altra parte: conserva quel file in un posto sicuro.')
}

// ---------- nuove password per account esistenti ----------
if (REIMPOSTA) {
  const daAggiornare = voci.filter((v) => v.utente?.ruolo === 'ufficio')
  console.log(`${daAggiornare.length} account ufficio esistenti riceveranno una nuova password (es. ${password(daAggiornare[0]?.nomeUtente ?? 'somalia')}).`)
  if (!ESEGUI) {
    console.log('\nQuesta era una PROVA: nessuna password cambiata. Per cambiarle:  node scripts/crea-account.mjs --reimposta-password --esegui')
    process.exit(0)
  }
  let tutti = null   // elenco degli account di accesso, letto solo se serve
  const risultati = []
  for (const v of daAggiornare) {
    let id = v.utente.auth_id
    if (!id) {
      tutti ??= (await db.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users
      id = tutti.find((u) => u.email === v.utente.email)?.id
    }
    const pw = password(v.nomeUtente)
    const { error } = id ? await db.auth.admin.updateUserById(id, { password: pw }) : { error: { message: 'account di accesso non trovato' } }
    risultati.push(error ? { ...v, esito: `ERRORE: ${error.message}` } : { ...v, password: pw, esito: 'password aggiornata' })
    console.log(error ? `✗ ${v.ufficio}: ${error.message}` : `✓ ${v.ufficio}`)
  }
  scriviCredenziali(risultati)
  process.exit(0)
}

// ---------- creazione degli account mancanti ----------
const daCreare = voci.filter((v) => !v.utente)
console.log(`${voci.length} uffici nell'elenco: ${daCreare.length} account da creare, ${voci.length - daCreare.length} già esistenti (saltati).`)
console.log(`Senza email per i promemoria: ${daCreare.filter((v) => !v.email).map((v) => v.ufficio).join(', ') || 'nessuno'}`)
const doppi = daCreare.filter((v) => v.ufficioHaAccount)
if (doppi.length) console.log(`Attenzione, questi uffici hanno già un account con un altro nome utente: ${doppi.map((v) => v.ufficio).join(', ')}`)

if (!ESEGUI) {
  console.log('\nQuesta era una PROVA: non è stato creato nulla. Per creare gli account:  node scripts/crea-account.mjs --esegui')
  process.exit(0)
}

const risultati = []
for (const v of daCreare) {
  const pw = password(v.nomeUtente)
  // 1) scheda utente: l'email tecnica di accesso la genera il database dal nome utente
  const { data: nuovo, error: errUtente } = await db.from('utenti').insert({
    nome_utente: v.nomeUtente, nome: `Ufficio ${v.ufficio}`, ruolo: 'ufficio', ufficio_id: v.ufficioRec.id, email_promemoria: v.email,
  }).select('email').single()
  if (errUtente) { risultati.push({ ...v, esito: `ERRORE: ${errUtente.message}` }); console.log(`✗ ${v.ufficio}: ${errUtente.message}`); continue }
  // 2) account di accesso
  const { data: creato, error: errAuth } = await db.auth.admin.createUser({ email: nuovo.email, password: pw, email_confirm: true })
  if (errAuth) {
    await db.from('utenti').delete().eq('email', nuovo.email)
    risultati.push({ ...v, esito: `ERRORE: ${errAuth.message}` }); console.log(`✗ ${v.ufficio}: ${errAuth.message}`); continue
  }
  await db.from('utenti').update({ auth_id: creato.user.id }).eq('email', nuovo.email)
  risultati.push({ ...v, password: pw, esito: 'creato' })
  console.log(`✓ ${v.ufficio} → ${v.nomeUtente}`)
}
scriviCredenziali(risultati)
