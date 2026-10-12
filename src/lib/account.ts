// Operazioni sugli account (creazione, nuova password, eliminazione):
// passano dalla funzione sul server "gestione-account", l'unica che può
// creare account di accesso.
import { supabase } from './supabase'

export async function gestioneAccount(corpo: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase.functions.invoke('gestione-account', { body: corpo })
  if (error) {
    // La funzione risponde con { errore: "..." }: lo si estrae per mostrarlo in italiano
    const contesto = (error as { context?: Response }).context
    let messaggio = error.message
    try { messaggio = (await contesto?.json())?.errore ?? messaggio } catch { /* risposta non leggibile */ }
    if (/Failed to send a request|not found/i.test(messaggio)) {
      messaggio = 'La funzione "gestione-account" non risponde: è installata su Supabase? (vedi guida, passo 5)'
    }
    throw new Error(messaggio)
  }
  if (data?.errore) throw new Error(data.errore)
}

const PAROLE = ['sole', 'mare', 'casa', 'luna', 'vento', 'fiore', 'monte', 'lago', 'porto', 'ponte',
  'stella', 'faro', 'nuvola', 'bosco', 'prato', 'torre', 'piazza', 'fiume', 'isola', 'onda']

/** Password facile da dettare al telefono, es. "mare47vento" */
export function generaPassword(): string {
  const n = new Uint32Array(3)
  crypto.getRandomValues(n)
  return `${PAROLE[n[0] % PAROLE.length]}${10 + (n[1] % 90)}${PAROLE[n[2] % PAROLE.length]}`
}

/** Suggerisce un nome utente dal nome dell'ufficio: "Roma Parioli" → "roma-parioli" */
export function suggerisciNomeUtente(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
}

/**
 * Dall'email tecnica di accesso al nome utente da mostrare:
 * "rapportini.gruppo+somalia@gmail.com" → "somalia"
 */
export function nomeDaEmail(email: string | null | undefined): string {
  if (!email) return ''
  const locale = email.split('@')[0]
  return locale.includes('+') ? locale.slice(locale.indexOf('+') + 1) : locale
}
