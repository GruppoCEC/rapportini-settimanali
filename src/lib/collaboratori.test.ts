import { describe, expect, it } from 'vitest'
import { arrivatoDaTrasferimento, curvaCrescita, daSeguire, media, mediaRuolo, meseDiServizio, nuoviEntrati, numeriPersona, rispettoAllaMedia } from './collaboratori'
import type { Persona, ValoreMensile, VoceMensile } from './tipi'

const voci: VoceMensile[] = [
  { codice: 'incarichi_vendita', gruppo: 'Incarichi', sotto: 'vendita', ordine: 1 },
  { codice: 'incarichi_scaduti', gruppo: 'Incarichi scaduti', sotto: null, ordine: 2, meglio_se_scende: true },
]
const persona = (id: number, ruolo: Persona['ruolo'], data_inizio: string, data_fine: string | null = null): Persona =>
  ({ id, ufficio_id: 1, nome: `Persona ${id}`, ruolo, data_inizio, data_fine })
const val = (persona_id: number, mese: string, voce: string, valore: number | null): ValoreMensile =>
  ({ persona_id, ufficio_id: 1, mese, voce, valore })

describe('scheda del collaboratore', () => {
  const persone = [
    persona(1, 'collaboratore', '2020-01-01'),
    persona(2, 'collaboratore', '2021-01-01'),
    persona(3, 'collaboratore', '2021-01-01', '2026-08-20'),   // uscito ad agosto: ad agosto non conta
    persona(4, 'coordinatrice', '2021-01-01'),                  // altro ruolo
  ]
  const valori = [
    val(1, '2026-08-01', 'incarichi_vendita', 4), val(2, '2026-08-01', 'incarichi_vendita', 2), val(2, '2026-08-01', 'incarichi_scaduti', 1),
    val(3, '2026-08-01', 'incarichi_vendita', 50), val(4, '2026-08-01', 'incarichi_vendita', 30),
  ]

  it('prende i numeri di una persona in un mese', () => {
    expect([...numeriPersona(valori, 2, '2026-08-01', voci)]).toEqual([['incarichi_vendita', 2], ['incarichi_scaduti', 1]])
    expect([...numeriPersona(valori, 1, '2026-07-01', voci)]).toEqual([['incarichi_vendita', null], ['incarichi_scaduti', null]])
  })

  it('la media è tra i colleghi dello stesso ruolo in servizio, solo dove il numero c\'è', () => {
    const m = mediaRuolo(persone, valori, 'collaboratore', '2026-08-01', voci)
    expect(m.get('incarichi_vendita')).toBe(3)          // (4 + 2) ÷ 2: né chi è uscito né la coordinatrice
    expect(m.get('incarichi_scaduti')).toBe(1)
    expect(media([], ['incarichi_vendita']).get('incarichi_vendita')).toBeNull()
  })

  it('confronta con la media, al contrario per le voci "meglio se scende"', () => {
    expect(rispettoAllaMedia(4, 3, voci[0])).toBe('sopra')
    expect(rispettoAllaMedia(2, 3, voci[0])).toBe('sotto')
    expect(rispettoAllaMedia(2, 3, voci[1])).toBe('sopra')            // meno incarichi scaduti = meglio
    expect(rispettoAllaMedia(null, 3, voci[0])).toBeNull()
  })
})

describe('curva dei nuovi', () => {
  const mesi = ['2026-07-01', '2026-08-01', '2026-09-01']
  // tre nuovi entrati a luglio, uno ad agosto (a metà mese: agosto è il suo 1° mese)
  const persone = [
    persona(1, 'collaboratore', '2026-07-01'), persona(2, 'collaboratore', '2026-07-10'), persona(3, 'collaboratore', '2026-07-31'),
    persona(4, 'collaboratore', '2026-08-15'), persona(5, 'collaboratore', '2018-01-01'), persona(6, 'marketer', '2026-07-01'),
  ]
  const valori = [
    ...[1, 2, 3].map((id) => val(id, '2026-07-01', 'incarichi_vendita', id)),            // 1° mese: 1, 2, 3
    ...[1, 2, 3].map((id) => val(id, '2026-08-01', 'incarichi_vendita', id * 2)),        // 2° mese: 2, 4, 6
    val(4, '2026-08-01', 'incarichi_vendita', 9),                                          // 1° mese di Persona 4
    val(5, '2026-09-01', 'incarichi_vendita', 40), val(6, '2026-07-01', 'incarichi_vendita', 99),
  ]

  it('conta il mese di servizio dal mese di inizio', () => {
    expect(meseDiServizio(persone[0], '2026-07-01')).toBe(1)
    expect(meseDiServizio(persone[1], '2026-07-01')).toBe(1)   // iniziato il 10 luglio: luglio è il 1° mese
    expect(meseDiServizio(persone[1], '2026-08-01')).toBe(2)   // e agosto il 2°
  })

  it('fa la media per mese di servizio, solo con almeno 3 persone', () => {
    const c = curvaCrescita(persone, valori, mesi, 'collaboratore', 'incarichi_vendita', 4)
    expect(c[0]).toEqual({ persone: 4, valore: (1 + 2 + 3 + 9) / 4 })
    expect(c[1].persone).toBe(3)
    expect(c[2]).toEqual({ persone: 0, valore: null })
  })

  it('elenca i nuovi entrati e segnala chi è sotto la metà della media', () => {
    expect(nuoviEntrati(persone, 'collaboratore', '2026-09-01', 12).map((p) => p.id)).toEqual([4, 3, 2, 1])
    expect(daSeguire(1, 3.75, voci[0])).toBe(true)
    expect(daSeguire(2, 3.75, voci[0])).toBe(false)
    expect(daSeguire(9, 3, voci[1])).toBe(true)          // incarichi scaduti: sopra il doppio della media
    expect(daSeguire(0, 0, voci[0])).toBe(false)
  })

  it('chi arriva da un altro ufficio con un trasferimento (017) non è un nuovo entrato', () => {
    const prima: Persona = { ...persona(7, 'collaboratore', '2022-05-03', '2026-08-01'), nome: 'Emanuel Stefan', motivo_fine: 'trasferimento' }
    const dopo: Persona = { ...persona(8, 'collaboratore', '2026-08-01'), ufficio_id: 2, nome: 'Emanuel Stefan' }
    const omonimo: Persona = { ...persona(9, 'collaboratore', '2026-08-01'), nome: 'Emanuel Rossi' }
    const tutti = [...persone, prima, dopo, omonimo]
    expect(arrivatoDaTrasferimento(dopo, tutti)).toBe(true)
    expect(arrivatoDaTrasferimento(omonimo, tutti)).toBe(false)
    expect(nuoviEntrati(tutti, 'collaboratore', '2026-09-01', 12).map((p) => p.id)).toEqual([4, 9, 3, 2, 1])
    const c = curvaCrescita([...tutti], [...valori, val(8, '2026-08-01', 'incarichi_vendita', 50)], mesi, 'collaboratore', 'incarichi_vendita', 4)
    expect(c[0]).toEqual({ persone: 4, valore: (1 + 2 + 3 + 9) / 4 })   // i 50 di chi è arrivato col trasferimento non contano
  })
})
