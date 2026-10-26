// Test del calendario dei promemoria (scripts/promemoria-calendario.mjs):
// quando parte ogni email e quali uffici risultano senza rapportino mensile.
import { describe, expect, it } from 'vitest'
import {
  chiaveMensile, dalAl, inItalia, oraMensile, promemoriaMensiliDiOggi, settimanaDelPromemoria, statoMensile as statoScript, tipoSettimanale,
} from '../scripts/promemoria-calendario.mjs'
import { statoMensile as statoSito, inServizio } from '../src/lib/mensile'
import type { Persona, ValoreMensile, VoceMensile } from '../src/lib/tipi'

// Orari di GitHub (UTC) → ora italiana, con e senza ora legale
describe('promemoria settimanali', () => {
  it('sabato alle 10 italiane, sia d\'estate sia d\'inverno', () => {
    expect(tipoSettimanale(inItalia('2026-10-17T08:00:00Z'))).toBe('sabato')    // ora legale: 10:00
    expect(tipoSettimanale(inItalia('2026-11-21T08:00:00Z'))).toBe(null)        // ora solare: 9:00, troppo presto
    expect(tipoSettimanale(inItalia('2026-11-21T09:00:00Z'))).toBe('sabato')    // ora solare: 10:00
    // terzo orario di GitHub: secondo tentativo, sia d'estate (12:00) sia d'inverno (11:00)
    expect(tipoSettimanale(inItalia('2026-10-17T10:00:00Z'))).toBe('sabato')
    expect(tipoSettimanale(inItalia('2026-11-21T10:00:00Z'))).toBe('sabato')
  })
  it('il sabato fino alle 15, quando gli uffici chiudono', () => {
    expect(tipoSettimanale(inItalia('2026-10-24T12:32:00Z'))).toBe('sabato')    // 14:32 con l'ora legale (GitHub in ritardo)
    expect(tipoSettimanale(inItalia('2026-11-21T13:59:00Z'))).toBe('sabato')    // 14:59 con l'ora solare
    expect(tipoSettimanale(inItalia('2026-11-21T14:00:00Z'))).toBe(null)        // 15:00: troppo tardi
  })
  it('lunedì alle 9:30 italiane, giorno della riunione', () => {
    expect(tipoSettimanale(inItalia('2026-10-19T07:30:00Z'))).toBe('lunedi')    // ora legale: 9:30
    expect(tipoSettimanale(inItalia('2026-11-23T07:30:00Z'))).toBe(null)        // ora solare: 8:30, troppo presto
    expect(tipoSettimanale(inItalia('2026-11-23T08:30:00Z'))).toBe('lunedi')    // ora solare: 9:30
    expect(tipoSettimanale(inItalia('2026-10-19T07:29:00Z'))).toBe(null)        // 9:29: non ancora
  })
  it('il lunedì GitHub può riprovare, ma non oltre le 11:30 (riunioni: Milano alle 12, Roma alle 13)', () => {
    expect(tipoSettimanale(inItalia('2026-10-19T09:00:00Z'))).toBe('lunedi')    // 11:00 con l'ora legale
    expect(tipoSettimanale(inItalia('2026-11-23T10:00:00Z'))).toBe('lunedi')    // 11:00 con l'ora solare
    expect(tipoSettimanale(inItalia('2026-10-19T09:30:00Z'))).toBe(null)        // 11:30: troppo tardi
    expect(tipoSettimanale(inItalia('2026-11-23T10:45:00Z'))).toBe(null)        // 11:45: troppo tardi
  })
  it('il sabato chiede la settimana in corso, il lunedì quella appena chiusa', () => {
    expect(settimanaDelPromemoria('sabato', '2026-10-17')).toBe('2026-10-12')
    expect(settimanaDelPromemoria('lunedi', '2026-10-19')).toBe('2026-10-12')
  })
  it('venerdì e domenica non parte più nulla', () => {
    expect(tipoSettimanale(inItalia('2026-10-16T14:00:00Z'))).toBe(null)        // venerdì 16:00
    expect(tipoSettimanale(inItalia('2026-10-18T08:00:00Z'))).toBe(null)        // domenica 10:00
  })
  it('la settimana si scrive in italiano corretto', () => {
    expect(dalAl('2026-10-12', '2026-10-18')).toBe('dal 12 al 18 ottobre')
    expect(dalAl('2026-09-28', '2026-10-04')).toBe('dal 28 settembre al 4 ottobre')
    expect(dalAl('2026-06-08', '2026-06-14')).toBe("dall'8 al 14 giugno")
    expect(dalAl('2026-06-01', '2026-06-07')).toBe('dal 1° al 7 giugno')
  })
  it('i promemoria mensili si controllano alle 10 di ogni giorno', () => {
    expect(oraMensile(inItalia('2026-10-14T08:00:00Z'))).toBe(true)    // 10:00
    expect(oraMensile(inItalia('2026-10-19T07:30:00Z'))).toBe(false)   // lunedì 9:30
  })
})

