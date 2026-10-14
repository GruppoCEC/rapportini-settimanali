import { describe, expect, it } from 'vitest'
import {
  aggiungiMesi, formattaAnzianita, indicatori, movimentoNelMese, vociDelRapportino, formattaVariazione, inServizio, mesePredefinito, mesiDiServizio, ordinaUfficiReport,
  righeDelMese, sommaTotali, statoMensile, STAFF, titoloMese, totaleUfficio, ultimoGiornoDelMese, variazione,
} from './mensile'
import type { Persona, Ufficio, ValoreMensile, VoceMensile } from './tipi'

const voci: VoceMensile[] = [
  { codice: 'colloqui', gruppo: 'Colloqui', sotto: null, ordine: 1 },
  { codice: 'proposte_vendita', gruppo: 'Proposte', sotto: 'vendita', ordine: 2 },
]
const fix: VoceMensile = { codice: 'appuntamenti_vendita_fix', gruppo: 'App. vendita fix', sotto: null, ordine: 50, solo_ruolo: 'coordinatrice' }
const persona = (id: number, ruolo: Persona['ruolo'], data_inizio: string, data_fine: string | null = null): Persona =>
  ({ id, ufficio_id: 1, nome: `Persona ${id}`, ruolo, data_inizio, data_fine })
const val = (persona_id: number, voce: string, valore: number | null, mese = '2026-09-01'): ValoreMensile =>
  ({ persona_id, ufficio_id: 1, mese, voce, valore })

describe('mesi', () => {
  it('propone il mese appena concluso, anche a cavallo d\'anno', () => {
    expect(mesePredefinito('2026-10-14')).toBe('2026-09-01')
    expect(mesePredefinito('2027-01-03')).toBe('2026-12-01')
    expect(aggiungiMesi('2026-11-01', 3)).toBe('2027-02-01')
    expect(ultimoGiornoDelMese('2028-02-01')).toBe('2028-02-29')
    expect(titoloMese('2026-09-01')).toBe('Settembre 2026')
  })
})

describe('persone', () => {
  const persone = [
    persona(1, 'funzionario', '2020-01-15'),
    persona(2, 'responsabile', '2018-06-01'),
    persona(3, 'marketer', '2026-09-30'),               // inizia l'ultimo giorno del mese: conta
    persona(4, 'funzionario', '2019-01-01', '2026-08-31'), // uscita ad agosto: a settembre non c'è
    persona(5, 'coordinatrice', '2026-10-01'),          // inizia a ottobre
  ]

  it('sa chi era in servizio nel mese', () => {
    expect(persone.filter((p) => inServizio(p, '2026-09-01')).map((p) => p.id)).toEqual([1, 2, 3])
  })

  it('mette le righe in ordine di ruolo e tiene chi ha numeri anche se uscito', () => {
    expect(righeDelMese(persone, [val(4, 'colloqui', 2)], '2026-09-01').map((p) => p.id)).toEqual([2, 4, 1, 3])   // funzionari dal più anziano
  })

  it('calcola l\'anzianità a fine mese', () => {
    expect(mesiDiServizio('2023-03-01', '2026-09-01')).toBe(42)
    expect(formattaAnzianita(42)).toBe('3 anni e 6 mesi')
    expect(formattaAnzianita(12)).toBe('1 anno')
    expect(formattaAnzianita(1)).toBe('1 mese')
    expect(formattaAnzianita(mesiDiServizio('2026-09-30', '2026-09-01'))).toBe('meno di un mese')
  })
})

describe('cambi di personale nel mese', () => {
  it('verde chi entra, rosso chi esce', () => {
    expect(movimentoNelMese(persona(1, 'funzionario', '2026-09-10'), '2026-09-01')).toBe('entrata')
    expect(movimentoNelMese(persona(2, 'funzionario', '2020-01-01', '2026-09-30'), '2026-09-01')).toBe('uscita')
    expect(movimentoNelMese(persona(3, 'marketer', '2026-09-01', '2026-09-20'), '2026-09-01')).toBe('uscita')
    expect(movimentoNelMese(persona(4, 'funzionario', '2020-01-01', '2026-10-15'), '2026-09-01')).toBeNull()
    expect(movimentoNelMese(persona(5, 'funzionario', '2026-08-31'), '2026-09-01')).toBeNull()
  })
})

