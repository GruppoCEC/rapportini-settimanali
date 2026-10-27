// Calcoli del rapportino mensile. Un mese è identificato dalla data del giorno 1 ('AAAA-MM-01').
// - Totale dell'ufficio = somma delle persone, voce per voce.
// - Staff = numero di persone in servizio nel mese (non si scrive: si conta).
// - Totale di gruppo = somma di tutti gli uffici (nell'Excel la formula dimenticava Villa Lais).
// - Variazione = (mese − stesso mese dell'anno prima) ÷ anno prima; vuota se non calcolabile (mai #DIV/0!).
import type { StatoCompilazione } from './aggregazioni'
import { aggiungiGiorni, lunediDi, nomeMese, oggiISO } from './settimane'
import type { Persona, RuoloPersona, Scadenza, StoricoMensile, Ufficio, ValoreMensile, VoceMensile } from './tipi'

/** Chiave dello staff nei totali (non è una colonna da compilare) */
export const STAFF = 'staff'

export const ORDINE_RUOLI: RuoloPersona[] = ['responsabile', 'collaboratore', 'coordinatrice', 'marketer', 'da_definire']

/** Le due tabelle del rapportino dell'ufficio, come nel file Excel */
export const GRUPPI_PERSONE: { titolo: string; ruoli: RuoloPersona[]; soloSePieno?: boolean }[] = [
  { titolo: 'Responsabile e collaboratori', ruoli: ['responsabile', 'collaboratore'] },
  { titolo: 'Coordinatrici e marketer', ruoli: ['coordinatrice', 'marketer'] },
  { titolo: 'Ruolo da definire', ruoli: ['da_definire'], soloSePieno: true },   // si vede solo se c'è qualcuno
]

export type TotaliMese = Map<string, number | null>

// ---------------------------------------------------------------- Mesi

export function primoDelMese(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

export function aggiungiMesi(mese: string, n: number): string {
  const [a, m] = mese.split('-').map(Number)
  const totale = a * 12 + (m - 1) + n
  return `${Math.floor(totale / 12)}-${String((totale % 12) + 1).padStart(2, '0')}-01`
}

export function ultimoGiornoDelMese(mese: string): string {
  return aggiungiGiorni(aggiungiMesi(mese, 1), -1)
}

/** Il mese in corso: oltre questo non si compila */
export function meseInCorso(oggi: string = oggiISO()): string {
  return primoDelMese(oggi)
}

/** Mese proposto all'apertura: quello appena concluso (a ottobre si apre settembre) */
export function mesePredefinito(oggi: string = oggiISO()): string {
  return aggiungiMesi(primoDelMese(oggi), -1)
}

/** Es. "Settembre 2026" */
export function titoloMese(mese: string): string {
  const n = nomeMese(mese)
  return n.charAt(0).toUpperCase() + n.slice(1)
}

/** 'AAAA-MM-GG' → '01/03/2023' */
export function dataItaliana(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, g] = iso.split('-')
  return `${g}/${m}/${a}`
}

// ---------------------------------------------------------------- Colonne

/** Le colonne del rapportino vero e proprio: entrano nei totali e nel report di gruppo */
export function vociDelRapportino(voci: VoceMensile[]): VoceMensile[] {
  return voci.filter((v) => !v.solo_ruolo && !v.riservata)
}

/** Voci riservate all'amministrazione, solo per la gara a punti (018: Locazioni effettuate) */
export function vociRiservate(voci: VoceMensile[]): VoceMensile[] {
  return voci.filter((v) => v.riservata)
}

/** Gli indicatori riservati a un ruolo (es. App. vendita fix delle coordinatrici): fuori dai totali */
export function indicatori(voci: VoceMensile[], ruolo?: RuoloPersona): VoceMensile[] {
  return voci.filter((v) => v.solo_ruolo && (!ruolo || v.solo_ruolo === ruolo))
}