describe('promemoria mensili', () => {
  // Settembre 2026: scadenza il 5 ottobre alle 23:59 italiane (21:59 UTC con l'ora legale)
  const settembre = { mese: '2026-09-01', scadenza: '2026-10-05T21:59:00+00:00', blocca: false }

  it('3 giorni prima, il giorno prima e il giorno dopo la scadenza', () => {
    expect(promemoriaMensiliDiOggi('2026-10-02', [settembre]).map((p) => p.tipo)).toEqual(['mensile_3giorni'])
    expect(promemoriaMensiliDiOggi('2026-10-04', [settembre]).map((p) => p.tipo)).toEqual(['mensile_vigilia'])
    expect(promemoriaMensiliDiOggi('2026-10-06', [settembre]).map((p) => p.tipo)).toEqual(['mensile_riepilogo'])
  })
  it('negli altri giorni nessun promemoria', () => {
    for (const giorno of ['2026-10-01', '2026-10-03', '2026-10-05', '2026-10-07']) {
      expect(promemoriaMensiliDiOggi(giorno, [settembre])).toEqual([])
    }
  })
  it('il giorno della scadenza è quello italiano (6 dicembre 00:30 in Italia = 5 dicembre 23:30 UTC)', () => {
    const novembre = { mese: '2026-11-01', scadenza: '2026-12-05T23:30:00+00:00', blocca: true }
    const [p] = promemoriaMensiliDiOggi('2026-12-05', [novembre])
    expect(p.tipo).toBe('mensile_vigilia')
    expect(p.scadenza.giorno).toBe('2026-12-06')
    expect(p.scadenza.orario).toBe('00:30')
  })
  it('se la scadenza viene spostata, i promemoria ripartono per la nuova data', () => {
    expect(chiaveMensile('mensile_vigilia', '2026-09-01', '2026-10-05')).toEqual({ tipo: 'mensile_vigilia:2026-09', settimana: '2026-10-05' })
    expect(chiaveMensile('mensile_vigilia', '2026-09-01', '2026-10-08')).not.toEqual(chiaveMensile('mensile_vigilia', '2026-09-01', '2026-10-05'))
  })
})

describe('stato del rapportino mensile: stessa regola del sito', () => {
  const mese = '2026-09-01'
  const voci: VoceMensile[] = [
    { codice: 'acquisizioni', gruppo: 'Acquisizioni', sotto: null, ordine: 1 },
    { codice: 'ribassi', gruppo: 'Ribassi', sotto: null, ordine: 2 },
    { codice: 'fix', gruppo: 'Fix', sotto: null, ordine: 3, solo_ruolo: 'coordinatrice' },
  ]
  const persona = (id: number, data_inizio: string, data_fine: string | null = null): Persona =>
    ({ id, ufficio_id: 1, nome: `P${id}`, ruolo: 'collaboratore', data_inizio, data_fine })
  const valore = (persona_id: number, voce: string, v: number | null): ValoreMensile => ({ persona_id, ufficio_id: 1, mese, voce, valore: v })

  const casi: [string, Persona[], ValoreMensile[]][] = [
    ['nessun numero', [persona(1, '2020-01-01')], []],
    ['caselle vuote', [persona(1, '2020-01-01')], [valore(1, 'acquisizioni', null)]],
    ['una persona a metà', [persona(1, '2020-01-01'), persona(2, '2020-01-01')], [valore(1, 'acquisizioni', 3), valore(1, 'ribassi', 0)]],
    ['tutto compilato (anche con 0), indicatore facoltativo', [persona(1, '2020-01-01')], [valore(1, 'acquisizioni', 3), valore(1, 'ribassi', 0)]],
    ['chi è uscito nel mese non conta', [persona(1, '2020-01-01'), persona(2, '2020-01-01', '2026-09-20')], [valore(1, 'acquisizioni', 1), valore(1, 'ribassi', 1)]],
    ['solo numeri di chi è uscito', [persona(2, '2020-01-01', '2026-09-20')], [valore(2, 'acquisizioni', 1)]],
    ['chi entra a ottobre non conta a settembre', [persona(1, '2020-01-01'), persona(3, '2026-10-01')], [valore(1, 'acquisizioni', 1), valore(1, 'ribassi', 1)]],
  ]
  for (const [nome, persone, valori] of casi) {
    it(nome, () => {
      const sito = statoSito(persone.filter((p) => inServizio(p, mese)), valori, voci)
      expect(statoScript(persone, valori, voci, mese)).toBe(sito)
    })
  }
  it('i casi coprono tutti e tre gli stati', () => {
    const stati = new Set(casi.map(([, p, v]) => statoScript(p, v, voci, mese)))
    expect([...stati].sort()).toEqual(['completo', 'mancante', 'parziale'])
  })
})
