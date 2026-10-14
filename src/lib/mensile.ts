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

export const ORDINE_RUOLI: RuoloPersona[] = ['responsabile', 'funzionario', 'coordinatrice', 'marketer']

/** Le due tabelle del rapportino dell'ufficio, come nel file Excel */
export const GRUPPI_PERSONE: { titolo: string; ruoli: RuoloPersona[] }[] = [
  { titolo: 'Responsabile e funzionari', ruoli: ['responsabile', 'funzionario'] },
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

// ---------------------------------------------------------------- Persone

/** La persona era in ufficio in quel mese? (iniziata entro la fine del mese, non uscita prima dell'inizio) */
export function inServizio(p: Persona, mese: string): boolean {
  return p.data_inizio <= ultimoGiornoDelMese(mese) && (!p.data_fine || p.data_fine >= mese)
}

/** Ordine delle righe: responsabile, funzionari, coordinatrici, marketer; poi per anzianità e nome */
export function ordinaPersone(a: Persona, b: Persona): number {
  return ORDINE_RUOLI.indexOf(a.ruolo) - ORDINE_RUOLI.indexOf(b.ruolo)
    || a.data_inizio.localeCompare(b.data_inizio) || a.nome.localeCompare(b.nome)
}

/**
 * Le righe del rapportino di un mese: le persone in servizio, più chi ha comunque
 * dei numeri in quel mese (così nessun valore salvato sparisce dalla tabella).
 */
export function righeDelMese(persone: Persona[], valori: ValoreMensile[], mese: string): Persona[] {
  const conValori = new Set(valori.filter((v) => v.mese === mese && v.valore !== null).map((v) => v.persona_id))
  return persone.filter((p) => inServizio(p, mese) || conValori.has(p.id)).sort(ordinaPersone)
}

/** Mesi interi di servizio dalla data di inizio alla fine del mese indicato */
export function mesiDiServizio(dataInizio: string, mese: string): number {
  const [a1, m1, g1] = dataInizio.split('-').map(Number)
  const [a2, m2, g2] = ultimoGiornoDelMese(mese).split('-').map(Number)
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
  const totali: TotaliMese = new Map(voci.map((v) => [v.codice, null]))
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
  const totali = sommaValori(valori.filter((v) => v.mese === mese), voci)
  const staff = persone.filter((p) => inServizio(p, mese)).length
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
  const pieni = new Set(valori.filter((v) => v.valore !== null).map((v) => `${v.persona_id}|${v.voce}`))
  if (pieni.size === 0) return 'mancante'
  const completo = personeInServizio.length > 0
    && personeInServizio.every((p) => voci.every((v) => pieni.has(`${p.id}|${v.codice}`)))
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
