// =====================================================================
// RICARICA DELLO STORICO NEL DATABASE
//
//   node scripts/ricarica-storico.mjs            → prova: conta cosa verrebbe sostituito
//   node scripts/ricarica-storico.mjs --esegui   → sostituisce i dati importati dagli Excel
//
// Prima esegui  node scripts/importa-storico.mjs  (crea import/sql/righe.json).
// Sostituisce SOLO i dati arrivati dagli Excel, cioè senza un utente della piattaforma
// come autore. I dati inseriti dagli uffici sulla piattaforma non vengono toccati: se esiste
// già un valore per quella settimana, resta quello dell'ufficio.
// Serve SUPABASE_SERVICE_KEY in .env.local (vedi scripts/crea-account.mjs).
// =====================================================================
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'

const ESEGUI = process.argv.includes('--esegui')
const env = { ...process.env }
if (existsSync('.env.local')) {
  for (const riga of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = riga.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m && !env[m[1]]) env[m[1]] = m[2]
  }
}
if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY === 'INCOLLA_QUI') {
  console.error('Mancano VITE_SUPABASE_URL e/o SUPABASE_SERVICE_KEY nel file .env.local'); process.exit(1)
}
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
const nuove = JSON.parse(readFileSync('import/sql/righe.json', 'utf8'))

async function tutte(tabella, colonne, filtro = (q) => q) {
  const righe = []
  for (let da = 0; ; da += 1000) {
    const { data, error } = await filtro(db.from(tabella).select(colonne)).range(da, da + 999)
    if (error) throw new Error(`${tabella}: ${error.message}`)
    righe.push(...data)
    if (data.length < 1000) return righe
  }
}

const uffici = await tutte('uffici', 'id, nome, citta_id')
const idUfficio = new Map(uffici.map((u) => [`${u.nome}|${u.citta_id}`, u.id]))
const mancanti = [...new Set(nuove.filter((r) => !idUfficio.has(`${r.ufficio}|${r.citta_id}`)).map((r) => r.ufficio))]
if (mancanti.length) { console.error(`Uffici non presenti sulla piattaforma: ${mancanti.join(', ')}`); process.exit(1) }

// Dati attuali: "importati" = autore 'import excel' (caricati da SQL) o senza autore (caricati da questo programma)
const attuali = await tutte('rilevazioni', 'ufficio_id, settimana, metrica, aggiornato_da')
const importati = attuali.filter((r) => r.aggiornato_da === null || r.aggiornato_da === 'import excel')
const dellaPiattaforma = attuali.filter((r) => !(r.aggiornato_da === null || r.aggiornato_da === 'import excel'))
console.log(`Nel database: ${attuali.length} valori, di cui ${importati.length} importati dagli Excel e ${dellaPiattaforma.length} inseriti sulla piattaforma (questi restano).`)
console.log(`Nuovi valori da caricare: ${nuove.length}`)
if (!ESEGUI) { console.log('\nQuesta era una PROVA: nulla è stato modificato. Per eseguire:  node scripts/ricarica-storico.mjs --esegui'); process.exit(0) }

const inizio = new Date().toISOString()

// 1) cancella i valori importati (a blocchi, per ufficio)
for (const u of uffici) {
  for (const autore of ['import excel', null]) {
    let q = db.from('rilevazioni').delete().eq('ufficio_id', u.id)
    q = autore === null ? q.is('aggiornato_da', null) : q.eq('aggiornato_da', autore)
    const { error } = await q
    if (error) { console.error(`Cancellazione ${u.nome}: ${error.message}`); process.exit(1) }
  }
}
console.log('✓ valori importati cancellati')

// 2) carica i nuovi (i valori inseriti dagli uffici hanno la precedenza)
const righe = nuove.map((r) => ({
  ufficio_id: idUfficio.get(`${r.ufficio}|${r.citta_id}`), settimana: r.settimana, metrica: r.metrica, obiettivo: r.obiettivo, risultato: r.risultato,
}))
for (let i = 0; i < righe.length; i += 500) {
  const { error } = await db.from('rilevazioni').upsert(righe.slice(i, i + 500), { onConflict: 'ufficio_id,settimana,metrica', ignoreDuplicates: true })
  if (error) { console.error(`Caricamento (blocco ${i / 500 + 1}): ${error.message}`); process.exit(1) }
}
console.log(`✓ ${righe.length} valori caricati`)

// 3) il registro modifiche non deve riempirsi con migliaia di righe dovute alla ricarica
const { error: errStorico } = await db.from('storico_modifiche').delete().gte('quando', inizio).is('utente', null)
console.log(errStorico ? `(registro modifiche non ripulito: ${errStorico.message})` : '✓ registro modifiche ripulito')

const { count } = await db.from('rilevazioni').select('*', { count: 'exact', head: true })
console.log(`\nFatto. Valori ora nel database: ${count}.`)
