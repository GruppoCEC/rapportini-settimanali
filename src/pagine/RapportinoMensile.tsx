// Pagina "Rapportino mensile": l'ufficio scrive i numeri del mese di ogni persona
// (come nel file Excel "Rapportino vuoto NUOVO") e tiene aggiornato il proprio personale.
// Totale dell'ufficio e staff si calcolano da soli.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { nomeDaEmail } from '../lib/account'
import { leggiNumero } from '../lib/calcoli'
import { caricaPersone, caricaValoriMensili, caricaVociMensili } from '../lib/dati'
import {
  dataItaliana, inServizio, mesePredefinito, ordinaPersone, righeDelMese, titoloMese, totaleUfficio, ORDINE_RUOLI,
} from '../lib/mensile'
import { NOMI_RUOLO_PERSONA, type Persona, type RuoloPersona, type Ufficio, type ValoreMensile, type VoceMensile } from '../lib/tipi'
import { oggiISO } from '../lib/settimane'
import { useDati } from '../lib/useDati'
import { Caricamento } from '../componenti/Celle'
import { Icona, useConferma, useToast } from '../componenti/Interfaccia'
import SceltaMese from '../componenti/SceltaMese'
import { AvvisoUscite, classeMovimento, EtichettaMovimento, TabellaRapportino } from '../componenti/TabellaMensile'

interface Props {
  uffici: Ufficio[]                     // uffici che l'utente può compilare (di solito uno solo)
  ufficioPredefinito?: number | null
}

/** Caselle scritte, come testo: chiave "persona|voce" */
type Caselle = Record<string, string>
const chiave = (personaId: number, voce: string) => `${personaId}|${voce}`
const num = (s: string) => { const v = leggiNumero(s); return typeof v === 'number' ? v : null }

export default function RapportinoMensile({ uffici, ufficioPredefinito }: Props) {
  const voci = useDati(caricaVociMensili, [])
  if (!voci.dati) return <div className="pagina"><Caricamento errore={voci.errore} /></div>
  return <Compilazione uffici={uffici} ufficioPredefinito={ufficioPredefinito} voci={voci.dati} />
}

