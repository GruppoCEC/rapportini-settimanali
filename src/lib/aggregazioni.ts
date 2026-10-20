// Aggregazioni per cruscotto, riunione e stato compilazione.
// Partono sempre dai dati settimanali grezzi e usano le regole di calcoli.ts.
import { quotaMercato, totaliPeriodo, type Totale } from './calcoli'
import type { Metrica, Rilevazione, Ufficio } from './tipi'

export type Totali = Map<string, Totale>

/** Totali del periodo per ciascun ufficio */
export function totaliPerUfficio(rilevazioni: Rilevazione[], metriche: Metrica[]): Map<number, Totali> {
  const perUfficio = new Map<number, Rilevazione[]>()
  for (const r of rilevazioni) {
    const lista = perUfficio.get(r.ufficio_id) ?? []
    lista.push(r)
    perUfficio.set(r.ufficio_id, lista)
  }
  return new Map([...perUfficio].map(([id, righe]) => [id, totaliPeriodo(righe, metriche)]))
}

/**
 * Somma i totali di più uffici (per area o città).
 * Anche i dati di zona si sommano qui: il portafoglio di una città è la somma
 * dei portafogli dei suoi uffici (ciascuno già preso all'ultima settimana).
 */
export function sommaTotali(elenco: Totali[]): Totali {
  const somma: Totali = new Map()
  for (const totali of elenco) {
    for (const [codice, t] of totali) {
      const s = somma.get(codice) ?? { obiettivo: null, risultato: null }
      if (t.obiettivo !== null) s.obiettivo = (s.obiettivo ?? 0) + t.obiettivo
      if (t.risultato !== null) s.risultato = (s.risultato ?? 0) + t.risultato
      somma.set(codice, s)
    }
  }
  return somma
}

export function quotaDaTotali(t: Totali | undefined): number | null {
  if (!t) return null
  return quotaMercato(t.get('portafoglio')?.risultato ?? null, t.get('incarichi_zona')?.risultato ?? null)
}

/**
 * Variazione di un dato di zona (es. portafoglio) rispetto alla settimana prima, sommata sugli uffici.
 * Conta solo gli uffici che l'hanno inserito in entrambe le settimane: chi non ha compilato non sembra un calo.
 * confrontati < conDato quando qualche ufficio manca nella settimana prima.
 */
export function variazioneZona(uffici: Ufficio[], ora: Map<number, Totali>, prima: Map<number, Totali>, codice: string):
  { variazione: number | null; confrontati: number; conDato: number } {
  const di = (t: Map<number, Totali>, u: Ufficio) => t.get(u.id)?.get(codice)?.risultato ?? null
  const conDato = uffici.filter((u) => di(ora, u) !== null)
  const confrontati = conDato.filter((u) => di(prima, u) !== null)
  const variazione = confrontati.length === 0 ? null : confrontati.reduce((s, u) => s + di(ora, u)! - di(prima, u)!, 0)
  return { variazione, confrontati: confrontati.length, conDato: conDato.length }
}

/**
 * Totali della somma degli uffici, periodo per periodo (ogni periodo = elenco di lunedì: una
 * settimana o le settimane di un mese). Stesse regole del mese: attività sommate, dati di zona
 * all'ultima settimana compilata da ciascun ufficio. Le rilevazioni vanno già filtrate sugli uffici.
 */
export function totaliPerPeriodi(rilevazioni: Rilevazione[], metriche: Metrica[], periodi: string[][]): Totali[] {
  return periodi.map((settimane) => {
    const dentro = new Set(settimane)
    return sommaTotali([...totaliPerUfficio(rilevazioni.filter((r) => dentro.has(r.settimana)), metriche).values()])
  })
}

/** Una riga di totali_mia_citta (supabase/migrations/008_totali_citta.sql): somme della città, senza i singoli uffici */
export interface RigaTotaliCitta {
  periodo: number            // da 1, nell'ordine dei periodi richiesti
  metrica: string
  obiettivo: number | null
  risultato: number | null
  uffici_con_dato: number    // uffici con questa voce
  uffici_con_dati: number    // uffici con almeno una voce
  variazione: number | null  // solo dati di zona
  confrontati: number | null
  uffici_citta: number
}

/** Totali di tutta la città dell'ufficio, nella stessa forma di totaliPerPeriodi e variazioneZona */
export interface TotaliCitta {
  andamento: Totali[]        // un elemento per periodo, dal più vecchio; l'ultimo è quello presentato
  zona: Map<string, { variazione: number | null; confrontati: number; conDato: number }>   // ultimo periodo sul precedente
  ufficiConDati: number      // uffici con almeno un dato nell'ultimo periodo
  ufficiCitta: number
}

