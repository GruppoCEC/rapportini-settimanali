// =====================================================================
// IMPORT DELLO STORICO DAGLI EXCEL
// Uso: node scripts/importa-storico.mjs
//
// Legge i file in  import/<Città> <anno>/<Ufficio>.xlsx  (es. import/Roma 2026/Somalia.xlsx)
// e produce, senza toccare il database:
//   import/REPORT_IMPORT.md   → resoconto e anomalie da controllare
//   import/sql/IMPORTA_n.sql  → file da incollare in Supabase → SQL Editor, uno alla volta
//
// Regole:
//   - si importano solo obiettivi e risultati (esiti, totali e percentuali si ricalcolano);
//   - "n° settimana" del mese (regola ricavata dai file, 13/10/2026): la 1ª è la prima settimana
//     intera, cioè la settimana lun-dom che ha il giovedì nel mese. Se un ufficio ha compilato una
//     settimana in più a fine mese (es. "5ª di settembre" = 28/9–4/10), quella va alla settimana
//     seguente e il mese dopo slitta di una (la sua "1ª" diventa 5–11/10), purché non sfori;
//   - uffici con "settimane": "primo" in regole.json (es. Lanciani): la 1ª va dal giorno 1 alla
//     prima domenica; i due pezzi di una settimana a cavallo di due mesi si riuniscono;
//   - si importano solo settimane già concluse (le altre sono avanzi dell'anno prima);
//   - i dati già presenti sulla piattaforma NON vengono sovrascritti.
// =====================================================================
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { leggiFile, ZONA } from './leggi-excel.mjs'

const CARTELLA = 'import'
const UFFICI_PER_FILE = 8
const CITTA = { roma: 1, milano: 2 }
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const NOMI_VOCI = {
  app_vendita: 'App.ti Vendita', proposte: 'Proposte', incarichi: 'Incarichi', valutazioni: 'Valutazioni', vendite: 'Vendite',
  ribassi: 'Ribassi', im3: 'IM3', piu90: '+90', portafoglio: 'Portafoglio', incarichi_zona: 'Incarichi in zona',
  contatti_zona: 'Contatti zona', telefoni_mancanti: 'Telefoni mancanti', affittati: 'Affittati', vuoti: 'Vuoti',
}

// ---------- settimane (stessa regola di src/lib/settimane.ts) ----------
const GIORNO = 864e5
const iso = (d) => d.toISOString().slice(0, 10)
function settimaneDelMese(anno, mese) {
  const primo = new Date(Date.UTC(anno, mese - 1, 1))
  let lunedi = new Date(+primo - ((primo.getUTCDay() + 6) % 7) * GIORNO)
  const elenco = []
  for (let i = 0; i < 6; i++, lunedi = new Date(+lunedi + 7 * GIORNO)) {
    if (new Date(+lunedi + 3 * GIORNO).getUTCMonth() === mese - 1) elenco.push(iso(lunedi))
  }
  return elenco
}
/** Lunedì della settimana (lun-dom) che contiene la n-esima "settimana Excel" del mese, o null se fuori mese */
function lunediSettimanaExcel(anno, mese, n) {
  const primo = new Date(Date.UTC(anno, mese - 1, 1))
  const lunedi = new Date(+primo - ((primo.getUTCDay() + 6) % 7) * GIORNO + (n - 1) * 7 * GIORNO)
  const ultimo = new Date(Date.UTC(anno, mese, 0))
  return lunedi <= ultimo ? iso(lunedi) : null
}
/**
 * Regola standard con "settimana in più": restituisce la funzione (mese, n) → lunedì | null.
 * Una settimana in più a fine mese (n = settimane del mese + 1) passa alla prima settimana del mese
 * dopo, e il mese dopo slitta di una, solo se così facendo non sfora a sua volta.
 */
function mappaSettimaneStandard(anno, dati, note) {
  const maxRis = {}
  for (const d of dati) if (d.risultato !== null) maxRis[d.mese] = Math.max(maxRis[d.mese] ?? 0, d.settimanaExcel)
  const scarto = {}, inPiuOk = {}
  for (let m = 1; m <= 12; m++) {
    const n = settimaneDelMese(anno, m).length
    if ((maxRis[m] ?? 0) + (scarto[m] ?? 0) === n + 1 && m < 12) {
      const nDopo = settimaneDelMese(anno, m + 1).length
      if ((maxRis[m + 1] ?? 0) + 1 <= nDopo) {
        inPiuOk[m] = true
        scarto[m + 1] = 1
        note.push(`${MESI[m - 1]} ha una ${n + 1}ª settimana: è la settimana ${intervallo(settimaneDelMese(anno, m + 1)[0])}, e le settimane di ${MESI[m]} slittano di una`)
      }
    }
  }
  return (mese, n) => {
    const elenco = settimaneDelMese(anno, mese)
    const i = n - 1 + (scarto[mese] ?? 0)
    if (i < elenco.length) return elenco[i]
    if (i === elenco.length && inPiuOk[mese]) return settimaneDelMese(anno, mese + 1)[0]
    return null
  }
}

