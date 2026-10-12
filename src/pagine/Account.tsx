// Il mio account: dati dell'account e cambio password.
import { useState } from 'react'
import type { Contesto } from '../lib/contesto'
import { supabase } from '../lib/supabase'
import { NOMI_RUOLO } from '../lib/tipi'

export default function Account({ ctx }: { ctx: Contesto }) {
  const [nuova, setNuova] = useState('')
  const [conferma, setConferma] = useState('')
  const [attesa, setAttesa] = useState(false)
  const [messaggio, setMessaggio] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null)
  const u = ctx.utente
  const ufficio = ctx.uffici.find((x) => x.id === u.ufficio_id)

  async function cambia(e: React.FormEvent) {
    e.preventDefault()
    if (nuova.length < 8) return setMessaggio({ tipo: 'errore', testo: 'La password deve avere almeno 8 caratteri.' })
    if (nuova !== conferma) return setMessaggio({ tipo: 'errore', testo: 'Le due password non coincidono.' })
    setAttesa(true)
    const { error } = await supabase.auth.updateUser({ password: nuova })
    setAttesa(false)
    if (error) return setMessaggio({ tipo: 'errore', testo: `Cambio non riuscito: ${error.message}` })
    setNuova(''); setConferma('')
    setMessaggio({ tipo: 'ok', testo: 'Password cambiata. Usala dal prossimo accesso.' })
  }

  return (
    <div className="pagina">
      <div className="scheda">
        <h1>Il mio account</h1>
        <dl className="dati-account">
          <dt>Nome utente</dt><dd>{u.nome_utente}</dd>
          {u.nome && <><dt>Nome</dt><dd>{u.nome}</dd></>}
          <dt>Ruolo</dt><dd>{NOMI_RUOLO[u.ruolo]}</dd>
          {ufficio && <><dt>Ufficio</dt><dd>{ufficio.nome}</dd></>}
          <dt>Email per i promemoria</dt><dd>{u.email_promemoria ?? <em>nessuna (chiedi all'amministratore di aggiungerla)</em>}</dd>
        </dl>
      </div>
      <form className="scheda" onSubmit={cambia}>
        <h2>Cambia password</h2>
        <label htmlFor="nuova">Nuova password (almeno 8 caratteri)</label>
        <input id="nuova" type="password" autoComplete="new-password" value={nuova} onChange={(e) => setNuova(e.target.value)} />
        <label htmlFor="conferma">Ripeti la nuova password</label>
        <input id="conferma" type="password" autoComplete="new-password" value={conferma} onChange={(e) => setConferma(e.target.value)} />
        <p><button type="submit" disabled={attesa || !nuova}>{attesa ? 'Salvataggio…' : 'Cambia password'}</button></p>
        {messaggio && <p className={messaggio.tipo === 'ok' ? 'ok' : 'errore'} role="status">{messaggio.testo}</p>}
      </form>
    </div>
  )
}
