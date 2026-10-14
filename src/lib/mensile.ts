// Calcoli del rapportino mensile. Un mese è identificato dalla data del giorno 1 ('AAAA-MM-01').
// - Totale dell'ufficio = somma delle persone, voce per voce.
// - Staff = numero di persone in servizio nel mese (non si scrive: si conta).
// - Totale di gruppo = somma di tutti gli uffici (nell'Excel la formula dimenticava Villa Lais).
// - Variazione = (mese − stesso mese dell'anno prima) ÷ anno prima; vuota se non calcolabile (mai #DIV/0!).
import type { StatoCompilazione } from './aggregazioni'
import { aggiungiGiorni, nomeMese, oggiISO } from './settimane'
import type { Persona, RuoloPersona, Ufficio, ValoreMensile, VoceMensile } from './tipi'

/** Chiave dello staff nei totali (non è una colonna da compilare) */
export const STAFF = 'staff'

export const ORDINE_RUOLI: RuoloPersona[] = ['responsabile', 'collaboratore', 'coordinatrice', 'marketer']

/** Le due tabelle del rapportino dell'ufficio, come nel file Excel */
export const GRUPPI_PERSONE: { titolo: string; ruoli: RuoloPersona[] }[] = [
  { titolo: 'Responsabile e collaboratori', ruoli: ['responsabile', 'collaboratore'] },
  { titolo: 'Coordinatrici e marketer', ruoli: ['coordinatrice', 'marketer'] },
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
  return voci.filter((v) => !v.solo_ruolo)
}

/** Gli indicatori riservati a un ruolo (es. App. vendita fix delle coordinatrici): fuori dai totali */
export function indicatori(voci: VoceMensile[], ruolo?: RuoloPersona): VoceMensile[] {
  return voci.filter((v) => v.solo_ruolo && (!ruolo || v.solo_ruolo === ruolo))
}

/** Le voci che danno punti nella gara dei collaboratori (tutte quelle del rapportino tranne Gestione incarichi) */
export function vociConPunti(voci: VoceMensile[]): VoceMensile[] {
  return vociDelRapportino(voci).filter((v) => v.con_punti !== false)
}

/**
 * Turnover dell'anno: chi ha lasciato l'ufficio nell'anno, con l'anzianità al giorno dell'uscita,
 * e il tasso di uscita = uscite ÷ persone in servizio al 1° gennaio (vuoto se non calcolabile).
 */
export function turnoverAnno(persone: Persona[], anno: string) {
  const inizioAnno = `${anno}-01-01`
  const usciti = persone
    .filter((p) => p.data_fine && p.data_fine.startsWith(`${anno}-`))
    .map((p) => ({ persona: p, mesi: mesiTraDate(p.data_inizio, p.data_fine!) }))
    .sort((a, b) => a.persona.data_fine!.localeCompare(b.persona.data_fine!) || a.persona.nome.localeCompare(b.persona.nome))
  const organicoInizio = persone.filter((p) => p.data_inizio <= inizioAnno && (!p.data_fine || p.data_fine >= inizioAnno)).length
  const anzianitaMedia = usciti.length ? Math.round(usciti.reduce((t, u) => t + u.mesi, 0) / usciti.length) : null
  return { usciti, organicoInizio, anzianitaMedia, tasso: organicoInizio > 0 ? usciti.length / organicoInizio : null }
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
export function inServizio(p: Persona, mese: string): boolean {
  const fine = ultimoGiornoDelMese(mese)
  return p.data_inizio <= fine && (!p.data_fine || p.data_fine > fine)
}

/**
 * Cambi di personale nel mese: "uscita" se la persona ha lasciato l'ufficio in quel mese,
 * "entrata" se ha iniziato in quel mese (se entrambe, conta l'uscita).
 */
export function movimentoNelMese(p: Persona, mese: string): 'entrata' | 'uscita' | null {
  const fine = ultimoGiornoDelMese(mese)
  if (p.data_fine && p.data_fine >= mese && p.data_fine <= fine) return 'uscita'
  if (p.data_inizio >= mese && p.data_inizio <= fine) return 'entrata'
  return null
}

/** Ordine delle righe: responsabile, collaboratori, coordinatrici, marketer; poi per anzianità e nome */
export function ordinaPersone(a: Persona, b: Persona): number {
  return ORDINE_RUOLI.indexOf(a.ruolo) - ORDINE_RUOLI.indexOf(b.ruolo)
    || a.data_inizio.localeCompare(b.data_inizio) || a.nome.localeCompare(b.nome)
}

/** Le righe del rapportino di un mese: solo le persone in servizio (chi è uscito nel mese non compare) */
export function righeDelMese(persone: Persona[], mese: string): Persona[] {
  return persone.filter((p) => inServizio(p, mese)).sort(ordinaPersone)
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
  const inUfficio = new Set(persone.filter((p) => inServizio(p, mese)).map((p) => p.id))   // i numeri di chi è uscito nel mese non contano
  const totali = sommaValori(valori.filter((v) => v.mese === mese && inUfficio.has(v.persona_id)), voci)
  const staff = inUfficio.size
  totali.set(STAFF, staff > 0 ? staff : null)
  return totali
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
