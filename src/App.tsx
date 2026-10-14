// Struttura generale del sito: controlla l'accesso, carica i dati di base
// (account, città, aree, uffici, voci) e mostra la pagina scelta dal menu.
import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configurato, supabase } from './lib/supabase'
import { AREE_ATTIVE, MENSILE_ATTIVO, type Contesto } from './lib/contesto'
import { isAmministratore, ufficiCompilabili } from './lib/permessi'
import { type Area, type Citta, type Metrica, type Ufficio, type Utente } from './lib/tipi'
import Accesso from './pagine/Accesso'
import Account from './pagine/Account'
import Amministrazione from './pagine/Amministrazione'
import AndamentoUfficio from './pagine/AndamentoUfficio'
import Cruscotto from './pagine/Cruscotto'
import InserisciSettimana from './pagine/InserisciSettimana'
import RapportinoMensile from './pagine/RapportinoMensile'
import ReportMensile from './pagine/ReportMensile'
import Riunione from './pagine/Riunione'
import StatoCompilazione from './pagine/StatoCompilazione'
import Testata, { type VoceMenu } from './componenti/Testata'

type Pagina = 'inserisci' | 'mensile' | 'andamento' | 'cruscotto' | 'compilazione' | 'riunione' | 'report-mensile' | 'amministrazione' | 'account'

interface DatiBase {
  utente: Utente | null
  citta: Citta[]
  aree: Area[]
  uffici: Ufficio[]
  metriche: Metrica[]
}

const CHIAVE_PAGINA = 'rapportini.pagina'