const oggi = new Date()
const lunediCorrente = (() => { const d = new Date(Date.UTC(oggi.getFullYear(), oggi.getMonth(), oggi.getDate())); return iso(new Date(+d - ((d.getUTCDay() + 6) % 7) * GIORNO)) })()
const intervallo = (lunedi) => {
  const a = new Date(`${lunedi}T00:00:00Z`), b = new Date(+a + 6 * GIORNO)
  const f = (d) => `${d.getUTCDate()} ${MESI[d.getUTCMonth()].slice(0, 3)}`
  return `${f(a)} – ${f(b)}`
}

// ---------- regole particolari (import/regole.json, facoltativo) ----------
// es. { "Imm. Garbatella": { "dal": "2026-10", "motivo": "…" } } → importa solo da ottobre 2026
const REGOLE = existsSync(join(CARTELLA, 'regole.json')) ? JSON.parse(readFileSync(join(CARTELLA, 'regole.json'), 'utf8')) : {}

// ---------- lettura ----------
const uffici = []
for (const cartella of readdirSync(CARTELLA, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== 'sql')) {
  const m = cartella.name.match(/^(roma|milano)\s+(\d{4})$/i)
  if (!m) { console.warn(`Cartella "${cartella.name}" ignorata: il nome deve essere "Roma 2026" o "Milano 2026"`); continue }
  const cittaId = CITTA[m[1].toLowerCase()], anno = Number(m[2])
  for (const file of readdirSync(join(CARTELLA, cartella.name)).filter((f) => /\.xlsx$/i.test(f) && !f.startsWith('~$')).sort((a, b) => a.localeCompare(b, 'it'))) {
    const nome = file.replace(/\.xlsx$/i, '').trim()
    process.stdout.write(`Lettura ${cartella.name}/${file}… `)
    const { foglio, dati, anomalie } = await leggiFile(join(CARTELLA, cartella.name, file), { unisciAnni: REGOLE[nome]?.unisciAnni })

    const regola = REGOLE[nome]
    const primoMese = regola?.dal ? Number(regola.dal.split('-')[1]) : 1
    let primaDelDal = 0
    const righe = new Map()           // chiave settimana|voce → riga
    const scartateFuture = new Map()  // mese → numero di valori
    const fuoriMese = []
    let riunite = 0
    const noteSettimane = []
    const settimanaDi = regola?.settimane === 'primo'
      ? (mese, n) => lunediSettimanaExcel(anno, mese, n)
      : mappaSettimaneStandard(anno, dati, noteSettimane)
    for (const d of dati) {
      const lunedi = settimanaDi(d.mese, d.settimanaExcel)
      if (!lunedi) {
        fuoriMese.push(`${MESI[d.mese - 1]}: ${d.settimanaExcel}ª settimana (${d.etichetta}) ma il mese non ha così tante settimane`)
        continue
      }
      if (lunedi >= lunediCorrente) { scartateFuture.set(d.mese, (scartateFuture.get(d.mese) ?? 0) + 1); continue }
      if (d.mese < primoMese) { primaDelDal++; continue }
      const chiave = `${lunedi}|${d.codice}`
      const gia = righe.get(chiave)
      if (gia) {
        if (gia.mese === d.mese) {
          anomalie.push({ riga: d.riga, mese: d.mese, testo: `"${d.etichetta}" ripetuta nella stessa settimana: tenuta solo la prima riga` })
          continue
        }
        // Settimana a cavallo di due mesi: si riuniscono i due pezzi
        riunite++
        const somma = (a, b) => (a === null && b === null ? null : (a ?? 0) + (b ?? 0))
        if (ZONA.has(d.codice)) { if (d.mese > gia.mese && d.risultato !== null) gia.risultato = d.risultato }
        else { gia.obiettivo = somma(gia.obiettivo, d.obiettivo); gia.risultato = somma(gia.risultato, d.risultato) }
        continue
      }
      righe.set(chiave, { settimana: lunedi, metrica: d.codice, mese: d.mese, obiettivo: ZONA.has(d.codice) ? null : d.obiettivo, risultato: d.risultato })
    }
    for (const t of noteSettimane) anomalie.unshift({ riga: 0, testo: t, slittamento: true })
    if (regola?.settimane === 'primo') anomalie.unshift({ riga: 0, testo: 'regola particolare: settimane dal giorno 1 alla prima domenica (come compilato in questo file)' })
    if (riunite) anomalie.push({ riga: 0, testo: `${riunite} valori di settimane a cavallo di due mesi riuniti nella stessa settimana lun-dom (attività sommate)`, riunione: true })
    const elenco = [...righe.values()].map(({ mese, ...x }) => x).sort((a, b) => a.settimana.localeCompare(b.settimana) || a.metrica.localeCompare(b.metrica))
    const settimaneConDati = [...new Set(elenco.filter((r) => r.risultato !== null).map((r) => r.settimana))].sort()
    if (regola?.dal) anomalie.unshift({ riga: 0, testo: `regola particolare: importato solo da ${MESI[primoMese - 1]} ${anno} in poi (${regola.motivo ?? 'indicazione di Davide'}); ${primaDelDal} valori dei mesi precedenti NON importati` })
    uffici.push({ nome, cittaId, citta: m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(), anno, file, foglio, righe: elenco, settimaneConDati, anomalie, scartateFuture, fuoriMese })
    console.log(`${elenco.length} valori, ${settimaneConDati.length} settimane`)
  }
}

