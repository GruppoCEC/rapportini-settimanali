// Il mio account: dati dell'account e cambio password.
import { useState } from 'react'
import type { Contesto } from '../lib/contesto'
import { supabase } from '../lib/supabase'
import { NOMI_RUOLO } from '../lib/tipi'
import { Icona, useToast } from '../componenti/Interfaccia'

export default function Account({ ctx }: { ctx: Contesto }) {
  const [nuova, setNuova] = useState('')
  const [conferma, setConferma] = useState('')
  const [attesa, setAttesa] = useState(false)
  const [messaggio, setMessaggio] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null)
  const [toast, mostraToast] = useToast()
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
    mostraToast('Password cambiata.')
  }

  return (
    <div className="due-colonne entra">
      <section className="scheda" style={{ gap: 22 }}>
        <span className="kicker">Il mio account</span>
        <h1 className="titolo-pagina">{u.nome || u.nome_utente}</h1>
        <dl className="dati-account">
          <dt>Nome utente</dt><dd className="mono">{u.nome_utente}</dd>
          <dt>Ruolo</dt><dd>{NOMI_RUOLO[u.ruolo]}</dd>
          {ufficio && <><dt>Ufficio</dt><dd>{ufficio.nome}</dd></>}
          <dt>Email per i promemoria</dt><dd>{u.email_promemoria ?? <em>nessuna (chiedi all'amministratore di aggiungerla)</em>}</dd>
        </dl>
      </section>
      <form className="modulo entra entra-1" style={{ maxWidth: 420 }} onSubmit={cambia}>
        <h2 style={{ fontSize: 22 }}>Cambia password</h2>
        <div className="campo">
          <label htmlFor="nuova">Nuova password (almeno 8 caratteri)</label>
          <input id="nuova" type="password" autoComplete="new-password" value={nuova} onChange={(e) => { setNuova(e.target.value); setMessaggio(null) }} />
        </div>
        <div className="campo">
          <label htmlFor="conferma">Ripeti la nuova password</label>
          <input id="conferma" type="password" autoComplete="new-password" value={conferma} onChange={(e) => { setConferma(e.target.value); setMessaggio(null) }} />
        </div>
        <div><button type="submit" className="btn btn-primario" disabled={attesa || !nuova}><Icona nome="key" />{attesa ? 'Salvataggio…' : 'Cambia password'}</button></div>
        {messaggio && <p className={`messaggio-stato ${messaggio.tipo}`} role="status"><Icona nome={messaggio.tipo === 'ok' ? 'check-circle' : 'warning-circle'} />{messaggio.testo}</p>}
      </form>
      {toast}
    </div>
  )
}
