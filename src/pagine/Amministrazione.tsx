// Amministrazione della città: account (nome utente + password), affiliati, uffici e (se attive) aree.
import { useState } from 'react'
import { gestioneAccount, generaPassword, suggerisciNomeUtente } from '../lib/account'
import { AREE_ATTIVE, MENSILE_ATTIVO, type Contesto, nomeArea } from '../lib/contesto'
import { supabase } from '../lib/supabase'
import { NOMI_RUOLO, type Ruolo, type Ufficio, type Utente } from '../lib/tipi'
import { useDati } from '../lib/useDati'
import { caricaMensilePerBackup, caricaTuttoPerBackup } from '../lib/dati'
import { Caricamento } from '../componenti/Celle'
import { Icona, useConferma, useToast } from '../componenti/Interfaccia'

type Sezione = 'account' | 'uffici' | 'aree' | 'backup'
type Esito = { tipo: 'ok' | 'errore'; testo: string; credenziali?: { utente: string; password: string } } | null

function MessaggioEsito({ esito, onChiudi }: { esito: Esito; onChiudi: () => void }) {
  const [copiato, setCopiato] = useState(false)
  if (!esito) return null
  return (
    <div className={`esito-box ${esito.tipo}`} role="status">
      <div className="esito-riga">
        <Icona nome={esito.tipo === 'ok' ? 'check-circle' : 'warning-circle'} />
        <span>{esito.testo}</span>
        <button className="btn btn-fantasma" onClick={onChiudi}>Chiudi</button>
      </div>
      {esito.credenziali && (
        <div className="credenziali">
          <span>Nome utente: <strong>{esito.credenziali.utente}</strong></span>
          <span>Password: <strong className="mono">{esito.credenziali.password}</strong></span>
          <button className="btn btn-secondario" onClick={async () => {
            await navigator.clipboard.writeText(
              `Accesso a Rapportini Settimanali\nIndirizzo: ${location.origin + location.pathname}\nNome utente: ${esito.credenziali!.utente}\nPassword: ${esito.credenziali!.password}`)
            setCopiato(true)
          }}>
            <Icona nome={copiato ? 'check' : 'copy'} />{copiato ? 'Copiato' : 'Copia da inviare'}
          </button>
          <span style={{ fontSize: 13 }}>Annotala ora: per sicurezza la password non sarà più visibile.</span>
        </div>
      )}
    </div>
  )
}

export default function Amministrazione({ ctx }: { ctx: Contesto }) {
  const [sezione, setSezione] = useState<Sezione>('account')
  const nomeCitta = ctx.citta.find((c) => c.id === ctx.cittaId)?.nome
  const generale = ctx.utente.ruolo === 'admin_generale'
  const sezioni: Sezione[] = [...(AREE_ATTIVE ? ['account', 'uffici', 'aree'] as Sezione[] : ['account', 'uffici'] as Sezione[]), ...(generale ? ['backup'] as Sezione[] : [])]
  return (
    <div className="pagina entra">
      <div className="intestazione">
        <div className="intestazione-titoli">
          <span className="kicker">Amministrazione</span>
          <h1 className="titolo-pagina">{nomeCitta}</h1>
        </div>
        <div className="segmentato" role="tablist">
          {sezioni.map((s) => (
            <button key={s} role="tab" aria-selected={sezione === s} className={sezione === s ? 'attivo' : ''} onClick={() => setSezione(s)}>
              <Icona nome={{ account: 'users', uffici: 'buildings', aree: 'map-trifold', backup: 'download-simple' }[s]} />{{ account: 'Account', uffici: 'Uffici', aree: 'Aree', backup: 'Backup' }[s]}
            </button>
          ))}
        </div>
      </div>
      {sezione === 'account' && <SezioneAccount ctx={ctx} />}
      {sezione === 'uffici' && <SezioneUffici ctx={ctx} />}
      {sezione === 'aree' && <SezioneAree ctx={ctx} />}
      {sezione === 'backup' && generale && <SezioneBackup ctx={ctx} />}
    </div>
  )
}

// ---------------------------------------------------------------- ACCOUNT

/** Affiliato con gli uffici che può consultare */
type Affiliato = Utente & { uffici: number[] }