describe('indicatore delle coordinatrici', () => {
  const persone = [persona(1, 'coordinatrice', '2020-01-01')]
  it('App. vendita fix non entra nei totali né nello stato di compilazione', () => {
    const tutte = [...voci, fix]
    expect(vociDelRapportino(tutte)).toEqual(voci)
    expect(indicatori(tutte, 'coordinatrice')).toEqual([fix])
    expect(indicatori(tutte, 'funzionario')).toEqual([])
    const valori = [val(1, 'colloqui', 1), val(1, 'proposte_vendita', 0), val(1, 'appuntamenti_vendita_fix', 12)]
    const t = totaleUfficio(persone, valori, '2026-09-01', tutte)
    expect(t.has('appuntamenti_vendita_fix')).toBe(false)
    expect(statoMensile(persone, valori.slice(0, 2), tutte)).toBe('completo')   // completo anche senza il fix
  })
})

describe('totali', () => {
  const persone = [persona(1, 'responsabile', '2020-01-01'), persona(2, 'funzionario', '2021-01-01'), persona(3, 'funzionario', '2026-10-01')]

  it('il totale dell\'ufficio somma le persone e conta lo staff', () => {
    const t = totaleUfficio(persone, [val(1, 'colloqui', 3), val(2, 'colloqui', 4), val(2, 'proposte_vendita', 0), val(1, 'colloqui', 9, '2026-08-01')], '2026-09-01', voci)
    expect(t.get('colloqui')).toBe(7)
    expect(t.get('proposte_vendita')).toBe(0)
    expect(t.get(STAFF)).toBe(2)
  })

  it('una colonna che nessuno ha scritto resta vuota, non zero', () => {
    expect(totaleUfficio(persone, [val(1, 'colloqui', 3)], '2026-09-01', voci).get('proposte_vendita')).toBeNull()
  })

  it('il totale di gruppo somma tutti gli uffici', () => {
    const t = (colloqui: number | null, staff: number) => new Map<string, number | null>([['colloqui', colloqui], [STAFF, staff]])
    const uffici = [t(3, 4), t(null, 5), t(10, 6)]   // il terzo è come Villa Lais, dimenticata dalla formula dell'Excel
    const g = sommaTotali(uffici)
    expect(g.get('colloqui')).toBe(13)
    expect(g.get(STAFF)).toBe(15)
  })

  it('la variazione non dà mai #DIV/0!', () => {
    expect(variazione(110, 100)).toBeCloseTo(0.1)
    expect(variazione(5, 0)).toBeNull()
    expect(variazione(null, 100)).toBeNull()
    expect(variazione(100, undefined)).toBeNull()
    expect(formattaVariazione(0.125)).toBe('+12,5%')
    expect(formattaVariazione(-0.03)).toBe('−3,0%')
  })
})

describe('stato del rapportino', () => {
  const persone = [persona(1, 'responsabile', '2020-01-01'), persona(2, 'funzionario', '2021-01-01')]
  it('mancante, parziale, completo', () => {
    expect(statoMensile(persone, [], voci)).toBe('mancante')
    expect(statoMensile(persone, [val(1, 'colloqui', null)], voci)).toBe('mancante')
    expect(statoMensile(persone, [val(1, 'colloqui', 0), val(1, 'proposte_vendita', 1)], voci)).toBe('parziale')
    const tutti = persone.flatMap((p) => voci.map((v) => val(p.id, v.codice, 0)))
    expect(statoMensile(persone, tutti, voci)).toBe('completo')
  })
})

describe('ordine del report', () => {
  it('segue blocco e posizione del file, non l\'ordine alfabetico', () => {
    const u = (id: number, nome: string, blocco_mensile: number, ordine_mensile: number | null): Ufficio =>
      ({ id, nome, citta_id: 1, area_id: null, attivo: true, blocco_mensile, ordine_mensile })
    const ordinati = ordinaUfficiReport([u(1, 'Villa Lais', 2, 5), u(2, 'Somalia', 1, 13), u(3, "Casal de' Pazzi", 1, 1), u(4, 'Nuovo', 1, null), u(5, 'Espero', 2, 4)])
    expect(ordinati.map((x) => x.nome)).toEqual(["Casal de' Pazzi", 'Somalia', 'Nuovo', 'Espero', 'Villa Lais'])
  })
})
