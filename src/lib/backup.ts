// Backup in Excel di tutti i dati della piattaforma (solo amministratore generale).
// Un foglio per ufficio con lo stesso schema dei vecchi rapportini Excel (mesi uno sotto l'altro,
// 5 settimane × obiettivo/risultato/esito, totale del mese), più i fogli con l'elenco completo
// dei valori, le note, gli uffici e gli account. Il file si genera nel browser: nulla esce dal sito.
import ExcelJS from 'exceljs'
import { nomeDaEmail } from './account'
import { quotaMercato, totaliPeriodo } from './calcoli'
import { intervalloSettimana, lunediDi, meseDellaSettimana, nomeMese, oggiISO, settimaneDelMese, aggiungiGiorni } from './settimane'
import { NOMI_RUOLO, type Citta, type Metrica, type Rilevazione, type Ufficio, type Utente } from './tipi'
import type { Nota } from './dati'

export interface DatiBackup {
  citta: Citta[]
  uffici: Ufficio[]
  metriche: Metrica[]          // tutte, anche quelle non più in uso
  rilevazioni: Rilevazione[]
  note: Nota[]
  utenti: Utente[]
  generatoDa: string
  adesso?: Date
}

const BLU_SCURO = 'FF0A2440', BLU = 'FF0057A3', BLU_CHIARO = 'FFE6EEF6', ARANCIO_CHIARO = 'FFFDF1E9'
const VERDE = 'FFE4F2EA', ROSSO = 'FFFBE8E6', GRIGIO = 'FFF4F3EF'
const SETTIMANE_PER_MESE = 5
const ORDINALI = ['1°', '2°', '3°', '4°', '5°']

const riempi = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const sottile: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFD7D3CB' } }
const bordi: Partial<ExcelJS.Borders> = { top: sottile, left: sottile, bottom: sottile, right: sottile }
const dataUTC = (iso: string) => { const [a, m, g] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, g)) }
const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Mesi da `da` ad `a` compresi (formato AAAA-MM) */
function mesiTra(da: string, a: string): string[] {
  const out: string[] = []
  let [anno, mese] = da.split('-').map(Number)
  for (;;) {
    const m = `${anno}-${String(mese).padStart(2, '0')}`
    out.push(m)
    if (m >= a) return out
    mese++; if (mese > 12) { mese = 1; anno++ }
  }
}

/** Nome valido e unico per un foglio Excel (max 31 caratteri, senza : \ / ? * [ ]) */
function nomeFoglio(nome: string, usati: Set<string>): string {
  const base = nome.replace(/[:\\/?*[\]]/g, '-').slice(0, 31)
  let n = base, i = 2
  while (usati.has(n.toLowerCase())) n = `${base.slice(0, 27)} (${i++})`
  usati.add(n.toLowerCase())
  return n
}

