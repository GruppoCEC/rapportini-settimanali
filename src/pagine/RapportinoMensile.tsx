// Pagina "Rapportino mensile": l'ufficio scrive i numeri del mese di ogni persona
// (come nel file Excel "Rapportino vuoto NUOVO") e tiene aggiornato il proprio personale.
// Totale dell'ufficio e staff si calcolano da soli.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { nomeDaEmail } from '../lib/account'
import { leggiNumero } from '../lib/calcoli'
import { caricaPersone, caricaScadenza, caricaStorico, caricaValoriMensili, caricaVociMensili, mensileAperto } from '../lib/dati'
import {
  aiutoDataInizio, dataItaliana, dataOra, dateDaCompletare, DATA_INIZIO_PROVVISORIA, inServizio, meseChiuso, mesePredefinito, primoDelMese, scadenzaPassata, ordinaPersone, righeDelMese,
  titoloMese, totaleUfficio, ORDINE_RUOLI,
} from '../lib/mensile'
import { NOMI_MOTIVO_FINE, NOMI_RUOLO_PERSONA, type MotivoFine, type Persona, type RuoloPersona, type Scadenza, type Ufficio, type ValoreMensile, type VoceMensile } from '../lib/tipi'
import { oggiISO } from '../lib/settimane'
import { useDati } from '../lib/useDati'
import { Caricamento } from '../componenti/Celle'
import { Icona, useConferma, useToast } from '../componenti/Interfaccia'
import SceltaMese from '../componenti/SceltaMese'
import { AvvisoUscite, classeMovimento, EtichettaMovimento, TabellaRapportino } from '../componenti/TabellaMensile'
import ReportGruppoUfficio from '../componenti/ReportGruppoUfficio'
import GuidaMensile from '../componenti/GuidaMensile'
import { guidaDaMostrare, guidaNascosta, memorieBrowser, ricordaChiusura } from '../lib/guida'

interface Props {
  uffici: Ufficio[]                     // uffici che l'utente può compilare (di solito uno solo)
  ufficioPredefinito?: number | null
  amministratore?: boolean              // gli amministratori possono scrivere anche a mese chiuso
  nomeUtente: string                    // per ricordare se la guida va ancora aperta da sola
}

/** Caselle scritte, come testo: chiave "persona|voce" */
type Caselle = Record<string, string>
const chiave = (personaId: number, voce: string) => `${personaId}|${voce}`
const num = (s: string) => { const v = leggiNumero(s); return typeof v === 'number' ? v : null }

export default function RapportinoMensile({ uffici, ufficioPredefinito, amministratore, nomeUtente }: Props) {
  const base = useDati(() => Promise.all([caricaVociMensili(), mensileAperto()]), [])
  if (!base.dati) return <div className="pagina"><Caricamento errore={base.errore} /></div>
  const [voci, aperto] = base.dati
  return <Compilazione uffici={uffici} ufficioPredefinito={ufficioPredefinito} amministratore={amministratore} nomeUtente={nomeUtente} voci={voci} aperto={aperto} />
}

/** Funzione ancora in prova: lo si dice chiaramente, agli uffici e agli amministratori */
export function AvvisoProva({ amministratore }: { amministratore?: boolean }) {
  return (
    <div className="avviso-wip" role="note">
      <span className="tag-wip">Work in progress</span>
      <span>
        <strong>Funzione in prova.</strong>{' '}
        {amministratore
          ? 'Gli uffici vedono questa pagina ma non possono ancora inserire i dati. Tu puoi provarla: i dati che inserisci restano nel database.'
          : 'Il rapportino mensile sarà presto disponibile: per ora le caselle sono bloccate e non è possibile inserire i dati.'}
      </span>
    </div>
  )
}