/** Le voci che danno punti nella gara dei collaboratori (tutte quelle del rapportino tranne Gestione incarichi) */
export function vociConPunti(voci: VoceMensile[]): VoceMensile[] {
  return vociDelRapportino(voci).filter((v) => v.con_punti !== false)
}

/** La fine è una promozione a responsabile (non un'uscita dal gruppo)? */
export const promosso = (p: Persona) => p.motivo_fine === 'promozione'

/** La fine è un passaggio a un altro ufficio del gruppo (017)? Non è un'uscita */
export const trasferito = (p: Persona) => p.motivo_fine === 'trasferimento'

/**
 * Turnover dell'anno: chi ha lasciato il gruppo nell'anno, con l'anzianità al giorno dell'uscita,
 * e il tasso di uscita = uscite ÷ persone in servizio al 1° gennaio (vuoto se non calcolabile).
 * Chi è stato promosso a responsabile non è un'uscita (decisione di Davide del 21/10/2026): è in `promossi`.
 */
export function turnoverAnno(persone: Persona[], anno: string) {
  const inizioAnno = `${anno}-01-01`
  const finiti = persone
    .filter((p) => p.data_fine && p.data_fine.startsWith(`${anno}-`))
    .map((p) => ({ persona: p, mesi: mesiTraDate(p.data_inizio, p.data_fine!) }))
    .sort((a, b) => a.persona.data_fine!.localeCompare(b.persona.data_fine!) || a.persona.nome.localeCompare(b.persona.nome))
  const usciti = finiti.filter((u) => !promosso(u.persona) && !trasferito(u.persona))
  const promossi = finiti.filter((u) => promosso(u.persona))
  const organicoInizio = persone.filter((p) => p.data_inizio <= inizioAnno && (!p.data_fine || p.data_fine >= inizioAnno)).length
  const anzianitaMedia = usciti.length ? Math.round(usciti.reduce((t, u) => t + u.mesi, 0) / usciti.length) : null
  return { usciti, promossi, organicoInizio, anzianitaMedia, tasso: organicoInizio > 0 ? usciti.length / organicoInizio : null }
}

/** Solo i collaboratori partecipano alla gara a punti */
export const RUOLO_GARA: RuoloPersona = 'collaboratore'

/**
 * Punteggio del mese di una persona = somma di (numero × punti della voce).
 * Vuoto se i punti non sono ancora stati decisi o se la persona non ha numeri nel mese.
 */
export function punteggio(valoriPersona: ValoreMensile[], punti: Map<string, number>): number | null {
  if (punti.size === 0) return null
  const pieni = valoriPersona.filter((v) => v.valore !== null && punti.has(v.voce))
  if (pieni.length === 0) return null
  return Math.round(pieni.reduce((t, v) => t + v.valore! * punti.get(v.voce)!, 0) * 100) / 100
}

/** Es. "42", "12,5", "−3" */
export function formattaPunti(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('it-IT', { maximumFractionDigits: 2 }).replace('-', '−')
}

/** Legge i punti scritti in una casella: "5", "2,5", "-3" → numero; "" → null; altro → 'errore' */
export function leggiPunti(testo: string): number | null | 'errore' {
  const t = testo.trim().replace(',', '.').replace('−', '-')
  if (t === '') return null
  if (!/^-?\d{1,4}(\.\d{1,2})?$/.test(t)) return 'errore'
  return Number(t)
}

/** La variazione è un buon segno? Per le voci "meglio se scende" (es. incarichi scaduti) un aumento è negativo */
export function variazioneBuona(v: number, voce?: VoceMensile): boolean {
  return voce?.meglio_se_scende ? v <= 0 : v >= 0
}

/** Gli indicatori da mostrare tra parentesi in una colonna, per una persona con quel ruolo */
export function indicatoriAccanto(voci: VoceMensile[], colonna: string, ruolo: RuoloPersona): VoceMensile[] {
  return indicatori(voci, ruolo).filter((v) => v.accanto_a === colonna)
}

// ---------------------------------------------------------------- Persone

