import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { creaBackup, nomeFileBackup } from './backup'
import type { Metrica, Rilevazione } from './tipi'

const metriche: Metrica[] = [
  { codice: 'incarichi', nome: 'Incarichi', tipo: 'attivita', ordine: 1 },
  { codice: 'vendite', nome: 'Vendite', tipo: 'attivita', ordine: 2 },
  { codice: 'portafoglio', nome: 'Portafoglio', tipo: 'zona', ordine: 10 },
  { codice: 'incarichi_zona', nome: 'Incarichi in zona', tipo: 'zona', ordine: 11 },
]
const r = (ufficio_id: number, settimana: string, metrica: string, obiettivo: number | null, risultato: number | null): Rilevazione =>
  ({ ufficio_id, settimana, metrica, obiettivo, risultato, aggiornato_da: 'somalia@rapportini.local', aggiornato_il: '2026-10-09T16:00:00Z' })

const dati = {
  citta: [{ id: 1, nome: 'Roma' }, { id: 2, nome: 'Milano' }],
  uffici: [
    { id: 1, nome: 'Somalia', citta_id: 1, area_id: null, attivo: true },
    { id: 2, nome: 'Navigli', citta_id: 2, area_id: null, attivo: true },
  ],
  metriche,
  rilevazioni: [
    r(1, '2026-09-28', 'incarichi', 3, 2), r(1, '2026-10-05', 'incarichi', 3, 4),
    r(1, '2026-10-05', 'portafoglio', null, 10), r(1, '2026-10-05', 'incarichi_zona', null, 40),
  ],
  note: [{ ufficio_id: 1, settimana: '2026-10-05', testo: 'Nuovo incarico in via Mogadiscio' }],
  utenti: [{ email: 'somalia@rapportini.local', nome_utente: 'somalia', nome: 'Ufficio Somalia', email_promemoria: 'x@y.it', ruolo: 'ufficio' as const, citta_id: 1, ufficio_id: 1, area_id: null, attivo: true }],
  generatoDa: 'Davide',
  adesso: new Date('2026-10-13T10:00:00'),
}

/** Riga del foglio che ha nella prima colonna il testo indicato (a partire da una riga) */
function trovaRiga(ws: ExcelJS.Worksheet, testo: string, da = 1): number {
  for (let n = da; n <= ws.rowCount; n++) if (ws.getRow(n).getCell(1).value === testo) return n
  return -1
}

describe('backup in Excel', () => {
  it('ha un foglio per ufficio più i fogli di riepilogo, e si rilegge', async () => {
    const buffer = await creaBackup(dati).xlsx.writeBuffer()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Leggimi', 'Somalia', 'Navigli', 'Dati', 'Note', 'Uffici', 'Account'])
    expect(wb.getWorksheet('Dati')!.rowCount).toBe(1 + 4)
    expect(nomeFileBackup(dati.adesso)).toBe('Rapportini backup 2026-10-13.xlsx')
  })

  it('il foglio ufficio segue lo schema dei vecchi rapportini', () => {
    const ws = creaBackup(dati).getWorksheet('Somalia')!
    // ottobre 2026: la settimana 28/9–4/10 conta in ottobre (giovedì 1 ottobre), quella del 5/10 è la 2ª
    const mese = trovaRiga(ws, 'OTTOBRE 2026')
    expect(mese).toBeGreaterThan(0)
    expect(String(ws.getRow(mese + 1).getCell(2).value)).toContain('1° SETTIMANA')
    expect(ws.getRow(mese + 2).getCell(1).value).toBe('Parametro')
    const inc = trovaRiga(ws, 'Incarichi', mese)
    const riga = ws.getRow(inc)
    expect([riga.getCell(2).value, riga.getCell(3).value]).toEqual([3, 2])          // 1ª settimana: obiettivo, risultato
    expect([riga.getCell(5).value, riga.getCell(6).value]).toEqual([3, 4])          // 2ª settimana
    expect(riga.getCell(4).value).toMatchObject({ formula: expect.stringContaining('C' + inc), result: -1 })   // esito come formula
    expect(riga.getCell(17).value).toMatchObject({ result: 6 })                     // obiettivo del mese
    expect(riga.getCell(18).value).toMatchObject({ result: 6 })                     // risultato del mese
    const quota = ws.getRow(trovaRiga(ws, 'Quota di mercato (obiettivo 20%)', mese))
    expect(quota.getCell(6).value).toMatchObject({ result: 0.25 })                  // 10 ÷ 40
    const note = ws.getRow(trovaRiga(ws, 'Note', mese))
    expect(note.getCell(5).value).toBe('Nuovo incarico in via Mogadiscio')
  })

  it('con il rapportino mensile aggiunge i fogli Mensile e Personale', () => {
    const wb = creaBackup({
      ...dati,
      mensile: {
        voci: [{ codice: 'colloqui', gruppo: 'Colloqui', sotto: null, ordine: 1 }, { codice: 'proposte_vendita', gruppo: 'Proposte', sotto: 'vendita', ordine: 2 }],
        persone: [{ id: 7, ufficio_id: 1, nome: 'Anna Rossi', ruolo: 'collaboratore', data_inizio: '2023-03-01', data_fine: null }],
        valori: [
          { persona_id: 7, ufficio_id: 1, mese: '2026-09-01', voce: 'colloqui', valore: 5 },
          { persona_id: 7, ufficio_id: 1, mese: '2026-09-01', voce: 'proposte_vendita', valore: 0 },
        ],
      },
    })
    expect(wb.worksheets.map((w) => w.name).slice(-2)).toEqual(['Mensile', 'Personale'])
    const mensile = wb.getWorksheet('Mensile')!
    expect(mensile.getRow(1).values).toEqual([undefined, 'Mese', 'Città', 'Ufficio', 'Persona', 'Ruolo', 'Colloqui', 'Proposte vendita'])
    expect(mensile.getRow(2).values).toEqual([undefined, 'Settembre 2026', 'Roma', 'Somalia', 'Anna Rossi', 'Collaboratore', 5, 0])
    expect(wb.getWorksheet('Personale')!.getRow(2).getCell(3).value).toBe('Anna Rossi')
  })

  it('il foglio Dati riporta chi ha modificato e l\'esito', () => {
    const ws = creaBackup(dati).getWorksheet('Dati')!
    const prima = ws.getRow(2).values as unknown[]
    expect(prima[1]).toBe('Roma')
    expect(prima[2]).toBe('Somalia')
    expect(prima[6]).toBe('Incarichi')
    expect(prima[10]).toBe(-1)
    expect(prima[12]).toBe('somalia')
  })
})
