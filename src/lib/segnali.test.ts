import { describe, expect, it } from 'vitest'
import { calcolaSegnali, inizioSegnali, perUfficio } from './segnali'
import { aggiungiSettimane } from './settimane'
import type { Metrica, Rilevazione, Ufficio } from './tipi'

const ULTIMA = '2026-10-12'
const uffici: Ufficio[] = [1, 2, 3].map((id) => ({ id, nome: `Ufficio ${id}`, citta_id: 1, area_id: null, attivo: true }))
const attivita: Metrica[] = [{ codice: 'app_vendita', nome: 'App.ti vendita', tipo: 'attivita', ordine: 1 }]
/** 16 settimane fino a ULTIMA: i valori dati, dalla più vecchia */
const serie = (ufficio_id: number, valori: (number | null)[], da_mensile = false): Rilevazione[] =>
  valori.map((v, i) => ({ ufficio_id, settimana: aggiungiSettimane(ULTIMA, i - valori.length + 1), metrica: 'app_vendita', obiettivo: null, risultato: v, da_mensile }))
const base = [10, 9, 11, 10, 9, 11, 10, 9, 11, 10, 9, 11]       // media 10, oscillazione normale piccola

describe('segnali della settimana', () => {
  it('calo prolungato: 4 settimane di fila sotto la media, con uno scarto vero', () => {
    const s = calcolaSegnali(serie(1, [...base, 7, 6, 7, 5]), uffici, attivita, ULTIMA)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ tipo: 'calo', positivo: false, testo: 'App.ti vendita sotto la sua media da 4 settimane', dettaglio: 'media 10 · ultime 4 settimane: 7, 6, 7, 5' })
  })

  it('appena sotto la media non è un allarme', () => {
    expect(calcolaSegnali(serie(1, [...base, 9, 9, 9, 9]), uffici, attivita, ULTIMA)).toHaveLength(0)
  })

  it('fuori dal solito: una settimana oltre la normale oscillazione dell\'ufficio, in giù o in su', () => {
    const giu = calcolaSegnali(serie(1, [...base, 10, 11, 10, 3]), uffici, attivita, ULTIMA)
    expect(giu[0]).toMatchObject({ tipo: 'basso', testo: 'App.ti vendita molto sotto il solito questa settimana' })
    expect(giu[0].dettaglio).toBe('3 contro una media di 10 (di solito tra 8 e 12)')
    const su = calcolaSegnali(serie(2, [...base, 10, 9, 10, 18]), uffici, attivita, ULTIMA)
    expect(su[0]).toMatchObject({ tipo: 'alto', positivo: true })
  })

  it('crescita prolungata è una buona notizia', () => {
    expect(calcolaSegnali(serie(3, [...base, 13, 14, 13, 15]), uffici, attivita, ULTIMA)[0]).toMatchObject({ tipo: 'crescita', positivo: true })
  })

  it('le settimane completate dal mensile non contano, e servono almeno 8 settimane scritte', () => {
    // le ultime 4 sono ricostruite: niente segnale anche se basse
    const righe = [...serie(1, [...base, null, null, null, null]), ...serie(1, [null, null, null, null, null, null, null, null, null, null, null, null, 5, 5, 5, 5], true)]
    expect(calcolaSegnali(righe.filter((r) => r.risultato !== null), uffici, attivita, ULTIMA)).toHaveLength(0)
    expect(calcolaSegnali(serie(1, [null, null, null, null, null, 10, 9, 11, 10, 9, 11, 10, 2, 2, 2, 2]), uffici, attivita, ULTIMA)).toHaveLength(0)
  })

  it('voci piccole (media sotto 2 a settimana): nessun segnale, né in giù né in su', () => {
    expect(calcolaSegnali(serie(1, [1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1, 2, 0]), uffici, attivita, ULTIMA)).toHaveLength(0)
    expect(calcolaSegnali(serie(1, [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 2, 2, 2, 3]), uffici, attivita, ULTIMA)).toHaveLength(0)
  })

  it('raggruppa per ufficio, prima chi ha più segnali', () => {
    const due: Metrica[] = [...attivita, { codice: 'proposte', nome: 'Proposte', tipo: 'attivita', ordine: 2 }]
    const righe = [...serie(1, [...base, 7, 6, 7, 5]), ...serie(2, [...base, 7, 6, 7, 5]),
      ...serie(2, [...base, 7, 6, 7, 5]).map((r) => ({ ...r, metrica: 'proposte' }))]
    expect(perUfficio(calcolaSegnali(righe, uffici, due, ULTIMA)).map((g) => [g.ufficio.id, g.segnali.length])).toEqual([[2, 2], [1, 1]])
    expect(inizioSegnali(ULTIMA)).toBe(aggiungiSettimane(ULTIMA, -15))
  })
})