/**
 * La persona conta in quel mese? Deve aver iniziato entro la fine del mese e non aver lasciato
 * l'ufficio durante il mese: chi esce non conta da nessuna parte nel mese in cui esce
 * (rapportino, totali, staff, liste, gara), decisione di Davide del 14/10/2026.
 */
/**
 * Presente nel mese: ha lavorato almeno una parte del mese (anche chi è uscito durante il mese).
 * Chi finisce il 1° del mese non c'è. Decisione di Davide (26/10/2026): i numeri di chi lascia
 * nel mese restano nel totale dell'ufficio, ma lo staff e la gara contano solo chi è in servizio.
 */
export function presenteNelMese(p: Persona, mese: string): boolean {
  return p.data_inizio <= ultimoGiornoDelMese(mese) && (!p.data_fine || p.data_fine > mese)
}

/** In servizio nel mese: c'è ancora a fine mese (staff, gara a punti, completezza del rapportino) */
export function inServizio(p: Persona, mese: string): boolean {
  const fine = ultimoGiornoDelMese(mese)
  return p.data_inizio <= fine && (!p.data_fine || p.data_fine > fine)
}

/**
 * Cambi di personale nel mese: "uscita" se la persona ha lasciato l'ufficio in quel mese ("promozione"
 * se è stata promossa a responsabile, "trasferimento" se è passata a un altro ufficio),
 * "entrata" se ha iniziato in quel mese (se entrambe, conta l'uscita).
 */
export function movimentoNelMese(p: Persona, mese: string): 'entrata' | 'uscita' | 'promozione' | 'trasferimento' | null {
  const fine = ultimoGiornoDelMese(mese)
  if (p.data_fine && p.data_fine >= mese && p.data_fine <= fine) return promosso(p) ? 'promozione' : trasferito(p) ? 'trasferimento' : 'uscita'
  if (p.data_inizio >= mese && p.data_inizio <= fine) return 'entrata'
  return null
}

/** Ordine delle righe: responsabile, collaboratori, coordinatrici, marketer; poi per anzianità e nome */
export function ordinaPersone(a: Persona, b: Persona): number {
  return ORDINE_RUOLI.indexOf(a.ruolo) - ORDINE_RUOLI.indexOf(b.ruolo)
    || a.data_inizio.localeCompare(b.data_inizio) || a.nome.localeCompare(b.nome)
}

/** Le righe del rapportino di un mese: chi è presente nel mese, anche chi è uscito (riga rossa) */
export function righeDelMese(persone: Persona[], mese: string): Persona[] {
  return persone.filter((p) => presenteNelMese(p, mese)).sort(ordinaPersone)
}

// ---------------------------------------------------------------- Date di inizio provvisorie

/**
 * Data di inizio messa d'ufficio a responsabili, coordinatrici e marketer caricati dai rapportini
 * del 2026, perché nei fogli la data vera non c'era. Gli uffici la correggono dal Personale.
 */
export const DATA_INIZIO_PROVVISORIA = '2026-01-01'
export const RUOLI_DATA_DA_COMPLETARE: RuoloPersona[] = ['responsabile', 'coordinatrice', 'marketer']

/** Chi è ancora in ufficio con la data di inizio provvisoria (i collaboratori no: le loro date c'erano) */
export function dateDaCompletare(persone: Persona[], oggi: string = oggiISO()): Persona[] {
  return persone.filter((p) => RUOLI_DATA_DA_COMPLETARE.includes(p.ruolo) && p.data_inizio === DATA_INIZIO_PROVVISORIA
    && (!p.data_fine || p.data_fine > oggi)).sort(ordinaPersone)
}

/** Che data scrivere come inizio, secondo il ruolo (regola di Davide, 27/10/2026) */
export function aiutoDataInizio(ruolo: RuoloPersona): string {
  return ruolo === 'responsabile' ? 'Da quando è responsabile' : 'Da quando lavora nel gruppo'
}

