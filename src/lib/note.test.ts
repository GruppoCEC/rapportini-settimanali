import { describe, expect, it } from 'vitest'
import { contaParole, noteIncomplete, noteObbligatorie } from './note'

describe('note della settimana obbligatorie', () => {
  it('conta le parole, non i segni', () => {
    expect(contaParole('')).toBe(0)
    expect(contaParole('   ')).toBe(0)
    expect(contaParole("Preso l'incarico in esclusiva – via Appia 12.")).toBe(7)
    expect(contaParole('ok ... - !!')).toBe(1)
  })

  it('servono almeno 6 parole in tutte e tre le caselle', () => {
    const sei = 'abbiamo preso due incarichi in esclusiva'
    expect(noteIncomplete({ bene: sei, difficolta: sei, aiuto: sei })).toEqual([])
    expect(noteIncomplete({ bene: sei, difficolta: 'poche richieste', aiuto: '' })).toEqual(['difficolta', 'aiuto'])
  })

  it('non valgono per amministratori, settimane future e settimane prima del 26/10/2026', () => {
    expect(noteObbligatorie('2026-10-26', {})).toBe(true)
    expect(noteObbligatorie('2026-10-26', { amministratore: true })).toBe(false)
    expect(noteObbligatorie('2026-11-02', { futura: true })).toBe(false)
    expect(noteObbligatorie('2026-10-19', {})).toBe(false)
  })
})
