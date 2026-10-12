import { describe, expect, it } from 'vitest'
import {
  classifica, classificaQuota, quotaDaTotali, raggiungimento, semaforo, serieQuota, serieSettimanale,
  sommaTotali, statoCompilazione, totaliPerUfficio,
} from './aggregazioni'
import type { Metrica, Rilevazione, Ufficio } from './tipi'

const metriche: Metrica[] = [
  { codice: 'incarichi', nome: 'Incarichi', tipo: 'attivita', ordine: 1 },
  { codice: 'vendite', nome: 'Vendite', tipo: 'attivita', ordine: 2 },
  { codice: 'portafoglio', nome: 'Portafoglio', tipo: 'zona', ordine: 10 },
  { codice: 'incarichi_zona', nome: 'Incarichi in zona', tipo: 'zona', ordine: 11 },
]
const uffici: Ufficio[] = [
  { id: 1, nome: 'Somalia', citta_id: 1, area_id: 1, attivo: true },
  { id: 2, nome: 'Trieste', citta_id: 1, area_id: 1, attivo: true },
  { id: 3, nome: 'Parioli', citta_id: 1, area_id: 2, attivo: true },
]
const r = (ufficio_id: number, settimana: string, metrica: string, obiettivo: number | null, risultato: number | null): Rilevazione =>
  ({ ufficio_id, settimana, metrica, obiettivo, risultato })

const dati: Rilevazione[] = [
  r(1, '2026-10-05', 'incarichi', 2, 3), r(1, '2026-10-12', 'incarichi', 2, 1),
  r(1, '2026-10-05', 'portafoglio', null, 4), r(1, '2026-10-12', 'portafoglio', null, 5),
  r(1, '2026-10-12', 'incarichi_zona', null, 45),
  r(2, '2026-10-05', 'incarichi', 1, 0), r(2, '2026-10-12', 'portafoglio', null, 10),
  r(2, '2026-10-12', 'incarichi_zona', null, 30),
]

describe('totali per ufficio e somma per città', () => {
  const totali = totaliPerUfficio(dati, metriche)
  it('per ufficio: attività sommate, zona all\'ultima settimana', () => {
    expect(totali.get(1)!.get('incarichi')).toEqual({ obiettivo: 4, risultato: 4 })
    expect(totali.get(1)!.get('portafoglio')!.risultato).toBe(5)
  })
  it('per città: somma degli uffici, anche per i dati di zona', () => {
    const citta = sommaTotali([...totali.values()])
    expect(citta.get('incarichi')).toEqual({ obiettivo: 5, risultato: 4 })
    expect(citta.get('portafoglio')!.risultato).toBe(15)
    expect(quotaDaTotali(citta)).toBeCloseTo(15 / 90, 6)
  })
})

describe('semaforo e raggiungimento', () => {
  it('verde ≥100%, giallo ≥70%, rosso sotto', () => {
    expect(semaforo({ obiettivo: 10, risultato: 10 })).toBe('verde')
    expect(semaforo({ obiettivo: 10, risultato: 7 })).toBe('giallo')
    expect(semaforo({ obiettivo: 10, risultato: 6 })).toBe('rosso')
    expect(semaforo({ obiettivo: null, risultato: 6 })).toBe('nessuno')
    expect(raggiungimento({ obiettivo: 0, risultato: 3 })).toBeNull()
  })
})

describe('stato compilazione', () => {
  it('distingue completo, parziale, mancante', () => {
    expect(statoCompilazione([], metriche)).toBe('mancante')
    expect(statoCompilazione([r(1, 's', 'incarichi', 2, null)], metriche)).toBe('mancante')
    expect(statoCompilazione([r(1, 's', 'incarichi', 2, 1)], metriche)).toBe('parziale')
    expect(statoCompilazione([r(1, 's', 'incarichi', 2, 1), r(1, 's', 'vendite', null, 0)], metriche)).toBe('completo')
  })
})

describe('classifiche', () => {
  const totali = totaliPerUfficio(dati, metriche)
  it('ordina per valore assoluto ed esclude chi non ha dati', () => {
    expect(classifica(uffici, totali, 'incarichi').map((v) => [v.ufficio.nome, v.valore])).toEqual([['Somalia', 4], ['Trieste', 0]])
  })
  it('quota di mercato dal più alto', () => {
    expect(classificaQuota(uffici, totali).map((v) => v.ufficio.nome)).toEqual(['Trieste', 'Somalia'])
  })
})

describe('serie per i grafici', () => {
  it('somma gli uffici settimana per settimana e lascia vuote le settimane senza dati', () => {
    expect(serieSettimanale(dati, 'incarichi', ['2026-10-05', '2026-10-12', '2026-10-19'])).toEqual([
      { obiettivo: 3, risultato: 3 }, { obiettivo: 2, risultato: 1 }, { obiettivo: null, risultato: null },
    ])
    const q = serieQuota(dati, ['2026-10-05', '2026-10-12'])
    expect(q[0]).toBeNull()                       // manca incarichi in zona
    expect(q[1]).toBeCloseTo(15 / 90, 6)
  })
})
