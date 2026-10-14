import { describe, expect, it } from 'vitest'
import {
  aggiungiMesi, formattaAnzianita, turnoverAnno, formattaPunti, indicatori, indicatoriAccanto, leggiPunti, punteggio, variazioneBuona, vociConPunti, movimentoNelMese, vociDelRapportino, formattaVariazione, inServizio, mesePredefinito, mesiDiServizio, ordinaUfficiReport,
  righeDelMese, sommaTotali, statoMensile, STAFF, titoloMese, totaleUfficio, ultimoGiornoDelMese, variazione,
} from './mensile'
import type { Persona, Ufficio, ValoreMensile, VoceMensile } from './tipi'

const voci: VoceMensile[] = [
  { codice: 'colloqui', gruppo: 'Colloqui', sotto: null, ordine: 1 },
  { codice: 'proposte_vendita', gruppo: 'Proposte', sotto: 'vendita', ordine: 2 },
]
const fix: VoceMensile = { codice: 'appuntamenti_vendita_fix', gruppo: 'App. vendita fix', sotto: null, ordine: 50, solo_ruolo: 'coordinatrice', accanto_a: 'colloqui' }
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
    persona(1, 'collaboratore', '2020-01-15'),
    persona(2, 'responsabile', '2018-06-01'),
    persona(3, 'marketer', '2026-09-30'),               // inizia l'ultimo giorno del mese: conta
    persona(4, 'collaboratore', '2019-01-01', '2026-08-31'), // uscita ad agosto: a settembre non c'è
    persona(5, 'coordinatrice', '2026-10-01'),          // inizia a ottobre
    persona(6, 'collaboratore', '2019-01-01', '2026-09-15'), // uscita a settembre: a settembre non conta già più
    persona(7, 'marketer', '2019-01-01', '2026-10-01'), // uscita il 1° ottobre: settembre lo ha fatto tutto
  ]

  it('sa chi era in servizio nel mese', () => {
    expect(persone.filter((p) => inServizio(p, '2026-09-01')).map((p) => p.id)).toEqual([1, 2, 3, 7])
  })

  it('mette le righe in ordine di ruolo e non mostra chi è uscito nel mese', () => {
    expect(righeDelMese(persone, '2026-09-01').map((p) => p.id)).toEqual([2, 1, 7, 3])   // marketer dal più anziano
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
    expect(movimentoNelMese(persona(1, 'collaboratore', '2026-09-10'), '2026-09-01')).toBe('entrata')
    expect(movimentoNelMese(persona(2, 'collaboratore', '2020-01-01', '2026-09-30'), '2026-09-01')).toBe('uscita')
    expect(movimentoNelMese(persona(3, 'marketer', '2026-09-01', '2026-09-20'), '2026-09-01')).toBe('uscita')
    expect(movimentoNelMese(persona(4, 'collaboratore', '2020-01-01', '2026-10-15'), '2026-09-01')).toBeNull()
    expect(movimentoNelMese(persona(5, 'collaboratore', '2026-08-31'), '2026-09-01')).toBeNull()
  })
})

describe('indicatore delle coordinatrici', () => {
  const persone = [persona(1, 'coordinatrice', '2020-01-01')]
  it('App. vendita fix non entra nei totali né nello stato di compilazione', () => {
    const tutte = [...voci, fix]
    expect(vociDelRapportino(tutte)).toEqual(voci)
    expect(indicatori(tutte, 'coordinatrice')).toEqual([fix])
    expect(indicatori(tutte, 'collaboratore')).toEqual([])
    expect(indicatoriAccanto(tutte, 'colloqui', 'coordinatrice')).toEqual([fix])
    expect(indicatoriAccanto(tutte, 'colloqui', 'collaboratore')).toEqual([])
    const valori = [val(1, 'colloqui', 1), val(1, 'proposte_vendita', 0), val(1, 'appuntamenti_vendita_fix', 12)]
    const t = totaleUfficio(persone, valori, '2026-09-01', tutte)
    expect(t.has('appuntamenti_vendita_fix')).toBe(false)
    expect(statoMensile(persone, valori.slice(0, 2), tutte)).toBe('completo')   // completo anche senza il fix
  })
})