/** Mesi interi di servizio dalla data di inizio alla fine del mese indicato */
export function mesiDiServizio(dataInizio: string, mese: string): number {
  return mesiTraDate(dataInizio, ultimoGiornoDelMese(mese))
}

/** Mesi interi tra due date 'AAAA-MM-GG' (es. anzianità al giorno dell'uscita) */
export function mesiTraDate(dataInizio: string, dataFine: string): number {
  const [a1, m1, g1] = dataInizio.split('-').map(Number)
  const [a2, m2, g2] = dataFine.split('-').map(Number)
  let n = (a2 - a1) * 12 + (m2 - m1)
  if (g2 < g1) n--
  return Math.max(0, n)
}

/** Es. "meno di un mese", "5 mesi", "2 anni", "1 anno e 3 mesi" */
export function formattaAnzianita(mesi: number): string {
  if (mesi < 1) return 'meno di un mese'
  const anni = Math.floor(mesi / 12), resto = mesi % 12
  const testoMesi = resto === 1 ? '1 mese' : `${resto} mesi`
  if (anni === 0) return testoMesi
  const testoAnni = anni === 1 ? '1 anno' : `${anni} anni`
  return resto === 0 ? testoAnni : `${testoAnni} e ${testoMesi}`
}

// ---------------------------------------------------------------- Totali

/** Somma voce per voce dei valori indicati (vuota se nessuno ha scritto quella voce) */
export function sommaValori(valori: ValoreMensile[], voci: VoceMensile[]): TotaliMese {
  const totali: TotaliMese = new Map(vociDelRapportino(voci).map((v) => [v.codice, null]))
  for (const v of valori) {
    if (v.valore === null || !totali.has(v.voce)) continue
    totali.set(v.voce, (totali.get(v.voce) ?? 0) + v.valore)
  }
  return totali
}

/**
 * Totale dell'ufficio nel mese: somma delle persone e staff.
 * `persone` e `valori` sono quelli di un solo ufficio.
 */
export function totaleUfficio(persone: Persona[], valori: ValoreMensile[], mese: string, voci: VoceMensile[]): TotaliMese {
  // i numeri di chi è uscito durante il mese contano; lo staff è chi c'è a fine mese
  const presenti = new Set(persone.filter((p) => presenteNelMese(p, mese)).map((p) => p.id))
  const totali = sommaValori(valori.filter((v) => v.mese === mese && presenti.has(v.persona_id)), voci)
  const staff = persone.filter((p) => inServizio(p, mese)).length
  totali.set(STAFF, staff > 0 ? staff : null)
  return totali
}

/**
 * Totale dell'ufficio nel mese, tenendo conto dello storico dal file Excel annuale: se l'ufficio non ha
 * numeri persona per persona in quel mese ma c'è il suo totale nello storico, vale quello (staff compreso).
 * Se ha numeri persona per persona valgono quelli, ma voce per voce (016): una voce che nessuno ha scritto
 * prende il valore dello storico (es. le vendite effettuate). Lo staff resta quello delle persone in servizio.
 * `persone`, `valori` e `storico` sono quelli di un solo ufficio.
 */
export function totaleConStorico(persone: Persona[], valori: ValoreMensile[], mese: string, voci: VoceMensile[], storico: StoricoMensile[]):
  { totale: TotaliMese; daStorico: boolean } {
  const calcolato = totaleUfficio(persone, valori, mese, voci)
  const delMese = storico.filter((s) => s.mese === mese)
  const haNumeri = [...calcolato].some(([k, v]) => k !== STAFF && v !== null)
  if (delMese.length === 0) return { totale: calcolato, daStorico: false }
  if (haNumeri) {
    // voce per voce (016): dove nessuno ha scritto la voce persona per persona vale il file annuale
    // (es. le vendite effettuate, che i rapportini degli uffici non hanno); lo staff resta dalle persone
    for (const s of delMese) if (s.voce !== STAFF && calcolato.has(s.voce) && calcolato.get(s.voce) === null) calcolato.set(s.voce, s.valore)
    return { totale: calcolato, daStorico: false }
  }
  const totale: TotaliMese = new Map(vociDelRapportino(voci).map((v) => [v.codice, null]))
  totale.set(STAFF, null)
  for (const s of delMese) if (totale.has(s.voce)) totale.set(s.voce, s.valore)
  return { totale, daStorico: true }
}