// ---------- file quasi identici (probabile file sbagliato): esclusi finché non si chiarisce ----------
const firma = (u) => new Set(u.righe.filter((x) => x.risultato !== null).map((x) => `${x.settimana}|${x.metrica}|${x.risultato}`))
const quasiIdentici = []
for (let i = 0; i < uffici.length; i++) for (let j = i + 1; j < uffici.length; j++) {
  const a = firma(uffici[i]), b = firma(uffici[j])
  const comuni = [...a].filter((x) => b.has(x)).length
  const somiglianza = comuni / Math.max(1, Math.min(a.size, b.size))
  if (somiglianza >= 0.9) {
    quasiIdentici.push({ a: uffici[i], b: uffici[j], somiglianza })
    uffici[i].escluso = uffici[j].escluso = true
  }
}
const daCaricare = uffici.filter((u) => !u.escluso)

// ---------- resoconto ----------
const r = []
const totaleValori = daCaricare.reduce((s, u) => s + u.righe.length, 0)
r.push('# Resoconto import dello storico', '')
r.push(`Generato il ${new Date().toLocaleString('it-IT')} da \`scripts/importa-storico.mjs\`. **Nulla è ancora stato caricato sulla piattaforma.**`, '')
r.push('## In sintesi', '')
r.push(`- **${daCaricare.length} uffici** (${daCaricare.filter((u) => u.cittaId === 1).length} Roma, ${daCaricare.filter((u) => u.cittaId === 2).length} Milano), **${totaleValori.toLocaleString('it-IT')} valori** da importare${quasiIdentici.length ? ` (${uffici.length - daCaricare.length} file esclusi, vedi sotto)` : ''}.`)
r.push(`- Si importano solo le **settimane concluse**: fino a quella iniziata il ${new Date(+new Date(`${lunediCorrente}T00:00:00Z`) - 7 * GIORNO).toLocaleDateString('it-IT')}.`)
r.push('- **Settimane dell\'Excel** (regola ricavata dai file): la 1ª settimana del mese è la prima settimana intera, lunedì–domenica, col giovedì nel mese. Ad esempio la 1ª di febbraio 2026 è il 2–8 febbraio e la 1ª di ottobre il 28 settembre – 4 ottobre.')
r.push('- Se un ufficio ha compilato una **settimana in più** a fine mese (es. una "5ª di settembre"), quella è la settimana seguente (28 settembre – 4 ottobre) e la sua "1ª di ottobre" diventa il 5–11 ottobre.')
const conSlittamento = uffici.filter((u) => u.anomalie.some((a) => a.slittamento))
if (conSlittamento.length) r.push(`  Uffici con settimane slittate: ${conSlittamento.map((u) => u.nome).join(', ')}.`)
const conPrimo = Object.entries(REGOLE).filter(([, v]) => v?.settimane === 'primo').map(([k]) => k)
if (conPrimo.length) r.push(`- Seguono invece la regola "dal giorno 1 alla prima domenica": ${conPrimo.join(', ')}. Le mezze settimane a cavallo di due mesi si riuniscono.`)
r.push('- Si importano **solo obiettivi e risultati**: esiti, totali del mese e quote di mercato si ricalcolano, quindi gli errori #DIV/0! e #VALORE! spariscono.')
r.push('- I dati già inseriti sulla piattaforma **non vengono toccati**: si aggiunge solo ciò che manca.', '')