export default function App() {
  const [sessione, setSessione] = useState<Session | null | undefined>(undefined)
  const [dati, setDati] = useState<DatiBase | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [cittaScelta, setCittaScelta] = useState<number | null>(null)
  const [pagina, setPagina] = useState<Pagina>(() => {
    try { return (localStorage.getItem(CHIAVE_PAGINA) as Pagina) || 'inserisci' } catch { return 'inserisci' }
  })
  const [versioneBase, setVersioneBase] = useState(0)
  const [aggiornamento, setAggiornamento] = useState(0)   // dopo ogni salvataggio, la testata ricalcola chi ha compilato

  // Sessione di accesso (resta valida anche chiudendo il browser)
  useEffect(() => {
    if (!configurato) return
    supabase.auth.getSession().then(({ data }) => setSessione(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessione(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // Dati di base, caricati dopo l'accesso (e ricaricati dopo modifiche in Amministrazione)
  const email = sessione?.user.email?.toLowerCase()
  useEffect(() => {
    if (!email) { setDati(null); return }
    let annullato = false
    ;(async () => {
      const [u, c, a, uf, m] = await Promise.all([
        supabase.from('utenti').select('*').eq('email', email).maybeSingle(),
        supabase.from('citta').select('*').order('id'),
        supabase.from('aree').select('*').order('nome'),
        supabase.from('uffici').select('*').order('nome'),
        supabase.from('metriche').select('*').eq('attiva', true).order('ordine'),
      ])
      if (annullato) return
      const primoErrore = [u, c, a, uf, m].find((r) => r.error)?.error
      if (primoErrore) { setErrore(primoErrore.message); return }
      const utente = u.data as Utente | null
      setDati({ utente, citta: c.data ?? [], aree: a.data ?? [], uffici: uf.data ?? [], metriche: m.data ?? [] })
      setCittaScelta((attuale) => attuale ?? utente?.citta_id ?? 1)
    })()
    return () => { annullato = true }
  }, [email, versioneBase])

  const ricaricaBase = useCallback(() => setVersioneBase((v) => v + 1), [])

  // Quando si torna sulla scheda del browser, si ricaricano uffici e account:
  // così compaiono subito eventuali uffici aggiunti nel frattempo (es. da un import)
  useEffect(() => {
    const alRitorno = () => { if (document.visibilityState === 'visible') ricaricaBase() }
    document.addEventListener('visibilitychange', alRitorno)
    return () => document.removeEventListener('visibilitychange', alRitorno)
  }, [ricaricaBase])
  const vaiA = (p: Pagina) => {
    setPagina(p)
    try { localStorage.setItem(CHIAVE_PAGINA, p) } catch { /* memoria del browser non disponibile */ }
    window.scrollTo(0, 0)
  }

  if (!configurato) {
    return (
      <Centro titolo="Configurazione mancante">
        <p>Il sito non sa a quale database collegarsi. Mancano le variabili <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_KEY</code>.</p>
        <p>Segui il passo "Collegare il sito a Supabase" in <code>docs/GUIDA_SETUP.md</code>.</p>
      </Centro>
    )
  }
  if (sessione === undefined) return <Centro titolo="Caricamento…" />
  if (!sessione) return <Accesso />
  if (errore) {
    return (
      <Centro titolo="Qualcosa non ha funzionato">
        <p>Non è stato possibile caricare i dati: {errore}</p>
        <p><button className="btn btn-primario" onClick={() => location.reload()}>Riprova</button></p>
      </Centro>
    )
  }
  if (!dati || cittaScelta === null) return <Centro titolo="Caricamento…" />

  const { utente } = dati
  if (!utente || !utente.attivo) {
    return (
      <Centro titolo="Accesso non autorizzato">
        <p>Questo account non è attivo sulla piattaforma.</p>
        <p>Chiedi all'amministratore della tua città di verificarlo.</p>
        <p><button className="btn btn-secondario" onClick={() => supabase.auth.signOut()}>Esci</button></p>
      </Centro>
    )
  }

  const ctx: Contesto = {
    ...dati, utente, cittaId: cittaScelta, ricaricaBase,
    // aree disattivate: il sito si comporta come se nessun ufficio ne avesse una
    aree: AREE_ATTIVE ? dati.aree : [],
    uffici: AREE_ATTIVE ? dati.uffici : dati.uffici.map((u) => ({ ...u, area_id: null })),
  }
  const compilabili = ufficiCompilabili(utente, dati.uffici, cittaScelta)
  const vedeInsieme = utente.ruolo !== 'ufficio'

  // Voci di menu in base al ruolo
  const menu: (VoceMenu & { id: Pagina })[] = [
    ...(compilabili.length > 0 ? [{ id: 'inserisci' as Pagina, etichetta: 'Inserisci settimana', icona: 'pencil-simple-line' }] : []),
    ...(compilabili.length > 0 && MENSILE_ATTIVO ? [{ id: 'mensile' as Pagina, etichetta: 'Inserisci mese', icona: 'calendar-check' }] : []),
    { id: 'andamento', etichetta: vedeInsieme ? 'Andamento uffici' : 'Il mio ufficio', icona: 'chart-line-up' },
    ...(vedeInsieme ? [
      { id: 'cruscotto' as Pagina, etichetta: 'Cruscotto', icona: 'gauge' },
      { id: 'compilazione' as Pagina, etichetta: 'Stato compilazione', icona: 'list-checks' },
      { id: 'riunione' as Pagina, etichetta: 'Riunione', icona: 'presentation-chart' },
    ] : []),
    ...(isAmministratore(utente) && MENSILE_ATTIVO ? [{ id: 'report-mensile' as Pagina, etichetta: 'Report mensile', icona: 'printer' }] : []),
    ...(isAmministratore(utente) ? [{ id: 'amministrazione' as Pagina, etichetta: 'Amministrazione', icona: 'gear-six' }] : []),
  ]
  const attiva: Pagina = pagina === 'account' || menu.some((v) => v.id === pagina) ? pagina : menu[0].id

  return (
    <div className="app">
      {import.meta.env.VITE_DEMO && <div className="striscia-demo">Versione dimostrativa · dati inventati, si azzerano ricaricando la pagina</div>}
      <Testata ctx={ctx} menu={menu} attiva={attiva} onVai={(p) => vaiA(p as Pagina)} onCitta={setCittaScelta}
        onEsci={() => supabase.auth.signOut()} aggiornamento={aggiornamento} />

      <main className="contenuto" key={`${attiva}-${cittaScelta}`}>
        {attiva === 'inserisci' && <InserisciSettimana uffici={compilabili} metriche={dati.metriche} ufficioPredefinito={utente.ufficio_id} onSalvato={() => setAggiornamento((n) => n + 1)} />}
        {attiva === 'mensile' && <RapportinoMensile uffici={compilabili} ufficioPredefinito={utente.ufficio_id} />}
        {attiva === 'andamento' && <AndamentoUfficio ctx={ctx} />}
        {attiva === 'cruscotto' && <Cruscotto ctx={ctx} />}
        {attiva === 'compilazione' && <StatoCompilazione ctx={ctx} />}
        {attiva === 'riunione' && <Riunione ctx={ctx} />}
        {attiva === 'report-mensile' && <ReportMensile ctx={ctx} />}
        {attiva === 'amministrazione' && <Amministrazione ctx={ctx} />}
        {attiva === 'account' && <Account ctx={ctx} />}
      </main>
    </div>
  )
}

function Centro({ titolo, children }: { titolo: string; children?: React.ReactNode }) {
  return (
    <div className="centro">
      <div className="scheda entra">
        <h1>{titolo}</h1>
        {children}
      </div>
    </div>
  )
}