/** I mesi di un anno da riepilogare: gennaio … dicembre, ma non oltre `ultimo` (anno in corso) */
export function mesiDellAnno(anno: string, ultimo: string = mesePredefinito()): string[] {
  return Array.from({ length: 12 }, (_, i) => `${anno}-${String(i + 1).padStart(2, '0')}-01`).filter((m) => m <= ultimo)
}

/**
 * Voci "di consistenza": dicono quante persone e quanti immobili ci sono, non cosa si è fatto nel mese.
 * Nel riepilogo dell'anno non si sommano i mesi (decisione di Davide del 21/10/2026).
 */
export const VOCI_CONSISTENZA = [STAFF, 'portafoglio_vendita', 'portafoglio_locazione']

/**
 * Riepilogo dell'anno di un ufficio: ogni voce è la somma dei totali dei mesi (stesse regole del mese:
 * chi esce non conta nel mese in cui esce; i mesi senza numeri persona per persona usano lo storico).
 * Staff e portafoglio (VOCI_CONSISTENZA) non si sommano: vale il dato dell'ultimo mese in cui l'ufficio
 * ha inserito il rapportino (per lo staff, se non ne ha inseriti, l'ultimo mese).
 */
export function totaleAnnoUfficio(persone: Persona[], valori: ValoreMensile[], mesi: string[], voci: VoceMensile[], storico: StoricoMensile[] = []) {
  const perMese = mesi.map((m) => totaleConStorico(persone, valori, m, voci, storico).totale)
  const compilato = (t: TotaliMese) => [...t].some(([k, v]) => k !== STAFF && v !== null)
  const totale = sommaTotali(perMese.map((t) => new Map([...t].filter(([k]) => !VOCI_CONSISTENZA.includes(k)))))
  for (const c of VOCI_CONSISTENZA) {
    const ultimo = [...perMese].reverse().find((t) => compilato(t) && t.get(c) != null)
    totale.set(c, ultimo?.get(c) ?? (c === STAFF && perMese.length ? perMese[perMese.length - 1].get(STAFF) ?? null : null))
  }
  const mesiCompilati = perMese.filter(compilato).length
  return { totale, perMese, mesiCompilati }
}

/** Somma di più totali (uffici → gruppo) */
export function sommaTotali(elenco: TotaliMese[]): TotaliMese {
  const somma: TotaliMese = new Map()
  for (const totali of elenco) {
    for (const [chiave, v] of totali) {
      if (!somma.has(chiave)) somma.set(chiave, null)
      if (v !== null) somma.set(chiave, (somma.get(chiave) ?? 0) + v)
    }
  }
  return somma
}

// ---------------------------------------------------------------- Presentazione mensile

/** Variazione di una voce sul mese prima, sommata sugli uffici che hanno il dato in entrambi i mesi */
export interface VariazioneMensile {
  variazione: number | null
  confrontati: number         // uffici usati per la variazione
  conDato: number             // uffici con il dato nel mese presentato
}

/** Un gruppo di uffici (città, propri uffici, un ufficio) mese per mese, per la presentazione mensile */
export interface RiepilogoMensile {
  andamento: TotaliMese[]                     // somma degli uffici mese per mese; l'ultimo è quello presentato
  variazioni: Map<string, VariazioneMensile>  // ultimo mese sul precedente, voce per voce (staff compreso)
  ufficiConDati: number                       // uffici con almeno un numero nell'ultimo mese (lo staff non conta)
  ufficiTotali: number
}

