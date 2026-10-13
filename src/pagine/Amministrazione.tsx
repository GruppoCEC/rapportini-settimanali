// Amministrazione della città: account (nome utente + password), uffici e (se attive) aree.
import { useState } from 'react'
import { gestioneAccount, generaPassword, suggerisciNomeUtente } from '../lib/account'
import { AREE_ATTIVE, type Contesto, nomeArea } from '../lib/contesto'
import { supabase } from '../lib/supabase'
import { NOMI_RUOLO, type Ruolo, type Utente } from '../lib/tipi'
import { useDati } from '../lib/useDati'
import { Caricamento } from '../componenti/Celle'

type Sezione = 'account' | 'uffici' | 'aree'
type Esito = { tipo: 'ok' | 'errore'; testo: string; credenziali?: { utente: string; password: string } } | null

function MessaggioEsito({ esito, onChiudi }: { esito: Esito; onChiudi: () => void }) {
  if (!esito) return null
  return (
    <div className={`messaggio-esito ${esito.tipo}`} role="status">
      <p>{esito.testo}</p>
      {esito.credenziali && (
        <div className="credenziali">
          <span>Nome utente: <strong>{esito.credenziali.utente}</strong></span>
          <span>Password: <strong>{esito.credenziali.password}</strong></span>
          <button className="secondario" onClick={() => navigator.clipboard.writeText(
            `Accesso a Rapportini Settimanali\nIndirizzo: ${location.origin + location.pathname}\nNome utente: ${esito.credenziali!.utente}\nPassword: ${esito.credenziali!.password}`)}>
            Copia da inviare all'ufficio
          </button>
          <span className="piccolo">Annotala ora: per sicurezza la password non sarà più visibile.</span>
        </div>
      )}
      <button className="link" onClick={onChiudi}>Chiudi</button>
    </div>
  )
}

export default function Amministrazione({ ctx }: { ctx: Contesto }) {
  const [sezione, setSezione] = useState<Sezione>('account')
  const nomeCitta = ctx.citta.find((c) => c.id === ctx.cittaId)?.nome
  return (
    <div className="pagina pagina-larga">
      <div className="scheda">
        <h1>Amministrazione · {nomeCitta}</h1>
        <div className="interruttore" role="tablist">
          {(AREE_ATTIVE ? ['account', 'uffici', 'aree'] as const : ['account', 'uffici'] as const).map((s) => (
            <button key={s} role="tab" aria-selected={sezione === s} className={sezione === s ? 'attivo' : ''} onClick={() => setSezione(s)}>
              {{ account: 'Account', uffici: 'Uffici', aree: 'Aree' }[s]}
            </button>
          ))}
        </div>
      </div>
      {sezione === 'account' && <SezioneAccount ctx={ctx} />}
      {sezione === 'uffici' && <SezioneUffici ctx={ctx} />}
      {sezione === 'aree' && <SezioneAree ctx={ctx} />}
    </div>
  )
}

// ---------------------------------------------------------------- ACCOUNT