function Compilazione({ uffici, ufficioPredefinito, amministratore, nomeUtente, voci, aperto }: Props & { voci: VoceMensile[]; aperto: boolean }) {
  const [ufficioId, setUfficioId] = useState(uffici.find((u) => u.id === ufficioPredefinito)?.id ?? uffici[0].id)
  const [mese, setMese] = useState(mesePredefinito())
  const [persone, setPersone] = useState<Persona[]>([])
  const [scadenza, setScadenza] = useState<Scadenza | null>(null)
  const [conStorico, setConStorico] = useState(false)       // per questo mese c'è il totale dal file Excel annuale
  const [caselle, setCaselle] = useState<Caselle>({})
  const [originali, setOriginali] = useState<Caselle>({})
  const [ultimoSalvataggio, setUltimoSalvataggio] = useState<{ quando: string; chi: string | null } | null>(null)
  const [stato, setStato] = useState<'caricamento' | 'pronto' | 'salvataggio'>('caricamento')
  const [messaggio, setMessaggio] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null)
  const [versione, setVersione] = useState(0)
  const [dialogo, chiedi] = useConferma()
  const [toast, mostraToast] = useToast()
  // Guida di benvenuto: si apre da sola a uffici e affiliati, finché non scelgono "Non mostrare più"
  const [memorie] = useState(memorieBrowser)
  const [guida, setGuida] = useState(() => guidaDaMostrare(nomeUtente, !!amministratore, memorie))
  const chiudiGuida = useCallback((nonMostrarePiu: boolean) => {
    ricordaChiusura(nomeUtente, nonMostrarePiu, memorie)
    setGuida(false)
  }, [nomeUtente, memorie])

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
    Promise.all([caricaPersone([ufficioId]), caricaValoriMensili(mese, [ufficioId]), caricaScadenza(mese), caricaStorico([mese], [ufficioId])])
      .then(([p, valori, sc, storico]) => {
        if (annullato) return
        setScadenza(sc)
        setConStorico(storico.length > 0)
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
  const daCompletare = dateDaCompletare(persone)
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
  const inProva = !aperto && !amministratore                 // Work in progress: gli uffici non scrivono ancora
  const chiuso = (meseChiuso(scadenza) && !amministratore) || inProva   // mese chiuso dall'amministratore: l'ufficio non scrive più
  const disattivo = stato !== 'pronto' || chiuso

  return (
    <div className="pagina entra">
      {!aperto && <AvvisoProva amministratore={amministratore} />}
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
        <div className="intestazione-azioni">
          <button className="btn btn-secondario" onClick={() => setGuida(true)}><Icona nome="question" />Guida</button>
          <SceltaMese mese={mese} onCambia={(m) => conPermesso(() => setMese(m))} />
        </div>
      </div>

      {/* dopo la scadenza con il blocco l'ufficio vede e stampa il report di tutto il gruppo, in cima alla pagina (018) */}
      {scadenza?.blocca && scadenzaPassata(scadenza) && <ReportGruppoUfficio key={mese} mese={mese} ufficioId={ufficioId} voci={voci} />}

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
        {!inProva && <AvvisoScadenza scadenza={scadenza} amministratore={amministratore} />}
        {!inProva && daCompletare.length > 0 && (
          <p className="avviso avviso-arancio compare"><Icona nome="calendar-x" />
            <span>
              {daCompletare.length === 1 ? '1 persona ha' : `${daCompletare.length} persone hanno`} la <strong>data di inizio da completare</strong>:{' '}
              <button className="collegamento" onClick={() => document.getElementById('personale-ufficio')?.scrollIntoView({ behavior: 'smooth' })}>
                {daCompletare.length === 1 ? 'la trovate' : 'le trovate'} in Personale dell'ufficio</button>, qui sotto.
            </span>
          </p>
        )}
        {conStorico && stato !== 'caricamento' && (
          <p className="avviso compare"><Icona nome="file-xls" />
            <span>Per {titoloMese(mese).toLowerCase()} il report usa il <strong>totale dell'ufficio dal file Excel annuale</strong>. Se inserisci qui i numeri persona per persona, il report userà quelli al posto del totale dell'Excel.</span>
          </p>
        )}
        <AvvisoUscite persone={persone} mese={mese} />
        <TabellaRapportino voci={voci} mese={mese} righe={righe} totale={totale} modificabile disattivo={disattivo} errate={errate}
          testo={(pid, voce) => caselle[chiave(pid, voce)] ?? ''}
          onCambia={(pid, voce, valore) => { setCaselle((c) => ({ ...c, [chiave(pid, voce)]: valore })); setMessaggio(null) }} />
      </section>

      <Personale persone={persone} daCompletare={daCompletare} ufficioId={ufficioId} mese={mese} onCambiato={ricaricaPersone} chiedi={chiedi} mostraToast={mostraToast} bloccato={inProva} />

      <div className="barra-salvataggio">
        {messaggio && (
          <span className={`messaggio-stato ${messaggio.tipo}`} role="status">
            <Icona nome={messaggio.tipo === 'ok' ? 'check-circle' : 'warning-circle'} />{messaggio.testo}
          </span>
        )}
        {!messaggio && modificato && stato === 'pronto' && <span className="non-salvato"><span className="pallino" />Modifiche non salvate</span>}
        <button className="btn btn-primario" onClick={salva} disabled={stato !== 'pronto' || !modificato || chiuso}>
          <Icona nome={stato === 'salvataggio' ? 'circle-notch' : 'floppy-disk'} className={stato === 'salvataggio' ? 'gira' : ''} />
          {stato === 'salvataggio' ? 'Salvataggio…' : stato === 'caricamento' ? 'Caricamento…' : 'Salva'}
        </button>
      </div>
      {dialogo}
      {toast}
      {guida && <GuidaMensile nascostaAllInizio={guidaNascosta(nomeUtente, memorie)} onChiudi={chiudiGuida} />}
    </div>
  )
}

// ---------------------------------------------------------------- Scadenza

/** Entro quando compilare; dopo la scadenza avvisa che i dati arrivano in ritardo, o che il mese è chiuso */
function AvvisoScadenza({ scadenza, amministratore }: { scadenza: Scadenza | null; amministratore?: boolean }) {
  if (!scadenza) return null
  const quando = dataOra(scadenza.scadenza)
  if (!scadenzaPassata(scadenza)) {
    return <p className="avviso compare"><Icona nome="calendar-check" /><span>Da compilare entro il <strong>{quando}</strong>.</span></p>
  }
  if (scadenza.blocca) {
    return (
      <p className="avviso avviso-scadenza-chiusa compare"><Icona nome="lock-simple" />
        <span><strong>Inserimento chiuso</strong> il {quando}. {amministratore
          ? 'Gli uffici non possono più modificare questo mese; come amministratore puoi ancora correggere.'
          : 'Per correzioni contatta l\'amministratore.'}</span>
      </p>
    )
  }
  return (
    <p className="avviso avviso-arancio compare"><Icona nome="alarm" />
      <span><strong>Scadenza superata</strong> il {quando}: puoi ancora inserire o correggere i numeri, ma l'amministratore vedrà che sono arrivati in ritardo.</span>
    </p>
  )
}

// ---------------------------------------------------------------- Personale dell'ufficio

interface PropsPersonale {
  persone: Persona[]
  daCompletare: Persona[]               // con la data di inizio provvisoria (01/01/2026)
  ufficioId: number
  mese: string
  onCambiato: () => Promise<void>
  chiedi: ReturnType<typeof useConferma>[1]
  mostraToast: (testo: string) => void
  bloccato?: boolean                    // Work in progress: niente modifiche al personale
}

type Bozza = { nome: string; ruolo: RuoloPersona; data_inizio: string; data_fine: string; motivo_fine: MotivoFine }

function messaggioErrore(m: string): string {
  if (/check constraint|violates check/i.test(m)) return 'Controlla i dati: il nome non può essere vuoto e la data di fine non può essere prima di quella di inizio.'
  return m
}

function Personale({ persone, daCompletare, ufficioId, mese, onCambiato, chiedi, mostraToast, bloccato }: PropsPersonale) {
  const vuota: Bozza = { nome: '', ruolo: 'collaboratore', data_inizio: '', data_fine: '', motivo_fine: 'uscita' }
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
    if (!await confermaInizioPosticipato(inModifica.id, b)) return
    // il motivo si scrive solo se c'è una data di fine (e solo se il database ha già la 015)
    const campi = { nome: b.nome.trim(), ruolo: b.ruolo, data_inizio: b.data_inizio, data_fine: b.data_fine || null,
      ...(b.data_fine && (b.motivo_fine !== 'uscita' || persone.some((x) => 'motivo_fine' in x)) ? { motivo_fine: b.motivo_fine } : {}) }
    const ok = await esegui(supabase.from('persone').update(campi).eq('id', inModifica.id),
      `Scheda di ${b.nome.trim()} aggiornata.`)
    if (ok) setInModifica(null)
  }

  /**
   * Spostando avanti la data di inizio, i numeri dei mesi prima non compaiono più (né nel rapportino
   * né nei totali): se ce ne sono, lo si chiede prima. Evita di "perdere" per errore i mesi già caricati.
   */
  async function confermaInizioPosticipato(id: number, b: Bozza): Promise<boolean> {
    const prima = persone.find((x) => x.id === id)
    if (!prima || !b.data_inizio || b.data_inizio <= prima.data_inizio) return true
    const { data, error } = await supabase.from('valori_mensili').select('mese, valore').eq('persona_id', id).lt('mese', primoDelMese(b.data_inizio))
    if (error) { setErrore(`Impossibile controllare i numeri già inseriti: ${error.message}`); return false }
    const mesi = [...new Set((data as { mese: string; valore: number | null }[]).filter((v) => v.valore !== null).map((v) => v.mese))].sort()
    if (mesi.length === 0) return true
    const quali = mesi.length === 1 ? `in ${titoloMese(mesi[0]).toLowerCase()}`
      : `tra ${titoloMese(mesi[0]).toLowerCase()} e ${titoloMese(mesi[mesi.length - 1]).toLowerCase()}`
    return chiedi({
      titolo: 'Controlla la data di inizio',
      testo: `${b.nome.trim()} ha già dei numeri ${quali}. Con inizio dal ${dataItaliana(b.data_inizio)} quei numeri non compariranno più nel rapportino né nei totali dell'ufficio. Vuoi cambiare lo stesso la data?`,
      conferma: 'Cambia la data', pericolo: true,
    })
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
    setInModifica({ id: p.id, bozza: { nome: p.nome, ruolo: p.ruolo, data_inizio: p.data_inizio, data_fine: dataFine ?? p.data_fine ?? '', motivo_fine: p.motivo_fine ?? 'uscita' } })
  // dall'avviso delle date da completare: apre la riga e porta sulla data di inizio
  const correggiInizio = (p: Persona) => {
    modifica(p)
    setTimeout(() => document.getElementById(`inizio-${p.id}`)?.focus())
  }
  const daCompletareIds = new Set(daCompletare.map((p) => p.id))
  const campoBozza = (campo: keyof Bozza, valore: string) =>
    setInModifica((m) => m && { ...m, bozza: { ...m.bozza, [campo]: valore } })

  return (
    <section className="scheda entra entra-2" id="personale-ufficio">
      <h2 className="titolo-icona"><span className="icona-quadrata icona-arancio"><Icona nome="users-three" /></span>Personale dell'ufficio</h2>
      {daCompletare.length > 0 && (
        <div className="avviso avviso-arancio date-da-completare" role="note">
          <div className="intestazione-avviso"><Icona nome="calendar-x" />
            <span>
              <strong>Date di inizio da completare.</strong> Per {daCompletare.length === 1 ? 'questa persona' : 'queste persone'} abbiamo messo il {dataItaliana(DATA_INIZIO_PROVVISORIA)} perché la data vera non c'era.
              Premete <strong>Modifica</strong> e scrivete: per il <strong>responsabile</strong> da quando è responsabile, per <strong>gli altri</strong> da quando lavorano nel gruppo.
              Se la data è davvero il 1° gennaio 2026, ignorate questo avviso.
            </span>
          </div>
          <ul>
            {daCompletare.map((p) => (
              <li key={p.id}>{p.nome} <span className="piccolo">· {NOMI_RUOLO_PERSONA[p.ruolo].toLowerCase()}</span>
                <button className="btn btn-fantasma" disabled={bloccato} onClick={() => correggiInizio(p)}>Modifica</button></li>
            ))}
          </ul>
        </div>
      )}
      <p className="piccolo">
        Il personale si inserisce una volta sola e vale per tutti i mesi, a partire dalla data di inizio.
        Quando qualcuno lascia l'ufficio premi <strong>Ha lasciato</strong>, indica l'ultimo giorno e il motivo (ha lasciato il gruppo, promosso a responsabile oppure trasferito in un altro ufficio: in quel caso crealo anche nel nuovo ufficio). Nel mese in cui esce resta nel rapportino con la riga rossa: i suoi numeri di quel mese contano nel totale dell'ufficio, ma non nello staff né nella gara a punti. Dal mese dopo non compare più; i suoi numeri dei mesi precedenti restano.
      </p>
      {errore && <p className="errore-box" role="alert"><Icona nome="warning-circle" />{errore}</p>}

      <form className="riga-modulo" onSubmit={aggiungi}>
        <label className="campo campo-nome"><span className="etichetta">Nome e cognome</span>
          <input required maxLength={80} disabled={bloccato} value={nuova.nome} onChange={(e) => setNuova({ ...nuova, nome: e.target.value })} placeholder="es. Mario Rossi" /></label>
        <label className="campo"><span className="etichetta">Ruolo</span>
          <select disabled={bloccato} value={nuova.ruolo} onChange={(e) => setNuova({ ...nuova, ruolo: e.target.value as RuoloPersona })}>
            {ORDINE_RUOLI.map((r) => <option key={r} value={r}>{NOMI_RUOLO_PERSONA[r]}</option>)}
          </select></label>
        <label className="campo"><span className="etichetta">Data di inizio</span>
          <input required type="date" disabled={bloccato} value={nuova.data_inizio} onChange={(e) => setNuova({ ...nuova, data_inizio: e.target.value })} />
          <span className="aiuto-data">{aiutoDataInizio(nuova.ruolo)}</span></label>
        <button type="submit" className="btn btn-primario" disabled={occupato || bloccato}><Icona nome="user-plus" />Aggiungi</button>
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
                      <td>
                        <input type="date" id={`inizio-${p.id}`} value={b.data_inizio} aria-label="Data di inizio" onChange={(e) => campoBozza('data_inizio', e.target.value)} />
                        <span className="aiuto-data">{aiutoDataInizio(b.ruolo)}</span>
                      </td>
                      <td>
                        <input type="date" value={b.data_fine} aria-label="Data di fine" onChange={(e) => campoBozza('data_fine', e.target.value)} />
                        {b.data_fine && (
                          <select value={b.motivo_fine} aria-label="Motivo" style={{ marginTop: 6 }} onChange={(e) => campoBozza('motivo_fine', e.target.value)}>
                            {(Object.keys(NOMI_MOTIVO_FINE) as MotivoFine[]).map((m) => <option key={m} value={m}>{NOMI_MOTIVO_FINE[m]}</option>)}
                          </select>
                        )}
                      </td>
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
                    <td>{dataItaliana(p.data_inizio)}{daCompletareIds.has(p.id) && <span className="tag tag-quasi tag-a-capo">Data da completare</span>}</td>
                    <td>{dataItaliana(p.data_fine)}{p.motivo_fine && p.motivo_fine !== 'uscita' && <span className="piccolo" style={{ display: 'block' }}>{NOMI_MOTIVO_FINE[p.motivo_fine].toLowerCase()}</span>}</td>
                    <td>
                      <EtichettaMovimento persona={p} mese={mese} />
                      {!classeMovimento(p, mese) && (
                        <span className={`tag ${servizio ? 'tag-accento' : 'tag-neutro'}`}>
                          {servizio ? `In servizio a ${titoloMese(mese).split(' ')[0].toLowerCase()}` : p.data_inizio > mese ? 'Non ancora iniziato' : 'Non più in ufficio'}
                        </span>
                      )}
                    </td>
                    <td className="azioni">
                      <button className="btn btn-fantasma" disabled={bloccato} onClick={() => modifica(p)}>Modifica</button>
                      {!p.data_fine && <button className="btn btn-fantasma" disabled={bloccato} onClick={() => modifica(p, oggi)}>Ha lasciato</button>}
                      <button className="btn btn-fantasma btn-pericolo" disabled={bloccato} onClick={() => elimina(p)}>Elimina</button>
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
