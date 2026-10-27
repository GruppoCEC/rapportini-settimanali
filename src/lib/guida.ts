// Guida di benvenuto di "Inserisci mese": quando aprirla da sola e come ricordare la scelta.
// La scelta resta nel browser (vale per quel computer, non segue l'account su un altro PC):
// - "Non mostrare più" → per sempre (localStorage);
// - "Salta" o "Ho capito" senza spunta → solo finché la scheda resta aperta (sessionStorage).

/** La parte delle memorie del browser che serve qui (nelle prove si usa una memoria finta) */
export interface Memoria {
  getItem(chiave: string): string | null
  setItem(chiave: string, valore: string): void
  removeItem(chiave: string): void
}

export interface MemorieGuida {
  sempre: Memoria | null       // localStorage
  sessione: Memoria | null     // sessionStorage
}

const NASCOSTA = 'nascosta'
const VISTA = 'vista'
const chiave = (nomeUtente: string) => `rapportini.guidaMensile.${nomeUtente}`

/** Le memorie del browser; in una finestra privata o con i dati bloccati possono mancare */
export function memorieBrowser(): MemorieGuida {
  const prendi = (leggi: () => Storage): Memoria | null => { try { return leggi() } catch { return null } }
  return { sempre: prendi(() => window.localStorage), sessione: prendi(() => window.sessionStorage) }
}

function leggi(m: Memoria | null, k: string): string | null {
  try { return m?.getItem(k) ?? null } catch { return null }
}

/** L'utente ha spuntato "Non mostrare più" */
export function guidaNascosta(nomeUtente: string, memorie: MemorieGuida): boolean {
  return leggi(memorie.sempre, chiave(nomeUtente)) === NASCOSTA
}

/** Si apre da sola solo a uffici e affiliati, se non l'hanno già chiusa in questa scheda o nascosta per sempre */
export function guidaDaMostrare(nomeUtente: string, amministratore: boolean, memorie: MemorieGuida): boolean {
  if (amministratore) return false
  return !guidaNascosta(nomeUtente, memorie) && leggi(memorie.sessione, chiave(nomeUtente)) !== VISTA
}

/** Alla chiusura: non riaprirla in questa scheda; con la spunta, mai più (togliendo la spunta torna) */
export function ricordaChiusura(nomeUtente: string, nonMostrarePiu: boolean, memorie: MemorieGuida): void {
  const k = chiave(nomeUtente)
  try { memorie.sessione?.setItem(k, VISTA) } catch { /* memoria del browser non disponibile */ }
  try {
    if (nonMostrarePiu) memorie.sempre?.setItem(k, NASCOSTA)
    else memorie.sempre?.removeItem(k)
  } catch { /* memoria del browser non disponibile */ }
}