/**
 * Riepilogo mensile di un gruppo di uffici. perUfficio[u][m] = totale dell'ufficio u nel mese m
 * (dal più vecchio), come lo dà totaleConStorico. La variazione conta solo gli uffici che hanno
 * il dato in entrambi i mesi: chi non ha ancora compilato non sembra un calo. Per lo staff serve
 * anche il rapportino inserito (lo staff si conta dal personale anche nei mesi non compilati).
 */
export function riepilogoMensile(perUfficio: TotaliMese[][], colonne: string[]): RiepilogoMensile {
  const nMesi = perUfficio[0]?.length ?? 0
  const andamento = Array.from({ length: nMesi }, (_, m) => sommaTotali(perUfficio.map((u) => u[m])))
  const haNumeri = (t: TotaliMese | undefined) => !!t && [...t].some(([k, v]) => k !== STAFF && v !== null)
  const vale = (u: TotaliMese[], m: number, c: string) => u[m]?.get(c) != null && (c !== STAFF || haNumeri(u[m]))
  const variazioni = new Map<string, VariazioneMensile>()
  for (const c of colonne) {
    const conDato = perUfficio.filter((u) => vale(u, nMesi - 1, c))
    const confrontati = nMesi > 1 ? conDato.filter((u) => vale(u, nMesi - 2, c)) : []
    variazioni.set(c, {
      variazione: confrontati.length === 0 ? null : confrontati.reduce((t, u) => t + u[nMesi - 1].get(c)! - u[nMesi - 2].get(c)!, 0),
      confrontati: confrontati.length,
      conDato: conDato.length,
    })
  }
  const ufficiConDati = perUfficio.filter((u) => haNumeri(u[nMesi - 1])).length
  return { andamento, variazioni, ufficiConDati, ufficiTotali: perUfficio.length }
}

/** Una riga di totali_mensili_mia_citta (supabase/migrations/010_totali_mensili_citta.sql) */
export interface RigaTotaliMensiliCitta {
  posizione: number           // da 1, nell'ordine dei mesi richiesti
  voce: string
  valore: number | null
  uffici_con_dato: number
  uffici_con_dati: number
  variazione: number | null
  confrontati: number
  uffici_citta: number
}

/** Riepilogo di tutta la città dell'ufficio, dalle somme calcolate dal database */
export function riepilogoDaRighe(righe: RigaTotaliMensiliCitta[], nMesi: number, colonne: string[]): RiepilogoMensile {
  const numero = (v: number | string | null) => (v === null ? null : Number(v))   // i bigint possono arrivare come testo
  const andamento: TotaliMese[] = Array.from({ length: nMesi }, () => new Map(colonne.map((c) => [c, null])))
  const variazioni = new Map<string, VariazioneMensile>(colonne.map((c) => [c, { variazione: null, confrontati: 0, conDato: 0 }]))
  let ufficiConDati = 0, ufficiTotali = 0
  for (const r of righe) {
    if (!andamento[r.posizione - 1] || !colonne.includes(r.voce)) continue
    andamento[r.posizione - 1].set(r.voce, numero(r.valore))
    ufficiTotali = r.uffici_citta
    if (r.posizione === nMesi) {
      ufficiConDati = r.uffici_con_dati
      variazioni.set(r.voce, { variazione: numero(r.variazione), confrontati: r.confrontati, conDato: r.uffici_con_dato })
    }
  }
  return { andamento, variazioni, ufficiConDati, ufficiTotali }
}

/** Variazione rispetto all'anno prima: 0,125 = +12,5%. Vuota se manca un dato o se l'anno prima era 0 */
export function variazione(attuale: number | null | undefined, annoPrima: number | null | undefined): number | null {
  if (attuale == null || annoPrima == null || annoPrima === 0) return null
  return (attuale - annoPrima) / annoPrima
}

/**
 * Stato del rapportino di un ufficio:
 * - mancante: nessun numero inserito;
 * - completo: ogni persona in servizio ha tutte le caselle compilate (anche con 0);
 * - parziale: tutto il resto.
 */
