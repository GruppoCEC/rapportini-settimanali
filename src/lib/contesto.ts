// Dati di base condivisi da tutte le pagine (caricati una volta in App.tsx)
import type { Area, Citta, Metrica, Ufficio, Utente } from './tipi'

/**
 * Aree e responsabili d'area: disattivati il 13/10/2026 su richiesta di Davide.
 * Nel database restano (tabelle, regole di accesso): per riattivarli basta mettere true.
 */
export const AREE_ATTIVE = false

/**
 * Promemoria via email (venerdì 16:00 e domenica 10:00): finché non sono configurati
 * (passo 8 di docs/GUIDA_SETUP.md) il sito non li annuncia. Dopo la configurazione: true.
 */
export const PROMEMORIA_ATTIVI = false

export interface Contesto {
  utente: Utente
  citta: Citta[]
  aree: Area[]
  uffici: Ufficio[]
  metriche: Metrica[]
  cittaId: number                // città selezionata
  ricaricaBase: () => void       // da chiamare dopo modifiche in Amministrazione
}

/** Uffici attivi visibili all'utente nella città selezionata */
export function ufficiVisibili(c: Contesto): Ufficio[] {
  return c.uffici.filter((u) => u.attivo && u.citta_id === c.cittaId)
}

export function nomeArea(c: Contesto, areaId: number | null): string {
  return c.aree.find((a) => a.id === areaId)?.nome ?? 'Senza area'
}
