import { describe, expect, it } from 'vitest'
import {
  aggiungiSettimane, etichettaSettimana, intervalloSettimana, lunediDi, meseDellaSettimana,
  oggiISO, settimanaNelMese, settimanaPredefinita, settimaneDelMese,
} from './settimane'

describe('lunedì della settimana', () => {
  it('trova il lunedì da qualsiasi giorno', () => {
    expect(lunediDi('2026-10-12')).toBe('2026-10-12')   // lunedì
    expect(lunediDi('2026-10-15')).toBe('2026-10-12')   // giovedì
    expect(lunediDi('2026-10-18')).toBe('2026-10-12')   // domenica
  })
  it('funziona a cavallo di mese e anno', () => {
    expect(lunediDi('2026-10-01')).toBe('2026-09-28')
    expect(lunediDi('2026-01-01')).toBe('2025-12-29')
  })
  it('non sbaglia nei giorni del cambio d\'ora', () => {
    expect(aggiungiSettimane('2026-03-23', 1)).toBe('2026-03-30')
    expect(aggiungiSettimane('2026-10-19', 1)).toBe('2026-10-26')
  })
})

describe('mese della settimana (regola del giovedì)', () => {
  it('una settimana a cavallo va nel mese del giovedì', () => {
    expect(meseDellaSettimana('2026-09-28')).toBe('2026-10')   // giovedì 1 ottobre
    expect(settimanaNelMese('2026-09-28')).toBe(1)
    expect(meseDellaSettimana('2025-12-29')).toBe('2026-01')   // giovedì 1 gennaio 2026
    expect(meseDellaSettimana('2026-12-28')).toBe('2026-12')   // giovedì 31 dicembre
  })
  it('elenca le settimane del mese: ogni mese ha 4 o 5 settimane e nessuna è contata due volte', () => {
    expect(settimaneDelMese('2026-10')).toEqual(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'])
    expect(settimaneDelMese('2026-02')).toEqual(['2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23'])
    const anno = Array.from({ length: 12 }, (_, i) => settimaneDelMese(`2026-${String(i + 1).padStart(2, '0')}`))
    expect(anno.every((s) => s.length === 4 || s.length === 5)).toBe(true)
    expect(new Set(anno.flat()).size).toBe(anno.flat().length)
  })
})

describe('settimana proposta all\'apertura', () => {
  it('il lunedì (giorno della riunione) propone la settimana appena chiusa', () => {
    expect(settimanaPredefinita('2026-10-12')).toBe('2026-10-05')
  })
  it('gli altri giorni propone la settimana in corso', () => {
    expect(settimanaPredefinita('2026-10-13')).toBe('2026-10-12')
    expect(settimanaPredefinita('2026-10-18')).toBe('2026-10-12')
  })
  it('usa la data locale', () => {
    expect(oggiISO(new Date(2026, 9, 12, 23, 30))).toBe('2026-10-12')
  })
})

describe('etichette', () => {
  it('descrive la settimana in italiano', () => {
    expect(intervalloSettimana('2026-10-05')).toBe('5 – 11 ottobre 2026')
    expect(intervalloSettimana('2026-09-28')).toBe('28 settembre – 4 ottobre 2026')
    expect(intervalloSettimana('2025-12-29')).toBe('29 dicembre 2025 – 4 gennaio 2026')
    expect(etichettaSettimana('2026-10-05')).toBe('2ª settimana di ottobre 2026')
  })
})
