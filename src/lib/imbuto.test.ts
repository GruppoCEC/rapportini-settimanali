import { describe, expect, it } from 'vitest'
import { calcolaImbuto, confrontaPassaggio, IMBUTO_MENSILE, IMBUTO_SETTIMANALE, sommaPeriodi } from './imbuto'

const valori = (o: Record<string, number | null>) => new Map(Object.entries(o))

describe('imbuto della vendita', () => {
  it('calcola i passaggi tra le fasi in parole semplici', () => {
    const i = calcolaImbuto(IMBUTO_MENSILE, valori({
      acquisizioni: 20, incarichi_vendita: 8, appuntamenti_vendita: 39, proposte_vendita: 6, accettazioni_vendita: 6, vendite_effettuate: 4,
    }))
    expect(i.fasi.map((f) => f.valore)).toEqual([20, 8, 39, 6, 6, 4])
    expect(i.passaggi[0]).toMatchObject({ rapporto: 0.4, valore: '40%', testo: 'delle acquisizioni diventa incarico' })
    expect(i.passaggi[1]).toBeNull()                                     // incarichi → appuntamenti: nessun passaggio
    expect(i.passaggi[2]).toMatchObject({ valore: '1 ogni 6,5', numero: '6,5', testo: 'appuntamenti per ogni proposta' })
    expect(i.passaggi[3]).toMatchObject({ valore: '100%', testo: 'delle proposte è accettata' })
    expect(i.passaggi[4]).toMatchObject({ valore: '66,7%' })
  })

  it('con meno di 5 casi o un dato mancante il passaggio non si calcola, e mai #DIV/0!', () => {
    const i = calcolaImbuto(IMBUTO_SETTIMANALE, valori({ valutazioni: 4, incarichi: 1, app_vendita: 0, proposte: 0, vendite: null }))
    expect(i.passaggi[0]).toMatchObject({ rapporto: null, valore: '—', motivo: 'pochi' })
    expect(i.passaggi[2]).toMatchObject({ rapporto: null, motivo: 'pochi' })       // 0 appuntamenti: niente divisione per zero
    expect(i.passaggi[3]).toMatchObject({ rapporto: null, motivo: 'mancante' })
  })

  it('nessuna proposta su tanti appuntamenti', () => {
    const i = calcolaImbuto(IMBUTO_SETTIMANALE, valori({ valutazioni: 0, incarichi: 0, app_vendita: 12, proposte: 0, vendite: 0 }))
    expect(i.passaggi[2]).toMatchObject({ rapporto: 0, valore: '0 su 12', numero: '0', testo: 'proposte su 12 appuntamenti' })
  })

  it('somma più periodi voce per voce, lasciando vuote le voci mai inserite', () => {
    const s = sommaPeriodi([valori({ incarichi: 2, vendite: null }), valori({ incarichi: 3 })], ['incarichi', 'vendite'])
    expect([...s]).toEqual([['incarichi', 5], ['vendite', null]])
  })

  it('confronta un passaggio con quello della città', () => {
    const p = (rapporto: number | null) => ({ rapporto, valore: '', numero: '', testo: '' })
    expect(confrontaPassaggio(p(0.5), p(0.4))).toBe('sopra')
    expect(confrontaPassaggio(p(0.3), p(0.4))).toBe('sotto')
    expect(confrontaPassaggio(p(null), p(0.4))).toBeNull()
    expect(confrontaPassaggio(null, p(0.4))).toBeNull()
  })
})