export function creaBackup(d: DatiBackup): ExcelJS.Workbook {
  const adesso = d.adesso ?? new Date()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Rapportini Settimanali'
  wb.created = adesso

  const attivita = d.metriche.filter((m) => m.tipo === 'attivita').sort((a, b) => a.ordine - b.ordine)
  const zona = d.metriche.filter((m) => m.tipo === 'zona').sort((a, b) => a.ordine - b.ordine)
  const nomeMetrica = new Map(d.metriche.map((m) => [m.codice, m]))
  const nomeCitta = (id: number | null) => d.citta.find((c) => c.id === id)?.nome ?? ''
  const ufficioDi = new Map(d.uffici.map((u) => [u.id, u]))
  const meseCorrente = meseDellaSettimana(lunediDi(oggiISO(adesso)))
  const ufficiOrdinati = [...d.uffici].sort((a, b) => a.citta_id - b.citta_id || Number(b.attivo) - Number(a.attivo) || a.nome.localeCompare(b.nome))
  const usati = new Set(['leggimi', 'dati', 'note', 'uffici', 'account'])

  // ---------------------------------------------------------------- Leggimi
  const leggimi = wb.addWorksheet('Leggimi', { properties: { tabColor: { argb: BLU_SCURO } } })
  leggimi.getColumn(1).width = 30
  leggimi.getColumn(2).width = 90
  leggimi.addRow(['Rapportini Settimanali · backup dei dati']).font = { bold: true, size: 16, color: { argb: BLU_SCURO } }
  leggimi.addRow([])
  const conDati = new Set(d.rilevazioni.map((r) => r.ufficio_id))
  const info: [string, string | number][] = [
    ['Creato il', adesso.toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'short' })],
    ['Creato da', d.generatoDa],
    ['Città', d.citta.map((c) => c.nome).join(', ')],
    ['Uffici', `${d.uffici.length} (${conDati.size} con dati)`],
    ['Valori settimanali', d.rilevazioni.length],
    ['Note', d.note.length],
    ['Account', d.utenti.length],
  ]
  for (const [k, v] of info) { const r = leggimi.addRow([k, v]); r.getCell(1).font = { bold: true } }
  leggimi.addRow([])
  leggimi.addRow(['Fogli']).font = { bold: true, size: 13, color: { argb: BLU_SCURO } }
  const fogli: [string, string][] = [
    ['Un foglio per ufficio', 'Come i vecchi rapportini: mesi uno sotto l\'altro, 5 settimane con obiettivo, risultato ed esito, totale del mese, dati di zona, quota di mercato e note.'],
    ['Dati', 'Tutti i valori inseriti, una riga per ufficio, settimana e voce, con chi li ha modificati e quando. È la copia completa: si può filtrare e ordinare.'],
    ['Note', 'Le note settimanali degli uffici.'],
    ['Uffici', 'Elenco degli uffici con città, stato e account.'],
    ['Account', 'Gli account della piattaforma. Le password non ci sono: il sistema le conserva solo in forma cifrata.'],
  ]
  for (const [k, v] of fogli) { const r = leggimi.addRow([k, v]); r.getCell(1).font = { bold: true }; r.getCell(2).alignment = { wrapText: true } }
  leggimi.addRow([])
  leggimi.addRow(['Regole', 'Le settimane vanno da lunedì a domenica e contano nel mese in cui cade il loro giovedì. Nel totale del mese le attività si sommano; i dati di zona prendono il valore dell\'ultima settimana. Quota di mercato = Portafoglio ÷ (Portafoglio + Incarichi in zona), obiettivo 20%.'])
    .getCell(2).alignment = { wrapText: true }

  // ---------------------------------------------------------------- Un foglio per ufficio
  const colonnaSett = (k: number) => 2 + k * 3                    // colonna "obiettivo" della settimana k (B, E, H, K, N)
  const COL_MESE = 2 + SETTIMANE_PER_MESE * 3                      // Q
  const lettera = (c: number) => String.fromCharCode(64 + c)

  for (const u of ufficiOrdinati) {
    const sue = d.rilevazioni.filter((r) => r.ufficio_id === u.id)
    const noteUfficio = d.note.filter((n) => n.ufficio_id === u.id)
    const cittaNome = nomeCitta(u.citta_id)
    const ws = wb.addWorksheet(nomeFoglio(u.nome, usati), {
      properties: { tabColor: { argb: u.citta_id === d.citta[0]?.id ? BLU : 'FFEE7326' } },
      views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    })
    ws.getColumn(1).width = 24
    for (let c = 2; c <= COL_MESE + 2; c++) ws.getColumn(c).width = c >= COL_MESE ? 12 : 10

    const titolo = ws.addRow([`${u.nome.toUpperCase()} · ${cittaNome}${u.attivo ? '' : ' (ufficio disattivato)'}`])
    titolo.font = { bold: true, size: 18, color: { argb: BLU_SCURO } }
    titolo.height = 28
    ws.addRow([`Backup del ${adesso.toLocaleDateString('it-IT')} · valori inseriti sulla piattaforma`]).font = { italic: true, color: { argb: 'FF6B6F78' } }
    ws.addRow([])

    const settimaneConDati = [...new Set(sue.map((r) => r.settimana))].sort()
    const primoMese = settimaneConDati.length ? meseDellaSettimana(settimaneConDati[0]) : meseCorrente
    const mesi = mesiTra(primoMese < meseCorrente ? primoMese : meseCorrente, meseCorrente)

    for (const mese of mesi) {
      const settimane = settimaneDelMese(mese)
      const valore = (sett: string, metrica: string) => sue.find((r) => r.settimana === sett && r.metrica === metrica)

      // Riga del mese
      const rMese = ws.addRow([`${nomeMese(mese).toUpperCase()}`])
      ws.mergeCells(rMese.number, 1, rMese.number, COL_MESE + 2)
      rMese.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
      rMese.getCell(1).fill = riempi(BLU_SCURO)
      rMese.getCell(1).alignment = { vertical: 'middle', indent: 1 }
      rMese.height = 24

      // Riga delle settimane
      const rSett = ws.addRow([])
      rSett.height = 30
      for (let k = 0; k < SETTIMANE_PER_MESE; k++) {
        const c = colonnaSett(k)
        const cella = rSett.getCell(c)
        cella.value = settimane[k] ? `${ORDINALI[k]} SETTIMANA\n${intervalloSettimana(settimane[k])}` : `${ORDINALI[k]} SETTIMANA\n—`
        ws.mergeCells(rSett.number, c, rSett.number, c + 2)
      }
      rSett.getCell(COL_MESE).value = 'RISULTATO MESE'
      ws.mergeCells(rSett.number, COL_MESE, rSett.number, COL_MESE + 2)
      rSett.eachCell({ includeEmpty: true }, (cella, c) => {
        if (c === 1) return
        cella.font = { bold: true, size: 9, color: { argb: BLU_SCURO } }
        cella.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cella.fill = riempi(c >= COL_MESE ? ARANCIO_CHIARO : BLU_CHIARO)
      })

      // Intestazioni
      const intest = ['Parametro']
      for (let k = 0; k < SETTIMANE_PER_MESE; k++) intest.push('obiettivo', 'risultato', 'esito')
      intest.push('OBIETTIVO MESE', 'RISULTATO MESE', 'ESITO MESE')
      const rInt = ws.addRow(intest)
      rInt.eachCell((cella, c) => {
        cella.font = { bold: true, size: 9 }
        cella.alignment = { horizontal: c === 1 ? 'left' : 'center', wrapText: true }
        cella.fill = riempi(GRIGIO)
        cella.border = bordi
      })

      // Attività: obiettivo, risultato ed esito (formula) per settimana, poi il totale del mese
      const totMese = totaliPeriodo(sue.filter((r) => settimane.includes(r.settimana)), d.metriche)
      for (const m of attivita) {
        const riga = ws.addRow([m.nome])
        const n = riga.number
        for (let k = 0; k < SETTIMANE_PER_MESE; k++) {
          const c = colonnaSett(k)
          const v = settimane[k] ? valore(settimane[k], m.codice) : undefined
          const ob = v?.obiettivo ?? null, ri = v?.risultato ?? null
          if (ob !== null) riga.getCell(c).value = ob
          if (ri !== null) riga.getCell(c + 1).value = ri
          const es = ob !== null && ri !== null ? ri - ob : null
          riga.getCell(c + 2).value = {
            formula: `IF(AND(ISNUMBER(${lettera(c)}${n}),ISNUMBER(${lettera(c + 1)}${n})),${lettera(c + 1)}${n}-${lettera(c)}${n},"")`,
            result: es ?? '',
          }
          if (es !== null) riga.getCell(c + 2).fill = riempi(es >= 0 ? VERDE : ROSSO)
        }
        const t = totMese.get(m.codice)
        const somma = (offset: number) => Array.from({ length: SETTIMANE_PER_MESE }, (_, k) => `${lettera(colonnaSett(k) + offset)}${n}`).join(',')
        riga.getCell(COL_MESE).value = { formula: `IF(COUNT(${somma(0)})=0,"",SUM(${somma(0)}))`, result: t?.obiettivo ?? '' }
        riga.getCell(COL_MESE + 1).value = { formula: `IF(COUNT(${somma(1)})=0,"",SUM(${somma(1)}))`, result: t?.risultato ?? '' }
        const esMese = t?.obiettivo != null && t.risultato != null ? t.risultato - t.obiettivo : null
        riga.getCell(COL_MESE + 2).value = {
          formula: `IF(AND(ISNUMBER(${lettera(COL_MESE)}${n}),ISNUMBER(${lettera(COL_MESE + 1)}${n})),${lettera(COL_MESE + 1)}${n}-${lettera(COL_MESE)}${n},"")`,
          result: esMese ?? '',
        }
        if (esMese !== null) riga.getCell(COL_MESE + 2).fill = riempi(esMese >= 0 ? VERDE : ROSSO)
      }

      // Dati di zona: un valore per settimana (colonna "risultato"); nel mese l'ultimo valore
      const righeZona = new Map<string, number>()
      for (const m of zona) {
        const riga = ws.addRow([m.nome])
        righeZona.set(m.codice, riga.number)
        for (let k = 0; k < SETTIMANE_PER_MESE; k++) {
          const v = settimane[k] ? valore(settimane[k], m.codice)?.risultato ?? null : null
          if (v !== null) riga.getCell(colonnaSett(k) + 1).value = v
        }
        const ultimo = totMese.get(m.codice)?.risultato
        if (ultimo != null) riga.getCell(COL_MESE + 1).value = ultimo
      }

      // Quota di mercato (formula, come nei vecchi file)
      const rQuota = ws.addRow(['Quota di mercato (obiettivo 20%)'])
      const rp = righeZona.get('portafoglio'), ri = righeZona.get('incarichi_zona')
      if (rp && ri) {
        const colonne = [...Array.from({ length: SETTIMANE_PER_MESE }, (_, k) => colonnaSett(k) + 1), COL_MESE + 1]
        colonne.forEach((c, idx) => {
          const p = `${lettera(c)}${rp}`, z = `${lettera(c)}${ri}`
          const sett = idx < SETTIMANE_PER_MESE ? settimane[idx] : null
          const port = idx < SETTIMANE_PER_MESE ? (sett ? valore(sett, 'portafoglio')?.risultato ?? null : null) : totMese.get('portafoglio')?.risultato ?? null
          const inc = idx < SETTIMANE_PER_MESE ? (sett ? valore(sett, 'incarichi_zona')?.risultato ?? null : null) : totMese.get('incarichi_zona')?.risultato ?? null
          const q = quotaMercato(port, inc)
          const cella = rQuota.getCell(c)
          cella.value = { formula: `IF(AND(ISNUMBER(${p}),ISNUMBER(${z})),IF(${p}+${z}>0,${p}/(${p}+${z}),""),"")`, result: q ?? '' }
          cella.numFmt = '0.0%'
          if (q !== null) cella.fill = riempi(q >= 0.2 ? VERDE : ROSSO)
        })
      }
      rQuota.font = { bold: true }

      // Note della settimana
      const rNote = ws.addRow(['Note'])
      let altezza = 0
      for (let k = 0; k < SETTIMANE_PER_MESE; k++) {
        const testo = settimane[k] ? noteUfficio.find((x) => x.settimana === settimane[k])?.testo ?? '' : ''
        const c = colonnaSett(k)
        if (testo) {
          rNote.getCell(c).value = testo
          altezza = Math.max(altezza, Math.ceil(testo.length / 30) * 13)
        }
        ws.mergeCells(rNote.number, c, rNote.number, c + 2)
        rNote.getCell(c).alignment = { wrapText: true, vertical: 'top' }
        rNote.getCell(c).font = { size: 9, italic: true }
      }
      if (altezza) rNote.height = Math.min(120, Math.max(16, altezza))

      // Bordi e allineamenti del blocco
      for (let n = rInt.number + 1; n <= rNote.number; n++) {
        const riga = ws.getRow(n)
        for (let c = 1; c <= COL_MESE + 2; c++) {
          const cella = riga.getCell(c)
          cella.border = bordi
          if (c > 1 && n !== rNote.number) cella.alignment = { horizontal: 'center' }
        }
      }
      ws.addRow([])
      ws.addRow([])
    }
  }

  // ---------------------------------------------------------------- Tabelle
  const tabella = (nome: string, colonne: { titolo: string; larghezza: number; formato?: string }[], righe: unknown[][]) => {
    const ws = wb.addWorksheet(nome, { views: [{ state: 'frozen', ySplit: 1 }], properties: { tabColor: { argb: 'FF6B6F78' } } })
    ws.columns = colonne.map((c) => ({ header: c.titolo, width: c.larghezza, style: c.formato ? { numFmt: c.formato } : {} }))
    const testa = ws.getRow(1)
    testa.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    testa.fill = riempi(BLU_SCURO)
    testa.alignment = { vertical: 'middle' }
    for (const r of righe) ws.addRow(r)
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, righe.length + 1), column: colonne.length } }
    return ws
  }

  const ordinate = [...d.rilevazioni].sort((a, b) => {
    const ua = ufficioDi.get(a.ufficio_id), ub = ufficioDi.get(b.ufficio_id)
    return (ua?.citta_id ?? 0) - (ub?.citta_id ?? 0) || (ua?.nome ?? '').localeCompare(ub?.nome ?? '')
      || a.settimana.localeCompare(b.settimana) || (nomeMetrica.get(a.metrica)?.ordine ?? 99) - (nomeMetrica.get(b.metrica)?.ordine ?? 99)
  })
  tabella('Dati', [
    { titolo: 'Città', larghezza: 10 }, { titolo: 'Ufficio', larghezza: 24 },
    { titolo: 'Settimana dal', larghezza: 13, formato: 'dd/mm/yyyy' }, { titolo: 'Settimana al', larghezza: 13, formato: 'dd/mm/yyyy' },
    { titolo: 'Mese', larghezza: 16 }, { titolo: 'Voce', larghezza: 20 }, { titolo: 'Tipo', larghezza: 10 },
    { titolo: 'Obiettivo', larghezza: 11 }, { titolo: 'Risultato', larghezza: 11 }, { titolo: 'Esito', larghezza: 9 },
    { titolo: 'Ultima modifica', larghezza: 17, formato: 'dd/mm/yyyy hh:mm' }, { titolo: 'Modificato da', larghezza: 18 },
  ], ordinate.map((r) => {
    const u = ufficioDi.get(r.ufficio_id)
    const m = nomeMetrica.get(r.metrica)
    const es = m?.tipo !== 'zona' && r.obiettivo !== null && r.risultato !== null ? r.risultato - r.obiettivo : null
    return [
      nomeCitta(u?.citta_id ?? null), u?.nome ?? `ufficio ${r.ufficio_id}`,
      dataUTC(r.settimana), dataUTC(aggiungiGiorni(r.settimana, 6)), maiuscola(nomeMese(meseDellaSettimana(r.settimana))),
      m?.nome ?? r.metrica, m?.tipo === 'zona' ? 'zona' : 'attività',
      r.obiettivo, r.risultato, es,
      r.aggiornato_il ? new Date(r.aggiornato_il) : null,
      r.aggiornato_da ? (r.aggiornato_da === 'import excel' ? 'import da Excel' : nomeDaEmail(r.aggiornato_da)) : 'import da Excel',
    ]
  }))

  tabella('Note', [
    { titolo: 'Città', larghezza: 10 }, { titolo: 'Ufficio', larghezza: 24 },
    { titolo: 'Settimana dal', larghezza: 13, formato: 'dd/mm/yyyy' }, { titolo: 'Nota', larghezza: 100 },
  ], [...d.note].sort((a, b) => a.settimana.localeCompare(b.settimana)).map((n) => {
    const u = ufficioDi.get(n.ufficio_id)
    return [nomeCitta(u?.citta_id ?? null), u?.nome ?? '', dataUTC(n.settimana), n.testo]
  })).getColumn(4).alignment = { wrapText: true, vertical: 'top' }

  tabella('Uffici', [
    { titolo: 'Città', larghezza: 10 }, { titolo: 'Ufficio', larghezza: 26 }, { titolo: 'Stato', larghezza: 12 },
    { titolo: 'Account', larghezza: 26 }, { titolo: 'Email promemoria', larghezza: 40 }, { titolo: 'Settimane con dati', larghezza: 18 },
  ], ufficiOrdinati.map((u) => {
    const acc = d.utenti.filter((x) => x.ufficio_id === u.id)
    return [
      nomeCitta(u.citta_id), u.nome, u.attivo ? 'attivo' : 'disattivato',
      acc.map((x) => x.nome_utente).join(', '), acc.map((x) => x.email_promemoria).filter(Boolean).join(', '),
      new Set(d.rilevazioni.filter((r) => r.ufficio_id === u.id).map((r) => r.settimana)).size,
    ]
  }))

  tabella('Account', [
    { titolo: 'Nome utente', larghezza: 26 }, { titolo: 'Nome', larghezza: 26 }, { titolo: 'Ruolo', larghezza: 24 },
    { titolo: 'Città', larghezza: 10 }, { titolo: 'Ufficio', larghezza: 24 }, { titolo: 'Email promemoria', larghezza: 40 }, { titolo: 'Stato', larghezza: 12 },
  ], [...d.utenti].sort((a, b) => (a.citta_id ?? 0) - (b.citta_id ?? 0) || a.nome_utente.localeCompare(b.nome_utente)).map((x) => [
    x.nome_utente, x.nome ?? '', NOMI_RUOLO[x.ruolo], nomeCitta(x.citta_id),
    x.ufficio_id ? ufficioDi.get(x.ufficio_id)?.nome ?? '' : '', x.email_promemoria ?? '', x.attivo ? 'attivo' : 'disattivato',
  ]))

  return wb
}

/** Nome del file: "Rapportini backup 2026-10-13.xlsx" */
export const nomeFileBackup = (adesso: Date = new Date()) => `Rapportini backup ${oggiISO(adesso)}.xlsx`
