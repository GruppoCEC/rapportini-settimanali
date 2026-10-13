// Pagina di accesso: nome utente e password dell'ufficio.
// Supabase lavora con le email: il nome utente viene trasformato nell'email
// tecnica di accesso dal database (funzione email_di_accesso).
import { useState } from 'react'
import { supabase } from '../lib/supabase'

function traduciErrore(messaggio: string): string {
  if (/invalid login credentials/i.test(messaggio)) return 'Nome utente o password errati.'
  if (/rate limit|too many/i.test(messaggio)) return 'Troppi tentativi. Attendi qualche minuto e riprova.'
  if (/fetch|network/i.test(messaggio)) return 'Connessione assente o servizio non raggiungibile. Riprova.'
  return `Si è verificato un errore: ${messaggio}`
}

export default function Accesso() {
  const [nomeUtente, setNomeUtente] = useState('')
  const [password, setPassword] = useState('')
  const [mostraPassword, setMostraPassword] = useState(false)
  const [attesa, setAttesa] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function entra(e: React.FormEvent) {
    e.preventDefault()
    setAttesa(true); setErrore(null)
    const { data: email, error: e1 } = await supabase.rpc('email_di_accesso', { p_nome_utente: nomeUtente })
    if (e1 || !email) {
      setAttesa(false)
      setErrore(e1 ? traduciErrore(e1.message) : 'La piattaforma non è ancora configurata: manca il modello di accesso (vedi guida).')
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email as string, password })
    setAttesa(false)
    if (error) setErrore(traduciErrore(error.message))
    // se va bene, App.tsx riceve la nuova sessione e mostra il sito
  }

  return (
    <div className="centro">
      <div className="scheda scheda-stretta">
        <h1>Rapportini Settimanali</h1>
        <form onSubmit={entra}>
          <label htmlFor="utente">Nome utente</label>
          <input id="utente" required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus
            value={nomeUtente} onChange={(e) => setNomeUtente(e.target.value)} placeholder="es. somalia" />
          <label htmlFor="password">Password</label>
          <div className="campo-password">
            <input id="password" required type={mostraPassword ? 'text' : 'password'} autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="link" onClick={() => setMostraPassword((m) => !m)}>
              {mostraPassword ? 'Nascondi' : 'Mostra'}
            </button>
          </div>
          <button type="submit" disabled={attesa}>{attesa ? 'Accesso in corso…' : 'Entra'}</button>
        </form>
        {errore && <p className="errore" role="alert">{errore}</p>}
        <p className="piccolo">Password dimenticata? Chiedi all'amministratore della tua città di reimpostarla.</p>
        {import.meta.env.VITE_DEMO && (
          <div className="avviso">
            <strong>Versione dimostrativa</strong> (dati inventati). Password per tutti: <code>demo</code>
            <ul>
              <li><code>davide</code> · amministratore generale</li>
              <li><code>admin-milano</code> · amministratore di Milano</li>
              <li><code>somalia</code> · un ufficio</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
