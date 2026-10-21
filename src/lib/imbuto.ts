// Imbuto della vendita: le fasi dall'acquisizione alla vendita e i passaggi tra una fase e l'altra
// (es. "1 proposta ogni 7 appuntamenti"). Con i rapportini settimanali e con quelli mensili.
import { formattaPercentuale } from './calcoli'

/** Come si legge il passaggio tra due fasi */
type Passaggio =
  | { tipo: 'percentuale'; testo: string }               // "42% delle valutazioni diventa incarico"
  | { tipo: 'ogni'; uno: string; unoPlurale: string; molti: string }   // "7 appuntamenti per ogni proposta"

export interface DefinizioneImbuto {
  fasi: { codice: string; nome: string }[]
  /** passaggi[i] collega fasi[i] e fasi[i+1]; null = nessun passaggio da calcolare (es. incarichi → appuntamenti) */
  passaggi: (Passaggio | null)[]
}

/** Rapportino settimanale: le attività dell'ufficio */
export const IMBUTO_SETTIMANALE: DefinizioneImbuto = {
  fasi: [
    { codice: 'valutazioni', nome: 'Valutazioni' },
    { codice: 'incarichi', nome: 'Incarichi' },
    { codice: 'app_vendita', nome: 'App.ti vendita' },
    { codice: 'proposte', nome: 'Proposte' },
    { codice: 'vendite', nome: 'Vendite' },
  ],
  passaggi: [
    { tipo: 'percentuale', testo: 'delle valutazioni diventa incarico' },
    null,
    { tipo: 'ogni', uno: 'proposta', unoPlurale: 'proposte', molti: 'appuntamenti' },
    { tipo: 'percentuale', testo: 'delle proposte diventa vendita' },
  ],
}

/** Rapportino mensile: la parte vendita del rapportino, con le accettazioni */
export const IMBUTO_MENSILE: DefinizioneImbuto = {
  fasi: [
    { codice: 'acquisizioni', nome: 'Acquisizioni' },
    { codice: 'incarichi_vendita', nome: 'Incarichi vendita' },
    { codice: 'appuntamenti_vendita', nome: 'Appuntamenti vendita' },
    { codice: 'proposte_vendita', nome: 'Proposte vendita' },
    { codice: 'accettazioni_vendita', nome: 'Accettazioni vendita' },
    { codice: 'vendite_effettuate', nome: 'Vendite effettuate' },
  ],
  passaggi: [
    { tipo: 'percentuale', testo: 'delle acquisizioni diventa incarico' },
    null,
    { tipo: 'ogni', uno: 'proposta', unoPlurale: 'proposte', molti: 'appuntamenti' },
    { tipo: 'percentuale', testo: 'delle proposte è accettata' },
    { tipo: 'percentuale', testo: 'delle accettazioni arriva a vendita' },
  ],
}

/** Periodo su cui si calcola l'imbuto: con un periodo solo i numeri sono troppo piccoli e casuali */
export const SETTIMANE_IMBUTO = 4
export const MESI_IMBUTO = 3

/** Sotto questo numero di casi nella fase di partenza il passaggio non si mostra: sarebbe casuale */
export const MINIMO_CASI = 5

export interface FaseCalcolata { codice: string; nome: string; valore: number | null }

export interface PassaggioCalcolato {
  rapporto: number | null      // fase dopo ÷ fase prima (più alto = meglio); null se non calcolabile
  valore: string               // per le tabelle: "42%", "1 ogni 6,5", oppure "—"
  numero: string               // per l'imbuto, prima del testo: "42%", "6,5"
  testo: string                // "delle valutazioni diventa incarico", "appuntamenti per ogni proposta"
  motivo?: 'mancante' | 'pochi'
}

export interface Imbuto {
  fasi: FaseCalcolata[]
  passaggi: (PassaggioCalcolato | null)[]
}

const unDecimale = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 1 })

/** Calcola fasi e passaggi da una tabella voce → numero del periodo. Mai #DIV/0!. */
export function calcolaImbuto(def: DefinizioneImbuto, valori: Map<string, number | null>): Imbuto {
  const fasi = def.fasi.map((f) => ({ ...f, valore: valori.get(f.codice) ?? null }))
  const passaggi = def.passaggi.map((p, i): PassaggioCalcolato | null => {
    if (!p) return null
    const da = fasi[i].valore, a = fasi[i + 1].valore
    const testo = p.tipo === 'percentuale' ? p.testo : `${p.molti} per ogni ${p.uno}`
    if (da === null || a === null) return { rapporto: null, valore: '—', numero: '—', testo, motivo: 'mancante' }
    if (da < MINIMO_CASI) return { rapporto: null, valore: '—', numero: '—', testo: `${testo} (pochi casi)`, motivo: 'pochi' }
    const rapporto = a / da
    if (p.tipo === 'percentuale') {
      const percentuale = formattaPercentuale(rapporto).replace(',0%', '%')
      return { rapporto, valore: percentuale, numero: percentuale, testo }
    }
    if (a === 0) return { rapporto, valore: `0 su ${unDecimale(da)}`, numero: '0', testo: `${p.unoPlurale} su ${unDecimale(da)} ${p.molti}` }
    return { rapporto, valore: `1 ogni ${unDecimale(da / a)}`, numero: unDecimale(da / a), testo }
  })
  return { fasi, passaggi }
}

/** Somma voce per voce di più periodi (es. le ultime 4 settimane); vuota se la voce manca in tutti */
export function sommaPeriodi(periodi: Map<string, number | null>[], codici: string[]): Map<string, number | null> {
  return new Map(codici.map((c) => {
    const presenti = periodi.map((p) => p.get(c) ?? null).filter((v): v is number => v !== null)
    return [c, presenti.length === 0 ? null : presenti.reduce((s, v) => s + v, 0)]
  }))
}

/** I codici delle fasi di un imbuto */
export const codiciImbuto = (def: DefinizioneImbuto) => def.fasi.map((f) => f.codice)

/** Confronto di un passaggio con quello di riferimento (città o gruppo): sopra, sotto o nessun confronto */
export function confrontaPassaggio(p: PassaggioCalcolato | null, riferimento: PassaggioCalcolato | null): 'sopra' | 'sotto' | null {
  if (!p || !riferimento || p.rapporto === null || riferimento.rapporto === null) return null
  return p.rapporto >= riferimento.rapporto ? 'sopra' : 'sotto'
}
