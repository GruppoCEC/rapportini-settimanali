// =====================================================================
// Lettura dei vecchi file Excel dei rapportini (usato da importa-storico.mjs).
// Ogni file ha un foglio con i 12 mesi uno sotto l'altro; per ogni mese:
//   riga col nome del mese (testo "GENNAIO" oppure una data)
//   riga "1° SETTIMANA … 5° SETTIMANA"
//   riga "Parametro | obiettivo | risultato | esito | …"
//   righe delle voci (App.ti Vend., Proposte, … , Portafoglio, …)
// Le colonne possono essere spostate da file a file: si individuano dalle intestazioni.
// =====================================================================
import ExcelJS from 'exceljs'

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

// Nomi delle righe nei vari file → codice della voce sulla piattaforma
const SINONIMI = [
  [/^(app\.?\s*ti|appuntament)/, 'app_vendita'],
  [/^proposte$/, 'proposte'],
  [/^incarichi$/, 'incarichi'],
  [/^valutazioni$/, 'valutazioni'],
  [/^vendite$/, 'vendite'],
  [/^ribassi$/, 'ribassi'],
  [/^im\s*3$/, 'im3'],
  [/^(\+\s*|più\s*|piu'?\s*|contattati da\s*)?90(\s*(gg|giorni))?$/, 'piu90'],
  [/^portafoglio$/, 'portafoglio'],
  [/^(incarichi in zona|case in vendita|contatto incarichi zona)$/, 'incarichi_zona'],
  [/^(contatti zona|comtatti in zona|contatti in zona|contatti)$/, 'contatti_zona'],
  [/^(telefoni mancanti|tel\.? mancanti)$/, 'telefoni_mancanti'],
  [/^affittati$/, 'affittati'],
  [/^vuoti$/, 'vuoti'],
]
// Righe calcolate dall'Excel: si ignorano (la piattaforma le ricalcola)
const CALCOLATE = /(20\s*%|mercato)/
// Righe da non importare per decisione di Davide (13/10/2026)
const IGNORATE = /^in contatto$/
// Righe da ignorare senza segnalarle (intestazioni ripetute)
const INTESTAZIONI = /^(\d+\s*°?\s*settimana|obiettivo|risultato|esito|parametro)$/

export const ZONA = new Set(['portafoglio', 'incarichi_zona', 'contatti_zona', 'telefoni_mancanti', 'affittati', 'vuoti'])

const pulisci = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim()

export function codiceVoce(etichetta) {
  const e = pulisci(etichetta)
  if (!e) return { tipo: 'vuota' }
  if (INTESTAZIONI.test(e)) return { tipo: 'intestazione' }
  if (CALCOLATE.test(e) || IGNORATE.test(e)) return { tipo: 'calcolata' }
  for (const [re, codice] of SINONIMI) if (re.test(e)) return { tipo: 'voce', codice }
  return { tipo: 'sconosciuta' }
}

/** Valore leggibile di una cella (risultato delle formule, testo, data, errore) */
function valoreCella(cella) {
  let v = cella.value
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'object') {
    if ('result' in v) v = v.result
    else if (v.richText) v = v.richText.map((t) => t.text).join('')
    else if (v.error) return { errore: v.error }
    else if (v.text) v = v.text
    else return null
    if (v === null || v === undefined) return null
    if (typeof v === 'object') return v instanceof Date ? v : (v.error ? { errore: v.error } : null)
  }
  return v
}

const testo = (v) => (v === null || v === undefined || typeof v === 'object' ? '' : String(v).trim())

/** Interpreta un valore numerico; restituisce { numero } oppure { numero, avviso } oppure { scarto } */
export function interpretaNumero(v) {
  if (v === null || v === undefined || v === '') return { numero: null }
  if (v instanceof Date) return { scarto: 'una data al posto di un numero' }
  if (typeof v === 'object' && v.errore) return { scarto: `errore Excel ${v.errore}` }
  if (typeof v === 'number') {
    if (v < 0) return { scarto: `numero negativo (${v})` }
    if (!Number.isInteger(v)) return { numero: Math.round(v), avviso: `decimale ${v} arrotondato a ${Math.round(v)}` }
    return { numero: v }
  }
  const s = String(v).trim()
  if (s === '' || s === '-' || s === '/') return { numero: null }
  if (/^\d+$/.test(s)) return { numero: Number(s) }
  const m = s.match(/^(\d+)[\s,.()]*[a-zà-ù].*$/i)
  if (m) return { numero: Number(m[1]), avviso: `testo "${s}" letto come ${m[1]}` }
  return { scarto: `testo "${s}" non numerico` }
}

function meseDellaRiga(celle) {
  for (const v of celle) {
    if (v instanceof Date) return v.getUTCMonth() + 1
    const t = pulisci(testo(v))
    const i = MESI.indexOf(t.replace(/\s*\d{4}$/, ''))
    if (i >= 0) return i + 1
  }
  return null
}

/**
 * Legge un file e restituisce le righe trovate:
 * { mese, settimanaExcel, codice, etichetta, obiettivo, risultato, riga, colonna }
 * più l'elenco delle anomalie.
 */
export async function leggiFile(percorso, opzioni = {}) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(percorso)
  const foglio = wb.worksheets.find((w) => w.state === 'visible') ?? wb.worksheets[0]
  const righe = []
  foglio.eachRow({ includeEmpty: true }, (row, n) => {
    const celle = []
    row.eachCell({ includeEmpty: true }, (c, i) => { celle[i] = valoreCella(c) })
    righe[n] = celle
  })

  const anomalie = []

  // Una riga è l'intestazione VERA di una tabella se contiene "Parametro" e, nella stessa
  // riga, almeno una coppia "obiettivo | risultato" (alcuni file hanno etichette fantasma).
  function intestazione(celle) {
    for (let p = 0; p < celle.length; p++) {
      if (!/^parametro$/i.test(testo(celle[p]))) continue
      const ob = []
      for (let c = p + 1; c < celle.length; c++) {
        const t = testo(celle[c]).toLowerCase()
        if (t.includes('mese')) break
        if (t === 'obiettivo') ob.push(c)
      }
      if (ob.length) return { colParametro: p, colObiettivo: ob }
    }
    return null
  }

  // 1) Individua le tabelle e il loro mese
  const tabelle = []
  let meseIntestato = null     // ultimo mese letto in una riga-titolo, non ancora usato
  for (let r = 1; r < righe.length; r++) {
    const celle = righe[r] ?? []
    const m = meseDellaRiga(celle)
    if (m) { meseIntestato = m; continue }
    const int = intestazione(celle)
    if (!int) continue
    let mese = meseIntestato
    let dedotto = false
    if (!mese) {
      const prec = tabelle.at(-1)
      if (!prec) { anomalie.push({ riga: r, testo: 'tabella senza mese riconoscibile: ignorata' }); continue }
      mese = prec.mese === 12 ? 1 : prec.mese + 1
      dedotto = true
    }
    meseIntestato = null
    // Colonne delle settimane: dalla riga "n° SETTIMANA" sopra, altrimenti in ordine
    const sopra = righe[r - 1] ?? []
    const coppie = []
    for (let i = 0; i < int.colObiettivo.length; i++) {
      const c = int.colObiettivo[i]
      const t = testo(sopra[c]) || testo(sopra[c + 1])
      const num = t.match(/(\d)\s*°?\s*settimana/i)
      coppie.push({ ob: c, ris: c + 1, settimana: num ? Number(num[1]) : i + 1 })
    }
    tabelle.push({ riga: r, mese, dedotto, colParametro: int.colParametro, coppie })
  }

  // 2) Più anni nello stesso file: quando il mese "torna indietro" inizia un anno nuovo.
  //    Si tiene solo l'ultimo anno (quello della cartella); i precedenti si scartano.
  let anno = 0
  tabelle.forEach((t, i) => { if (i > 0 && t.mese < tabelle[i - 1].mese) anno++; t.anno = anno })
  // Con "unisciAnni" (es. Espero: tabella nuova creata solo a gennaio, poi dati scritti sulle
  // tabelle vecchie) i mesi assenti nell'ultimo anno si prendono dalle tabelle precedenti.
  if (opzioni.unisciAnni && anno > 0) {
    const mesiUltimo = new Set(tabelle.filter((t) => t.anno === anno).map((t) => t.mese))
    const recuperati = new Set()
    for (const t of tabelle) if (t.anno < anno && !mesiUltimo.has(t.mese)) { t.anno = anno; recuperati.add(t.mese) }
    anomalie.push({ riga: 0, testo: `regola particolare: dall'ultima tabella ${[...mesiUltimo].map((m) => MESI[m - 1]).join(', ')}; dalle tabelle precedenti ${[...recuperati].sort((a, b) => a - b).map((m) => MESI[m - 1]).join(', ')}` })
  }
  const scartate = tabelle.filter((t) => t.anno < anno)
  if (scartate.length) {
    anomalie.push({ riga: scartate[0].riga, testo: opzioni.unisciAnni
      ? `tabelle sostituite da quelle più recenti (${scartate.map((t) => MESI[t.mese - 1]).join(', ')} alla riga ${scartate.map((t) => t.riga).join(', ')}): NON importate`
      : `il file contiene ${anno + 1} anni uno sotto l'altro: importato solo l'ultimo (dalla riga ${tabelle.find((t) => t.anno === anno).riga}); le righe ${scartate[0].riga}–${scartate.at(-1).riga} sono di anni precedenti e NON sono state importate`, annoPrecedente: true })
  }
  for (const t of tabelle) if (t.anno === anno && t.dedotto) {
    anomalie.push({ riga: t.riga, mese: t.mese, testo: `tabella senza il nome del mese: considerata ${MESI[t.mese - 1]} (viene dopo ${MESI[(t.mese + 10) % 12]})` })
  }

  // 3) Legge le voci di ogni tabella dell'ultimo anno; tabelle ripetute dello stesso mese si uniscono
  const valori = new Map()   // mese|settimana|codice → { obiettivo, risultato, etichetta, riga }
  const mesiVisti = new Map()
  for (const t of tabelle.filter((x) => x.anno === anno)) {
    if (mesiVisti.has(t.mese)) {
      anomalie.push({ riga: t.riga, mese: t.mese, testo: `${MESI[t.mese - 1]} ha due tabelle (righe ${mesiVisti.get(t.mese)} e ${t.riga}): unite, a parità di casella vale la seconda` })
    } else mesiVisti.set(t.mese, t.riga)
    let vuote = 0
    for (let d = t.riga + 1; d < righe.length && vuote < 3; d++) {
      const rc = righe[d] ?? []
      if (meseDellaRiga(rc) || intestazione(rc)) break
      const etichetta = testo(rc[t.colParametro])
      const voce = codiceVoce(etichetta)
      const haNumeri = t.coppie.some((cp) => rc[cp.ob] != null || rc[cp.ris] != null)
      if (voce.tipo === 'vuota') { if (!haNumeri) vuote++; continue }
      vuote = 0
      if (voce.tipo === 'intestazione' || voce.tipo === 'calcolata') continue
      if (voce.tipo === 'sconosciuta') {
        if (haNumeri) anomalie.push({ riga: d, mese: t.mese, testo: `riga "${etichetta}" non riconosciuta: non importata` })
        continue
      }
      for (const cp of t.coppie) {
        const ob = interpretaNumero(rc[cp.ob])
        const ris = interpretaNumero(rc[cp.ris])
        for (const [x, nome] of [[ob, 'obiettivo'], [ris, 'risultato']]) {
          if (x.scarto) anomalie.push({ riga: d, mese: t.mese, settimana: cp.settimana, testo: `${etichetta}, ${nome}: ${x.scarto} → ignorato` })
          if (x.avviso) anomalie.push({ riga: d, mese: t.mese, settimana: cp.settimana, testo: `${etichetta}, ${nome}: ${x.avviso}` })
        }
        let obiettivo = ob.numero ?? null
        let risultato = ris.numero ?? null
        if (ZONA.has(voce.codice)) {
          // I dati di zona non hanno obiettivo: se il valore è finito nella colonna sbagliata lo si sposta
          if (risultato === null && obiettivo !== null) {
            anomalie.push({ riga: d, mese: t.mese, settimana: cp.settimana, testo: `${etichetta}: valore ${obiettivo} nella colonna "obiettivo", spostato in "risultato"` })
            risultato = obiettivo
          }
          obiettivo = null
        }
        if (obiettivo === null && risultato === null) continue
        const chiave = `${t.mese}|${cp.settimana}|${voce.codice}`
        const prima = valori.get(chiave)
        valori.set(chiave, {
          mese: t.mese, settimanaExcel: cp.settimana, codice: voce.codice, etichetta, riga: d,
          obiettivo: obiettivo ?? prima?.obiettivo ?? null,
          risultato: risultato ?? prima?.risultato ?? null,
        })
      }
    }
  }
  const dati = [...valori.values()]
  return { foglio: foglio.name, dati, anomalie }
}
