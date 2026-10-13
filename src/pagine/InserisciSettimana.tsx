// Pagina "Inserisci settimana": l'ufficio scrive obiettivi e risultati della
// settimana e i dati di zona. Esito e quota di mercato si calcolano da soli.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { nomeDaEmail } from '../lib/account'
import { esito, formattaEsito, formattaPercentuale, leggiNumero, OBIETTIVO_QUOTA, quotaMercato } from '../lib/calcoli'
import { intervalloSettimana, settimanaPredefinita } from '../lib/settimane'
import type { Metrica, Rilevazione, Ufficio } from '../lib/tipi'
import SceltaSettimana from '../componenti/SceltaSettimana'

interface Props {
  uffici: Ufficio[]      // uffici che l'utente può compilare (di solito uno solo)
  metriche: Metrica[]
}

/** Quanto scritto nelle caselle (come testo, per poter mostrare anche gli errori) */
type Caselle = Record<string, { obiettivo: string; risultato: string }>

const testo = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))
const num = (s: string) => { const v = leggiNumero(s); return typeof v === 'number' ? v : null }

function caselleVuote(metriche: Metrica[]): Caselle {
  return Object.fromEntries(metriche.map((m) => [m.codice, { obiettivo: '', risultato: '' }]))
}

export default function InserisciSettimana({ uffici, metriche }: Props) {
  const [ufficioId, setUfficioId] = useState(uffici[0].id)
  const [settimana, setSettimana] = useState(settimanaPredefinita())
  const [caselle, setCaselle] = useState<Caselle>(() => caselleVuote(metriche))
  const [originali, setOriginali] = useState<Caselle>(() => caselleVuote(metriche))
  const [nota, setNota] = useState('')
  const [notaOriginale, setNotaOriginale] = useState('')
  const [proposteDa, setProposteDa] = useState<string | null>(null)   // settimana da cui sono copiati i dati di zona
  const [obiettiviDa, setObiettiviDa] = useState<string | null>(null)  // settimana da cui sono copiati gli obiettivi
  const [ultimoSalvataggio, setUltimoSalvataggio] = useState<{ quando: string; chi: string | null } | null>(null)
  const [stato, setStato] = useState<'caricamento' | 'pronto' | 'salvataggio'>('caricamento')
  const [messaggio, setMessaggio] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null)
  const [versione, setVersione] = useState(0)   // aumenta dopo ogni salvataggio per ricaricare

  const attivita = metriche.filter((m) => m.tipo === 'attivita')
  const zona = metriche.filter((m) => m.tipo === 'zona')

  const modificato = useMemo(
    () => nota !== notaOriginale || metriche.some((m) =>
      caselle[m.codice].obiettivo !== originali[m.codice].obiettivo ||
      caselle[m.codice].risultato !== originali[m.codice].risultato),
    [caselle, originali, nota, notaOriginale, metriche],
  )

  // Avvisa se si chiude la pagina con modifiche non salvate
  useEffect(() => {
    if (!modificato) return
    const avvisa = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', avvisa)
    return () => window.removeEventListener('beforeunload', avvisa)
  }, [modificato])

  // Caricamento dei dati della settimana scelta
  useEffect(() => {
    let annullato = false
    setStato('caricamento')
    ;(async () => {
      const [righe, notaDb] = await Promise.all([
        supabase.from('rilevazioni').select('*').eq('ufficio_id', ufficioId).eq('settimana', settimana),
        supabase.from('note_settimana').select('testo').eq('ufficio_id', ufficioId).eq('settimana', settimana).maybeSingle(),
      ])
      if (annullato) return
      if (righe.error || notaDb.error) {
        setMessaggio({ tipo: 'errore', testo: `Impossibile caricare i dati: ${(righe.error ?? notaDb.error)!.message}` })
        setStato('pronto')
        return
      }
      const salvate = caselleVuote(metriche)
      for (const r of righe.data as Rilevazione[]) {
        if (salvate[r.metrica]) salvate[r.metrica] = { obiettivo: testo(r.obiettivo), risultato: testo(r.risultato) }
      }
      const piuRecente = (righe.data as Rilevazione[])
        .filter((r) => r.aggiornato_il)
        .sort((a, b) => b.aggiornato_il!.localeCompare(a.aggiornato_il!))[0]
      setUltimoSalvataggio(piuRecente ? { quando: piuRecente.aggiornato_il!, chi: piuRecente.aggiornato_da ?? null } : null)

      // Dati di zona non ancora inseriti → proponi quelli dell'ultima settimana compilata
      const proposte: Caselle = structuredClone(salvate)
      let da: string | null = null
      const zonaVuota = zona.every((m) => salvate[m.codice].risultato === '')
      if (zonaVuota && zona.length > 0) {
        const precedenti = await supabase.from('rilevazioni')
          .select('metrica, risultato, settimana')
          .eq('ufficio_id', ufficioId).lt('settimana', settimana)
          .in('metrica', zona.map((m) => m.codice)).not('risultato', 'is', null)
          .order('settimana', { ascending: false }).limit(zona.length * 4)
        if (annullato) return
        for (const r of (precedenti.data ?? []) as Rilevazione[]) {
          if (proposte[r.metrica].risultato === '') {
            proposte[r.metrica].risultato = testo(r.risultato)
            da = da ?? r.settimana
          }
        }
      }

      // Obiettivi non ancora inseriti → riprendi quelli dell'ultima settimana che li aveva (modificabili)
      let obDa: string | null = null
      const obiettiviVuoti = attivita.every((m) => salvate[m.codice].obiettivo === '')
      if (obiettiviVuoti && attivita.length > 0) {
        const precedenti = await supabase.from('rilevazioni')
          .select('metrica, obiettivo, settimana')
          .eq('ufficio_id', ufficioId).lt('settimana', settimana)
          .in('metrica', attivita.map((m) => m.codice)).not('obiettivo', 'is', null)
          .order('settimana', { ascending: false }).limit(attivita.length * 4)
        if (annullato) return
        const righePrec = (precedenti.data ?? []) as Rilevazione[]
        obDa = righePrec[0]?.settimana ?? null
        // solo la settimana più recente: gli obiettivi si riprendono tutti insieme, senza mescolare settimane
        for (const r of righePrec) if (r.settimana === obDa) proposte[r.metrica].obiettivo = testo(r.obiettivo)
      }

      setOriginali(salvate)
      setCaselle(proposte)
      setNota(notaDb.data?.testo ?? '')
      setNotaOriginale(notaDb.data?.testo ?? '')
      setProposteDa(da)
      setObiettiviDa(obDa)
      setStato('pronto')
    })()
    return () => { annullato = true }
  }, [ufficioId, settimana, versione, metriche])

  function cambia(codice: string, campo: 'obiettivo' | 'risultato', valore: string) {
    setCaselle((c) => ({ ...c, [codice]: { ...c[codice], [campo]: valore } }))
    setMessaggio(null)
  }

  function conPermesso(azione: () => void) {
    if (modificato && !window.confirm('Hai modifiche non salvate. Vuoi abbandonarle?')) return
    setMessaggio(null)
    azione()
  }

  const caselleErrate = metriche.flatMap((m) =>
    (['obiettivo', 'risultato'] as const)
      .filter((campo) => leggiNumero(caselle[m.codice][campo]) === 'errore')
      .map((campo) => `${m.codice}.${campo}`))

  async function salva() {
    if (caselleErrate.length > 0) {
      setMessaggio({ tipo: 'errore', testo: 'Alcune caselle contengono valori non validi (solo numeri interi, senza segni o virgole).' })
      return
    }
    setStato('salvataggio')
    const cambiate = metriche.filter((m) =>
      caselle[m.codice].obiettivo !== originali[m.codice].obiettivo ||
      caselle[m.codice].risultato !== originali[m.codice].risultato)
    const righe = cambiate.map((m) => ({
      ufficio_id: ufficioId,
      settimana,
      metrica: m.codice,
      obiettivo: m.tipo === 'attivita' ? num(caselle[m.codice].obiettivo) : null,
      risultato: num(caselle[m.codice].risultato),
    }))
    const esiti = await Promise.all([
      righe.length > 0
        ? supabase.from('rilevazioni').upsert(righe, { onConflict: 'ufficio_id,settimana,metrica' })
        : Promise.resolve({ error: null }),
      nota !== notaOriginale
        ? supabase.from('note_settimana').upsert({ ufficio_id: ufficioId, settimana, testo: nota.trim() }, { onConflict: 'ufficio_id,settimana' })
        : Promise.resolve({ error: null }),
    ])
    const errore = esiti.find((r) => r.error)?.error
    if (errore) {
      setStato('pronto')
      setMessaggio({ tipo: 'errore', testo: `Salvataggio non riuscito: ${errore.message}. I dati sono ancora nelle caselle: riprova.` })
      return
    }
    setMessaggio({ tipo: 'ok', testo: `Dati salvati alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}.` })
    setVersione((v) => v + 1)
  }

  const quota = quotaMercato(num(caselle.portafoglio?.risultato ?? ''), num(caselle.incarichi_zona?.risultato ?? ''))
  const ufficio = uffici.find((u) => u.id === ufficioId)!

  return (
    <div className="pagina-inserimento">
      <div className="scheda intestazione-inserimento">
        {uffici.length > 1 ? (
          <label className="scelta-ufficio">
            Ufficio
            <select value={ufficioId} onChange={(e) => { const v = Number(e.target.value); conPermesso(() => setUfficioId(v)) }}>
              {uffici.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </label>
        ) : (
          <h1 className="nome-ufficio">{ufficio.nome}</h1>
        )}
        <SceltaSettimana settimana={settimana} onCambia={(s) => conPermesso(() => setSettimana(s))} />
        {ultimoSalvataggio && (
          <p className="piccolo">
            Ultimo salvataggio: {new Date(ultimoSalvataggio.quando).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
            {ultimoSalvataggio.chi ? ` da ${nomeDaEmail(ultimoSalvataggio.chi)}` : ''}
          </p>
        )}
      </div>

      <fieldset className="scheda" disabled={stato !== 'pronto'}>
        <h2>Attività della settimana</h2>
        <p className="piccolo">Se in un'attività non hai fatto nulla scrivi <strong>0</strong>: la casella vuota vuol dire "non ancora inserito".</p>
        {obiettiviDa && (
          <p className="avviso">
            Obiettivi ripresi dalla settimana {intervalloSettimana(obiettiviDa)}: cambiali se questa settimana sono diversi, poi salva.
          </p>
        )}
        <table className="tabella-dati">
          <thead>
            <tr><th>Attività</th><th>Obiettivo</th><th>Risultato</th><th>Esito</th></tr>
          </thead>
          <tbody>
            {attivita.map((m) => {
              const c = caselle[m.codice]
              const e = esito(num(c.obiettivo), num(c.risultato))
              return (
                <tr key={m.codice}>
                  <th scope="row">{m.nome}</th>
                  {(['obiettivo', 'risultato'] as const).map((campo) => (
                    <td key={campo}>
                      <input inputMode="numeric" aria-label={`${m.nome} – ${campo}`} value={c[campo]}
                        className={caselleErrate.includes(`${m.codice}.${campo}`) ? 'non-valido' : ''}
                        onChange={(ev) => cambia(m.codice, campo, ev.target.value)} />
                    </td>
                  ))}
                  <td className={`esito ${e === null ? '' : e >= 0 ? 'positivo' : 'negativo'}`}>{formattaEsito(e)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </fieldset>

      <fieldset className="scheda" disabled={stato !== 'pronto'}>
        <h2>Dati di zona</h2>
        {proposteDa && (
          <p className="avviso">
            Valori proposti dalla settimana {intervalloSettimana(proposteDa)}: controllali, cambia quelli variati e salva.
          </p>
        )}
        <table className="tabella-dati tabella-zona">
          <tbody>
            {zona.map((m) => (
              <tr key={m.codice}>
                <th scope="row">{m.nome}</th>
                <td>
                  <input inputMode="numeric" aria-label={m.nome} value={caselle[m.codice].risultato}
                    className={caselleErrate.includes(`${m.codice}.risultato`) ? 'non-valido' : ''}
                    onChange={(ev) => cambia(m.codice, 'risultato', ev.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={`quota ${quota === null ? '' : quota >= OBIETTIVO_QUOTA ? 'positivo' : 'negativo'}`}>
          <span>Quota di mercato</span>
          <strong>{formattaPercentuale(quota)}</strong>
          <span className="piccolo">obiettivo {formattaPercentuale(OBIETTIVO_QUOTA)} · Portafoglio ÷ (Portafoglio + Incarichi in zona)</span>
        </div>
      </fieldset>

      <fieldset className="scheda" disabled={stato !== 'pronto'}>
        <h2>Note della settimana <span className="piccolo">(facoltative, mostrate in riunione)</span></h2>
        <textarea rows={3} maxLength={2000} value={nota} placeholder="Es. acquisito incarico importante in via…"
          onChange={(e) => { setNota(e.target.value); setMessaggio(null) }} />
      </fieldset>

      <div className="barra-salvataggio">
        {messaggio && <span className={messaggio.tipo === 'ok' ? 'ok' : 'errore'} role="status">{messaggio.testo}</span>}
        {!messaggio && modificato && <span className="piccolo">Modifiche non salvate</span>}
        <button onClick={salva} disabled={stato !== 'pronto' || !modificato}>
          {stato === 'salvataggio' ? 'Salvataggio…' : stato === 'caricamento' ? 'Caricamento…' : 'Salva'}
        </button>
      </div>
    </div>
  )
}