export function statoMensile(personeInServizio: Persona[], valori: ValoreMensile[], voci: VoceMensile[]): StatoCompilazione {
  const inUfficio = new Set(personeInServizio.map((p) => p.id))
  const pieni = new Set(valori.filter((v) => v.valore !== null && inUfficio.has(v.persona_id)).map((v) => `${v.persona_id}|${v.voce}`))
  if (pieni.size === 0) return 'mancante'
  const colonne = vociDelRapportino(voci)        // gli indicatori (es. App. vendita fix) non sono obbligatori
  const completo = personeInServizio.length > 0
    && personeInServizio.every((p) => colonne.every((v) => pieni.has(`${p.id}|${v.codice}`)))
  return completo ? 'completo' : 'parziale'
}

// ---------------------------------------------------------------- Scadenza di inserimento

export function scadenzaPassata(s: Scadenza | null, adesso: Date = new Date()): boolean {
  return s !== null && adesso.getTime() > new Date(s.scadenza).getTime()
}

/** Il mese è chiuso per gli uffici? (scadenza passata e blocco attivo) */
export function meseChiuso(s: Scadenza | null, adesso: Date = new Date()): boolean {
  return s !== null && s.blocca && scadenzaPassata(s, adesso)
}

/**
 * Ritardo di un ufficio: l'ultima volta che ha inserito o modificato numeri dopo la scadenza
 * (null se ha fatto tutto in tempo o se non c'è scadenza).
 */
export function ultimoRitardo(valori: ValoreMensile[], s: Scadenza | null): string | null {
  if (!s) return null
  const limite = new Date(s.scadenza).getTime()
  const tardi = valori.filter((v) => v.aggiornato_il && new Date(v.aggiornato_il).getTime() > limite).map((v) => v.aggiornato_il!)
  return tardi.length ? tardi.sort().at(-1)! : null
}

/** Es. "5 ottobre 2026 alle 23:59" */
export function dataOra(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })} alle ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * Lunedì della riunione settimanale che salta per la riunione di fine mese (019): il lunedì più vicino al giorno della
 * scadenza, quello della stessa settimana se la riunione è da lunedì a giovedì, altrimenti quello dopo.
 * Stessa regola dei promemoria (lunediVicino in scripts/promemoria-calendario.mjs). giorno: 'AAAA-MM-GG'.
 */
export function lunediVicino(giorno: string): string {
  const giornoSettimana = (new Date(`${giorno}T00:00:00Z`).getUTCDay() + 6) % 7   // 0 = lunedì … 6 = domenica
  return giornoSettimana <= 3 ? lunediDi(giorno) : aggiungiGiorni(lunediDi(giorno), 7)
}

/** Scadenza proposta per un mese: il 5 del mese dopo alle 23:59 (formato della casella data e ora) */
export function scadenzaProposta(mese: string): string {
  return `${aggiungiMesi(mese, 1).slice(0, 8)}05T23:59`
}

// ---------------------------------------------------------------- Uffici e formati

/** Uffici nell'ordine del report di gruppo: blocco, posizione, poi nome per chi non ha ancora una posizione */
export function ordinaUfficiReport(uffici: Ufficio[]): Ufficio[] {
  return [...uffici].sort((a, b) =>
    (a.blocco_mensile ?? 1) - (b.blocco_mensile ?? 1)
    || (a.ordine_mensile ?? 9999) - (b.ordine_mensile ?? 9999)
    || a.nome.localeCompare(b.nome))
}

export function formattaNumero(n: number | null | undefined): string {
  return n == null ? '—' : n.toLocaleString('it-IT')
}

/** Es. "+12,5%", "−3,0%", "—" */
export function formattaVariazione(v: number | null): string {
  if (v === null) return '—'
  const testo = Math.abs(v * 100).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
  return v > 0 ? `+${testo}` : v < 0 ? `−${testo}` : testo
}
