import { describe, expect, it } from 'vitest'
import { esito, formattaEsito, formattaPercentuale, leggiNumero, quotaMercato, totaliPeriodo } from './calcoli'
import type { Metrica, Rilevazione } from './tipi'

const metriche: Metrica[] = [
  { codice: 'app_vendita', nome: 'App.ti Vendita', tipo: 'attivita', ordine: 1 },
  { codice: 'portafoglio', nome: 'Portafoglio', tipo: 'zona', ordine: 10 },
]

describe('esito', () => {
  it('è risultato meno obiettivo', () => {
    expect(esito(5, 1)).toBe(-4)
    expect(esito(15, 21)).toBe(6)
  })
  it('è vuoto se manca un dato (niente #VALORE!)', () => {
    expect(esito(null, 3)).toBeNull()
    expect(esito(3, null)).toBeNull()
  })
})

describe('quota di mercato', () => {
  it('Portafoglio ÷ Incarichi in zona (che comprendono già il portafoglio), con i numeri del file di Somalia', () => {
    expect(quotaMercato(2, 34)!).toBeCloseTo(0.0588, 4)   // feb, 1ª settimana
    expect(quotaMercato(3, 35)!).toBeCloseTo(0.0857, 4)   // feb, 2ª settimana
    expect(quotaMercato(2, 39)!).toBeCloseTo(0.0513, 4)   // mar, 1ª settimana
    expect(quotaMercato(10, 50)).toBe(0.2)                // esattamente l'obiettivo
  })
  it('non divide mai per zero', () => {
    expect(quotaMercato(0, 0)).toBeNull()
    expect(quotaMercato(5, 0)).toBeNull()
    expect(quotaMercato(null, 10)).toBeNull()
  })
})

describe('totali del mese', () => {
  // Febbraio di Somalia
  const settimane = ['2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23']
  const righe: Rilevazione[] = settimane.flatMap((s, i) => [
    { ufficio_id: 1, settimana: s, metrica: 'app_vendita', obiettivo: [5, 15, 15, 5][i], risultato: [0, 21, 33, 4][i] },
    { ufficio_id: 1, settimana: s, metrica: 'portafoglio', obiettivo: null, risultato: [2, 3, 1, 1][i] },
  ])

  it('somma le attività', () => {
    expect(totaliPeriodo(righe, metriche).get('app_vendita')).toEqual({ obiettivo: 40, risultato: 58 })
  })
  it('per i dati di zona prende l\'ultima settimana, anche se le righe arrivano in disordine', () => {
    expect(totaliPeriodo([...righe].reverse(), metriche).get('portafoglio')?.risultato).toBe(1)
  })
  it('lascia vuoto l\'obiettivo se nessuna settimana lo ha', () => {
    const r: Rilevazione[] = [{ ufficio_id: 1, settimana: '2026-02-02', metrica: 'app_vendita', obiettivo: null, risultato: 3 }]
    expect(totaliPeriodo(r, metriche).get('app_vendita')).toEqual({ obiettivo: null, risultato: 3 })
  })
})

describe('lettura delle caselle', () => {
  it('accetta interi non negativi e vuoto', () => {
    expect(leggiNumero(' 12 ')).toBe(12)
    expect(leggiNumero('')).toBeNull()
    expect(leggiNumero('0')).toBe(0)
  })
  it('rifiuta negativi, decimali e testo', () => {
    expect(leggiNumero('-1')).toBe('errore')
    expect(leggiNumero('2,5')).toBe('errore')
    expect(leggiNumero('u')).toBe('errore')   // il "u" trovato nel file di Somalia
  })
})

describe('formattazione', () => {
  it('scrive percentuali ed esiti all\'italiana', () => {
    expect(formattaPercentuale(0.0556)).toBe('5,6%')
    expect(formattaPercentuale(null)).toBe('—')
    expect(formattaEsito(6)).toBe('+6')
    expect(formattaEsito(-4)).toBe('-4')
    expect(formattaEsito(0)).toBe('0')
  })
})

import { nomeDaEmail, suggerisciNomeUtente } from './account'
describe('nomi utente', () => {
  it('mostra il nome utente al posto dell\'email tecnica', () => {
    expect(nomeDaEmail('rapportini.gruppo+somalia@gmail.com')).toBe('somalia')
    expect(nomeDaEmail('davide@demo')).toBe('davide')
    expect(nomeDaEmail(null)).toBe('')
  })
  it('suggerisce un nome utente valido dal nome dell\'ufficio', () => {
    expect(suggerisciNomeUtente('Città Studi')).toBe('citta-studi')
    expect(suggerisciNomeUtente('San Giovanni (Roma)')).toBe('san-giovanni-roma')
  })
})