function SezioneAccount({ ctx }: { ctx: Contesto }) {
  const generale = ctx.utente.ruolo === 'admin_generale'
  const ruoli: Ruolo[] = (generale ? ['ufficio', 'responsabile', 'admin_citta', 'admin_generale', 'affiliato'] as Ruolo[] : ['ufficio', 'responsabile'] as Ruolo[])
    .filter((r) => AREE_ATTIVE || r !== 'responsabile')
  const ruoliModifica = ruoli.filter((r) => r !== 'affiliato')   // un account esistente non diventa affiliato (e viceversa)
  const ufficiCitta = ctx.uffici.filter((u) => u.citta_id === ctx.cittaId && u.attivo)
  const areeCitta = ctx.aree.filter((a) => a.citta_id === ctx.cittaId)
  const [esito, setEsito] = useState<Esito>(null)
  const [attesa, setAttesa] = useState(false)
  const [modifica, setModifica] = useState<string | null>(null)
  const [dialogo, chiedi] = useConferma()
  const [toast, mostraToast] = useToast()

  const elenco = useDati(async () => {
    const { data, error } = await supabase.from('utenti').select('*').eq('citta_id', ctx.cittaId).neq('ruolo', 'affiliato').order('ruolo').order('nome_utente')
    if (error) throw new Error(error.message)
    return data as Utente[]
  }, [ctx.cittaId])

  // Gli affiliati possono avere uffici in entrambe le città: elenco unico, solo per l'amministratore generale
  const affiliati = useDati(async () => {
    if (!generale) return [] as Affiliato[]
    const [a, ua] = await Promise.all([
      supabase.from('utenti').select('*').eq('ruolo', 'affiliato').order('nome_utente'),
      supabase.from('uffici_affiliato').select('nome_utente, ufficio_id'),
    ])
    const errore = a.error ?? ua.error
    if (errore) throw new Error(/uffici_affiliato/.test(errore.message) ? 'Manca la tabella degli affiliati: esegui 006_affiliati.sql in Supabase (vedi guida).' : errore.message)
    const righe = (ua.data ?? []) as { nome_utente: string; ufficio_id: number }[]
    return (a.data as Utente[]).map((u) => ({ ...u, uffici: righe.filter((r) => r.nome_utente === u.nome_utente).map((r) => Number(r.ufficio_id)) }))
  }, [generale])

  const vuoto = { nome_utente: '', nome: '', ruolo: 'ufficio' as Ruolo, ufficio_id: '', area_id: '', email_promemoria: '', password: generaPassword(), uffici: [] as number[] }
  const [nuovo, setNuovo] = useState(vuoto)

  async function esegui(azione: () => Promise<void>, ok: Esito) {
    setAttesa(true); setEsito(null)
    try { await azione(); setEsito(ok); if (ok) mostraToast(ok.testo); elenco.ricarica(); affiliati.ricarica() }
    catch (e) { setEsito({ tipo: 'errore', testo: (e as Error).message }) }
    finally { setAttesa(false) }
  }

  function crea(e: React.FormEvent) {
    e.preventDefault()
    const dati = { ...nuovo, nome_utente: nuovo.nome_utente.trim().toLowerCase() }
    const affiliato = dati.ruolo === 'affiliato'
    if (affiliato && dati.uffici.length === 0) { setEsito({ tipo: 'errore', testo: 'Scegli almeno un ufficio che l\'affiliato può consultare.' }); return }
    esegui(async () => {
      await gestioneAccount({
        azione: 'crea', nome_utente: dati.nome_utente, password: dati.password, nome: dati.nome, ruolo: dati.ruolo,
        // l'affiliato prende la città del primo ufficio scelto (serve solo agli elenchi)
        citta_id: affiliato ? ctx.uffici.find((u) => u.id === dati.uffici[0])?.citta_id ?? ctx.cittaId : ctx.cittaId,
        ufficio_id: !affiliato && dati.ufficio_id ? Number(dati.ufficio_id) : null,
        area_id: !affiliato && dati.area_id ? Number(dati.area_id) : null,
        email_promemoria: affiliato ? '' : dati.email_promemoria,
      })
      if (affiliato) {
        try { await salvaUfficiAffiliato(dati.nome_utente, dati.uffici) }
        catch (e) { throw new Error(`Account creato, ma gli uffici non sono stati salvati (${(e as Error).message}). Assegnali con "Modifica" nella sezione Affiliati.`) }
      }
      setNuovo({ ...vuoto, password: generaPassword() })
    }, { tipo: 'ok', testo: `Account "${dati.nome_utente}" creato.`, credenziali: { utente: dati.nome_utente, password: dati.password } })
  }

  function aggiornaAffiliato(a: Affiliato, nome: string, uffici: number[]) {
    esegui(async () => {
      const { error } = await supabase.from('utenti').update({ nome: nome || null }).eq('email', a.email)
      if (error) throw new Error(error.message)
      await salvaUfficiAffiliato(a.nome_utente, uffici)
      setModifica(null)
    }, { tipo: 'ok', testo: `Affiliato "${a.nome_utente}" aggiornato.` })
  }

  async function nuovaPassword(u: Utente) {
    const password = generaPassword()
    if (!await chiedi({ titolo: 'Nuova password', testo: `Impostare una nuova password per "${u.nome_utente}"? Quella attuale smetterà di funzionare.`, conferma: 'Imposta' })) return
    esegui(() => gestioneAccount({ azione: 'password', nome_utente: u.nome_utente, password }),
      { tipo: 'ok', testo: `Nuova password impostata per "${u.nome_utente}".`, credenziali: { utente: u.nome_utente, password } })
  }

  async function elimina(u: Utente) {
    if (!await chiedi({ titolo: 'Elimina account', testo: `Eliminare definitivamente l'account "${u.nome_utente}"? I dati inseriti dall'ufficio restano.`, conferma: 'Elimina', pericolo: true })) return
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
  // conta qualsiasi account collegato all'ufficio, anche un amministratore di città che compila per il proprio ufficio
  const senzaAccount = ufficiCitta.filter((uf) => !(elenco.dati ?? []).some((u) => u.ufficio_id === uf.id))

  return (
    <>
      <MessaggioEsito esito={esito} onChiudi={() => setEsito(null)} />

      <form className="modulo" style={{ gap: 18 }} onSubmit={crea}>
        <h2 style={{ fontSize: 22 }}>Nuovo account</h2>
        <div className="griglia-campi">
          <label className="campo"><span className="etichetta">Ruolo</span>
            <select value={nuovo.ruolo} onChange={(e) => setNuovo({ ...nuovo, ruolo: e.target.value as Ruolo })}>
              {ruoli.map((r) => <option key={r} value={r}>{NOMI_RUOLO[r]}</option>)}
            </select>
          </label>
          {nuovo.ruolo !== 'responsabile' && nuovo.ruolo !== 'affiliato' && (
            <label className="campo"><span className="etichetta">Ufficio {nuovo.ruolo !== 'ufficio' && <span style={{ fontSize: 11, fontWeight: 400 }}>(facoltativo: se compila anche un ufficio)</span>}</span>
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
            <label className="campo"><span className="etichetta">Area</span>
              <select required value={nuovo.area_id} onChange={(e) => setNuovo({ ...nuovo, area_id: e.target.value })}>
                <option value="">— scegli —</option>
                {areeCitta.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </label>
          )}
          <label className="campo"><span className="etichetta">Nome utente</span>
            <input required pattern="[a-z0-9][a-z0-9.\-]{2,29}" title="Da 3 a 30 caratteri: lettere minuscole, numeri, punto, trattino"
              autoCapitalize="none" value={nuovo.nome_utente} onChange={(e) => setNuovo({ ...nuovo, nome_utente: e.target.value.toLowerCase() })} placeholder="es. somalia" />
          </label>
          <label className="campo"><span className="etichetta">Nome descrittivo</span>
            <input value={nuovo.nome} onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })} placeholder={nuovo.ruolo === 'affiliato' ? 'es. Mario Rossi' : 'es. Ufficio Somalia'} />
          </label>
          {nuovo.ruolo !== 'affiliato' && (
            <label className="campo"><span className="etichetta">Email per i promemoria <span style={{ fontSize: 11, fontWeight: 400 }}>(una o più, separate da virgola)</span></span>
              <input value={nuovo.email_promemoria} onChange={(e) => setNuovo({ ...nuovo, email_promemoria: e.target.value })} placeholder="es. somalia@gmail.com" />
            </label>
          )}
          <div className="campo"><label htmlFor="password-nuova">Password iniziale</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input id="password-nuova" className="mono" required minLength={8} value={nuovo.password} onChange={(e) => setNuovo({ ...nuovo, password: e.target.value })} />
              <button type="button" className="btn btn-fantasma" onClick={() => setNuovo({ ...nuovo, password: generaPassword() })}><Icona nome="arrows-clockwise" />Genera</button>
            </div>
          </div>
        </div>
        {nuovo.ruolo === 'affiliato' && (
          <div className="campo">
            <span className="etichetta">Uffici che può consultare ({nuovo.uffici.length} scelti) <span style={{ fontSize: 11, fontWeight: 400 }}>· vede settimanale e mensile in sola lettura, senza gara a punti</span></span>
            <SceltaUffici uffici={ctx.uffici} citta={ctx.citta} scelti={nuovo.uffici} onCambia={(uffici) => setNuovo({ ...nuovo, uffici })} />
          </div>
        )}
        <div><button type="submit" className="btn btn-primario" disabled={attesa}><Icona nome="user-plus" />{attesa ? 'Attendere…' : 'Crea account'}</button></div>
      </form>

      {elenco.caricamento || elenco.errore || !elenco.dati ? <Caricamento errore={elenco.errore} /> : (
        <section className="scheda">
          <h2>Account ({elenco.dati.length})</h2>
          {senzaAccount.length > 0 && (
            <p className="avviso avviso-arancio"><Icona nome="warning" /><span>Uffici senza account: <strong>{senzaAccount.map((u) => u.nome).join(', ')}</strong></span></p>
          )}
          <div className="tabella-scorrevole">
            <table className="tabella tabella-admin" style={{ minWidth: 1040 }}>
              <thead><tr><th>Nome utente</th><th>Nome</th><th>Ruolo</th><th>{AREE_ATTIVE ? 'Ufficio / Area' : 'Ufficio'}</th><th>Email promemoria</th><th>Stato</th><th>Azioni</th></tr></thead>
              <tbody>
                {elenco.dati.map((u) => modifica === u.email ? (
                  <RigaModificaAccount key={u.email} u={u} ctx={ctx} ruoli={ruoliModifica} onAnnulla={() => setModifica(null)}
                    onSalva={(campi) => aggiorna(u, campi, `Account "${u.nome_utente}" aggiornato.`)} />
                ) : (
                  <tr key={u.email} className={u.attivo ? '' : 'disattivo'}>
                    <th scope="row" className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{u.nome_utente}</th>
                    <td>{u.nome ?? '—'}</td>
                    <td style={{ fontSize: 13 }}>{NOMI_RUOLO[u.ruolo]}</td>
                    <td>{descrizione(u)}</td>
                    <td style={{ fontSize: 13 }} className={u.email_promemoria ? 'piccolo' : 'email-mancante'}>{u.email_promemoria ?? 'nessuna'}</td>
                    <td><span className={`tag ${u.attivo ? 'tag-accento' : 'tag-neutro'}`}>{u.attivo ? 'Attivo' : 'Disattivato'}</span></td>
                    <td>
                      {gestibile(u) ? <div className="azioni">
                        <button className="btn btn-fantasma" onClick={() => setModifica(u.email)}>Modifica</button>
                        <button className="btn btn-fantasma" onClick={() => nuovaPassword(u)}>Nuova password</button>
                        <button className="btn btn-fantasma" onClick={() => aggiorna(u, { attivo: !u.attivo }, `Account "${u.nome_utente}" ${u.attivo ? 'disattivato' : 'riattivato'}.`)}>{u.attivo ? 'Disattiva' : 'Riattiva'}</button>
                        <button className="btn btn-fantasma btn-pericolo" onClick={() => elimina(u)}>Elimina</button>
                      </div> : <span className="piccolo">{u.email === ctx.utente.email ? 'sei tu' : 'solo admin generale'}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="piccolo">"Disattiva" blocca subito l'accesso senza cancellare nulla. Il nome utente non si può cambiare: in caso, crea un nuovo account ed elimina il vecchio.</p>
        </section>
      )}

      {generale && (affiliati.caricamento || affiliati.errore || !affiliati.dati ? <Caricamento errore={affiliati.errore} /> : (
        <section className="scheda">
          <h2>Affiliati ({affiliati.dati.length})</h2>
          <p className="piccolo">Consultano in sola lettura gli uffici assegnati, di Roma e di Milano: Cruscotto, Andamento uffici e Report mensile (senza gara a punti). Non ricevono promemoria.</p>
          {affiliati.dati.length === 0 ? <p className="piccolo">Nessun affiliato: per crearne uno scegli il ruolo "{NOMI_RUOLO.affiliato}" qui sopra.</p> : (
            <div className="tabella-scorrevole">
              <table className="tabella tabella-admin" style={{ minWidth: 900 }}>
                <thead><tr><th>Nome utente</th><th>Nome</th><th>Uffici</th><th>Stato</th><th>Azioni</th></tr></thead>
                <tbody>
                  {affiliati.dati.map((a) => modifica === a.email ? (
                    <RigaModificaAffiliato key={a.email} a={a} ctx={ctx} onAnnulla={() => setModifica(null)}
                      onSalva={(nome, uffici) => aggiornaAffiliato(a, nome, uffici)} />
                  ) : (
                    <tr key={a.email} className={a.attivo ? '' : 'disattivo'}>
                      <th scope="row" className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{a.nome_utente}</th>
                      <td>{a.nome ?? '—'}</td>
                      <td className="uffici-affiliato">{descriviUffici(ctx, a.uffici)}</td>
                      <td><span className={`tag ${a.attivo ? 'tag-accento' : 'tag-neutro'}`}>{a.attivo ? 'Attivo' : 'Disattivato'}</span></td>
                      <td>
                        <div className="azioni">
                          <button className="btn btn-fantasma" onClick={() => setModifica(a.email)}>Modifica</button>
                          <button className="btn btn-fantasma" onClick={() => nuovaPassword(a)}>Nuova password</button>
                          <button className="btn btn-fantasma" onClick={() => aggiorna(a, { attivo: !a.attivo }, `Account "${a.nome_utente}" ${a.attivo ? 'disattivato' : 'riattivato'}.`)}>{a.attivo ? 'Disattiva' : 'Riattiva'}</button>
                          <button className="btn btn-fantasma btn-pericolo" onClick={() => elimina(a)}>Elimina</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
      {dialogo}
      {toast}
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
      <th scope="row" className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{u.nome_utente}</th>
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
      <td colSpan={2}><div className="azioni" style={{ gap: 6 }}>
        <button className="btn btn-primario" onClick={() => onSalva({
          nome: campi.nome || null, ruolo: campi.ruolo,
          ufficio_id: campi.ufficio_id ? Number(campi.ufficio_id) : null,
          area_id: campi.ruolo === 'responsabile' && campi.area_id ? Number(campi.area_id) : null,
          email_promemoria: campi.email_promemoria || null,
        })}>Salva</button>
        <button className="btn btn-fantasma" onClick={onAnnulla}>Annulla</button>
      </div></td>
    </tr>
  )
}

/** Sostituisce gli uffici che l'affiliato può consultare */
async function salvaUfficiAffiliato(nomeUtente: string, uffici: number[]) {
  const { error: e1 } = await supabase.from('uffici_affiliato').delete().eq('nome_utente', nomeUtente)
  if (e1) throw new Error(e1.message)
  if (uffici.length === 0) return
  const { error: e2 } = await supabase.from('uffici_affiliato').insert(uffici.map((ufficio_id) => ({ nome_utente: nomeUtente, ufficio_id })))
  if (e2) throw new Error(e2.message)
}

/** "Somalia, Trieste (Roma) · Brera (Milano)" */
function descriviUffici(ctx: Contesto, ids: number[]): string {
  if (ids.length === 0) return 'nessuno'
  return ctx.citta.map((c) => {
    const nomi = ctx.uffici.filter((u) => u.citta_id === c.id && ids.includes(u.id)).map((u) => u.nome).sort((a, b) => a.localeCompare(b, 'it'))
    return nomi.length ? `${nomi.join(', ')} (${c.nome})` : ''
  }).filter(Boolean).join(' · ')
}

/** Caselle con gli uffici attivi, divisi per città */
function SceltaUffici({ uffici, citta, scelti, onCambia }: {
  uffici: Ufficio[]; citta: { id: number; nome: string }[]; scelti: number[]; onCambia: (scelti: number[]) => void
}) {
  const cambia = (id: number, si: boolean) => onCambia(si ? [...scelti, id] : scelti.filter((x) => x !== id))
  return (
    <div className="scelta-uffici">
      {citta.map((c) => {
        const lista = uffici.filter((u) => u.attivo && u.citta_id === c.id).sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
        if (lista.length === 0) return null
        return (
          <fieldset key={c.id}>
            <legend>{c.nome}</legend>
            <div className="scelta-uffici-griglia">
              {lista.map((u) => (
                <label key={u.id} className="casella-spunta">
                  <input type="checkbox" checked={scelti.includes(u.id)} onChange={(e) => cambia(u.id, e.target.checked)} />{u.nome}
                </label>
              ))}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}

function RigaModificaAffiliato({ a, ctx, onAnnulla, onSalva }: {
  a: Affiliato; ctx: Contesto; onAnnulla: () => void; onSalva: (nome: string, uffici: number[]) => void
}) {
  const [nome, setNome] = useState(a.nome ?? '')
  const [uffici, setUffici] = useState(a.uffici)
  return (
    <tr className="riga-modifica">
      <th scope="row" className="mono" style={{ fontSize: 14, fontWeight: 600, verticalAlign: 'top' }}>{a.nome_utente}</th>
      <td style={{ verticalAlign: 'top' }}><input value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome" /></td>
      <td colSpan={2}><SceltaUffici uffici={ctx.uffici} citta={ctx.citta} scelti={uffici} onCambia={setUffici} /></td>
      <td style={{ verticalAlign: 'top' }}><div className="azioni" style={{ gap: 6 }}>
        <button className="btn btn-primario" disabled={uffici.length === 0} title={uffici.length === 0 ? 'Scegli almeno un ufficio' : undefined}
          onClick={() => onSalva(nome, uffici)}>Salva</button>
        <button className="btn btn-fantasma" onClick={onAnnulla}>Annulla</button>
      </div></td>
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
  const [toast, mostraToast] = useToast()

  async function esegui(promessa: PromiseLike<{ error: { message: string } | null }>, testo: string) {
    const { error } = await promessa
    if (error) return setEsito({ tipo: 'errore', testo: /duplicate key/.test(error.message) ? 'Esiste già un ufficio con questo nome.' : error.message })
    setEsito({ tipo: 'ok', testo })
    mostraToast(testo)
    ctx.ricaricaBase()
  }

  return (
    <>
      <MessaggioEsito esito={esito} onChiudi={() => setEsito(null)} />
      <form className="modulo" style={{ gap: 18 }} onSubmit={(e) => {
        e.preventDefault()
        esegui(supabase.from('uffici').insert({ nome: nome.trim(), citta_id: ctx.cittaId, area_id: area ? Number(area) : null }), `Ufficio "${nome.trim()}" aggiunto. Ora crea il suo account nella scheda Account.`)
        setNome('')
      }}>
        <h2 style={{ fontSize: 22 }}>Nuovo ufficio</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="campo" style={{ width: 'min(100%, 320px)' }}><span className="etichetta">Nome</span><input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Somalia" /></label>
          {AREE_ATTIVE && (
            <label className="campo"><span className="etichetta">Area</span>
              <select value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">Nessuna area</option>
                {aree.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </label>
          )}
          <button type="submit" className="btn btn-primario" style={{ minHeight: 44 }}><Icona nome="plus" />Aggiungi ufficio</button>
        </div>
      </form>
      <section className="scheda">
        <h2>Uffici ({uffici.filter((u) => u.attivo).length} attivi)</h2>
        <div className="tabella-scorrevole">
          <table className="tabella tabella-admin" style={{ maxWidth: 900 }}>
            <thead><tr><th>Nome</th>{AREE_ATTIVE && <th>Area</th>}{MENSILE_ATTIVO && <th>Report mensile</th>}<th>Stato</th><th>Azioni</th></tr></thead>
            <tbody>
              {uffici.map((u) => (
                <tr key={u.id} className={u.attivo ? '' : 'disattivo'}>
                  <th scope="row">
                    <input className="input-nascosto" defaultValue={u.nome} aria-label="Nome ufficio" onBlur={(e) => {
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
                  {MENSILE_ATTIVO && (
                    <td>
                      <div className="posizione-report">
                        <select value={u.blocco_mensile ?? 1} aria-label="Tabella del report mensile" onChange={(e) =>
                          esegui(supabase.from('uffici').update({ blocco_mensile: Number(e.target.value) }).eq('id', u.id), `"${u.nome}" spostato nella ${e.target.value === '1' ? 'prima' : 'seconda'} tabella del report mensile.`)}>
                          <option value={1}>1ª tabella</option>
                          <option value={2}>2ª tabella</option>
                        </select>
                        <input inputMode="numeric" defaultValue={u.ordine_mensile ?? ''} key={`${u.id}-${u.ordine_mensile}`} placeholder="n." aria-label="Posizione nel report mensile" onBlur={(e) => {
                          const testo = e.target.value.trim()
                          const v = testo === '' ? null : Number(testo)
                          if (v !== null && !(Number.isInteger(v) && v > 0)) { setEsito({ tipo: 'errore', testo: 'La posizione deve essere un numero intero da 1 in su.' }); return }
                          if (v !== (u.ordine_mensile ?? null)) esegui(supabase.from('uffici').update({ ordine_mensile: v }).eq('id', u.id), `Posizione di "${u.nome}" nel report mensile aggiornata.`)
                        }} />
                      </div>
                    </td>
                  )}
                  <td><span className={`tag ${u.attivo ? 'tag-accento' : 'tag-neutro'}`}>{u.attivo ? 'Attivo' : 'Disattivato'}</span></td>
                  <td>
                    <button className="btn btn-fantasma" onClick={() => esegui(supabase.from('uffici').update({ attivo: !u.attivo }).eq('id', u.id), `Ufficio "${u.nome}" ${u.attivo ? 'disattivato' : 'riattivato'}.`)}>
                      {u.attivo ? 'Disattiva' : 'Riattiva'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {MENSILE_ATTIVO && <p className="piccolo" style={{ maxWidth: 760 }}>Report mensile: in quale tabella compare l'ufficio e in che posizione (1 = primo). La numerazione è unica per Roma e Milano, come nel file di gruppo. Gli uffici senza posizione vanno in fondo alla loro tabella.</p>}
        <p className="piccolo" style={{ maxWidth: 760 }}>Il nome si modifica direttamente nella casella. Gli uffici non si eliminano, per non perdere lo storico: un ufficio disattivato sparisce da cruscotto, riunione e promemoria.</p>
      </section>
      {toast}
    </>
  )
}

// ---------------------------------------------------------------- AREE

function SezioneAree({ ctx }: { ctx: Contesto }) {
  const aree = ctx.aree.filter((a) => a.citta_id === ctx.cittaId)
  const [nome, setNome] = useState('')
  const [esito, setEsito] = useState<Esito>(null)
  const [dialogo, chiedi] = useConferma()

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
      <form className="modulo" onSubmit={(e) => {
        e.preventDefault()
        esegui(supabase.from('aree').insert({ nome: nome.trim(), citta_id: ctx.cittaId }), `Area "${nome.trim()}" aggiunta.`)
        setNome('')
      }}>
        <h2 style={{ fontSize: 22 }}>Nuova area</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="campo" style={{ width: 'min(100%, 320px)' }}><span className="etichetta">Nome</span><input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Roma Nord" /></label>
          <button type="submit" className="btn btn-primario" style={{ minHeight: 44 }}><Icona nome="plus" />Aggiungi area</button>
        </div>
      </form>
      <section className="scheda">
        <h2>Aree ({aree.length})</h2>
        {aree.length === 0 ? <p className="piccolo">Nessuna area: gli uffici vengono mostrati tutti insieme.</p> : (
          <table className="tabella tabella-admin" style={{ maxWidth: 760 }}>
            <thead><tr><th>Nome</th><th>Uffici</th><th>Azioni</th></tr></thead>
            <tbody>
              {aree.map((a) => (
                <tr key={a.id}>
                  <th scope="row">
                    <input className="input-nascosto" defaultValue={a.nome} aria-label="Nome area" onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== a.nome) esegui(supabase.from('aree').update({ nome: v }).eq('id', a.id), `Area rinominata in "${v}".`)
                    }} />
                  </th>
                  <td className="destra">{ctx.uffici.filter((u) => u.area_id === a.id && u.attivo).length}</td>
                  <td>
                    <button className="btn btn-fantasma btn-pericolo" onClick={async () => {
                      if (await chiedi({ titolo: 'Elimina area', testo: `Eliminare l'area "${a.nome}"?`, conferma: 'Elimina', pericolo: true })) esegui(supabase.from('aree').delete().eq('id', a.id), `Area "${a.nome}" eliminata.`)
                    }}>Elimina</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {dialogo}
    </>
  )
}

// ---------------------------------------------------------------- BACKUP (solo amministratore generale)

function SezioneBackup({ ctx }: { ctx: Contesto }) {
  const [stato, setStato] = useState<'pronto' | 'raccolta' | 'file'>('pronto')
  const [esito, setEsito] = useState<Esito>(null)
  const [toast, mostraToast] = useToast()

  async function scarica() {
    setEsito(null)
    try {
      setStato('raccolta')
      const [dati, mensile, { creaBackup, nomeFileBackup }] = await Promise.all([
        caricaTuttoPerBackup(), MENSILE_ATTIVO ? caricaMensilePerBackup() : Promise.resolve(null), import('../lib/backup')])
      setStato('file')
      const adesso = new Date()
      const wb = creaBackup({ ...dati, mensile, citta: ctx.citta, uffici: ctx.uffici, generatoDa: ctx.utente.nome || ctx.utente.nome_utente, adesso })
      const contenuto = await wb.xlsx.writeBuffer()
      const url = URL.createObjectURL(new Blob([contenuto], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a')
      a.href = url
      a.download = nomeFileBackup(adesso)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      const testo = `Backup scaricato: ${ctx.uffici.length} uffici, ${dati.rilevazioni.length.toLocaleString('it-IT')} valori, ${dati.note.length} note.`
      setEsito({ tipo: 'ok', testo })
      mostraToast('Backup scaricato.')
    } catch (e) {
      setEsito({ tipo: 'errore', testo: `Backup non riuscito: ${(e as Error).message}` })
    } finally {
      setStato('pronto')
    }
  }

  return (
    <>
      <MessaggioEsito esito={esito} onChiudi={() => setEsito(null)} />
      <section className="scheda" style={{ maxWidth: 860, gap: 18 }}>
        <h2 className="titolo-icona"><span className="icona-quadrata icona-blu"><Icona nome="file-xls" /></span>Backup in Excel</h2>
        <p>Scarica sul computer un file Excel con <strong>tutti i dati della piattaforma</strong>, di Roma e di Milano.</p>
        <ul className="elenco-icone" style={{ fontSize: 15 }}>
          <li><Icona nome="storefront" />un foglio per ogni ufficio, impostato come i vecchi rapportini: mesi uno sotto l'altro, 5 settimane con obiettivo, risultato ed esito, totale del mese, dati di zona, quota di mercato e note;</li>
          <li><Icona nome="table" />il foglio "Dati" con tutti i valori, uno per riga, da filtrare e ordinare;</li>
          <li><Icona nome="note" />i fogli "Note", "Uffici" e "Account" (senza password).</li>
          {MENSILE_ATTIVO && <li><Icona nome="calendar-check" />i fogli "Mensile" (i numeri dei rapportini mensili, persona per persona) e "Personale".</li>}
        </ul>
        <p className="piccolo">Il file si crea nel browser e va nella cartella Download. Conviene scaricarlo una volta al mese e conservarlo in un posto sicuro: contiene i dati di tutti gli uffici.</p>
        <div>
          <button className="btn btn-primario btn-grande" onClick={scarica} disabled={stato !== 'pronto'}>
            <Icona nome={stato === 'pronto' ? 'download-simple' : 'circle-notch'} className={stato === 'pronto' ? '' : 'gira'} />
            {stato === 'raccolta' ? 'Raccolta dei dati…' : stato === 'file' ? 'Preparazione del file…' : 'Scarica il backup (.xlsx)'}
          </button>
        </div>
      </section>
      {toast}
    </>
  )
}