describe('totali', () => {
  const persone = [persona(1, 'responsabile', '2020-01-01'), persona(2, 'collaboratore', '2021-01-01'), persona(3, 'collaboratore', '2026-10-01')]

  it('il totale dell\'ufficio somma le persone e conta lo staff', () => {
    const t = totaleUfficio(persone, [val(1, 'colloqui', 3), val(2, 'colloqui', 4), val(2, 'proposte_vendita', 0), val(1, 'colloqui', 9, '2026-08-01')], '2026-09-01', voci)
    expect(t.get('colloqui')).toBe(7)
    expect(t.get('proposte_vendita')).toBe(0)
    expect(t.get(STAFF)).toBe(2)
  })

  it('chi è uscito nel mese non conta nel totale né nello staff, anche se aveva dei numeri', () => {
    const conUscita = [...persone, persona(9, 'collaboratore', '2020-01-01', '2026-09-20')]
    const t = totaleUfficio(conUscita, [val(1, 'colloqui', 3), val(9, 'colloqui', 50)], '2026-09-01', voci)
    expect(t.get('colloqui')).toBe(3)
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

describe('turnover dell\'anno', () => {
  it('elenca chi è uscito nell\'anno con l\'anzianità all\'uscita e calcola il tasso', () => {
    const persone = [
      persona(1, 'collaboratore', '2020-03-01', '2026-02-15'),   // uscito a febbraio: 5 anni e 11 mesi
      persona(2, 'marketer', '2025-06-01', '2026-09-30'),        // uscito a settembre: 1 anno e 3 mesi
      persona(3, 'collaboratore', '2018-01-01'),                 // ancora in ufficio
      persona(4, 'coordinatrice', '2019-01-01', '2025-12-31'),   // uscito l'anno prima: non conta nel 2026
      persona(5, 'collaboratore', '2026-04-01', '2026-07-10'),   // entrato e uscito nel 2026
    ]
    const t = turnoverAnno(persone, '2026')
    expect(t.usciti.map((u) => [u.persona.id, u.mesi])).toEqual([[1, 71], [5, 3], [2, 15]])
    expect(t.organicoInizio).toBe(3)            // persone 1, 2, 3 al 1° gennaio 2026
    expect(t.tasso).toBe(1)                     // 3 uscite su 3
    expect(t.anzianitaMedia).toBe(30)
  })
})

describe('gara a punti dei collaboratori', () => {
  const gestione: VoceMensile = { codice: 'gestione_incarichi', gruppo: 'Gestione incarichi', sotto: null, ordine: 3, con_punti: false }
  it('Gestione incarichi e il fix non danno punti', () => {
    expect(vociConPunti([...voci, gestione, fix]).map((v) => v.codice)).toEqual(['colloqui', 'proposte_vendita'])
  })
  it('punteggio = somma di numero × punti, anche con punti negativi e decimali', () => {
    const punti = new Map([['colloqui', 2.5], ['proposte_vendita', 4], ['incarichi_scaduti', -3]])
    expect(punteggio([val(1, 'colloqui', 4), val(1, 'proposte_vendita', 2), val(1, 'incarichi_scaduti', 1), val(1, 'kiron', 9)], punti)).toBe(15)
    expect(punteggio([], punti)).toBeNull()                                   // nessun numero nel mese
    expect(punteggio([val(1, 'colloqui', 4)], new Map())).toBeNull()        // punti non ancora decisi
    expect(formattaPunti(12.5)).toBe('12,5')
    expect(formattaPunti(-3)).toBe('−3')
  })
  it('legge i punti scritti all\'italiana', () => {
    expect(leggiPunti('2,5')).toBe(2.5)
    expect(leggiPunti('-3')).toBe(-3)
    expect(leggiPunti('')).toBeNull()
    expect(leggiPunti('tre')).toBe('errore')
  })
})

describe('colore della variazione', () => {
  it('per gli incarichi scaduti un aumento è negativo', () => {
    const scaduti: VoceMensile = { codice: 'incarichi_scaduti', gruppo: 'Incarichi scaduti', sotto: null, ordine: 19, meglio_se_scende: true }
    expect(variazioneBuona(0.2, scaduti)).toBe(false)
    expect(variazioneBuona(-0.2, scaduti)).toBe(true)
    expect(variazioneBuona(0.2, voci[0])).toBe(true)
    expect(variazioneBuona(-0.2)).toBe(false)
  })
})

describe('stato del rapportino', () => {
  const persone = [persona(1, 'responsabile', '2020-01-01'), persona(2, 'collaboratore', '2021-01-01')]
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
