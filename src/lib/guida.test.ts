import { describe, expect, it } from 'vitest'
import { guidaDaMostrare, guidaNascosta, ricordaChiusura, type Memoria, type MemorieGuida } from './guida'

/** Memoria finta, come quella del browser */
function memoria(): Memoria {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v) }, removeItem: (k) => { m.delete(k) } }
}
const nuove = (): MemorieGuida => ({ sempre: memoria(), sessione: memoria() })

describe('guida di Inserisci mese', () => {
  it('si apre da sola a uffici e affiliati, non agli amministratori', () => {
    const m = nuove()
    expect(guidaDaMostrare('somalia', false, m)).toBe(true)
    expect(guidaDaMostrare('davide', true, m)).toBe(false)
  })

  it('con Salta non ricompare nella stessa scheda, ma torna in una nuova', () => {
    const m = nuove()
    ricordaChiusura('somalia', false, m)
    expect(guidaDaMostrare('somalia', false, m)).toBe(false)
    expect(guidaDaMostrare('somalia', false, { sempre: m.sempre, sessione: memoria() })).toBe(true)
  })

  it('con "Non mostrare più" non torna più, solo per quel nome utente', () => {
    const m = nuove()
    ricordaChiusura('somalia', true, m)
    const nuovaScheda = { sempre: m.sempre, sessione: memoria() }
    expect(guidaNascosta('somalia', nuovaScheda)).toBe(true)
    expect(guidaDaMostrare('somalia', false, nuovaScheda)).toBe(false)
    expect(guidaDaMostrare('trieste', false, nuovaScheda)).toBe(true)
  })

  it('togliendo la spunta si riapre di nuovo da sola', () => {
    const m = nuove()
    ricordaChiusura('somalia', true, m)
    ricordaChiusura('somalia', false, m)
    expect(guidaDaMostrare('somalia', false, { sempre: m.sempre, sessione: memoria() })).toBe(true)
  })

  it('senza memoria del browser (finestra privata, dati bloccati) si apre e non si rompe', () => {
    const rotta: Memoria = { getItem: () => { throw new Error('bloccata') }, setItem: () => { throw new Error('bloccata') }, removeItem: () => { throw new Error('bloccata') } }
    expect(guidaDaMostrare('somalia', false, { sempre: null, sessione: null })).toBe(true)
    expect(() => ricordaChiusura('somalia', true, { sempre: rotta, sessione: rotta })).not.toThrow()
    expect(guidaDaMostrare('somalia', false, { sempre: rotta, sessione: rotta })).toBe(true)
  })
})
