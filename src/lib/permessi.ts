// Cosa può fare l'utente collegato, lato sito.
// È solo per mostrare i menu giusti: la protezione vera è nel database (002_sicurezza.sql).
import type { Ufficio, Utente } from './tipi'

export function isAmministratore(u: Utente): boolean {
  return u.ruolo === 'admin_generale' || u.ruolo === 'admin_citta'
}

/** Affiliato: vede e compila gli uffici che gli sono stati assegnati, anche di città diverse (dal 21/10/2026) */
export function isAffiliato(u: Utente): boolean {
  return u.ruolo === 'affiliato'
}

/** Uffici di cui l'utente può inserire i dati, nella città selezionata (l'affiliato: tutti i suoi) */
export function ufficiCompilabili(u: Utente, uffici: Ufficio[], cittaId: number): Ufficio[] {
  if (u.ruolo === 'affiliato') return uffici.filter((uf) => uf.attivo)   // il database gli manda solo i suoi uffici
  const attivi = uffici.filter((uf) => uf.attivo && uf.citta_id === cittaId)
  if (u.ruolo === 'admin_generale') return attivi
  if (u.ruolo === 'admin_citta') return attivi.filter((uf) => uf.citta_id === u.citta_id)
  return attivi.filter((uf) => uf.id === u.ufficio_id)
}