function Compilazione({ uffici, ufficioPredefinito, voci }: Props & { voci: VoceMensile[] }) {
  const [ufficioId, setUfficioId] = useState(uffici.find((u) => u.id === ufficioPredefinito)?.id ?? uffici[0].id)
  const [mese, setMese] = useState(mesePredefinito())
  const [persone, setPersone] = useState<Persona[]>([])
  const [caselle, setCaselle] = useState<Caselle>({})
  const [originali, setOriginali] = useState<Caselle>({})
  const [ultimoSalvataggio, setUltimoSalvataggio] = useState<{ quando: string; chi: string | null } | null>(null)
  const [stato, setStato] = useState<'caricamento' | 'pronto' | 'salvataggio'>('caricamento')
  const [messaggio, setMessaggio] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null)
  const [versione, setVersione] = useState(0)
  const [dialogo, chiedi] = useConferma()
  const [toast, mostraToast] = useToast()

  const cambiate = useMemo(() => {
    const chiavi = new Set([...Object.keys(caselle), ...Object.keys(originali)])
    return [...chiavi].filter((k) => (caselle[k] ?? '') !== (originali[k] ?? ''))
  }, [caselle, originali])
  const modificato = cambiate.length > 0

  // Avvisa se si chiude la pagina con modifiche non salvate
  useEffect(() => {
    if (!modificato) return
    const avvisa = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', avvisa)
    return () => window.removeEventListener('beforeunload', avvisa)
  }, [modificato])

  // Caricamento di personale e numeri del mese scelto
  useEffect(() => {
    let annullato = false
    setStato('caricamento')
    Promise.all([caricaPersone([ufficioId]), caricaValoriMensili(mese, [ufficioId])])
      .then(([p, valori]) => {
        if (annullato) return
        const salvate: Caselle = {}
        for (const v of valori) if (v.valore !== null) salvate[chiave(v.persona_id, v.voce)] = String(v.valore)
        const recente = valori.filter((v) => v.aggiornato_il).sort((a, b) => b.aggiornato_il!.localeCompare(a.aggiornato_il!))[0]
        setUltimoSalvataggio(recente ? { quando: recente.aggiornato_il!, chi: recente.aggiornato_da ?? null } : null)
        setPersone(p)
        setOriginali(salvate)
        setCaselle(salvate)
        setStato('pronto')
      })
      .catch((e: Error) => {
        if (annullato) return
        setMessaggio({ tipo: 'errore', testo: `Impossibile caricare i dati: ${e.message}` })
        setStato('pronto')
      })
    return () => { annullato = true }
  }, [ufficioId, mese, versione])

  const ricaricaPersone = async () => setPersone(await caricaPersone([ufficioId]))

  // Valori come sono adesso nelle caselle (per totale e righe, mentre si scrive)
  const valoriAttuali: ValoreMensile[] = useMemo(() => Object.entries(caselle).map(([k, testo]) => {
    const [pid, voce] = k.split('|')
    return { persona_id: Number(pid), ufficio_id: ufficioId, mese, voce, valore: num(testo) }
  }), [caselle, ufficioId, mese])
  const righe = righeDelMese(persone, mese)
  const totale = totaleUfficio(persone, valoriAttuali, mese, voci)
  const errate = new Set(Object.entries(caselle).filter(([, t]) => leggiNumero(t) === 'errore').map(([k]) => k))

  async function conPermesso(azione: () => void) {
    if (modificato && !await chiedi({ titolo: 'Modifiche non salvate', testo: 'Hai modifiche non salvate. Vuoi abbandonarle?', conferma: 'Abbandona', pericolo: true })) return
    setMessaggio(null)
    azione()
  }

  async function salva() {
    if (errate.size > 0) {
      setMessaggio({ tipo: 'errore', testo: 'Alcune caselle contengono valori non validi (solo numeri interi, senza segni o virgole).' })
      return
    }
    setStato('salvataggio')
    const righeDaSalvare = cambiate.map((k) => {
      const [pid, voce] = k.split('|')
      return { persona_id: Number(pid), ufficio_id: ufficioId, mese, voce, valore: num(caselle[k] ?? '') }
    })
    const { error } = await supabase.from('valori_mensili').upsert(righeDaSalvare, { onConflict: 'persona_id,mese,voce' })
    if (error) {
      setStato('pronto')
      setMessaggio({ tipo: 'errore', testo: `Salvataggio non riuscito: ${error.message}. I dati sono ancora nelle caselle: riprova.` })
      return
    }
    const testoOk = `Dati salvati alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}.`
    setMessaggio({ tipo: 'ok', testo: testoOk })
    mostraToast(testoOk)
    setVersione((v) => v + 1)
  }

  const ufficio = uffici.find((u) => u.id === ufficioId)!
  const disattivo = stato !== 'pronto'

  return (
    <div className="pagina entra">
      <div className="intestazione">
        <div className="intestazione-titoli">
          <span className="kicker">Rapportino mensile</span>
          {uffici.length > 1 ? (
            <select className="select-titolo" aria-label="Ufficio" value={ufficioId}
              onChange={(e) => { const v = Number(e.target.value); conPermesso(() => setUfficioId(v)) }}>
              {uffici.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          ) : (
            <h1 className="titolo-pagina">{ufficio.nome}</h1>
          )}
          {ultimoSalvataggio && (
            <span className="piccolo">
              Ultimo salvataggio: {new Date(ultimoSalvataggio.quando).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
              {ultimoSalvataggio.chi ? ` da ${nomeDaEmail(ultimoSalvataggio.chi)}` : ''}
            </span>
          )}
        </div>
        <SceltaMese mese={mese} onCambia={(m) => conPermesso(() => setMese(m))} />
      </div>

      <section className="scheda entra entra-1">
        <h2 className="titolo-icona"><span className="icona-quadrata icona-blu"><Icona nome="calendar-check" /></span>Numeri di {titoloMese(mese).toLowerCase()}</h2>
        <p className="piccolo">
          Una riga per persona. Se una persona in un'attività non ha fatto nulla scrivi <strong>0</strong>: la casella vuota vuol dire "non ancora inserito".
          Con <kbd>Invio</kbd> passi alla casella sotto. Il totale e lo staff si calcolano da soli.
        </p>
        {stato !== 'caricamento' && righe.length === 0 && (
          <p className="avviso avviso-arancio compare"><Icona nome="users-three" />
            <span>Nessuna persona in servizio a {titoloMese(mese).toLowerCase()}. Aggiungi il personale dell'ufficio nel riquadro <strong>Personale dell'ufficio</strong> qui sotto: lo fai una volta sola, poi vale per tutti i mesi.</span>
          </p>
        )}
        <AvvisoUscite persone={persone.map((p) => ({ p }))} mese={mese} />
        <TabellaRapportino voci={voci} mese={mese} righe={righe} totale={totale} modificabile disattivo={disattivo} errate={errate}
          testo={(pid, voce) => caselle[chiave(pid, voce)] ?? ''}
          onCambia={(pid, voce, valore) => { setCaselle((c) => ({ ...c, [chiave(pid, voce)]: valore })); setMessaggio(null) }} />
      </section>

      <Personale persone={persone} ufficioId={ufficioId} mese={mese} onCambiato={ricaricaPersone} chiedi={chiedi} mostraToast={mostraToast} />

      <div className="barra-salvataggio">
        {messaggio && (
          <span className={`messaggio-stato ${messaggio.tipo}`} role="status">
            <Icona nome={messaggio.tipo === 'ok' ? 'check-circle' : 'warning-circle'} />{messaggio.testo}
          </span>
        )}
        {!messaggio && modificato && stato === 'pronto' && <span className="non-salvato"><span className="pallino" />Modifiche non salvate</span>}
        <button className="btn btn-primario" onClick={salva} disabled={stato !== 'pronto' || !modificato}>
          <Icona nome={stato === 'salvataggio' ? 'circle-notch' : 'floppy-disk'} className={stato === 'salvataggio' ? 'gira' : ''} />
          {stato === 'salvataggio' ? 'Salvataggio…' : stato === 'caricamento' ? 'Caricamento…' : 'Salva'}
        </button>
      </div>
      {dialogo}
      {toast}
    </div>
  )
}

// ---------------------------------------------------------------- Personale dell'ufficio

interface PropsPersonale {
  persone: Persona[]
  ufficioId: number
  mese: string
  onCambiato: () => Promise<void>
  chiedi: ReturnType<typeof useConferma>[1]
  mostraToast: (testo: string) => void
}

type Bozza = { nome: string; ruolo: RuoloPersona; data_inizio: string; data_fine: string }

function messaggioErrore(m: string): string {
  if (/check constraint|violates check/i.test(m)) return 'Controlla i dati: il nome non può essere vuoto e la data di fine non può essere prima di quella di inizio.'
  return m
}

function Personale({ persone, ufficioId, mese, onCambiato, chiedi, mostraToast }: PropsPersonale) {
  const vuota: Bozza = { nome: '', ruolo: 'collaboratore', data_inizio: '', data_fine: '' }
  const [nuova, setNuova] = useState<Bozza>(vuota)
  const [inModifica, setInModifica] = useState<{ id: number; bozza: Bozza } | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [occupato, setOccupato] = useState(false)

  const oggi = oggiISO()
  const ordinate = [...persone].sort((a, b) =>
    Number(!b.data_fine || b.data_fine >= oggi) - Number(!a.data_fine || a.data_fine >= oggi) || ordinaPersone(a, b))

  async function esegui(promessa: PromiseLike<{ error: { message: string } | null }>, testo: string) {
    setOccupato(true)
    setErrore(null)
    const { error } = await promessa
    setOccupato(false)
    if (error) { setErrore(messaggioErrore(error.message)); return false }
    mostraToast(testo)
    await onCambiato()
    return true
  }

  async function aggiungi(e: React.FormEvent) {
    e.preventDefault()
    const ok = await esegui(supabase.from('persone').insert({ ufficio_id: ufficioId, nome: nuova.nome.trim(), ruolo: nuova.ruolo, data_inizio: nuova.data_inizio }),
      `Nuova persona nel personale: ${nuova.nome.trim()}.`)
    if (ok) setNuova(vuota)
  }

  async function salvaModifica() {
    if (!inModifica) return
    const b = inModifica.bozza
    const ok = await esegui(supabase.from('persone').update({ nome: b.nome.trim(), ruolo: b.ruolo, data_inizio: b.data_inizio, data_fine: b.data_fine || null }).eq('id', inModifica.id),
      `Scheda di ${b.nome.trim()} aggiornata.`)
    if (ok) setInModifica(null)
  }

  async function elimina(p: Persona) {
    const si = await chiedi({
      titolo: `Eliminare la scheda di ${p.nome}?`,
      testo: 'Usalo solo per correggere un inserimento sbagliato: si cancellano anche tutti i suoi numeri, di tutti i mesi. Se la persona ha lasciato l\'ufficio usa invece "Ha lasciato".',
      conferma: 'Elimina', pericolo: true,
    })
    if (si) await esegui(supabase.from('persone').delete().eq('id', p.id), `Scheda di ${p.nome} eliminata.`)
  }

  const modifica = (p: Persona, dataFine?: string) =>
    setInModifica({ id: p.id, bozza: { nome: p.nome, ruolo: p.ruolo, data_inizio: p.data_inizio, data_fine: dataFine ?? p.data_fine ?? '' } })
  const campoBozza = (campo: keyof Bozza, valore: string) =>
    setInModifica((m) => m && { ...m, bozza: { ...m.bozza, [campo]: valore } })

  return (
    <section className="scheda entra entra-2">
      <h2 className="titolo-icona"><span className="icona-quadrata icona-arancio"><Icona nome="users-three" /></span>Personale dell'ufficio</h2>
      <p className="piccolo">
        Il personale si inserisce una volta sola e vale per tutti i mesi, a partire dalla data di inizio.
        Quando qualcuno lascia l'ufficio premi <strong>Ha lasciato</strong> e indica l'ultimo giorno: non conta già dal mese in cui esce (niente riga nel rapportino, totali, staff né gara), ma i suoi numeri dei mesi precedenti restano.
      </p>
      {errore && <p className="errore-box" role="alert"><Icona nome="warning-circle" />{errore}</p>}

      <form className="riga-modulo" onSubmit={aggiungi}>
        <label className="campo campo-nome"><span className="etichetta">Nome e cognome</span>
          <input required maxLength={80} value={nuova.nome} onChange={(e) => setNuova({ ...nuova, nome: e.target.value })} placeholder="es. Mario Rossi" /></label>
        <label className="campo"><span className="etichetta">Ruolo</span>
          <select value={nuova.ruolo} onChange={(e) => setNuova({ ...nuova, ruolo: e.target.value as RuoloPersona })}>
            {ORDINE_RUOLI.map((r) => <option key={r} value={r}>{NOMI_RUOLO_PERSONA[r]}</option>)}
          </select></label>
        <label className="campo"><span className="etichetta">Data di inizio</span>
          <input required type="date" value={nuova.data_inizio} onChange={(e) => setNuova({ ...nuova, data_inizio: e.target.value })} /></label>
        <button type="submit" className="btn btn-primario" disabled={occupato}><Icona nome="user-plus" />Aggiungi</button>
      </form>

      {ordinate.length > 0 && (
        <div className="tabella-scorrevole">
          <table className="tabella tabella-admin">
            <thead><tr><th>Nome</th><th>Ruolo</th><th>Inizio</th><th>Fine</th><th>Stato</th><th>Azioni</th></tr></thead>
            <tbody>
              {ordinate.map((p) => {
                const servizio = inServizio(p, mese)
                if (inModifica?.id === p.id) {
                  const b = inModifica.bozza
                  return (
                    <tr key={p.id}>
                      <th scope="row"><input value={b.nome} maxLength={80} aria-label="Nome" onChange={(e) => campoBozza('nome', e.target.value)} /></th>
                      <td><select value={b.ruolo} aria-label="Ruolo" onChange={(e) => campoBozza('ruolo', e.target.value)}>
                        {ORDINE_RUOLI.map((r) => <option key={r} value={r}>{NOMI_RUOLO_PERSONA[r]}</option>)}
                      </select></td>
                      <td><input type="date" value={b.data_inizio} aria-label="Data di inizio" onChange={(e) => campoBozza('data_inizio', e.target.value)} /></td>
                      <td><input type="date" value={b.data_fine} aria-label="Data di fine" onChange={(e) => campoBozza('data_fine', e.target.value)} /></td>
                      <td />
                      <td className="azioni">
                        <button className="btn btn-primario" disabled={occupato || !b.nome.trim() || !b.data_inizio} onClick={salvaModifica}>Salva</button>
                        <button className="btn btn-fantasma" onClick={() => setInModifica(null)}>Annulla</button>
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr key={p.id} className={classeMovimento(p, mese) || (p.data_fine && p.data_fine < oggi ? 'disattivo' : '')}>
                    <th scope="row">{p.nome}</th>
                    <td>{NOMI_RUOLO_PERSONA[p.ruolo]}</td>
                    <td>{dataItaliana(p.data_inizio)}</td>
                    <td>{dataItaliana(p.data_fine)}</td>
                    <td>
                      <EtichettaMovimento persona={p} mese={mese} />
                      {!classeMovimento(p, mese) && (
                        <span className={`tag ${servizio ? 'tag-accento' : 'tag-neutro'}`}>
                          {servizio ? `In servizio a ${titoloMese(mese).split(' ')[0].toLowerCase()}` : p.data_inizio > mese ? 'Non ancora iniziato' : 'Non più in ufficio'}
                        </span>
                      )}
                    </td>
                    <td className="azioni">
                      <button className="btn btn-fantasma" onClick={() => modifica(p)}>Modifica</button>
                      {!p.data_fine && <button className="btn btn-fantasma" onClick={() => modifica(p, oggi)}>Ha lasciato</button>}
                      <button className="btn btn-fantasma btn-pericolo" onClick={() => elimina(p)}>Elimina</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
