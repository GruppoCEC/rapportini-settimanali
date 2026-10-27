// Note della settimana obbligatorie (decisione di Davide del 27/10/2026): tutte e tre le caselle
// (cosa è andato bene, difficoltà, mi serve aiuto su…), con almeno 6 parole ciascuna.
// Non valgono per le settimane non ancora iniziate (si scrivono solo gli obiettivi), per gli
// amministratori che correggono i dati di un ufficio e per le settimane prima del 26/10/2026.
import type { CampoNota } from './dati'

export const PAROLE_MINIME_NOTA = 6

/** Prima settimana con le note obbligatorie: quelle già chiuse si correggono senza doverle scrivere */
export const INIZIO_NOTE_OBBLIGATORIE = '2026-10-26'

const CAMPI: CampoNota[] = ['bene', 'difficolta', 'aiuto']

/** Parole di un testo: gruppi di caratteri con almeno una lettera o una cifra ("–", "..." non contano) */
export function contaParole(testo: string): number {
  return testo.split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length
}

/** Le note sono obbligatorie per questa settimana e questo utente? */
export function noteObbligatorie(settimana: string, opzioni: { amministratore?: boolean; futura?: boolean }): boolean {
  return !opzioni.amministratore && !opzioni.futura && settimana >= INIZIO_NOTE_OBBLIGATORIE
}

/** Le caselle con meno parole del minimo, nell'ordine della pagina */
export function noteIncomplete(nota: Record<CampoNota, string>): CampoNota[] {
  return CAMPI.filter((campo) => contaParole(nota[campo]) < PAROLE_MINIME_NOTA)
}
