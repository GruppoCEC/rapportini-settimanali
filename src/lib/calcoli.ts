// Calcoli sui dati: esito, quota di mercato, totali del mese.
// Le stesse regole sono nel database (supabase/migrations/003_viste_calcoli.sql; quota in 007_quota_mercato.sql).

import type { Metrica, Rilevazione } from './tipi'

/** Obiettivo di quota di mercato del gruppo */
export const OBIETTIVO_QUOTA = 0.2

/** Esito = Risultato − Obiettivo. Vuoto se manca uno dei due. */
export function esito(obiettivo: number | null, risultato: number | null): number | null {
  if (obiettivo === null || risultato === null) return null
  return risultato - obiettivo
}

/**
 * Quota di mercato = Portafoglio ÷ Incarichi in zona (gli incarichi in zona comprendono già il portafoglio).
 * Mai #DIV/0!: vuota se non calcolabile.
 */
export function quotaMercato(portafoglio: number | null, incarichiZona: number | null): number | null {
  if (portafoglio === null || incarichiZona === null || incarichiZona === 0) return null
  return portafoglio / incarichiZona
}

export interface Totale {
  obiettivo: number | null
  risultato: number | null
}

/**
 * Totali di un periodo (es. un mese) per ogni voce:
 * - attività → somma delle settimane
 * - zona     → valore dell'ultima settimana compilata (non si somma)
 */
export function totaliPeriodo(rilevazioni: Rilevazione[], metriche: Metrica[]): Map<string, Totale> {
  const tipo = new Map(metriche.map((m) => [m.codice, m.tipo]))
  const totali = new Map<string, Totale>()
  const ultimaSettimana = new Map<string, string>()
  for (const r of rilevazioni) {
    const t = totali.get(r.metrica) ?? { obiettivo: null, risultato: null }
    if (tipo.get(r.metrica) === 'attivita') {
      if (r.obiettivo !== null) t.obiettivo = (t.obiettivo ?? 0) + r.obiettivo
      if (r.risultato !== null) t.risultato = (t.risultato ?? 0) + r.risultato
    } else if (r.risultato !== null && r.settimana > (ultimaSettimana.get(r.metrica) ?? '')) {
      t.risultato = r.risultato
      ultimaSettimana.set(r.metrica, r.settimana)
    }
    totali.set(r.metrica, t)
  }
  return totali
}

/**
 * Converte quanto scritto in una casella in un numero.
 * '' → null (casella vuota); numero intero ≥ 0 → numero; altro → 'errore'
 */
export function leggiNumero(testo: string): number | null | 'errore' {
  const pulito = testo.trim()
  if (pulito === '') return null
  if (!/^\d+$/.test(pulito)) return 'errore'
  return Number(pulito)
}

export function formattaPercentuale(valore: number | null): string {
  if (valore === null) return '—'
  return (valore * 100).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
}

export function formattaEsito(valore: number | null): string {
  if (valore === null) return '—'
  return valore > 0 ? `+${valore}` : String(valore)
}
