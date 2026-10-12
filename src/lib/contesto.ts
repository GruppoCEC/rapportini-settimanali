// Dati di base condivisi da tutte le pagine (caricati una volta in App.tsx)
import type { Area, Citta, Metrica, Ufficio, Utente } from './tipi'

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
