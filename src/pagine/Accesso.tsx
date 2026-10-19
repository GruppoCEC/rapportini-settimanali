// Pagina di accesso: nome utente e password dell'ufficio.
// Supabase lavora con le email: il nome utente viene trasformato nell'email
// tecnica di accesso dal database (funzione email_di_accesso).
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { PROMEMORIA_ATTIVI } from '../lib/contesto'
import { Icona, Logo } from '../componenti/Interfaccia'

const UTENTI_DEMO = [['davide', 'amministratore generale'], ['admin-milano', 'amministratore di Milano'], ['somalia', 'un ufficio'], ['affiliato-demo', 'un affiliato']]

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

  const punti = [
    { icona: 'device-mobile', testo: 'Compili da computer o da telefono' },
    ...(PROMEMORIA_ATTIVI ? [{ icona: 'bell-ringing', testo: 'Promemoria automatici il sabato e il lunedì mattina' }] : []),
    { icona: 'presentation-chart', testo: 'Esiti, totali e quota di mercato calcolati da soli, pronti per la riunione del lunedì' },
  ]

  return (
    <>
      {import.meta.env.VITE_DEMO && <div className="striscia-demo">Versione dimostrativa · dati inventati, si azzerano ricaricando la pagina</div>}
      <div className="accesso">
        <section className="accesso-pannello">
          <div className="cerchio cerchio-a" /><div className="cerchio cerchio-b" />
          <div className="marchio accesso-marchio entra">
            <Logo dimensione={48} />
            <div className="marchio-testi">
              <span className="marchio-nome">Rapportini Settimanali</span>
              <span className="marchio-sotto">Gruppo CEC · Roma e Milano</span>
            </div>
          </div>
          <div className="entra entra-1" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <h1 className="accesso-titolo">La settimana di ogni ufficio, <span>in un solo posto.</span></h1>
            <p className="accesso-testo">Piattaforma web dove gli uffici immobiliari del gruppo inseriscono ogni settimana le proprie attività e i dati di zona.</p>
            <div className="accesso-punti">
              {punti.map((p) => <div key={p.icona}><span className="ic"><Icona nome={p.icona} /></span><span>{p.testo}</span></div>)}
            </div>
          </div>
          <div className="entra entra-2" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }} aria-hidden="true">
            <div className="mini-card">
              <span className="nome">Incarichi</span>
              <span className="riga"><strong>16</strong><span className="piccolo">su 15</span><span className="tag tag-ok" style={{ marginLeft: 'auto' }}>107% ✓</span></span>
              <span className="barra"><div className="pieno-verde" style={{ width: '100%' }} /></span>
            </div>
            <div className="mini-card" style={{ transform: 'translateY(14px)' }}>
              <span className="nome">Quota di mercato</span>
              <span className="riga"><strong>21,4%</strong><span className="tag tag-ok" style={{ marginLeft: 'auto' }}>✓</span></span>
              <span className="barra"><div className="pieno-verde" style={{ width: '54%' }} /></span>
            </div>
          </div>
        </section>

        <section className="accesso-modulo-zona">
          <form className="accesso-modulo entra entra-1" onSubmit={entra}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="kicker">Area riservata</span>
              <h2>Accedi al tuo ufficio</h2>
              <p style={{ color: 'var(--testo-2)' }}>Usa il nome utente e la password che ti ha dato l'amministratore della tua città.</p>
            </div>
            <div className="campo">
              <label htmlFor="utente" style={{ fontSize: 14, color: 'var(--testo)' }}>Nome utente</label>
              <div className="campo-icona">
                <Icona nome="user" />
                <input id="utente" required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus
                  value={nomeUtente} onChange={(e) => { setNomeUtente(e.target.value); setErrore(null) }} placeholder="es. somalia" />
              </div>
            </div>
            <div className="campo">
              <label htmlFor="password" style={{ fontSize: 14, color: 'var(--testo)' }}>Password</label>
              <div className="campo-icona">
                <Icona nome="lock-key" />
                <input id="password" required type={mostraPassword ? 'text' : 'password'} autoComplete="current-password"
                  value={password} onChange={(e) => { setPassword(e.target.value); setErrore(null) }} />
                <button type="button" onClick={() => setMostraPassword((m) => !m)} aria-pressed={mostraPassword}>
                  <Icona nome={mostraPassword ? 'eye-slash' : 'eye'} />{mostraPassword ? 'Nascondi' : 'Mostra'}
                </button>
              </div>
            </div>
            {errore && <p className="errore-box" role="alert"><Icona nome="warning-circle" />{errore}</p>}
            <button type="submit" className="btn btn-primario btn-entra" disabled={attesa}>
              <Icona nome={attesa ? 'circle-notch' : 'sign-in'} className={attesa ? 'gira' : ''} />{attesa ? 'Accesso in corso…' : 'Entra'}
            </button>
            <p style={{ fontSize: 14, color: 'var(--testo-2)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icona nome="question" style={{ fontSize: 18, color: 'var(--primario)' }} />Password dimenticata? Chiedi all'amministratore della tua città di reimpostarla.
            </p>
            {import.meta.env.VITE_DEMO && (
              <div className="riquadro-demo">
                <span style={{ fontSize: 13, fontWeight: 700 }}><span className="tag tag-quasi" style={{ marginRight: 6 }}>Demo</span>Dati inventati · password per tutti: <code>demo</code></span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {UTENTI_DEMO.map(([u, l]) => (
                    <button key={u} type="button" onClick={() => { setNomeUtente(u); setPassword('demo'); setErrore(null) }}>
                      <strong>{u}</strong><span>{l}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        </section>
      </div>
    </>
  )
}
