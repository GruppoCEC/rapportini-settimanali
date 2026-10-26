// =====================================================================
// Storico del rapportino mensile dal file Excel annuale di gruppo
// (es. "Rapportini mensili/BIGOLI C.E.C. ANNO 2026.xlsx").
// Un foglio per mese (Gennaio … Dicembre), con:
//   righe 4–45 e 48–53: una riga per ufficio, nell'ordine del report di gruppo
//                       (stesse posizioni di import/sql/ORDINE_MENSILE.sql);
//   riga "TOTALE":      somma calcolata dall'Excel (serve solo come controllo);
//   riga "<Mese> 2025": i totali di gruppo dello stesso mese dell'anno prima.
// Produce import/sql/STORICO_MENSILE_<anno>.sql, da incollare in Supabase dopo
// 009_storico_mensile.sql, e import/REPORT_MENSILE_<anno>.md con i controlli.
// Uso: node scripts/importa-mensile-excel.mjs "Rapportini mensili/BIGOLI C.E.C. ANNO 2026.xlsx"
// =====================================================================
import ExcelJS from 'exceljs'
import { writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const FILE = process.argv[2]
if (!FILE) { console.error('Indica il file Excel annuale.'); process.exit(1) }

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

// Colonne B…U → voce della piattaforma, con il controllo sull'intestazione (righe 2 e 3 unite)
const COLONNE = [
  ['staff', /staff/], ['portafoglio_vendita', /portaf.*vendita/], ['portafoglio_locazione', /^locaz/],
  ['acquisizioni', /acquisizioni/], ['appuntamenti_vendita', /appuntamenti.*vendita/], ['appuntamenti_locazione', /^locaz/],
  ['incarichi_vendita', /incarichi.*vendita/], ['incarichi_locazione', /^locaz/], ['gestione_incarichi', /gestione.*incarichi/],
  ['ribassi', /ribassi/], ['kiron', /kiron/], ['colloqui', /colloqui/],
  ['proposte_vendita', /proposte.*vendita/], ['proposte_locazione', /^locaz/],
  ['accettazioni_vendita', /accettazioni.*vendita/], ['accettazioni_locazione', /^locaz/],
  ['vendite_effettuate', /vendite effettuate/], ['richieste_vendita', /richieste.*vendita/], ['richieste_locazione', /^locaz/],
  ['incarichi_scaduti', /incarichi.*scaduti/],
]

// Riga dell'Excel → ufficio sulla piattaforma (città, nome) e controllo sul nome scritto nell'Excel.
// Abbinamenti confermati da Davide il 14/10/2026 (vedi ORDINE_MENSILE.sql).
const UFFICI = [
  [4, 'Roma', 'Casal De\' Pazzi', /casal de/], [5, 'Roma', 'Casalbertone', /casalbertone/], [6, 'Roma', 'Casalbruciato', /casalbruciato/],
  [7, 'Roma', 'Verderocca', /verderocca/], [8, 'Roma', 'Imm. Conca D\'Oro', /^conca d'oro$/], [9, 'Roma', 'Montesacro', /montesacro/],
  [10, 'Roma', 'Lanciani', /lanciani/], [11, 'Roma', 'Jonio', /jonio/], [12, 'Roma', 'Merulana', /merulana/],
  [13, 'Roma', 'S. Lorenzo', /lorenzo/], [14, 'Roma', 'Ippocrate', /ippocrate/], [15, 'Roma', 'San Giovanni', /^san giovanni/],
  [16, 'Roma', 'Somalia', /somalia/], [17, 'Roma', 'Verbano', /verbano/], [18, 'Roma', 'Cavour', /cavour/],
  [19, 'Roma', 'Caffarella', /caffarella/], [20, 'Milano', 'Umbria', /umbria/], [21, 'Milano', 'Tito Livio', /tito livio/],
  [22, 'Roma', 'Esquilino', /esquilino/], [23, 'Milano', 'Bocconi', /bocconi/], [24, 'Roma', 'Magna Grecia', /magna grecia/],
  [25, 'Roma', 'Castani', /castani/], [26, 'Roma', 'Conca D\'Oro 2', /conca d'oro 2/], [27, 'Milano', 'Beato Angelico', /beato angelico/],
  [28, 'Roma', 'Re di Roma', /re di roma/], [29, 'Roma', 'Circ. Appia', /appia/], [30, 'Roma', 'Trastevere', /trastevere/],
  [31, 'Roma', 'Taranto', /taranto/], [33, 'Roma', 'S.M Ausiliatrice', /ausiliatrice/], [34, 'Milano', 'Ticinese', /ticinese/],
  [35, 'Roma', 'Prati delle Vittorie', /prati delle vittorie/], [36, 'Roma', 'Marconi', /marconi/], [37, 'Milano', 'San Donato', /san donato/],
  [38, 'Roma', 'Quadraro', /quadraro/], [39, 'Roma', 'Ostiense', /ostiense aventino/], [40, 'Roma', 'Lamaro', /lamaro/],
  [41, 'Milano', 'Corsica', /corsica/], [42, 'Milano', 'Ungheria', /ungheria/], [43, 'Roma', 'Garbatella', /^garbatella$/],
  [44, 'Roma', 'Testaccio', /testaccio/], [45, 'Milano', 'Navigli', /navigli/],
  [48, 'Roma', 'Industriale S.Giovanni', /^ind.*giovanni/], [49, 'Roma', 'Oderisi', /oderisi/], [50, 'Roma', 'Villa Bonelli', /villa bonelli/],
  [51, 'Roma', 'Espero', /espero/], [52, 'Roma', 'Villa Lais', /villa lais/], [53, 'Roma', 'Garbatella-Ostiense', /garbatella-ostiense/],
]
// Righe dell'Excel senza ufficio sulla piattaforma: si saltano, ma se hanno numeri si segnalano
const SENZA_UFFICIO = [[32, 'St. Appio Latino', /appio latino/]]

/** Nome dell'Excel ripulito: minuscolo, senza "St.", "Mi", "Imm." davanti e senza spazi doppi */
const pulisci = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  .replace(/^(mi\.?\s+)?(st\.\s*)?(imm(obiliare)?\.?\s+)?/, '').trim()

function valore(cella) {
  let v = cella.value
  if (v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v)) v = v.result   // formula: vale il risultato salvato (vuoto se non c'è)
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) throw new Error(`Valore non valido in ${cella.address}: ${JSON.stringify(cella.value)}`)
  return n
}

const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(FILE)
const errori = [], avvisi = [], report = []
const storico = []                 // { citta, ufficio, mese, voce, valore }
const confronto = []               // { mese, voce, valore }
let anno = null

for (const ws of wb.worksheets) {
  const m = MESI.indexOf(ws.name.trim().toLowerCase())
  if (m < 0) continue              // il foglio "annuale" è solo una somma dei mesi
  // intestazioni: le 20 colonne devono essere quelle attese
  COLONNE.forEach(([voce, controllo], i) => {
    const testo = pulisci(`${ws.getRow(2).getCell(i + 2).text} ${ws.getRow(3).getCell(i + 2).text}`)
    const sotto = pulisci(ws.getRow(3).getCell(i + 2).text)
    if (!controllo.test(testo) && !controllo.test(sotto)) errori.push(`${ws.name}: la colonna ${ws.getRow(2).getCell(i + 2).address} ("${testo}") non sembra "${voce}"`)
  })

  // riga "<Mese> <anno prima>" → anno del file e confronto
  let rigaAnnoPrima = null
  ws.eachRow((row) => { const t = pulisci(row.getCell(1).text); if (new RegExp(`^${MESI[m]} (\\d{4})$`).test(t)) rigaAnnoPrima = row })
  if (!rigaAnnoPrima) { errori.push(`${ws.name}: manca la riga "${ws.name} <anno prima>"`); continue }
  const annoPrima = Number(pulisci(rigaAnnoPrima.getCell(1).text).slice(-4))
  anno ??= annoPrima + 1
  if (annoPrima + 1 !== anno) errori.push(`${ws.name}: la riga dell'anno prima è del ${annoPrima}, non del ${anno - 1}`)
  const mese = `${anno}-${String(m + 1).padStart(2, '0')}-01`
  const meseAnnoPrima = `${anno - 1}-${String(m + 1).padStart(2, '0')}-01`
  COLONNE.forEach(([voce], i) => {
    const v = valore(rigaAnnoPrima.getCell(i + 2))
    if (v !== null) confronto.push({ mese: meseAnnoPrima, voce, valore: v })
  })

  // uffici
  const somma = new Map()
  let conNumeri = 0
  for (const [riga, citta, ufficio, controllo] of UFFICI) {
    const row = ws.getRow(riga)
    const nome = pulisci(row.getCell(1).text)
    if (!controllo.test(nome)) { errori.push(`${ws.name}, riga ${riga}: c'è "${row.getCell(1).text.trim()}", ci si aspettava ${ufficio}`); continue }
    const valori = COLONNE.map(([voce], i) => [voce, valore(row.getCell(i + 2))]).filter(([, v]) => v !== null)
    if (valori.length === 0) continue
    conNumeri++
    for (const [voce, v] of valori) {
      storico.push({ citta, ufficio, mese, voce, valore: v })
      somma.set(voce, (somma.get(voce) ?? 0) + v)
    }
  }
  for (const [riga, nome, controllo] of SENZA_UFFICIO) {
    const row = ws.getRow(riga)
    if (!controllo.test(pulisci(row.getCell(1).text))) { errori.push(`${ws.name}, riga ${riga}: ci si aspettava ${nome}`); continue }
    const pieni = COLONNE.filter((_, i) => valore(row.getCell(i + 2)) !== null).length
    if (pieni > 0) avvisi.push(`${ws.name}: ${nome} ha ${pieni} numeri ma non è sulla piattaforma, quindi non è stato importato`)
  }
  if (conNumeri === 0) { report.push(`| ${ws.name} | — | mese vuoto, non importato | ${confronto.filter((c) => c.mese === meseAnnoPrima).length} |`); continue }

  // controllo con la riga TOTALE dell'Excel
  let rigaTotale = null
  ws.eachRow((row) => { if (pulisci(row.getCell(1).text) === 'totale') rigaTotale = row })
  const diverse = rigaTotale ? COLONNE.flatMap(([voce], i) => {
    const excel = valore(rigaTotale.getCell(i + 2)) ?? 0
    const nostro = somma.get(voce) ?? 0
    return excel === nostro ? [] : [`${voce} ${nostro} (Excel ${excel})`]
  }) : ['riga TOTALE non trovata']
  report.push(`| ${ws.name} | ${conNumeri} | ${diverse.length === 0 ? 'uguale al TOTALE dell\'Excel' : diverse.join(', ')} | ${confronto.filter((c) => c.mese === meseAnnoPrima).length} |`)
}

if (errori.length) {
  console.error('Il file non è come previsto, non ho prodotto nulla:\n- ' + errori.join('\n- '))
  process.exit(1)
}

// ---------------------------------------------------------------- SQL
const testo = (s) => `'${String(s).replace(/'/g, "''")}'`
const mesi = [...new Set(storico.map((s) => s.mese))].sort()
const sql = [
  `-- FILE GENERATO da scripts/importa-mensile-excel.mjs da "${basename(FILE)}" — non modificarlo a mano.`,
  `-- Storico del rapportino mensile ${anno}: totali di ogni ufficio (${mesi.length} mesi) e confronto con il ${anno - 1}.`,
  '-- Da incollare in Supabase → SQL Editor DOPO 009_storico_mensile.sql. Si può rieseguire:',
  '-- ricarica da capo i mesi del file. Se un ufficio non si trova, si ferma senza cambiare nulla.',
  'do $$',
  'declare mancanti text;',
  'begin',
  `  if to_regclass('public.totali_mensili_storico') is null then`,
  `    raise exception 'Manca la tabella dello storico: esegui prima supabase/migrations/009_storico_mensile.sql';`,
  '  end if;',
  '  create temp table if not exists _storico (citta text, ufficio text, mese date, voce text, valore int);',
  '  truncate _storico;',
  '  insert into _storico values',
  storico.map((s) => `    (${testo(s.citta)}, ${testo(s.ufficio)}, '${s.mese}', '${s.voce}', ${s.valore})`).join(',\n') + ';',
  '',
  '  select string_agg(distinct s.ufficio || \' (\' || s.citta || \')\', \', \') into mancanti',
  '  from _storico s',
  '  where not exists (select 1 from uffici u join citta c on c.id = u.citta_id where c.nome = s.citta and u.nome = s.ufficio);',
  '  if mancanti is not null then',
  `    raise exception 'Uffici non trovati sulla piattaforma: %. Controlla i nomi in Amministrazione → Uffici.', mancanti;`,
  '  end if;',
  '',
  `  delete from totali_mensili_storico where mese in (${mesi.map((m) => `'${m}'`).join(', ')});`,
  '  insert into totali_mensili_storico (ufficio_id, mese, voce, valore)',
  '  select u.id, s.mese, s.voce, s.valore',
  '  from _storico s join citta c on c.nome = s.citta join uffici u on u.citta_id = c.id and u.nome = s.ufficio;',
  '  drop table _storico;',
  '',
  `  -- Confronto con l'anno prima (la riga "<Mese> ${anno - 1}" di ogni foglio): sostituisce quanto scritto a mano`,
  '  insert into confronto_anno_prima (mese, voce, valore) values',
  confronto.map((c) => `    ('${c.mese}', '${c.voce}', ${c.valore})`).join(',\n'),
  '  on conflict (mese, voce) do update set valore = excluded.valore;',
  'end $$;',
  '',
  '-- Controllo: quanti uffici e quanti numeri per ogni mese',
  'select to_char(mese, \'YYYY-MM\') as mese, count(distinct ufficio_id) as uffici, count(*) as numeri',
  `from totali_mensili_storico where mese in (${mesi.map((m) => `'${m}'`).join(', ')}) group by mese order by mese;`,
  '',
]
writeFileSync(join('import', 'sql', `STORICO_MENSILE_${anno}.sql`), sql.join('\n'))

writeFileSync(join('import', `REPORT_MENSILE_${anno}.md`), [
  `# Storico mensile ${anno} da "${basename(FILE)}"`, '',
  `Creato il ${new Date().toLocaleString('it-IT')}. File SQL: \`import/sql/STORICO_MENSILE_${anno}.sql\`.`, '',
  '| Mese | Uffici con numeri | Controllo con la riga TOTALE | Voci dell\'anno prima |', '|---|---|---|---|',
  ...report, '',
  ...(avvisi.length ? ['## Da sapere', '', ...avvisi.map((a) => `- ${a}`), ''] : []),
].join('\n'))

console.log(`Storico ${anno}: ${storico.length} numeri in ${mesi.length} mesi · confronto ${anno - 1}: ${confronto.length} numeri`)
console.log(report.join('\n'))
if (avvisi.length) console.log('Da sapere:\n- ' + avvisi.join('\n- '))
