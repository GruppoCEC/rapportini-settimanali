// =====================================================================
// CREAZIONE IN BLOCCO DEGLI ACCOUNT DEGLI UFFICI
//
//   node scripts/crea-account.mjs            → prova: controlla l'elenco, non crea nulla
//   node scripts/crea-account.mjs --esegui   → crea davvero gli account
//
// Legge import/account.csv (ufficio;citta;nome_utente;email_promemoria;note)
// e scrive import/CREDENZIALI.csv con nome utente, password e un messaggio
// pronto da inviare a ogni ufficio. Gli account già esistenti vengono saltati.
//
// Serve la chiave SEGRETA di Supabase nel file .env.local (mai su GitHub, mai in chat):
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY=sb_secret_...
// =====================================================================
import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const ESEGUI = process.argv.includes('--esegui')
const SITO = 'https://gruppocec.github.io/rapportini-settimanali/'
const CITTA = { roma: 1, milano: 2 }

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
if (!url || !chiave) {
  console.error('Mancano VITE_SUPABASE_URL e/o SUPABASE_SERVICE_KEY nel file .env.local (vedi le istruzioni in cima a questo file).')
  process.exit(1)
}
const db = createClient(url, chiave, { auth: { persistSession: false, autoRefreshToken: false } })

// ---------- elenco ----------
const righe = readFileSync('import/account.csv', 'utf8').split(/\r?\n/).filter((r) => r.trim())
const [intestazione, ...dati] = righe
if (!/^ufficio;citta;nome_utente;email_promemoria/i.test(intestazione)) {
  console.error('import/account.csv: la prima riga deve essere "ufficio;citta;nome_utente;email_promemoria;note"')
  process.exit(1)
}
const voci = dati.map((r, i) => {
  const [ufficio, citta, nomeUtente, email] = r.split(';').map((x) => (x ?? '').trim())
  return { riga: i + 2, ufficio, citta, cittaId: CITTA[citta.toLowerCase()], nomeUtente: nomeUtente.toLowerCase(), email: email || null }
})

const PAROLE = ['sole', 'mare', 'casa', 'luna', 'vento', 'fiore', 'monte', 'lago', 'porto', 'ponte',
  'stella', 'faro', 'nuvola', 'bosco', 'prato', 'torre', 'piazza', 'fiume', 'isola', 'onda']
const password = () => `${PAROLE[randomInt(PAROLE.length)]}${randomInt(10, 100)}${PAROLE[randomInt(PAROLE.length)]}`

// ---------- controlli ----------
const [{ data: uffici, error: e1 }, { data: utenti, error: e2 }] = await Promise.all([
  db.from('uffici').select('id, nome, citta_id'),
  db.from('utenti').select('nome_utente, ufficio_id, ruolo'),
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
  v.esiste = utenti.some((u) => u.nome_utente === v.nomeUtente)
  v.ufficioHaAccount = v.ufficioRec && utenti.some((u) => u.ufficio_id === v.ufficioRec.id && u.ruolo === 'ufficio')
}
if (problemi.length) {
  console.error(`Ci sono ${problemi.length} problemi in import/account.csv, correggili e riprova:\n- ${problemi.join('\n- ')}`)
  process.exit(1)
}

const daCreare = voci.filter((v) => !v.esiste)
console.log(`${voci.length} uffici nell'elenco: ${daCreare.length} account da creare, ${voci.length - daCreare.length} già esistenti (saltati).`)
console.log(`Senza email per i promemoria: ${daCreare.filter((v) => !v.email).map((v) => v.ufficio).join(', ') || 'nessuno'}`)
const doppi = daCreare.filter((v) => v.ufficioHaAccount)
if (doppi.length) console.log(`Attenzione, questi uffici hanno già un account con un altro nome utente: ${doppi.map((v) => v.ufficio).join(', ')}`)

if (!ESEGUI) {
  console.log('\nQuesta era una PROVA: non è stato creato nulla. Per creare gli account:  node scripts/crea-account.mjs --esegui')
  process.exit(0)
}

// ---------- creazione ----------
const risultati = []
for (const v of daCreare) {
  const pw = password()
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

// ---------- credenziali ----------
const cella = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`
const messaggio = (v) => `Ciao! Da questa settimana i rapportini si inseriscono sulla piattaforma: ${SITO}  Nome utente: ${v.nomeUtente}  Password: ${v.password}  (puoi cambiarla cliccando sul nome dell'ufficio in alto a destra). Scadenza: domenica sera.`
const csv = ['Ufficio;Città;Nome utente;Password;Email promemoria;Esito;Messaggio da inviare']
for (const v of risultati) {
  csv.push([v.ufficio, v.citta, v.nomeUtente, v.password ?? '', v.email ?? '', v.esito, v.password ? messaggio(v) : ''].map(cella).join(';'))
}
writeFileSync('import/CREDENZIALI.csv', '﻿' + csv.join('\r\n'))   // ﻿: Excel legge bene gli accenti
const ok = risultati.filter((v) => v.esito === 'creato').length
console.log(`\nCreati ${ok} account su ${daCreare.length}. Credenziali in import/CREDENZIALI.csv (aprilo con Excel o Numbers).`)
console.log('Le password non sono salvate da nessun\'altra parte: conserva quel file in un posto sicuro.')
