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