if (quasiIdentici.length) {
  r.push('## ⛔ File quasi identici (ESCLUSI dal caricamento)', '')
  r.push('Questi file hanno quasi tutti i valori uguali: probabilmente uno dei due è il file sbagliato, cioè una copia salvata col nome dell\'altro ufficio. Non li carico finché non mi dici qual è quello giusto e mi mandi l\'altro.', '')
  for (const q of quasiIdentici) r.push(`- **${q.a.nome}** e **${q.b.nome}** (${q.a.citta}): ${Math.round(q.somiglianza * 100)}% dei risultati identici`)
  r.push('')
}

const dueAnni = uffici.filter((u) => u.anomalie.some((a) => a.annoPrecedente) && !REGOLE[u.nome]?.unisciAnni)
if (dueAnni.length) {
  r.push('## 📅 File che contengono due anni', '')
  r.push('In questi file sotto l\'anno precedente (gennaio–dicembre, con novembre e dicembre compilati) c\'è un secondo blocco gennaio–ottobre. Importo **solo il secondo blocco**, cioè il 2026.', '')
  r.push('| Ufficio | Settimane 2026 importate | Ultima settimana |', '|---|---:|---|')
  for (const u of dueAnni) r.push(`| ${u.nome} | ${u.settimaneConDati.length} | ${u.settimaneConDati.at(-1) ? intervallo(u.settimaneConDati.at(-1)) : '—'} |`)
  const pochi = dueAnni.filter((u) => u.settimaneConDati.length < 8)
  if (pochi.length) r.push('', `⚠️ ${pochi.map((u) => `**${u.nome}**`).join(', ')}: del 2026 c'è pochissimo. Forse il 2026 è stato compilato in un altro file: se esiste, mandamelo.`)
  r.push('')
}

const futuri = uffici.filter((u) => u.scartateFuture.size > 0)
if (futuri.length) {
  r.push('## ⚠️ Dati in settimane non ancora concluse (NON importati)', '')
  r.push(`In ${futuri.length} file ci sono valori in settimane che devono ancora finire. Quasi certamente sono **avanzi del 2025** rimasti nel modello Excel. Verifica a campione uno di questi file: se invece sono dati veri, dimmelo.`, '')
  r.push('| Ufficio | Mesi con valori "futuri" |', '|---|---|')
  for (const u of futuri) r.push(`| ${u.nome} | ${[...u.scartateFuture].map(([m, n]) => `${MESI[m - 1]} (${n})`).join(', ')} |`)
  r.push('')
}

const sconosciute = new Map()
for (const u of uffici) for (const a of u.anomalie) {
  const m = a.testo.match(/^riga "(.*)" non riconosciuta/)
  if (m) { const k = m[1].trim(); const x = sconosciute.get(k) ?? new Set(); x.add(u.nome); sconosciute.set(k, x) }
}
if (sconosciute.size) {
  r.push('## ❓ Righe non riconosciute (NON importate: dimmi tu cosa sono)', '')
  r.push('Queste righe non corrispondono a nessuna voce della piattaforma. Se qualcuna va importata, dimmi a quale voce corrisponde, oppure se serve una voce nuova.', '')
  r.push('| Nome della riga | In quali file |', '|---|---|')
  for (const [k, v] of [...sconosciute].sort((a, b) => b[1].size - a[1].size)) r.push(`| "${k}" | ${[...v].join(', ')} |`)
  r.push('')
}

r.push('## Uffici', '')
r.push('| Città | Ufficio | Valori | Settimane con risultati | Dal | Al | Anomalie |', '|---|---|---:|---:|---|---|---:|')
for (const u of uffici) {
  const n = u.anomalie.filter((a) => !/non riconosciuta/.test(a.testo)).length + u.fuoriMese.length
  r.push(`| ${u.citta} | ${u.escluso ? `~~${u.nome}~~ (escluso)` : u.nome} | ${u.righe.length} | ${u.settimaneConDati.length} | ${u.settimaneConDati[0] ? intervallo(u.settimaneConDati[0]) : '—'} | ${u.settimaneConDati.at(-1) ? intervallo(u.settimaneConDati.at(-1)) : '—'} | ${n || ''} |`)
}
r.push('')

