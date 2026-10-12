// Cosa può fare l'utente collegato, lato sito.
// È solo per mostrare i menu giusti: la protezione vera è nel database (002_sicurezza.sql).
import type { Ufficio, Utente } from './tipi'

export function isAmministratore(u: Utente): boolean {
  return u.ruolo === 'admin_generale' || u.ruolo === 'admin_citta'
}

/** Uffici di cui l'utente può inserire i dati, nella città selezionata */
export function ufficiCompilabili(u: Utente, uffici: Ufficio[], cittaId: number): Ufficio[] {
  const attivi = uffici.filter((uf) => uf.attivo && uf.citta_id === cittaId)
  if (u.ruolo === 'admin_generale') return attivi
  if (u.ruolo === 'admin_citta') return attivi.filter((uf) => uf.citta_id === u.citta_id)
  return attivi.filter((uf) => uf.id === u.ufficio_id)
}
