import { describe, expect, it } from 'vitest'
import {
  aggiungiMesi, formattaAnzianita, mesiDellAnno, totaleAnnoUfficio, meseChiuso, scadenzaPassata, scadenzaProposta, turnoverAnno, ultimoRitardo, formattaPunti, indicatori, indicatoriAccanto, leggiPunti, punteggio, variazioneBuona, vociConPunti, movimentoNelMese, vociDelRapportino, formattaVariazione, inServizio, mesePredefinito, mesiDiServizio, ordinaUfficiReport,
  presenteNelMese, righeDelMese, riepilogoDaRighe, riepilogoMensile, sommaTotali, statoMensile, STAFF, titoloMese, totaleConStorico, totaleUfficio, ultimoGiornoDelMese, variazione, vociRiservate,
} from './mensile'
import type { Persona, StoricoMensile, Ufficio, ValoreMensile, VoceMensile } from './tipi'

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
    persona(6, 'collaboratore', '2019-01-01', '2026-09-15'), // uscita a settembre: c'è nel rapportino (riga rossa), non nello staff
    persona(7, 'marketer', '2019-01-01', '2026-10-01'), // uscita il 1° ottobre: settembre lo ha fatto tutto
  ]

  it('sa chi era in servizio nel mese', () => {
    expect(persone.filter((p) => inServizio(p, '2026-09-01')).map((p) => p.id)).toEqual([1, 2, 3, 7])
  })

  it('mette le righe in ordine di ruolo e mostra anche chi è uscito durante il mese (018)', () => {
    expect(righeDelMese(persone, '2026-09-01').map((p) => p.id)).toEqual([2, 6, 1, 7, 3])   // per anzianità; marketer dal più anziano
  })

  it('presente nel mese: anche chi esce durante il mese, non chi esce il 1° o prima', () => {
    expect(persone.filter((p) => presenteNelMese(p, '2026-09-01')).map((p) => p.id)).toEqual([1, 2, 3, 6, 7])
    expect(presenteNelMese(persona(8, 'collaboratore', '2019-01-01', '2026-09-01'), '2026-09-01')).toBe(false)
    expect(presenteNelMese(persona(8, 'collaboratore', '2019-01-01', '2026-09-02'), '2026-09-01')).toBe(true)
    expect(inServizio(persona(8, 'collaboratore', '2019-01-01', '2026-09-02'), '2026-09-01')).toBe(false)
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

  it('chi è uscito durante il mese conta nel totale con i suoi numeri, ma non nello staff (018)', () => {
    const conUscita = [...persone, persona(9, 'collaboratore', '2020-01-01', '2026-09-20'), persona(10, 'collaboratore', '2020-01-01', '2026-09-01')]
    const t = totaleUfficio(conUscita, [val(1, 'colloqui', 3), val(9, 'colloqui', 50), val(10, 'colloqui', 7)], '2026-09-01', voci)
    expect(t.get('colloqui')).toBe(53)          // 3 + 50; chi è uscito il 1° settembre (7) no
    expect(t.get(STAFF)).toBe(2)
  })

  it('le voci riservate (Locazioni effettuate) non sono colonne del rapportino né dei totali', () => {
    const conRiservata = [...voci, { codice: 'locazioni_effettuate', gruppo: 'Locazioni effettuate', sotto: null, ordine: 60, riservata: true }]
    expect(vociDelRapportino(conRiservata).map((v) => v.codice)).not.toContain('locazioni_effettuate')
    expect(vociRiservate(conRiservata).map((v) => v.codice)).toEqual(['locazioni_effettuate'])
    expect(totaleUfficio(persone, [val(1, 'locazioni_effettuate', 4)], '2026-09-01', conRiservata).has('locazioni_effettuate')).toBe(false)
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

describe('riepilogo dell\'anno', () => {
  it('somma i mesi voce per voce, lo staff è quello dell\'ultimo mese', () => {
    expect(mesiDellAnno('2026', '2026-03-01')).toEqual(['2026-01-01', '2026-02-01', '2026-03-01'])
    expect(mesiDellAnno('2025', '2026-09-01')).toHaveLength(12)
    const persone = [persona(1, 'collaboratore', '2020-01-01'), persona(2, 'collaboratore', '2020-01-01', '2026-02-20'), persona(3, 'marketer', '2026-03-01')]
    const valori = [
      val(1, 'colloqui', 3, '2026-01-01'), val(2, 'colloqui', 4, '2026-01-01'),
      val(1, 'colloqui', 5, '2026-02-01'), val(2, 'colloqui', 9, '2026-02-01'),   // la persona 2 esce a febbraio: i suoi 9 contano (018)
      val(1, 'colloqui', 1, '2026-03-01'), val(3, 'colloqui', 2, '2026-03-01'),
    ]
    const { totale, mesiCompilati, perMese } = totaleAnnoUfficio(persone, valori, mesiDellAnno('2026', '2026-03-01'), voci)
    expect(totale.get('colloqui')).toBe(3 + 4 + 5 + 9 + 1 + 2)
    expect(totale.get('proposte_vendita')).toBeNull()
    expect(totale.get(STAFF)).toBe(2)                 // a marzo: persone 1 e 3
    expect(mesiCompilati).toBe(3)
    expect(perMese[1].get(STAFF)).toBe(1)             // a febbraio la persona 2 non è nello staff
  })
})

describe('storico dal file Excel annuale', () => {
  const persone = [persona(1, 'collaboratore', '2020-01-01'), persona(2, 'responsabile', '2020-01-01')]
  const st = (mese: string, voce: string, valore: number | null): StoricoMensile => ({ ufficio_id: 1, mese, voce, valore })
  const storico = [st('2026-01-01', 'colloqui', 7), st('2026-01-01', STAFF, 5), st('2026-01-01', 'voce_sconosciuta', 9), st('2026-02-01', 'colloqui', 4)]

  it('senza numeri persona per persona vale il totale dell\'Excel, staff compreso', () => {
    const { totale, daStorico } = totaleConStorico(persone, [], '2026-01-01', voci, storico)
    expect(daStorico).toBe(true)
    expect(totale.get('colloqui')).toBe(7)
    expect(totale.get('proposte_vendita')).toBeNull()      // cella vuota nell'Excel
    expect(totale.get(STAFF)).toBe(5)                      // lo staff dell'Excel, non le persone di oggi
    expect(totale.has('voce_sconosciuta')).toBe(false)
  })

  it('appena ci sono numeri persona per persona, valgono quelli', () => {
    const { totale, daStorico } = totaleConStorico(persone, [val(1, 'colloqui', 2, '2026-01-01')], '2026-01-01', voci, storico)
    expect(daStorico).toBe(false)
    expect(totale.get('colloqui')).toBe(2)
    expect(totale.get(STAFF)).toBe(2)
  })

  it('voce per voce (016): le voci che nessuno ha scritto persona per persona vengono dall\'Excel', () => {
    const conVendite = [...storico, st('2026-01-01', 'proposte_vendita', 3)]
    const { totale } = totaleConStorico(persone, [val(1, 'colloqui', 2, '2026-01-01')], '2026-01-01', voci, conVendite)
    expect(totale.get('colloqui')).toBe(2)                 // scritto persona per persona: vale quello
    expect(totale.get('proposte_vendita')).toBe(3)         // nessuno l'ha scritto: vale l'Excel
    expect(totale.get(STAFF)).toBe(2)                      // lo staff resta quello delle persone
  })

  it('senza storico per il mese il totale è quello di sempre', () => {
    expect(totaleConStorico(persone, [], '2026-03-01', voci, storico)).toEqual({ totale: totaleUfficio(persone, [], '2026-03-01', voci), daStorico: false })
  })

  it('il riepilogo dell\'anno somma storico e mesi della piattaforma', () => {
    const valori = [val(1, 'colloqui', 3, '2026-03-01')]
    const { totale, mesiCompilati } = totaleAnnoUfficio(persone, valori, mesiDellAnno('2026', '2026-03-01'), voci, storico)
    expect(totale.get('colloqui')).toBe(7 + 4 + 3)
    expect(mesiCompilati).toBe(3)
    expect(totale.get(STAFF)).toBe(2)                      // a marzo, dalla piattaforma
  })

  it('staff e portafoglio non si sommano: vale l\'ultimo mese compilato', () => {
    const conPortafoglio: VoceMensile[] = [...voci, { codice: 'portafoglio_vendita', gruppo: 'Portafoglio immobili', sotto: 'vendita', ordine: 0 }]
    const s = [st('2026-01-01', 'portafoglio_vendita', 20), st('2026-01-01', 'colloqui', 1), st('2026-01-01', STAFF, 5),
      st('2026-02-01', 'portafoglio_vendita', 22), st('2026-02-01', 'colloqui', 1), st('2026-02-01', STAFF, 6)]
    // marzo e aprile: nessun rapportino (né sulla piattaforma né nell'Excel)
    const { totale } = totaleAnnoUfficio(persone, [], mesiDellAnno('2026', '2026-04-01'), conPortafoglio, s)
    expect(totale.get('portafoglio_vendita')).toBe(22)     // febbraio, non 20 + 22
    expect(totale.get(STAFF)).toBe(6)                      // febbraio, ultimo mese compilato
    expect(totale.get('colloqui')).toBe(2)                 // le attività si sommano
  })
})

describe('presentazione mensile', () => {
  const t = (staff: number | null, colloqui: number | null) => new Map([[STAFF, staff], ['colloqui', colloqui]])
  const colonne = [STAFF, 'colloqui']

  it('somma gli uffici mese per mese e confronta solo chi ha il dato in entrambi i mesi', () => {
    const r = riepilogoMensile([
      [t(3, 10), t(3, 12)],        // +2
      [t(4, null), t(4, 7)],       // ad agosto non aveva compilato: non conta nella variazione
      [t(2, 5), t(2, null)],       // a settembre non ha ancora compilato
    ], colonne)
    expect(r.andamento[1].get('colloqui')).toBe(19)
    expect(r.variazioni.get('colloqui')).toEqual({ variazione: 2, confrontati: 1, conDato: 2 })
    expect(r.variazioni.get(STAFF)).toEqual({ variazione: 0, confrontati: 1, conDato: 2 })   // solo gli uffici con il rapportino in entrambi i mesi
    expect(r.ufficiConDati).toBe(2)                      // lo staff da solo non vuol dire "compilato"
    expect(r.ufficiTotali).toBe(3)
  })

  it('lo staff si confronta solo tra mesi con il rapportino inserito', () => {
    const r = riepilogoMensile([
      [t(9, null), t(5, 3)],       // il mese prima nessun rapportino: lo staff contato dal personale non si confronta
      [t(4, 1), t(6, 2)],          // +2
    ], colonne)
    expect(r.variazioni.get(STAFF)).toEqual({ variazione: 2, confrontati: 1, conDato: 2 })
  })

  it('rimette in forma le somme della città arrivate dal database', () => {
    const r = riepilogoDaRighe([
      { posizione: 1, voce: 'colloqui', valore: 15, uffici_con_dato: 2, uffici_con_dati: 2, variazione: null, confrontati: 0, uffici_citta: 38 },
      { posizione: 2, voce: 'colloqui', valore: '19' as never, uffici_con_dato: 2, uffici_con_dati: 3, variazione: '2' as never, confrontati: 1, uffici_citta: 38 },
    ], 2, colonne)
    expect(r.andamento[0].get('colloqui')).toBe(15)
    expect(r.andamento[1].get('colloqui')).toBe(19)
    expect(r.andamento[1].get(STAFF)).toBeNull()
    expect(r.variazioni.get('colloqui')).toEqual({ variazione: 2, confrontati: 1, conDato: 2 })
    expect(r.ufficiConDati).toBe(3)
    expect(r.ufficiTotali).toBe(38)
  })
})

describe('scadenza di inserimento', () => {
  const s = { mese: '2026-09-01', scadenza: '2026-10-05T21:59:00Z', blocca: false }
  it('sa se la scadenza è passata e se il mese è chiuso', () => {
    expect(scadenzaPassata(s, new Date('2026-10-05T20:00:00Z'))).toBe(false)
    expect(scadenzaPassata(s, new Date('2026-10-06T08:00:00Z'))).toBe(true)
    expect(meseChiuso(s, new Date('2026-10-06T08:00:00Z'))).toBe(false)
    expect(meseChiuso({ ...s, blocca: true }, new Date('2026-10-06T08:00:00Z'))).toBe(true)
    expect(scadenzaPassata(null)).toBe(false)
  })
  it('segnala l\'ultimo inserimento arrivato dopo la scadenza', () => {
    const v = (aggiornato_il: string) => ({ ...val(1, 'colloqui', 1), aggiornato_il })
    expect(ultimoRitardo([v('2026-10-03T10:00:00Z'), v('2026-10-05T21:00:00Z')], s)).toBeNull()
    expect(ultimoRitardo([v('2026-10-03T10:00:00Z'), v('2026-10-08T09:12:00Z'), v('2026-10-07T09:00:00Z')], s)).toBe('2026-10-08T09:12:00Z')
    expect(ultimoRitardo([v('2026-10-08T09:12:00Z')], null)).toBeNull()
    expect(scadenzaProposta('2026-12-01')).toBe('2027-01-05T23:59')
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

  it('chi è promosso a responsabile non è un\'uscita: è nei promossi e non pesa sul tasso', () => {
    const promossa = { ...persona(6, 'collaboratore', '2022-01-01', '2026-05-01'), motivo_fine: 'promozione' as const }
    const t = turnoverAnno([persona(1, 'collaboratore', '2020-03-01', '2026-02-15'), persona(3, 'collaboratore', '2018-01-01'), promossa], '2026')
    expect(t.usciti.map((u) => u.persona.id)).toEqual([1])
    expect(t.promossi.map((u) => [u.persona.id, u.mesi])).toEqual([[6, 52]])
    expect(t.tasso).toBe(1 / 3)
    expect(movimentoNelMese(promossa, '2026-05-01')).toBe('promozione')
    expect(inServizio(promossa, '2026-05-01')).toBe(false)     // come chi esce, non conta nel mese della promozione
  })

  it('chi passa a un altro ufficio (017) non è un\'uscita né un promosso', () => {
    const trasferita = { ...persona(7, 'collaboratore', '2022-05-03', '2026-03-01'), motivo_fine: 'trasferimento' as const }
    const t = turnoverAnno([persona(1, 'collaboratore', '2020-03-01', '2026-02-15'), persona(3, 'collaboratore', '2018-01-01'), trasferita], '2026')
    expect(t.usciti.map((u) => u.persona.id)).toEqual([1])
    expect(t.promossi).toEqual([])
    expect(movimentoNelMese(trasferita, '2026-03-01')).toBe('trasferimento')
    expect(inServizio(trasferita, '2026-02-01')).toBe(true)    // a febbraio è ancora nel vecchio ufficio
    expect(inServizio(trasferita, '2026-03-01')).toBe(false)
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