r.push('## Dettaglio anomalie per ufficio', '')
r.push('Correzioni fatte in automatico ("spostato", "letto come", "arrotondato") e valori scartati ("ignorato"). Il numero di riga è quello del file Excel.', '')
for (const u of uffici) {
  const voci = [
    ...u.fuoriMese.map((t) => `- ${t} → **non importato**`),
    ...u.anomalie.filter((a) => !/non riconosciuta/.test(a.testo))
      .map((a) => `- ${a.riga ? `riga ${a.riga}` : 'nota'}${a.mese ? `, ${MESI[a.mese - 1]}` : ''}${a.settimana ? ` ${a.settimana}ª sett.` : ''}: ${a.testo}`),
  ]
  if (!voci.length) continue
  r.push(`### ${u.nome} (${u.citta})`, '', ...voci, '')
}
writeFileSync(join(CARTELLA, 'REPORT_IMPORT.md'), r.join('\n'))

// ---------- file SQL ----------
const q = (s) => `'${String(s).replace(/'/g, "''")}'`
const n = (v) => (v === null || v === undefined ? 'null' : String(v))
rmSync(join(CARTELLA, 'sql'), { recursive: true, force: true })
mkdirSync(join(CARTELLA, 'sql'))
const gruppi = []
for (let i = 0; i < daCaricare.length; i += UFFICI_PER_FILE) gruppi.push(daCaricare.slice(i, i + UFFICI_PER_FILE))
gruppi.forEach((g, i) => {
  const s = []
  s.push(`-- IMPORT STORICO ${i + 1} di ${gruppi.length}: ${g.map((u) => u.nome).join(', ')}`)
  s.push('-- Da incollare in Supabase → SQL Editor → New query → Run. Si può rieseguire senza creare doppioni.')
  s.push('begin;')
  s.push('-- durante l\'import non si registra ogni riga nel registro modifiche')
  s.push('alter table rilevazioni disable trigger rilevazioni_registro;')
  s.push('alter table rilevazioni disable trigger rilevazioni_prima;')
  s.push('')
  s.push('-- 1) uffici (creati solo se non esistono già)')
  s.push('insert into uffici (nome, citta_id)')
  s.push('select v.nome, v.citta_id from (values')
  s.push(g.map((u) => `  (${q(u.nome)}, ${u.cittaId})`).join(',\n'))
  s.push(') as v(nome, citta_id)')
  s.push('where not exists (select 1 from uffici u where u.nome = v.nome and u.citta_id = v.citta_id);')
  s.push('')
  s.push('-- 2) dati settimanali (quelli già presenti sulla piattaforma non vengono toccati)')
  s.push('insert into rilevazioni (ufficio_id, settimana, metrica, obiettivo, risultato, aggiornato_da, aggiornato_il)')
  s.push("select u.id, v.settimana::date, v.metrica, v.obiettivo, v.risultato, 'import excel', now()")
  s.push('from (values')
  const valori = []
  for (const u of g) for (const x of u.righe) valori.push(`  (${q(u.nome)}, ${u.cittaId}, '${x.settimana}', '${x.metrica}', ${n(x.obiettivo)}, ${n(x.risultato)})`)
  s.push(valori.join(',\n'))
  s.push(') as v(nome, citta_id, settimana, metrica, obiettivo, risultato)')
  s.push('join uffici u on u.nome = v.nome and u.citta_id = v.citta_id')
  s.push('on conflict (ufficio_id, settimana, metrica) do nothing;')
  s.push('')
  s.push('alter table rilevazioni enable trigger rilevazioni_registro;')
  s.push('alter table rilevazioni enable trigger rilevazioni_prima;')
  s.push('commit;')
  s.push('')
  s.push(`-- Controllo: deve elencare ${g.length} uffici con il numero di valori importati`)
  s.push('select u.nome, count(r.*) as valori from uffici u left join rilevazioni r on r.ufficio_id = u.id')
  s.push(`where (u.nome, u.citta_id) in (${g.map((u) => `(${q(u.nome)}, ${u.cittaId})`).join(', ')})`)
  s.push('group by u.nome order by u.nome;')
  writeFileSync(join(CARTELLA, 'sql', `IMPORTA_${i + 1}.sql`), s.join('\n') + '\n')
})

writeFileSync(join(CARTELLA, 'sql', 'righe.json'), JSON.stringify(daCaricare.flatMap((u) => u.righe.map((x) => ({ ufficio: u.nome, citta_id: u.cittaId, ...x })))))

console.log(`\nFatto: ${daCaricare.length} uffici da caricare (${uffici.length - daCaricare.length} esclusi), ${totaleValori} valori.`)
console.log(`Resoconto: ${join(CARTELLA, 'REPORT_IMPORT.md')}`)
console.log(`File da caricare: ${gruppi.map((_, i) => `sql/IMPORTA_${i + 1}.sql`).join(', ')}`)