function SezioneAccount({ ctx }: { ctx: Contesto }) {
  const generale = ctx.utente.ruolo === 'admin_generale'
  const ruoli: Ruolo[] = (generale ? ['ufficio', 'responsabile', 'admin_citta', 'admin_generale'] as Ruolo[] : ['ufficio', 'responsabile'] as Ruolo[])
    .filter((r) => AREE_ATTIVE || r !== 'responsabile')
  const ufficiCitta = ctx.uffici.filter((u) => u.citta_id === ctx.cittaId && u.attivo)
  const areeCitta = ctx.aree.filter((a) => a.citta_id === ctx.cittaId)
  const [esito, setEsito] = useState<Esito>(null)
  const [attesa, setAttesa] = useState(false)
  const [modifica, setModifica] = useState<string | null>(null)

  const elenco = useDati(async () => {
    const { data, error } = await supabase.from('utenti').select('*').eq('citta_id', ctx.cittaId).order('ruolo').order('nome_utente')
    if (error) throw new Error(error.message)
    return data as Utente[]
  }, [ctx.cittaId])

  const vuoto = { nome_utente: '', nome: '', ruolo: 'ufficio' as Ruolo, ufficio_id: '', area_id: '', email_promemoria: '', password: generaPassword() }
  const [nuovo, setNuovo] = useState(vuoto)

  async function esegui(azione: () => Promise<void>, ok: Esito) {
    setAttesa(true); setEsito(null)
    try { await azione(); setEsito(ok); elenco.ricarica() }
    catch (e) { setEsito({ tipo: 'errore', testo: (e as Error).message }) }
    finally { setAttesa(false) }
  }

  function crea(e: React.FormEvent) {
    e.preventDefault()
    const dati = { ...nuovo, nome_utente: nuovo.nome_utente.trim().toLowerCase() }
    esegui(async () => {
      await gestioneAccount({
        azione: 'crea', nome_utente: dati.nome_utente, password: dati.password, nome: dati.nome, ruolo: dati.ruolo,
        citta_id: ctx.cittaId,
        ufficio_id: dati.ufficio_id ? Number(dati.ufficio_id) : null,
        area_id: dati.area_id ? Number(dati.area_id) : null,
        email_promemoria: dati.email_promemoria,
      })
      setNuovo({ ...vuoto, password: generaPassword() })
    }, { tipo: 'ok', testo: `Account "${dati.nome_utente}" creato.`, credenziali: { utente: dati.nome_utente, password: dati.password } })
  }

  function nuovaPassword(u: Utente) {
    const password = generaPassword()
    if (!window.confirm(`Impostare una nuova password per "${u.nome_utente}"? Quella attuale smetterà di funzionare.`)) return
    esegui(() => gestioneAccount({ azione: 'password', nome_utente: u.nome_utente, password }),
      { tipo: 'ok', testo: `Nuova password impostata per "${u.nome_utente}".`, credenziali: { utente: u.nome_utente, password } })
  }

  function elimina(u: Utente) {
    if (!window.confirm(`Eliminare definitivamente l'account "${u.nome_utente}"? I dati inseriti dall'ufficio restano.`)) return
    esegui(() => gestioneAccount({ azione: 'elimina', nome_utente: u.nome_utente }), { tipo: 'ok', testo: `Account "${u.nome_utente}" eliminato.` })
  }

  function aggiorna(u: Utente, campi: Partial<Utente>, testo: string) {
    esegui(async () => {
      const { error } = await supabase.from('utenti').update(campi).eq('email', u.email)
      if (error) throw new Error(/email_promemoria_check/.test(error.message) ? 'Email per i promemoria non valida.' : error.message)
      setModifica(null)
    }, { tipo: 'ok', testo })
  }

  const gestibile = (u: Utente) => u.email !== ctx.utente.email && (generale || u.ruolo === 'ufficio' || u.ruolo === 'responsabile')
  const descrizione = (u: Utente) =>
    u.ruolo === 'responsabile' ? nomeArea(ctx, u.area_id)
      : ctx.uffici.find((x) => x.id === u.ufficio_id)?.nome ?? (u.ruolo === 'ufficio' ? '?' : '—')
  const senzaAccount = ufficiCitta.filter((uf) => !(elenco.dati ?? []).some((u) => u.ufficio_id === uf.id && u.ruolo === 'ufficio'))

  return (
    <>
      <MessaggioEsito esito={esito} onChiudi={() => setEsito(null)} />

      <form className="scheda" onSubmit={crea}>
        <h2>Nuovo account</h2>
        <div className="griglia-form">
          <label>Ruolo
            <select value={nuovo.ruolo} onChange={(e) => setNuovo({ ...nuovo, ruolo: e.target.value as Ruolo })}>
              {ruoli.map((r) => <option key={r} value={r}>{NOMI_RUOLO[r]}</option>)}
            </select>
          </label>
          {nuovo.ruolo !== 'responsabile' && (
            <label>Ufficio {nuovo.ruolo !== 'ufficio' && <span className="piccolo">(facoltativo: se compila anche un ufficio)</span>}
              <select required={nuovo.ruolo === 'ufficio'} value={nuovo.ufficio_id} onChange={(e) => {
                const uf = ufficiCitta.find((u) => u.id === Number(e.target.value))
                setNuovo({ ...nuovo, ufficio_id: e.target.value, nome_utente: nuovo.nome_utente || (uf ? suggerisciNomeUtente(uf.nome) : ''), nome: nuovo.nome || (uf ? `Ufficio ${uf.nome}` : '') })
              }}>
                <option value="">— scegli —</option>
                {ufficiCitta.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </label>
          )}
          {nuovo.ruolo === 'responsabile' && (
            <label>Area
              <select required value={nuovo.area_id} onChange={(e) => setNuovo({ ...nuovo, area_id: e.target.value })}>
                <option value="">— scegli —</option>
                {areeCitta.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </label>
          )}
          <label>Nome utente
            <input required pattern="[a-z0-9][a-z0-9.\-]{2,29}" title="Da 3 a 30 caratteri: lettere minuscole, numeri, punto, trattino"
              autoCapitalize="none" value={nuovo.nome_utente} onChange={(e) => setNuovo({ ...nuovo, nome_utente: e.target.value.toLowerCase() })} placeholder="es. somalia" />
          </label>
          <label>Nome descrittivo
            <input value={nuovo.nome} onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })} placeholder="es. Ufficio Somalia" />
          </label>
          <label>Email per i promemoria <span className="piccolo">(una o più, separate da virgola)</span>
            <input value={nuovo.email_promemoria} onChange={(e) => setNuovo({ ...nuovo, email_promemoria: e.target.value })} placeholder="es. somalia@gmail.com" />
          </label>
          <label>Password iniziale
            <div className="campo-password">
              <input required minLength={8} value={nuovo.password} onChange={(e) => setNuovo({ ...nuovo, password: e.target.value })} />
              <button type="button" className="link" onClick={() => setNuovo({ ...nuovo, password: generaPassword() })}>Genera</button>
            </div>
          </label>
        </div>
        <p><button type="submit" disabled={attesa}>{attesa ? 'Attendere…' : 'Crea account'}</button></p>
      </form>

      {elenco.caricamento || elenco.errore || !elenco.dati ? <Caricamento errore={elenco.errore} /> : (
        <div className="scheda">
          <h2>Account ({elenco.dati.length})</h2>
          {senzaAccount.length > 0 && (
            <p className="avviso">Uffici senza account: <strong>{senzaAccount.map((u) => u.nome).join(', ')}</strong></p>
          )}
          <div className="tabella-scorrevole">
            <table className="tabella-riepilogo tabella-admin">
              <thead><tr><th>Nome utente</th><th>Nome</th><th>Ruolo</th><th>{AREE_ATTIVE ? 'Ufficio / Area' : 'Ufficio'}</th><th>Email promemoria</th><th>Stato</th><th>Azioni</th></tr></thead>
              <tbody>
                {elenco.dati.map((u) => modifica === u.email ? (
                  <RigaModificaAccount key={u.email} u={u} ctx={ctx} ruoli={ruoli} onAnnulla={() => setModifica(null)}
                    onSalva={(campi) => aggiorna(u, campi, `Account "${u.nome_utente}" aggiornato.`)} />
                ) : (
                  <tr key={u.email} className={u.attivo ? '' : 'disattivo'}>
                    <th scope="row">{u.nome_utente}</th>
                    <td>{u.nome ?? '—'}</td>
                    <td>{NOMI_RUOLO[u.ruolo]}</td>
                    <td>{descrizione(u)}</td>
                    <td className="piccolo">{u.email_promemoria ?? <em className="semaforo-rosso">nessuna</em>}</td>
                    <td>{u.attivo ? 'Attivo' : 'Disattivato'}</td>
                    <td className="azioni">
                      {gestibile(u) ? <>
                        <button className="link" onClick={() => setModifica(u.email)}>Modifica</button>
                        <button className="link" onClick={() => nuovaPassword(u)}>Nuova password</button>
                        <button className="link" onClick={() => aggiorna(u, { attivo: !u.attivo }, `Account "${u.nome_utente}" ${u.attivo ? 'disattivato' : 'riattivato'}.`)}>{u.attivo ? 'Disattiva' : 'Riattiva'}</button>
                        <button className="link pericolo" onClick={() => elimina(u)}>Elimina</button>
                      </> : <span className="piccolo">{u.email === ctx.utente.email ? 'sei tu' : 'solo admin generale'}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="piccolo">"Disattiva" blocca subito l'accesso senza cancellare nulla. Il nome utente non si può cambiare: in caso, crea un nuovo account ed elimina il vecchio.</p>
        </div>
      )}
    </>
  )
}

function RigaModificaAccount({ u, ctx, ruoli, onAnnulla, onSalva }: {
  u: Utente; ctx: Contesto; ruoli: Ruolo[]; onAnnulla: () => void; onSalva: (campi: Partial<Utente>) => void
}) {
  const [campi, setCampi] = useState({ nome: u.nome ?? '', ruolo: u.ruolo, ufficio_id: u.ufficio_id ? String(u.ufficio_id) : '', area_id: u.area_id ? String(u.area_id) : '', email_promemoria: u.email_promemoria ?? '' })
  const ufficiCitta = ctx.uffici.filter((x) => x.citta_id === ctx.cittaId)
  const areeCitta = ctx.aree.filter((a) => a.citta_id === ctx.cittaId)
  return (
    <tr className="riga-modifica">
      <th scope="row">{u.nome_utente}</th>
      <td><input value={campi.nome} onChange={(e) => setCampi({ ...campi, nome: e.target.value })} aria-label="Nome" /></td>
      <td>
        <select value={campi.ruolo} onChange={(e) => setCampi({ ...campi, ruolo: e.target.value as Ruolo })} aria-label="Ruolo">
          {ruoli.map((r) => <option key={r} value={r}>{NOMI_RUOLO[r]}</option>)}
        </select>
      </td>
      <td>
        {campi.ruolo === 'responsabile' ? (
          <select value={campi.area_id} onChange={(e) => setCampi({ ...campi, area_id: e.target.value })} aria-label="Area">
            <option value="">— area —</option>
            {areeCitta.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        ) : (
          <select value={campi.ufficio_id} onChange={(e) => setCampi({ ...campi, ufficio_id: e.target.value })} aria-label="Ufficio">
            <option value="">— ufficio —</option>
            {ufficiCitta.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        )}
      </td>
      <td><input value={campi.email_promemoria} onChange={(e) => setCampi({ ...campi, email_promemoria: e.target.value })} aria-label="Email promemoria" /></td>
      <td colSpan={2} className="azioni">
        <button onClick={() => onSalva({
          nome: campi.nome || null, ruolo: campi.ruolo,
          ufficio_id: campi.ufficio_id ? Number(campi.ufficio_id) : null,
          area_id: campi.ruolo === 'responsabile' && campi.area_id ? Number(campi.area_id) : null,
          email_promemoria: campi.email_promemoria || null,
        })}>Salva</button>
        <button className="link" onClick={onAnnulla}>Annulla</button>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------- UFFICI

function SezioneUffici({ ctx }: { ctx: Contesto }) {
  const uffici = ctx.uffici.filter((u) => u.citta_id === ctx.cittaId).sort((a, b) => Number(b.attivo) - Number(a.attivo) || a.nome.localeCompare(b.nome))
  const aree = ctx.aree.filter((a) => a.citta_id === ctx.cittaId)
  const [nome, setNome] = useState('')
  const [area, setArea] = useState('')
  const [esito, setEsito] = useState<Esito>(null)

  async function esegui(promessa: PromiseLike<{ error: { message: string } | null }>, testo: string) {
    const { error } = await promessa
    if (error) return setEsito({ tipo: 'errore', testo: /duplicate key/.test(error.message) ? 'Esiste già un ufficio con questo nome.' : error.message })
    setEsito({ tipo: 'ok', testo })
    ctx.ricaricaBase()
  }

  return (
    <>
      <MessaggioEsito esito={esito} onChiudi={() => setEsito(null)} />
      <form className="scheda" onSubmit={(e) => {
        e.preventDefault()
        esegui(supabase.from('uffici').insert({ nome: nome.trim(), citta_id: ctx.cittaId, area_id: area ? Number(area) : null }), `Ufficio "${nome.trim()}" aggiunto. Ora crea il suo account nella scheda Account.`)
        setNome('')
      }}>
        <h2>Nuovo ufficio</h2>
        <div className="griglia-form">
          <label>Nome<input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Somalia" /></label>
          {AREE_ATTIVE && (
            <label>Area
              <select value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">Nessuna area</option>
                {aree.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </label>
          )}
        </div>
        <p><button type="submit">Aggiungi ufficio</button></p>
      </form>
      <div className="scheda">
        <h2>Uffici ({uffici.filter((u) => u.attivo).length} attivi)</h2>
        <div className="tabella-scorrevole">
          <table className="tabella-riepilogo tabella-admin">
            <thead><tr><th>Nome</th>{AREE_ATTIVE && <th>Area</th>}<th>Stato</th><th>Azioni</th></tr></thead>
            <tbody>
              {uffici.map((u) => (
                <tr key={u.id} className={u.attivo ? '' : 'disattivo'}>
                  <th scope="row">
                    <input defaultValue={u.nome} aria-label="Nome ufficio" onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== u.nome) esegui(supabase.from('uffici').update({ nome: v }).eq('id', u.id), `Ufficio rinominato in "${v}".`)
                    }} />
                  </th>
                  {AREE_ATTIVE && (
                  <td>
                      <select value={u.area_id ?? ''} aria-label="Area" onChange={(e) =>
                        esegui(supabase.from('uffici').update({ area_id: e.target.value ? Number(e.target.value) : null }).eq('id', u.id), `Area di "${u.nome}" aggiornata.`)}>
                        <option value="">Nessuna area</option>
                        {aree.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                      </select>
                    </td>
                  )}
                  <td>{u.attivo ? 'Attivo' : 'Disattivato'}</td>
                  <td className="azioni">
                    <button className="link" onClick={() => esegui(supabase.from('uffici').update({ attivo: !u.attivo }).eq('id', u.id), `Ufficio "${u.nome}" ${u.attivo ? 'disattivato' : 'riattivato'}.`)}>
                      {u.attivo ? 'Disattiva' : 'Riattiva'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="piccolo">Il nome si modifica direttamente nella casella. Gli uffici non si eliminano, per non perdere lo storico: un ufficio disattivato sparisce da cruscotto, riunione e promemoria.</p>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- AREE

function SezioneAree({ ctx }: { ctx: Contesto }) {
  const aree = ctx.aree.filter((a) => a.citta_id === ctx.cittaId)
  const [nome, setNome] = useState('')
  const [esito, setEsito] = useState<Esito>(null)

  async function esegui(promessa: PromiseLike<{ error: { message: string } | null }>, testo: string) {
    const { error } = await promessa
    if (error) {
      const msg = /foreign key/.test(error.message) ? 'L\'area contiene ancora uffici o responsabili: spostali prima di eliminarla.'
        : /duplicate key/.test(error.message) ? 'Esiste già un\'area con questo nome.' : error.message
      return setEsito({ tipo: 'errore', testo: msg })
    }
    setEsito({ tipo: 'ok', testo })
    ctx.ricaricaBase()
  }

  return (
    <>
      <MessaggioEsito esito={esito} onChiudi={() => setEsito(null)} />
      <form className="scheda" onSubmit={(e) => {
        e.preventDefault()
        esegui(supabase.from('aree').insert({ nome: nome.trim(), citta_id: ctx.cittaId }), `Area "${nome.trim()}" aggiunta.`)
        setNome('')
      }}>
        <h2>Nuova area</h2>
        <div className="griglia-form">
          <label>Nome<input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Roma Nord" /></label>
        </div>
        <p><button type="submit">Aggiungi area</button></p>
      </form>
      <div className="scheda">
        <h2>Aree ({aree.length})</h2>
        {aree.length === 0 ? <p className="piccolo">Nessuna area: gli uffici vengono mostrati tutti insieme.</p> : (
          <table className="tabella-riepilogo tabella-admin">
            <thead><tr><th>Nome</th><th>Uffici</th><th>Azioni</th></tr></thead>
            <tbody>
              {aree.map((a) => (
                <tr key={a.id}>
                  <th scope="row">
                    <input defaultValue={a.nome} aria-label="Nome area" onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== a.nome) esegui(supabase.from('aree').update({ nome: v }).eq('id', a.id), `Area rinominata in "${v}".`)
                    }} />
                  </th>
                  <td className="numero">{ctx.uffici.filter((u) => u.area_id === a.id && u.attivo).length}</td>
                  <td className="azioni">
                    <button className="link pericolo" onClick={() => {
                      if (window.confirm(`Eliminare l'area "${a.nome}"?`)) esegui(supabase.from('aree').delete().eq('id', a.id), `Area "${a.nome}" eliminata.`)
                    }}>Elimina</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