export function totaliCittaDaRighe(righe: RigaTotaliCitta[], nPeriodi: number): TotaliCitta {
  const numero = (v: number | string | null) => (v === null ? null : Number(v))   // i bigint possono arrivare come testo
  const andamento: Totali[] = Array.from({ length: nPeriodi }, () => new Map())
  const zona: TotaliCitta['zona'] = new Map()
  let ufficiConDati = 0, ufficiCitta = 0
  for (const r of righe) {
    const t = andamento[r.periodo - 1]
    if (!t) continue
    t.set(r.metrica, { obiettivo: numero(r.obiettivo), risultato: numero(r.risultato) })
    ufficiCitta = r.uffici_citta
    if (r.periodo === nPeriodi) {
      ufficiConDati = r.uffici_con_dati
      if (r.confrontati !== null) {
        zona.set(r.metrica, { variazione: numero(r.variazione), confrontati: r.confrontati, conDato: r.uffici_con_dato })
      }
    }
  }
  return { andamento, zona, ufficiConDati, ufficiCitta }
}

/** Percentuale di raggiungimento dell'obiettivo (1 = 100%) */
export function raggiungimento(t: Totale | undefined): number | null {
  if (!t || t.obiettivo === null || t.risultato === null || t.obiettivo === 0) return null
  return t.risultato / t.obiettivo
}

export type Semaforo = 'verde' | 'giallo' | 'rosso' | 'nessuno'

/** Verde: obiettivo raggiunto · Giallo: almeno 70% · Rosso: sotto il 70% */
export function semaforo(t: Totale | undefined): Semaforo {
  const r = raggiungimento(t)
  if (r === null) return 'nessuno'
  if (r >= 1) return 'verde'
  if (r >= 0.7) return 'giallo'
  return 'rosso'
}

export type StatoCompilazione = 'completo' | 'parziale' | 'mancante'

/**
 * Stato di compilazione di un ufficio in una settimana:
 * completo = tutte le attività hanno un risultato (anche 0) · mancante = nessun dato
 */
export function statoCompilazione(righe: Rilevazione[], metriche: Metrica[]): StatoCompilazione {
  const conRisultato = new Set(righe.filter((r) => r.risultato !== null).map((r) => r.metrica))
  if (conRisultato.size === 0) return 'mancante'
  const attivita = metriche.filter((m) => m.tipo === 'attivita')
  return attivita.every((m) => conRisultato.has(m.codice)) ? 'completo' : 'parziale'
}

/**
 * Stato di compilazione su più settimane (es. un mese): completo se tutte le settimane sono
 * complete, mancante se in nessuna c'è un dato, altrimenti parziale.
 */
export function statoCompilazionePeriodo(righe: Rilevazione[], metriche: Metrica[], settimane: string[]): StatoCompilazione {
  const stati = settimane.map((s) => statoCompilazione(righe.filter((r) => r.settimana === s), metriche))
  if (stati.every((s) => s === 'mancante')) return 'mancante'
  return stati.every((s) => s === 'completo') ? 'completo' : 'parziale'
}

export interface VoceClassifica {
  ufficio: Ufficio
  valore: number
  totale: Totale | undefined
}

/** Classifica degli uffici per una voce, in valore assoluto (dal più alto) */
export function classifica(uffici: Ufficio[], totali: Map<number, Totali>, metrica: string): VoceClassifica[] {
  return uffici
    .map((ufficio) => ({ ufficio, totale: totali.get(ufficio.id)?.get(metrica), valore: totali.get(ufficio.id)?.get(metrica)?.risultato ?? null }))
    .filter((v): v is VoceClassifica => v.valore !== null)
    .sort((a, b) => b.valore - a.valore || a.ufficio.nome.localeCompare(b.ufficio.nome))
}

/** Classifica per quota di mercato */
export function classificaQuota(uffici: Ufficio[], totali: Map<number, Totali>): { ufficio: Ufficio; quota: number }[] {
  return uffici
    .map((ufficio) => ({ ufficio, quota: quotaDaTotali(totali.get(ufficio.id)) }))
    .filter((v): v is { ufficio: Ufficio; quota: number } => v.quota !== null)
    .sort((a, b) => b.quota - a.quota)
}

/** Serie settimana per settimana di una voce (per i grafici di andamento) */
export function serieSettimanale(rilevazioni: Rilevazione[], metrica: string, settimane: string[]): Totale[] {
  return settimane.map((s) => {
    const righe = rilevazioni.filter((r) => r.settimana === s && r.metrica === metrica)
    if (righe.length === 0) return { obiettivo: null, risultato: null }
    return sommaTotali(righe.map((r) => new Map([[metrica, { obiettivo: r.obiettivo, risultato: r.risultato }]]))).get(metrica)!
  })
}

/** Quota di mercato settimana per settimana (somma degli uffici indicati) */
export function serieQuota(rilevazioni: Rilevazione[], settimane: string[]): (number | null)[] {
  const port = serieSettimanale(rilevazioni, 'portafoglio', settimane)
  const inc = serieSettimanale(rilevazioni, 'incarichi_zona', settimane)
  return settimane.map((_, i) => quotaMercato(port[i].risultato, inc[i].risultato))
}
