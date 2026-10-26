// Imbuto della vendita: le fasi dall'acquisizione alla vendita e i passaggi tra una fase e l'altra,
// sempre nella forma "1 incarico ogni 3,6 acquisizioni" (scelta di Davide). Con i rapportini settimanali e mensili.

/** Come si legge il passaggio tra due fasi: "1 {uno} ogni N {base}" */
interface Passaggio {
  uno: string; unoPlurale: string       // la fase dopo: "incarico", "incarichi"
  base: string; basePlurale: string     // la fase prima: "acquisizione", "acquisizioni"
}

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
    { uno: 'incarico', unoPlurale: 'incarichi', base: 'valutazione', basePlurale: 'valutazioni' },
    null,
    { uno: 'proposta', unoPlurale: 'proposte', base: 'appuntamento', basePlurale: 'appuntamenti' },
    { uno: 'vendita', unoPlurale: 'vendite', base: 'proposta', basePlurale: 'proposte' },
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
    { uno: 'incarico', unoPlurale: 'incarichi', base: 'acquisizione', basePlurale: 'acquisizioni' },
    null,
    { uno: 'proposta', unoPlurale: 'proposte', base: 'appuntamento', basePlurale: 'appuntamenti' },
    { uno: 'accettazione', unoPlurale: 'accettazioni', base: 'proposta', basePlurale: 'proposte' },
    { uno: 'vendita', unoPlurale: 'vendite', base: 'accettazione', basePlurale: 'accettazioni' },
  ],
}

/** Periodo su cui si calcola l'imbuto: con un periodo solo i numeri sono troppo piccoli e casuali */
export const SETTIMANE_IMBUTO = 4
export const MESI_IMBUTO = 3

/**
 * Sotto questo numero di casi nella fase di partenza il rapporto "1 ogni N" non si calcola, sarebbe casuale:
 * si mostrano i numeri veri ("2 su 3"), senza confronto con la città (Davide, 26/10/2026)
 */
export const MINIMO_CASI = 5

export interface FaseCalcolata { codice: string; nome: string; valore: number | null }

export interface PassaggioCalcolato {
  rapporto: number | null      // fase dopo ÷ fase prima (più alto = meglio); null se non calcolabile
  valore: string               // per le tabelle: "1 ogni 6,5", "0 su 12", "2 su 3" (pochi casi) oppure "—"
  numero: string               // per l'imbuto, in grassetto: "1 proposta ogni 6,5" o "2 vendite"
  testo: string                // per l'imbuto, dopo il numero: "appuntamenti" o "su 3 proposte (pochi casi)"
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
    const vuoto = { rapporto: null, valore: '—', numero: `1 ${p.uno} ogni …`, testo: p.basePlurale }
    if (da === null || a === null) return { ...vuoto, motivo: 'mancante' }
    if (da < MINIMO_CASI) return {
      rapporto: null, valore: `${unDecimale(a)} su ${unDecimale(da)}`, motivo: 'pochi',
      numero: `${unDecimale(a)} ${a === 1 ? p.uno : p.unoPlurale}`, testo: `su ${unDecimale(da)} ${da === 1 ? p.base : p.basePlurale} (pochi casi)`,
    }
    const rapporto = a / da
    if (a === 0) return { rapporto, valore: `0 su ${unDecimale(da)}`, numero: `0 ${p.unoPlurale}`, testo: `su ${unDecimale(da)} ${p.basePlurale}` }
    const ogni = da / a
    const n = unDecimale(ogni)
    return { rapporto, valore: `1 ogni ${n}`, numero: `1 ${p.uno} ogni ${n}`, testo: n === '1' ? p.base : p.basePlurale }
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
