// Dati di base condivisi da tutte le pagine (caricati una volta in App.tsx)
import type { Area, Citta, Metrica, Ufficio, Utente } from './tipi'

/**
 * Aree e responsabili d'area: disattivati il 13/10/2026 su richiesta di Davide.
 * Nel database restano (tabelle, regole di accesso): per riattivarli basta mettere true.
 */
export const AREE_ATTIVE = false

/**
 * Promemoria via email (settimanale: sabato 10:00 e lunedì 9:30; mensile: 3 giorni prima
 * e il giorno prima della scadenza). Configurati e provati da Davide il 15/10/2026, quindi il
 * sito li annuncia. Se un giorno si spengono su GitHub, rimettere false.
 */
export const PROMEMORIA_ATTIVI = true

/**
 * Rapportino mensile (pagine "Rapportino mensile" e "Report mensile").
 * Richiede le tabelle di supabase/migrations/005_mensile.sql: con false le pagine spariscono dal menu.
 */
export const MENSILE_ATTIVO = true

export interface Contesto {
  utente: Utente
  citta: Citta[]
  aree: Area[]
  uffici: Ufficio[]
  metriche: Metrica[]
  cittaId: number                // città selezionata
  ricaricaBase: () => void       // da chiamare dopo modifiche in Amministrazione
}

/**
 * Uffici attivi visibili all'utente nella città selezionata.
 * L'affiliato vede tutti i suoi uffici insieme, di qualunque città (il database gli manda solo quelli).
 */
export function ufficiVisibili(c: Contesto): Ufficio[] {
  return c.uffici.filter((u) => u.attivo && (c.utente.ruolo === 'affiliato' || u.citta_id === c.cittaId))
}

export function nomeArea(c: Contesto, areaId: number | null): string {
  return c.aree.find((a) => a.id === areaId)?.nome ?? 'Senza area'
}
