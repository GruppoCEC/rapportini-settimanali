// Struttura generale del sito: controlla l'accesso, carica i dati di base
// (account, città, aree, uffici, voci) e mostra la pagina scelta dal menu.
import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configurato, supabase } from './lib/supabase'
import { AREE_ATTIVE, type Contesto } from './lib/contesto'
import { isAmministratore, ufficiCompilabili } from './lib/permessi'
import { NOMI_RUOLO, type Area, type Citta, type Metrica, type Ufficio, type Utente } from './lib/tipi'
import Accesso from './pagine/Accesso'
import Account from './pagine/Account'
import Amministrazione from './pagine/Amministrazione'
import AndamentoUfficio from './pagine/AndamentoUfficio'
import Cruscotto from './pagine/Cruscotto'
import InserisciSettimana from './pagine/InserisciSettimana'
import Riunione from './pagine/Riunione'
import StatoCompilazione from './pagine/StatoCompilazione'

type Pagina = 'inserisci' | 'andamento' | 'cruscotto' | 'compilazione' | 'riunione' | 'amministrazione' | 'account'

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
        <button onClick={() => location.reload()}>Riprova</button>
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
        <button className="secondario" onClick={() => supabase.auth.signOut()}>Esci</button>
      </Centro>
    )
  }

  const ctx: Contesto = {
    ...dati, utente, cittaId: cittaScelta, ricaricaBase,
    // aree disattivate: il sito si comporta come se nessun ufficio ne avesse una
    aree: AREE_ATTIVE ? dati.aree : [],
    uffici: AREE_ATTIVE ? dati.uffici : dati.uffici.map((u) => ({ ...u, area_id: null })),
  }
  const nomeCitta = dati.citta.find((c) => c.id === cittaScelta)?.nome ?? ''
  const compilabili = ufficiCompilabili(utente, dati.uffici, cittaScelta)
  const vedeInsieme = utente.ruolo !== 'ufficio'

  // Voci di menu in base al ruolo
  const menu: { id: Pagina; etichetta: string }[] = [
    ...(compilabili.length > 0 ? [{ id: 'inserisci' as Pagina, etichetta: 'Inserisci settimana' }] : []),
    { id: 'andamento', etichetta: vedeInsieme ? 'Andamento uffici' : 'Il mio ufficio' },
    ...(vedeInsieme ? [
      { id: 'cruscotto' as Pagina, etichetta: 'Cruscotto' },
      { id: 'compilazione' as Pagina, etichetta: 'Stato compilazione' },
      { id: 'riunione' as Pagina, etichetta: 'Riunione' },
    ] : []),
    ...(isAmministratore(utente) ? [{ id: 'amministrazione' as Pagina, etichetta: 'Amministrazione' }] : []),
  ]
  const attiva: Pagina = pagina === 'account' || menu.some((v) => v.id === pagina) ? pagina : menu[0].id

  return (
    <div className="app">
      <header className="testata">
        <div className="testata-sinistra">
          <span className="logo">Rapportini Settimanali</span>
          {utente.ruolo === 'admin_generale' ? (
            <select className="scelta-citta" value={cittaScelta} aria-label="Città"
              onChange={(e) => setCittaScelta(Number(e.target.value))}>
              {dati.citta.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          ) : (
            <span className="etichetta-citta">{nomeCitta}</span>
          )}
        </div>
        <div className="testata-destra">
          <button className="link chi" title={NOMI_RUOLO[utente.ruolo]} onClick={() => vaiA('account')}>{utente.nome || utente.nome_utente}</button>
          <button className="link" onClick={() => supabase.auth.signOut()}>Esci</button>
        </div>
      </header>

      {import.meta.env.VITE_DEMO && <div className="striscia-demo">Versione dimostrativa · dati inventati, si azzerano ricaricando la pagina</div>}
      <nav className="menu" aria-label="Sezioni">
        {menu.map((v) => (
          <button key={v.id} className={attiva === v.id ? 'attivo' : ''} aria-current={attiva === v.id ? 'page' : undefined} onClick={() => vaiA(v.id)}>
            {v.etichetta}
          </button>
        ))}
      </nav>

      <main className="contenuto">
        {attiva === 'inserisci' && <InserisciSettimana key={cittaScelta} uffici={compilabili} metriche={dati.metriche} />}
        {attiva === 'andamento' && <AndamentoUfficio key={cittaScelta} ctx={ctx} />}
        {attiva === 'cruscotto' && <Cruscotto key={cittaScelta} ctx={ctx} />}
        {attiva === 'compilazione' && <StatoCompilazione key={cittaScelta} ctx={ctx} />}
        {attiva === 'riunione' && <Riunione key={cittaScelta} ctx={ctx} />}
        {attiva === 'amministrazione' && <Amministrazione key={cittaScelta} ctx={ctx} />}
        {attiva === 'account' && <Account ctx={ctx} />}
      </main>
    </div>
  )
}

function Centro({ titolo, children }: { titolo: string; children?: React.ReactNode }) {
  return (
    <div className="centro">
      <div className="scheda scheda-stretta">
        <h1>{titolo}</h1>
        {children}
      </div>
    </div>
  )
}
