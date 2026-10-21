import { describe, expect, it } from 'vitest'
import {
  fascia, inClassifica, posizioniDaRighe, classifica, classificaQuota, quotaDaTotali, raggiungimento, semaforo, serieQuota, serieSettimanale, variazioneZona,
  sommaTotali, statoCompilazione, statoCompilazionePeriodo, totaliCittaDaRighe, totaliPerPeriodi, totaliPerUfficio,
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
    expect(quotaDaTotali(citta)).toBeCloseTo(15 / 75, 6)
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
    expect(q[1]).toBeCloseTo(15 / 75, 6)
  })
})

describe('variazione del portafoglio rispetto alla settimana prima', () => {
  const ora = totaliPerUfficio([r(1, '2026-10-12', 'portafoglio', null, 5), r(2, '2026-10-12', 'portafoglio', null, 10)], metriche)
  it('somma le differenze degli uffici', () => {
    const prima = totaliPerUfficio([r(1, '2026-10-05', 'portafoglio', null, 4), r(2, '2026-10-05', 'portafoglio', null, 12)], metriche)
    expect(variazioneZona(uffici, ora, prima, 'portafoglio')).toEqual({ variazione: -1, confrontati: 2, conDato: 2 })   // +1 e −2
  })
  it('un ufficio che non aveva compilato la settimana prima non conta come aumento', () => {
    const prima = totaliPerUfficio([r(1, '2026-10-05', 'portafoglio', null, 4)], metriche)
    expect(variazioneZona(uffici, ora, prima, 'portafoglio')).toEqual({ variazione: 1, confrontati: 1, conDato: 2 })
  })
  it('senza dati della settimana prima non c\'è confronto', () => {
    expect(variazioneZona(uffici, ora, new Map(), 'portafoglio').variazione).toBeNull()
  })
})

describe('totali periodo per periodo (presentazione settimanale o mensile)', () => {
  it('a settimane dà gli stessi numeri della serie settimanale', () => {
    const settimane = ['2026-10-05', '2026-10-12', '2026-10-19']
    const t = totaliPerPeriodi(dati, metriche, settimane.map((s) => [s]))
    expect(t.map((x) => x.get('incarichi') ?? { obiettivo: null, risultato: null })).toEqual(serieSettimanale(dati, 'incarichi', settimane))
    expect(t.map(quotaDaTotali)).toEqual(serieQuota(dati, settimane))
  })
  it('a mesi somma le attività e prende il portafoglio all\'ultima settimana di ogni ufficio', () => {
    const [mese] = totaliPerPeriodi(dati, metriche, [['2026-10-05', '2026-10-12']])
    expect(mese.get('incarichi')).toEqual({ obiettivo: 5, risultato: 4 })      // 2+2+1 · 3+1+0
    expect(mese.get('portafoglio')?.risultato).toBe(15)                         // Somalia 5 (non 4+5) + Trieste 10
  })
})

describe('compilazione di un mese', () => {
  const complete = (u: number, s: string) => [r(u, s, 'incarichi', 1, 1), r(u, s, 'vendite', 1, 0)]
  const settimane = ['2026-10-05', '2026-10-12']
  it('completo solo se tutte le settimane sono complete', () => {
    expect(statoCompilazionePeriodo([...complete(1, settimane[0]), ...complete(1, settimane[1])], metriche, settimane)).toBe('completo')
    expect(statoCompilazionePeriodo(complete(1, settimane[0]), metriche, settimane)).toBe('parziale')
  })
  it('mancante se nel mese non c\'è nessun dato', () => {
    expect(statoCompilazionePeriodo([], metriche, settimane)).toBe('mancante')
  })
})

describe('totali di tutta la città (dal database, solo somme)', () => {
  const riga = (periodo: number, metrica: string, obiettivo: number | null, risultato: number | null, extra: object = {}) =>
    ({ periodo, metrica, obiettivo, risultato, uffici_con_dato: 2, uffici_con_dati: 3, variazione: null, confrontati: null, uffici_citta: 38, ...extra })
  it('rimette i totali periodo per periodo, con la variazione del portafoglio sull\'ultimo', () => {
    const t = totaliCittaDaRighe([
      riga(1, 'incarichi', 4, 3),
      riga(2, 'incarichi', 5, 6),
      riga(2, 'portafoglio', null, 105, { variazione: '10', confrontati: 2, uffici_con_dato: 3 } as object),
    ] as never, 3)
    expect(t.andamento).toHaveLength(3)
    expect(t.andamento[0].get('incarichi')).toEqual({ obiettivo: 4, risultato: 3 })
    expect(t.andamento[2].size).toBe(0)                    // periodo senza dati
    expect(t.zona.size).toBe(0)                            // la variazione conta solo per l'ultimo periodo
    expect(t.ufficiCitta).toBe(38)
    const ultimo = totaliCittaDaRighe([riga(2, 'portafoglio', null, 105, { variazione: '10', confrontati: 2, uffici_con_dato: 3 })] as never, 2)
    expect(ultimo.zona.get('portafoglio')).toEqual({ variazione: 10, confrontati: 2, conDato: 3 })
    expect(ultimo.ufficiConDati).toBe(3)
  })
})

describe('posizione nella città', () => {
  it('la fascia dice in quale quarto della città è l\'ufficio', () => {
    expect(fascia(1, 38)).toBe('primo')
    expect(fascia(8, 38)).toBe('primo')
    expect(fascia(10, 38)).toBe('primo')
    expect(fascia(11, 38)).toBe('secondo')
    expect(fascia(28, 38)).toBe('terzo')
    expect(fascia(38, 38)).toBe('ultimo')
    expect(fascia(1, 1)).toBe('primo')          // da solo
    expect(fascia(2, 2)).toBe('ultimo')
  })

  it('legge le righe del database: ultima posizione e quella del periodo prima', () => {
    const r = posizioniDaRighe([
      { periodo: 1, voce: 'incarichi', posizione: 5, uffici_con_dato: 30, uffici_citta: 31 },
      { periodo: 2, voce: 'incarichi', posizione: 2, uffici_con_dato: 29, uffici_citta: 31 },
      { periodo: 2, voce: '__quota', posizione: 9, uffici_con_dato: 28, uffici_citta: 31 },
    ], 2)
    expect(r.ufficiCitta).toBe(31)
    expect(r.voci.get('incarichi')).toEqual({ posizione: 2, su: 29, prima: 5 })
    expect(r.voci.get('__quota')).toEqual({ posizione: 9, su: 28, prima: null })
  })
})

describe('voci senza classifica', () => {
  it('IM3 e +90 per ora non entrano in classifiche e posizioni; i ribassi sì', () => {
    expect(inClassifica('im3')).toBe(false)
    expect(inClassifica('piu90')).toBe(false)
    expect(inClassifica('ribassi')).toBe(true)
    expect(inClassifica('incarichi')).toBe(true)
  })
})
