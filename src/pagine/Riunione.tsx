// Modalità riunione: presentazione a tutto schermo per la riunione del lunedì.
// Gli amministratori la usano per la città; uffici e affiliati la vedono come "Presentazione",
// solo con i propri uffici (il database manda loro solo quelli). Prima di avviarla si sceglie
// se presentare una settimana (rapportini settimanali) o un mese (rapportini mensili, con lo
// storico del file Excel annuale per i mesi compilati prima della piattaforma).
// Si avanza con le frecce della tastiera (o i pulsanti), Esc per uscire.
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  inClassifica, classifica, classificaQuota, quotaDaTotali, raggiungimento, sommaTotali, statoCompilazionePeriodo,
  totaliPerPeriodi, totaliPerUfficio, variazioneZona, type StatoCompilazione as Stato, type Totali, type TotaliCitta,
} from '../lib/aggregazioni'
import { esito, formattaEsito, formattaPercentuale, OBIETTIVO_QUOTA } from '../lib/calcoli'
import { AREE_ATTIVE, MENSILE_ATTIVO, type Contesto, nomeArea, ufficiVisibili } from '../lib/contesto'
import { nomeDaEmail } from '../lib/account'
import {
  CASELLE_NOTA, caricaNote, caricaPersone, caricaPosizioneCitta, caricaPosizioneMensileCitta, type PosizioniCitta, caricaRilevazioni, caricaStorico, caricaTotaliCitta, caricaTotaliMensiliCitta, caricaValoriMesi, caricaVociMensili, type Nota,
} from '../lib/dati'
import {
  formattaNumero, inServizio, meseInCorso as meseAttuale, titoloMese, mesePredefinito, riepilogoMensile, STAFF, statoMensile, totaleConStorico, variazioneBuona, vociDelRapportino,
  type RiepilogoMensile, type TotaliMese,
} from '../lib/mensile'
import { isAffiliato, isAmministratore } from '../lib/permessi'
import {
  aggiungiMesi, aggiungiSettimane, intervalloSettimana, intervalloSettimane, meseDellaSettimana, nomeMeseBreve, settimaneDelMese,
  ultimaSettimanaConclusa,
} from '../lib/settimane'
import type { Metrica, Rilevazione, Ufficio, VoceMensile } from '../lib/tipi'
import { useDati } from '../lib/useDati'
import { BadgeStato, CellaQuota, CellaRisultato, coloreRapporto } from '../componenti/Celle'
import { GraficoAndamento } from '../componenti/Grafici'
import { GraficoImbuto, ImbutoInRiga, NotaImbuto, TabellaImbuto } from '../componenti/Imbuto'
import { NotaPosizione, PosizioniCitta as RiquadriPosizione } from '../componenti/Posizione'
import {
  calcolaImbuto, codiciImbuto, IMBUTO_MENSILE, IMBUTO_SETTIMANALE, MESI_IMBUTO, SETTIMANE_IMBUTO, sommaPeriodi, type DefinizioneImbuto, type Imbuto,
} from '../lib/imbuto'
import { conta, Icona, Logo, useProgresso } from '../componenti/Interfaccia'
import SceltaPeriodo, { descriviPeriodo, periodoPredefinito, type Periodo } from '../componenti/SceltaPeriodo'

/** Quanti periodi mostrano i grafici di andamento: 8 settimane oppure 6 mesi */
const STORICO = { settimana: 8, mese: 6 }

/** I periodi dei grafici, dal più vecchio; l'ultimo è quello presentato. Ogni periodo è un elenco di lunedì. */
function periodiStorico(p: Periodo): string[][] {
  const n = STORICO[p.tipo]
  if (p.tipo === 'settimana') return Array.from({ length: n }, (_, i) => [aggiungiSettimane(p.settimana, i - n + 1)])
  const mese = meseDellaSettimana(p.settimana)
  return Array.from({ length: n }, (_, i) => settimaneDelMese(aggiungiMesi(mese, i - n + 1)))
}

/** Le parole che cambiano tra presentazione settimanale e mensile */
function paroleDelPeriodo(p: Periodo) {
  const n = STORICO[p.tipo]
  return p.tipo === 'settimana'
    ? { aggettivo: 'settimanale', prima: 'rispetto alla settimana prima', nessunConfronto: 'nessun confronto con la settimana prima', scorso: 'Settimana scorsa', vsScorso: 'vs scorsa',
        delPeriodo: 'della settimana', storico: `Ultime ${n} settimane`, nessunaNota: 'Nessuna nota per questa settimana.' }
    : { aggettivo: 'mensile', prima: 'rispetto al mese prima', nessunConfronto: 'nessun confronto con il mese prima', scorso: 'Mese scorso', vsScorso: 'vs mese scorso',
        delPeriodo: 'del mese', storico: `Ultimi ${n} mesi`, nessunaNota: 'Nessuna nota in questo mese.' }
}

const etichettaBreve = (lunedi: string) => { const [, m, g] = lunedi.split('-').map(Number); return `${g}/${m}` }

interface Diapositiva {
  titolo: string
  contenuto: (t: number) => ReactNode      // t = avanzamento dell'animazione (0–1)
}

interface DatiRiunione { dati: Rilevazione[]; note: Nota[]; citta: TotaliCitta | null; posizione: PosizioniCitta | null }

/** Presentazione mensile: i rapportini mensili degli uffici negli ultimi 6 mesi */
interface DatiMensili {
  voci: VoceMensile[]
  mesi: string[]                       // 'AAAA-MM-01', dal più vecchio; l'ultimo è quello presentato
  uffici: { ufficio: Ufficio; totali: TotaliMese[]; stato: Stato; daStorico: boolean }[]
  citta: RiepilogoMensile | null       // per un ufficio: tutta la sua città (solo le somme)
  posizione: PosizioniCitta | null     // per un ufficio: la sua posizione nella città (solo la sua riga)
}

/** Staff e colonne del rapportino mensile (l'indicatore delle coordinatrici resta fuori) */
const colonneMensili = (voci: VoceMensile[]) => [STAFF, ...vociDelRapportino(voci).map((v) => v.codice)]

async function caricaDatiMensili(mesi: string[], uffici: Ufficio[], soloUfficio: boolean): Promise<DatiMensili> {
  const ids = uffici.map((u) => u.id)
  const [voci, persone, valori, storico] = await Promise.all([caricaVociMensili(), caricaPersone(ids), caricaValoriMesi(mesi, ids), caricaStorico(mesi, ids)])
  const [citta, posizione] = soloUfficio
    ? await Promise.all([caricaTotaliMensiliCitta(mesi, colonneMensili(voci)), caricaPosizioneMensileCitta(mesi.slice(-2))])
    : [null, null]
  const ultimo = mesi[mesi.length - 1]
  return {
    voci, mesi, citta, posizione,
    uffici: uffici.map((ufficio) => {
      const suePersone = persone.filter((p) => p.ufficio_id === ufficio.id)
      const suoiValori = valori.filter((v) => v.ufficio_id === ufficio.id)
      const suoStorico = storico.filter((s) => s.ufficio_id === ufficio.id)
      const perMese = mesi.map((m) => totaleConStorico(suePersone, suoiValori, m, voci, suoStorico))
      const daStorico = perMese[perMese.length - 1].daStorico
      return {
        ufficio, daStorico, totali: perMese.map((x) => x.totale),
        stato: daStorico ? 'completo' : statoMensile(suePersone.filter((p) => inServizio(p, ultimo)), suoiValori.filter((v) => v.mese === ultimo), voci),
      }
    }),
  }
}

export default function Riunione({ ctx }: { ctx: Contesto }) {
  const [periodo, setPeriodo] = useState<Periodo>(periodoPredefinito)
  const [areaFiltro, setAreaFiltro] = useState<number | 'tutte'>('tutte')
  const [attiva, setAttiva] = useState(false)

  // Chi vede cosa: l'ufficio solo sé stesso, l'affiliato i suoi uffici (anche di città diverse),
  // gli amministratori la città scelta
  const amministrazione = isAmministratore(ctx.utente)
  const soloUfficio = ctx.utente.ruolo === 'ufficio'
  const visibili = ufficiVisibili(ctx)
  const tutti = soloUfficio ? visibili.filter((u) => u.id === ctx.utente.ufficio_id) : visibili
  const uffici = areaFiltro === 'tutte' ? tutti : tutti.filter((u) => u.area_id === areaFiltro)
  const ids = uffici.map((u) => u.id)
  const areeCitta = soloUfficio || isAffiliato(ctx.utente) ? [] : ctx.aree.filter((a) => a.citta_id === ctx.cittaId)
  const nomeCitta = ctx.citta.find((c) => c.id === ctx.cittaId)?.nome ?? ''
  const nomeGruppo = soloUfficio ? (tutti[0]?.nome ?? 'Il mio ufficio') : isAffiliato(ctx.utente) ? 'I miei uffici' : nomeCitta
  const titolo = areaFiltro === 'tutte' ? nomeGruppo : `${nomeGruppo} · ${nomeArea(ctx, areaFiltro)}`
  const nomePresentazione = amministrazione ? 'Riunione' : 'Presentazione'

  // Il mese usa i rapportini mensili; la settimana i rapportini settimanali.
  // Passando a "Mese" si parte dal mese appena concluso, come nel Report mensile (a ottobre, settembre).
  const mensile = MENSILE_ATTIVO && periodo.tipo === 'mese'
  const cambiaPeriodo = (p: Periodo) => setPeriodo(MENSILE_ATTIVO && p.tipo === 'mese' && periodo.tipo === 'settimana'
    ? { tipo: 'mese', settimana: settimaneDelMese(mesePredefinito().slice(0, 7))[0] } : p)
  const mesi = Array.from({ length: STORICO.mese }, (_, i) => `${aggiungiMesi(meseDellaSettimana(periodo.settimana), i - STORICO.mese + 1)}-01`)
  const caricoMese = useDati<DatiMensili | null>(async () => (mensile ? caricaDatiMensili(mesi, uffici, soloUfficio) : null),
    [mensile, mesi.join(','), ids.join(','), soloUfficio])

  const periodi = periodiStorico(periodo)
  const correnti = periodi[periodi.length - 1]
  const caricoSettimane = useDati<DatiRiunione | null>(async () => {
    if (mensile) return null
    const [dati, note, citta, posizione] = await Promise.all([
      caricaRilevazioni(periodi[0][0], correnti[correnti.length - 1], ids),
      caricaNote(correnti, ids),
      soloUfficio ? caricaTotaliCitta(periodi) : null,     // un ufficio vede anche come va tutta la sua città
      soloUfficio ? caricaPosizioneCitta(periodi.slice(-2)) : null,   // e la sua posizione (periodo presentato e quello prima)
    ])
    return { dati, note, citta, posizione }
  }, [mensile, periodi[0][0], correnti.join(','), ids.join(','), soloUfficio])

  const carico = mensile ? caricoMese : caricoSettimane
  const datiMese = mensile ? caricoMese.dati : null
  const datiSettimane = mensile ? null : caricoSettimane.dati
  const pronto = !!(datiMese ?? datiSettimane)
  const diapositive = datiMese ? costruisciDiapositiveMensili({ periodo, titolo, nomePresentazione, nomeCitta, ...datiMese })
    : datiSettimane ? costruisciDiapositive({ ctx, uffici, periodo, periodi, titolo, nomePresentazione, nomeCitta, ...datiSettimane }) : []
  const daControllare = settimaneDaControllare(correnti)
  const compilati = datiMese ? datiMese.uffici.filter((u) => u.stato !== 'mancante').length
    : datiSettimane ? uffici.filter((u) => statoCompilazionePeriodo(datiSettimane.dati.filter((r) => r.ufficio_id === u.id), ctx.metriche, daControllare) !== 'mancante').length
    : null
  const cittaPerUfficio = !!(datiMese?.citta ?? datiSettimane?.citta)
  const marchio = `${titolo} · ${periodo.tipo === 'settimana' ? intervalloSettimana(periodo.settimana) : descriviPeriodo(periodo)}`

  function avvia() {
    setAttiva(true)
    document.documentElement.requestFullscreen?.().catch(() => { /* il browser può rifiutare: si resta in finestra */ })
  }
  const esci = useCallback(() => {
    setAttiva(false)
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }, [])

  if (attiva && diapositive.length > 0) {
    return <Presentazione diapositive={diapositive} marchio={marchio} onEsci={esci} />
  }

  return (
    <div className="due-colonne entra">
      <section className="scheda" style={{ gap: 18 }}>
        <span className="kicker">{amministrazione ? 'Modalità riunione' : 'Presentazione'}</span>
        <h1 className="titolo-pagina">{amministrazione ? `${nomeCitta}, lunedì mattina` : nomeGruppo}</h1>
        <p style={{ fontSize: 18 }}>
          {amministrazione ? 'Una presentazione a tutto schermo da proiettare in riunione:'
            : `Una presentazione a tutto schermo con i dati ${soloUfficio ? 'del tuo ufficio' : 'dei tuoi uffici'}, settimanali o mensili:`}
        </p>
        {mensile ? (
          <ul className="elenco-icone">
            <li><Icona nome="sigma" />i numeri dei <strong>rapportini mensili</strong>: {soloUfficio ? 'totali dell\'ufficio' : amministrazione ? 'totali della città' : 'totali dei tuoi uffici'} voce per voce, con il confronto sul mese prima e gli ultimi 6 mesi;</li>
            {cittaPerUfficio && <li><Icona nome="buildings" />come va tutta {nomeCitta}: i totali di tutti gli uffici della città, senza i numeri dei singoli;</li>}
            <li><Icona nome="funnel" />imbuto della vendita degli ultimi {MESI_IMBUTO} mesi: dalle acquisizioni alle vendite, con i passaggi tra una fase e l'altra;</li>
            {uffici.length > 1 && <li><Icona nome="ranking" />classifiche degli uffici su {CLASSIFICHE_MENSILI.length} voci (acquisizioni, appuntamenti, incarichi, proposte, accettazioni, vendite).</li>}
          </ul>
        ) : (
          <ul className="elenco-icone">
            <li><Icona nome="sigma" />{soloUfficio ? 'totali dell\'ufficio' : amministrazione ? 'totali della città' : 'totali dei tuoi uffici'}, con il confronto sul periodo prima;</li>
            {cittaPerUfficio && <li><Icona nome="buildings" />come va tutta {nomeCitta}: i totali di tutti gli uffici della città, senza i numeri dei singoli;</li>}
            <li><Icona nome="funnel" />imbuto della vendita delle ultime {SETTIMANE_IMBUTO} settimane: dalle valutazioni alle vendite;</li>
            {uffici.length > 1 && <li><Icona nome="ranking" />classifiche per ogni attività;</li>}
            <li><Icona nome="chart-pie-slice" />quota di mercato;</li>
            {AREE_ATTIVE && areeCitta.length > 0 && <li><Icona nome="map-trifold" />confronto tra aree;</li>}
            <li><Icona nome="storefront" />{uffici.length > 1 ? 'una pagina per ogni ufficio, con le sue note.' : 'la pagina dell\'ufficio, con le sue note e l\'andamento.'}</li>
          </ul>
        )}
        <p className="piccolo" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
          Durante la presentazione: <kbd>→</kbd> o <kbd>spazio</kbd> avanti, <kbd>←</kbd> indietro, <kbd>Esc</kbd> per uscire.
        </p>
      </section>
      <section className="scheda entra entra-1" style={{ gap: 22 }}>
        <h2>Cosa presentare</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignSelf: 'flex-start' }}>
          <SceltaPeriodo periodo={periodo} onCambia={cambiaPeriodo} />
          <strong style={{ fontSize: 18 }}>{descriviPeriodo(periodo)}</strong>
          {mensile && <span className="piccolo">Il mese usa i numeri dei rapportini mensili (per i mesi prima della piattaforma, il file Excel annuale).{mesi[mesi.length - 1] >= meseAttuale() ? ' Il mese non è ancora finito.' : ''}</span>}
          {periodo.tipo === 'mese' && !mensile && <span className="piccolo">Il mese somma le settimane che hanno il giovedì nel mese ({correnti.length} settimane).{meseInCorso(correnti) ? ' Il mese non è ancora finito.' : ''}</span>}
        </div>
        {areeCitta.length > 0 && (
          <div className="campo">
            <label htmlFor="area-riunione">Uffici da includere</label>
            <select id="area-riunione" value={areaFiltro} onChange={(e) => setAreaFiltro(e.target.value === 'tutte' ? 'tutte' : Number(e.target.value))}>
              <option value="tutte">Tutta la città ({tutti.length} uffici)</option>
              {areeCitta.map((a) => <option key={a.id} value={a.id}>Solo {a.nome}</option>)}
            </select>
          </div>
        )}
        <div className="contatori">
          <div><strong>{pronto ? diapositive.length : '…'}</strong><span className="piccolo">pagine</span></div>
          <div><strong>{compilati === null ? '…' : `${compilati} / ${uffici.length}`}</strong><span className="piccolo">{uffici.length === 1 ? 'ufficio' : 'uffici'} con {mensile ? 'il rapportino mensile inserito' : 'i dati inseriti'}</span></div>
        </div>
        <div>
          <button className="btn btn-primario btn-grande" onClick={avvia} disabled={!pronto || uffici.length === 0}>
            <Icona nome={carico.caricamento ? 'circle-notch' : 'play'} className={carico.caricamento ? 'gira' : ''} />
            {carico.caricamento ? 'Preparazione…' : 'Avvia la presentazione'}
          </button>
        </div>
        {carico.errore && <p className="errore">Impossibile caricare i dati: {carico.errore}</p>}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- Presentazione

function Presentazione({ diapositive, marchio, onEsci }: { diapositive: Diapositiva[]; marchio: string; onEsci: () => void }) {
  const [indice, setIndice] = useState(0)
  const totale = diapositive.length
  const t = useProgresso(indice)
  const vai = useCallback((n: number) => setIndice((i) => Math.min(totale - 1, Math.max(0, i + n))), [totale])

  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'SELECT') return
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); vai(1) }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); vai(-1) }
      else if (e.key === 'Home') setIndice(0)
      else if (e.key === 'End') setIndice(totale - 1)
      else if (e.key === 'Escape') onEsci()
    }
    window.addEventListener('keydown', tasto)
    return () => window.removeEventListener('keydown', tasto)
  }, [vai, totale, onEsci])

  const d = diapositive[Math.min(indice, totale - 1)]
  return (
    <div className="presentazione">
      <header className="pres-testata">
        <div className="pres-testata-riga">
          <Logo dimensione={36} />
          <div className="pres-titoli">
            <span className="pres-marchio">{marchio}</span>
            <h2>{d.titolo}</h2>
          </div>
          <span className="pres-conta">{indice + 1} / {totale}</span>
          <button className="pres-esci" onClick={onEsci} aria-label="Esci dalla presentazione"><Icona nome="x" />Esci</button>
        </div>
        <div className="pres-avanzamento"><div style={{ width: `${(indice + 1) / totale * 100}%` }} /></div>
      </header>
      <main className="pres-corpo">
        <div key={indice} className="entra" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>{d.contenuto(t)}</div>
      </main>
      <footer className="pres-piede">
        <button className="btn btn-icona" onClick={() => vai(-1)} disabled={indice === 0} aria-label="Indietro"><Icona nome="caret-left" /></button>
        <select value={indice} onChange={(e) => setIndice(Number(e.target.value))} aria-label="Vai alla pagina">
          {diapositive.map((x, i) => <option key={i} value={i}>{i + 1}. {x.titolo}</option>)}
        </select>
        <button className="btn btn-icona" onClick={() => vai(1)} disabled={indice === totale - 1} aria-label="Avanti"><Icona nome="caret-right" /></button>
        <span className="piccolo">← → per sfogliare · Esc per uscire</span>
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------- Costruzione delle pagine

const CLASSE_MOSAICO: Record<Stato, string> = { completo: 'm-completo', parziale: 'm-parziale', mancante: 'm-mancante' }
const SIMBOLO_MOSAICO: Record<Stato, string> = { completo: '✓', parziale: '◐', mancante: '✗' }
const VERDE_CHIARO = '#8FE0B4', ROSA = '#FFB3A8'

/** Settimane su cui giudicare la compilazione: in un mese non ancora finito, solo quelle già concluse */
function settimaneDaControllare(settimane: string[]): string[] {
  const concluse = settimane.filter((s) => s <= ultimaSettimanaConclusa())
  return concluse.length > 0 ? concluse : settimane
}

function meseInCorso(settimane: string[]): boolean {
  return settimane.length > 1 && settimane[settimane.length - 1] > ultimaSettimanaConclusa()
}

/** Valori periodo per periodo di una voce (per i grafici di andamento) */
const serieDi = (andamento: Totali[], codice: string) => andamento.map((t) => t.get(codice) ?? { obiettivo: null, risultato: null })

function costruisciDiapositive({ ctx, uffici, periodo, periodi, titolo, nomePresentazione, nomeCitta, dati, note, citta, posizione }: {
  ctx: Contesto; uffici: Ufficio[]; periodo: Periodo; periodi: string[][]; titolo: string; nomePresentazione: string; nomeCitta: string
  dati: Rilevazione[]; note: Nota[]; citta: TotaliCitta | null     // citta: totali di tutta la città, solo per un ufficio
  posizione: PosizioniCitta | null                                 // posizione nella città, solo per un ufficio
}): Diapositiva[] {
  const attivita: Metrica[] = ctx.metriche.filter((m) => m.tipo === 'attivita')
  const parole = paroleDelPeriodo(periodo)
  const correnti = periodi[periodi.length - 1]
  const obiettivoDi = uffici.length === 1 ? 'dell\'ufficio' : nomePresentazione === 'Riunione' ? 'della città' : 'complessivo dei tuoi uffici'
  const etichetteBrevi = periodi.map((p) => periodo.tipo === 'settimana' ? etichettaBreve(p[0]) : nomeMeseBreve(meseDellaSettimana(p[0])))
  const nelPeriodo = (settimane: string[]) => { const s = new Set(settimane); return dati.filter((r) => s.has(r.settimana)) }
  // Andamento periodo per periodo di un gruppo di uffici (attività sommate, zona all'ultima settimana)
  const andamento = (lista: Ufficio[]) => {
    const ids = new Set(lista.map((u) => u.id))
    return totaliPerPeriodi(dati.filter((r) => ids.has(r.ufficio_id)), ctx.metriche, periodi)
  }

  const diQuesto = nelPeriodo(correnti)
  const totali = totaliPerUfficio(diQuesto, ctx.metriche)
  const totaliPrec = totaliPerUfficio(nelPeriodo(periodi[periodi.length - 2]), ctx.metriche)
  const somma = (t: Map<number, Totali>, lista: Ufficio[]) => sommaTotali(lista.map((u) => t.get(u.id)).filter((x): x is Totali => !!x))
  const totaleCitta = somma(totali, uffici)
  const quotaCitta = quotaDaTotali(totaleCitta)
  const daControllare = settimaneDaControllare(correnti)
  const stati = new Map(uffici.map((u) => [u.id, statoCompilazionePeriodo(diQuesto.filter((r) => r.ufficio_id === u.id), ctx.metriche, daControllare)]))
  const mancanti = uffici.filter((u) => stati.get(u.id) === 'mancante').map((u) => u.nome)
  const compilati = uffici.length - mancanti.length

  const ordinati = [...uffici].sort((a, b) => nomeArea(ctx, a.area_id).localeCompare(nomeArea(ctx, b.area_id)) || a.nome.localeCompare(b.nome))
  const idAree = [...new Set(uffici.map((u) => u.area_id))]
  const out: Diapositiva[] = []

  // 1. Copertina
  const statCopertina = (nome: string, codice: string) => {
    const x = totaleCitta.get(codice)
    const r = raggiungimento(x)
    return { nome, valore: (t: number) => x?.risultato != null ? conta(x.risultato, t) : '—', sotto: x?.obiettivo ? `obiettivo ${x.obiettivo} · ${formattaPercentuale(r)}` : '', ok: r !== null && r >= 1 }
  }
  const statistiche = [statCopertina('Incarichi', 'incarichi'), statCopertina('Vendite', 'vendite')]

  // Portafoglio: totale degli uffici e variazione sul periodo prima (solo uffici con il dato in entrambi)
  const portafoglio = totaleCitta.get('portafoglio')?.risultato ?? null
  const { variazione: variazionePortafoglio, confrontati, conDato } = variazioneZona(uffici, totali, totaliPrec, 'portafoglio')
  const testoVariazione = variazionePortafoglio === null ? parole.nessunConfronto
    : `${variazionePortafoglio === 0 ? 'invariato' : formattaEsito(variazionePortafoglio)} ${parole.prima}`
      + (confrontati < conDato ? ` (su ${confrontati} uffici)` : '')
  const colorePortafoglio = variazionePortafoglio === null || variazionePortafoglio === 0 ? '#AFC0D4' : variazionePortafoglio > 0 ? VERDE_CHIARO : ROSA
  out.push({
    titolo: `${nomePresentazione} ${parole.aggettivo}`,
    contenuto: (t) => (
      <div className="copertina" style={{ flex: 1 }}>
        <div className="cerchio cerchio-a" /><div className="cerchio cerchio-b" />
        <div>
          <div className="cop-marchio"><Logo dimensione={44} />{nomePresentazione} {parole.aggettivo} · Gruppo CEC</div>
          <h1 className="cop-citta">{titolo}</h1>
          <span className="cop-settimana">{descriviPeriodo(periodo)}{meseInCorso(correnti) ? ' · mese in corso' : ''}</span>
          <div className="cop-stats">
            {statistiche.map((s) => (
              <div key={s.nome} className="cop-stat">
                <span>{s.nome}</span><strong>{s.valore(t)}</strong><span style={{ color: s.ok ? VERDE_CHIARO : ROSA }}>{s.sotto}</span>
              </div>
            ))}
            <div className="cop-stat">
              <span>Portafoglio</span><strong>{portafoglio === null ? '—' : conta(portafoglio, t)}</strong>
              <span style={{ color: colorePortafoglio }}>{testoVariazione}</span>
            </div>
            <div className="cop-stat">
              <span>Quota di mercato</span><strong>{formattaPercentuale(quotaCitta === null ? null : quotaCitta * t)}</strong>
              <span style={{ color: quotaCitta !== null && quotaCitta >= OBIETTIVO_QUOTA ? VERDE_CHIARO : ROSA }}>obiettivo {formattaPercentuale(OBIETTIVO_QUOTA)}</span>
            </div>
          </div>
        </div>
        <div style={{ gap: 22 }}>
          <div className="anello-riga">
            <div className="anello" style={{ background: `conic-gradient(var(--secondario) ${uffici.length ? compilati / uffici.length * 360 * t : 0}deg, rgba(255,255,255,.12) 0)` }}>
              <div><strong>{conta(compilati, t)}</strong><span>su {uffici.length} {uffici.length === 1 ? 'ufficio' : 'uffici'}</span></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200, flex: 1 }}>
              <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{uffici.length === 1 ? 'ha' : 'hanno'} inserito i dati {parole.delPeriodo}</span>
              {mancanti.length > 0 && <span style={{ fontSize: 17, color: ROSA }}>Mancano: {mancanti.join(', ')}</span>}
            </div>
          </div>
          {uffici.length > 1 && (
            <div className="mosaico">
              {uffici.map((u) => {
                const s = stati.get(u.id)!
                return <div key={u.id} className={CLASSE_MOSAICO[s]} title={u.nome}><span>{u.nome}</span><span>{SIMBOLO_MOSAICO[s]}</span></div>
              })}
            </div>
          )}
          {uffici.length > 1 && (
            <div style={{ display: 'flex', gap: 18, fontSize: 13, fontWeight: 600, color: '#AFC0D4' }}>
              {periodo.tipo === 'settimana'
                ? <><span>✓ completo</span><span>◐ parziale</span><span>✗ mancante</span></>
                : <><span>✓ tutte le settimane complete</span><span>◐ in parte</span><span>✗ nessun dato nel mese</span></>}
            </div>
          )}
        </div>
      </div>
    ),
  })

  // 2. Totali della città (o dei propri uffici) con confronto sul periodo precedente
  const nomePortafoglio = ctx.metriche.find((m) => m.codice === 'portafoglio')?.nome ?? 'Portafoglio'
  const comuni = { attivita, parole, periodo, etichette: etichetteBrevi, nomePortafoglio }
  out.push(paginaTotali({
    ...comuni, titolo: `Totali · ${titolo}`, andamento: andamento(uffici), obiettivoDi,
    portafoglioPrima: { variazione: variazionePortafoglio, confrontati, conDato },
  }))

  // 2 bis. Per un ufficio: come va tutta la sua città (solo le somme, dal database)
  if (citta) {
    out.push(paginaTotali({
      ...comuni, titolo: `Totali · Tutta ${nomeCitta}`, andamento: citta.andamento, obiettivoDi: 'della città',
      portafoglioPrima: citta.zona.get('portafoglio') ?? { variazione: null, confrontati: 0, conDato: 0 },
      nota: `Somma di tutti gli uffici di ${nomeCitta}: ${citta.ufficiConDati} su ${citta.ufficiCitta} hanno inserito dati ${parole.delPeriodo}. I numeri dei singoli uffici non si vedono.`,
    }))
  }

  // 2 quater. Per un ufficio: la sua posizione nella città, voce per voce (solo la sua riga, dal database)
  if (posizione) {
    out.push(paginaPosizione({
      nomeCitta, posizioni: posizione.voci, prima: periodo.tipo === 'settimana' ? 'della settimana prima' : 'del mese prima',
      voci: [...attivita.filter((m) => inClassifica(m.codice)).map((m) => ({ codice: m.codice, nome: m.nome })), { codice: '__quota', nome: 'Quota di mercato' }],
      extra: `Numeri ${parole.delPeriodo}.`,
    }))
  }

  // 2 ter. Imbuto della vendita sulle ultime settimane (con una sola settimana i numeri sono troppo piccoli)
  const settimaneImbuto = periodi.flat().slice(-SETTIMANE_IMBUTO)
  const totaliImbuto = totaliPerUfficio(nelPeriodo(settimaneImbuto), ctx.metriche)
  const risultatiDi = (t: Totali | undefined) => new Map(codiciImbuto(IMBUTO_SETTIMANALE).map((c) => [c, t?.get(c)?.risultato ?? null]))
  const valoriCittaImbuto = citta ? sommaPeriodi(citta.andamento.slice(-SETTIMANE_IMBUTO).map(risultatiDi), codiciImbuto(IMBUTO_SETTIMANALE)) : null
  const valoriGruppoImbuto = risultatiDi(somma(totaliImbuto, uffici))
  const periodoImbuto = `Ultime ${settimaneImbuto.length} settimane (${intervalloSettimane(settimaneImbuto[0], settimaneImbuto[settimaneImbuto.length - 1])})`
  out.push(...pagineImbuto({
    def: IMBUTO_SETTIMANALE, nomeGruppo: titolo,
    gruppo: valoriGruppoImbuto,
    perUfficio: uffici.map((u) => ({ nome: u.nome, valori: risultatiDi(totaliImbuto.get(u.id)) })),
    citta: valoriCittaImbuto,
    nomeCitta,
    periodo: `${periodoImbuto}, rapportini settimanali`,
    tabellaUffici: false,     // l'imbuto di ogni ufficio è già nella sua pagina
  }))
  // Nelle pagine dei singoli uffici l'imbuto si confronta con tutta la città (per un ufficio) o con il totale del gruppo
  const riferimentoImbuto = calcolaImbuto(IMBUTO_SETTIMANALE, valoriCittaImbuto ?? valoriGruppoImbuto)
  const nomeRiferimentoImbuto = valoriCittaImbuto ? nomeCitta : titolo

  // 3. Classifiche, due attività per pagina (solo quelle con almeno un risultato; servono almeno due uffici)
  const compatta = uffici.length > 16
  const conDati = uffici.length > 1 ? attivita.filter((m) => inClassifica(m.codice) && classifica(uffici, totali, m.codice).length > 0) : []
  for (let i = 0; i < conDati.length; i += 2) {
    const coppia = conDati.slice(i, i + 2)
    out.push({
      titolo: `Classifica · ${coppia.map((m) => m.nome).join(' e ')}`,
      contenuto: (t) => (
        <div className={`classifiche ${compatta ? 'compatta' : ''}`}>
          {coppia.map((m) => {
            const voci = classifica(uffici, totali, m.codice)
            const max = Math.max(1, ...voci.map((v) => Math.max(v.valore, v.totale?.obiettivo ?? 0)))
            return (
              <div key={m.codice} className="p-card" style={{ gap: compatta ? 2 : 6 }}>
                <h3>{m.nome}</h3>
                {voci.map((v) => {
                  const ob = v.totale?.obiettivo ?? null
                  const ok = ob !== null && v.valore >= ob
                  return (
                    <div key={v.ufficio.id} className="barra-classifica">
                      <span title={v.ufficio.nome}>{v.ufficio.nome}</span>
                      <div className="pista"><div style={{ width: `${v.valore / max * 100 * t}%`, background: ok ? 'var(--primario)' : 'var(--secondario-400)' }} /></div>
                      <span style={{ color: ok ? 'var(--primario-800)' : 'var(--secondario-800)' }}>{ob !== null ? `${v.valore} / ${ob} ${ok ? '✓' : '✗'}` : v.valore}</span>
                    </div>
                  )
                })}
                <p className="piccolo" style={{ marginTop: 12 }}>Valore {parole.delPeriodo} · "/ n" = obiettivo dell'ufficio · ✓ raggiunto ✗ non raggiunto</p>
              </div>
            )
          })}
        </div>
      ),
    })
  }

  // 4. Quota di mercato (classifica: servono almeno due uffici)
  const quote = classificaQuota(uffici, totali)
  if (quote.length > 1) {
    const max = Math.max(0.3, ...quote.map((q) => q.quota))
    out.push({
      titolo: 'Quota di mercato',
      contenuto: (t) => (
        <div className={`p-card ${compatta ? 'compatta' : ''}`} style={{ maxWidth: 1200, gap: compatta ? 2 : 8 }}>
          <p style={{ fontSize: 17, fontWeight: 600, color: '#3A4250', marginBottom: 14 }}>
            Portafoglio ÷ Incarichi in zona · linea = obiettivo {formattaPercentuale(OBIETTIVO_QUOTA)} · {quote.filter((q) => q.quota >= OBIETTIVO_QUOTA).length} uffici sopra l'obiettivo
          </p>
          {quote.map((q) => {
            const ok = q.quota >= OBIETTIVO_QUOTA
            return (
              <div key={q.ufficio.id} className="barra-classifica">
                <span title={q.ufficio.nome}>{q.ufficio.nome}</span>
                <div className="pista">
                  <div style={{ width: `${q.quota / max * 100 * t}%`, background: ok ? 'var(--ok)' : 'var(--ko)' }} />
                  <div className="rif" style={{ left: `${OBIETTIVO_QUOTA / max * 100}%` }} />
                </div>
                <span style={{ fontWeight: 800 }} className={ok ? 't-verde' : 't-rosso'}>{formattaPercentuale(q.quota)}</span>
              </div>
            )
          })}
        </div>
      ),
    })
  }

  // 5. Confronto tra aree
  if (idAree.length > 1) {
    out.push({
      titolo: 'Confronto tra aree',
      contenuto: () => (
        <div className="p-card">
          <div className="tabella-scorrevole">
            <table className="tabella tabella-dia">
              <thead><tr><th>Area</th>{attivita.map((m) => <th key={m.codice} className="destra">{m.nome}</th>)}<th className="destra">Quota</th></tr></thead>
              <tbody>
                {[...idAree].sort((a, b) => nomeArea(ctx, a).localeCompare(nomeArea(ctx, b))).map((id) => {
                  const t = somma(totali, uffici.filter((u) => u.area_id === id))
                  return (
                    <tr key={String(id)}>
                      <th scope="row">{nomeArea(ctx, id)} <span className="piccolo">({uffici.filter((u) => u.area_id === id).length} uff.)</span></th>
                      {attivita.map((m) => <CellaRisultato key={m.codice} totale={t.get(m.codice)} />)}
                      <CellaQuota quota={quotaDaTotali(t)} />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ),
    })
  }

  // 6. Una pagina per ufficio
  for (const u of ordinati) {
    const tu = totali.get(u.id)
    const noteUfficio = note.filter((n) => n.ufficio_id === u.id)
    const andamentoUfficio = andamento([u])
    const imbutoUfficio = calcolaImbuto(IMBUTO_SETTIMANALE, risultatiDi(totaliImbuto.get(u.id)))
    const s = stati.get(u.id)!
    const ultimo = diQuesto.filter((r) => r.ufficio_id === u.id && r.aggiornato_il).sort((a, b) => b.aggiornato_il!.localeCompare(a.aggiornato_il!))[0]
    const raggiunti = attivita.filter((m) => { const x = tu?.get(m.codice); return x?.obiettivo != null && x.risultato != null && x.risultato >= x.obiettivo }).length
    const quota = quotaDaTotali(tu)
    const qOk = quota !== null && quota >= OBIETTIVO_QUOTA
    const minis = [
      ...attivita.map((m) => {
        const valori = serieDi(andamentoUfficio, m.codice)
        const ul = valori[valori.length - 1]
        return { nome: m.nome, valore: ul.risultato === null ? '—' : `${ul.risultato}${ul.obiettivo !== null ? ` / ${ul.obiettivo}` : ''}`, ris: valori.map((x) => x.risultato), ob: valori.map((x) => x.obiettivo), pct: false }
      }),
      { nome: 'Quota di mercato', valore: formattaPercentuale(quota), ris: andamentoUfficio.map(quotaDaTotali), ob: undefined, pct: true },
    ]
    out.push({
      titolo: u.nome,
      contenuto: (t) => (
        <div className="p-colonna">
          <div className="ufficio-riquadri">
            <div className="p-card" style={{ gap: 12 }}>
              <span className="p-etichetta">Compilazione{AREE_ATTIVE ? ` · ${nomeArea(ctx, u.area_id)}` : ''}</span>
              <BadgeStato stato={s} grande />
              <span className="piccolo">{ultimo ? `Salvato ${new Date(ultimo.aggiornato_il!).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}${ultimo.aggiornato_da ? ` da ${nomeDaEmail(ultimo.aggiornato_da)}` : ''}` : 'Nessun dato inserito'}</span>
            </div>
            <div className="p-card">
              <span className="p-etichetta">Obiettivi raggiunti</span>
              <strong className="p-grande">{conta(raggiunti, t)} su {attivita.length}</strong>
              <div className="barra"><div className="pieno-verde" style={{ width: `${raggiunti / attivita.length * 100 * t}%` }} /></div>
            </div>
            <div className="p-card" style={{ background: quota === null ? '#fff' : qOk ? 'var(--ok-bg)' : 'var(--ko-bg)' }}>
              <span className="p-etichetta">Quota di mercato</span>
              <strong className={`p-grande ${quota === null ? '' : qOk ? 't-verde' : 't-rosso'}`}>{formattaPercentuale(quota === null ? null : quota * t)}</strong>
              <span style={{ fontSize: 14, fontWeight: 600 }} className={quota === null ? 'piccolo' : qOk ? 't-verde' : 't-rosso'}>
                {quota === null ? 'dati di zona mancanti' : qOk ? '✓ sopra l\'obiettivo del 20%' : '✗ sotto l\'obiettivo del 20%'}
              </span>
            </div>
            <div className="p-card">
              <span className="p-etichetta">Dati di zona</span>
              <div className="zona-numeri">
                <div><strong>{tu?.get('portafoglio')?.risultato ?? '—'}</strong><span>portafoglio</span></div>
                <div><strong>{tu?.get('incarichi_zona')?.risultato ?? '—'}</strong><span>incarichi in zona</span></div>
              </div>
            </div>
          </div>
          <div className="ufficio-colonne">
            <div className="p-colonna">
              <div className="p-card" style={{ padding: '10px 20px 14px' }}>
                <table className="tabella tabella-dia">
                  <thead><tr><th>Attività</th><th className="destra">Obiettivo</th><th className="destra">Risultato</th><th className="destra">Esito</th></tr></thead>
                  <tbody>
                    {attivita.map((m) => {
                      const x = tu?.get(m.codice)
                      const e = esito(x?.obiettivo ?? null, x?.risultato ?? null)
                      return (
                        <tr key={m.codice}>
                          <td style={{ fontWeight: 600 }}>{m.nome}</td>
                          <td className="destra" style={{ color: 'var(--testo-3)' }}>{x?.obiettivo ?? '—'}</td>
                          <td className="destra" style={{ fontWeight: 800 }}>{x?.risultato ?? '—'}</td>
                          <td className="destra"><span className={`pillola-esito ${e === null ? '' : e >= 0 ? 'positivo' : 'negativo'}`} style={{ fontWeight: 800 }}>{formattaEsito(e)}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-card nota-card">
                <Icona nome="quotes" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="p-etichetta" style={{ color: 'var(--secondario-800)' }}>Note dell'ufficio</span>
                  {noteUfficio.length === 0 && <p style={{ color: 'var(--testo-tenue)' }}>{parole.nessunaNota}</p>}
                  {noteUfficio.map((n) => (
                    <div key={n.settimana} className="nota-righe">
                      {periodo.tipo === 'mese' && <strong style={{ color: 'var(--secondario-800)' }}>Settimana del {etichettaBreve(n.settimana)}</strong>}
                      {n.testo.trim() && <p style={{ color: 'var(--testo)' }}>“{n.testo}”</p>}
                      {CASELLE_NOTA.filter(({ campo }) => n[campo].trim()).map(({ campo, nome }) => (
                        <p key={campo} className={campo === 'aiuto' ? 'nota-aiuto' : ''} style={campo === 'aiuto' ? undefined : { color: 'var(--testo)' }}>
                          <span className="nota-etichetta">{nome.replace(/…$/, '')}: </span>{n[campo]}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-card" style={{ gap: 14 }}>
              <div className="scheda-titolo">
                <h3 style={{ fontSize: 22, margin: 0, marginRight: 'auto' }}>Andamento · {parole.storico.toLowerCase()}</h3>
                <span className="piccolo" style={{ fontWeight: 600 }}><span style={{ color: 'var(--primario)' }}>━</span> risultato · <span style={{ color: 'var(--secondario-500)' }}>┅</span> obiettivo</span>
              </div>
              <div className="griglia-mini">
                {minis.map((g) => (
                  <div key={g.nome} className="mini">
                    <div className="mini-testa"><strong>{g.nome}</strong><span>{g.valore}</span></div>
                    <GraficoAndamento compatto t={t} etichette={etichetteBrevi} nomeSerie={g.nome} risultati={g.ris} obiettivi={g.ob}
                      percentuale={g.pct} rigaRiferimento={g.pct ? OBIETTIVO_QUOTA : undefined} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-card">
            <span className="p-etichetta">Imbuto della vendita · {periodoImbuto.toLowerCase()}</span>
            <ImbutoInRiga imbuto={imbutoUfficio} riferimento={uffici.length > 1 || valoriCittaImbuto ? riferimentoImbuto : null} nomeRiferimento={nomeRiferimentoImbuto} />
          </div>
        </div>
      ),
    })
  }

  return out
}

/**
 * Pagina dei totali: attività rispetto all'obiettivo, quota di mercato, confronto con il periodo prima
 * e portafoglio. Serve per la città (Riunione), per i propri uffici e, per un ufficio, per tutta la sua città.
 */
function paginaTotali({ titolo, andamento, portafoglioPrima, attivita, parole, periodo, etichette, nomePortafoglio, obiettivoDi, nota }: {
  titolo: string
  andamento: Totali[]                     // un elemento per periodo, l'ultimo è quello presentato
  portafoglioPrima: { variazione: number | null; confrontati: number; conDato: number }
  attivita: Metrica[]; parole: ReturnType<typeof paroleDelPeriodo>; periodo: Periodo; etichette: string[]
  nomePortafoglio: string; obiettivoDi: string; nota?: string
}): Diapositiva {
  const totale = andamento[andamento.length - 1]
  const totalePrec = andamento[andamento.length - 2] ?? new Map()
  const quotaCitta = quotaDaTotali(totale)
  const quotaOk = quotaCitta !== null && quotaCitta >= OBIETTIVO_QUOTA
  let raggiunte = 0, su = 0, giu = 0
  const tabellone = attivita.map((m) => {
    const x = totale.get(m.codice)
    const r = raggiungimento(x)
    const prima = totalePrec.get(m.codice)?.risultato
    const diff = x?.risultato != null && prima != null ? x.risultato - prima : null
    if (r !== null && r >= 1) raggiunte++
    if (diff !== null && diff > 0) su++
    if (diff !== null && diff < 0) giu++
    return { m, x, r, diff, serie: serieDi(andamento, m.codice) }
  })
  // Portafoglio: dato di zona, senza obiettivo; stessa variazione della copertina
  const portafoglio = totale.get('portafoglio')?.risultato ?? null
  const { variazione: variazionePortafoglio, confrontati, conDato } = portafoglioPrima
  const seriePortafoglio = serieDi(andamento, 'portafoglio')
  return {
    titolo,
    contenuto: (t) => (
      <div className="p-colonna">
        <div className="sintesi-griglia">
          <div className="sintesi" style={{ background: 'var(--ok-bg)', color: 'var(--ok-fg)' }}>
            <span><Icona nome="target" /></span>
            <div><span className="p-etichetta">Obiettivi raggiunti</span><strong>{conta(raggiunte, t)} su {attivita.length}</strong><span>attività sopra l'obiettivo {obiettivoDi}</span></div>
          </div>
          <div className="sintesi" style={{ background: quotaOk ? 'var(--ok-bg)' : 'var(--ko-bg)', color: quotaOk ? 'var(--ok-fg)' : 'var(--ko-fg)' }}>
            <span><Icona nome="chart-pie-slice" /></span>
            <div><span className="p-etichetta">Quota di mercato</span><strong>{formattaPercentuale(quotaCitta)}</strong><span>{quotaCitta === null ? 'dati di zona mancanti' : quotaOk ? '✓ sopra l\'obiettivo del 20%' : '✗ sotto l\'obiettivo del 20%'}</span></div>
          </div>
          <div className="sintesi" style={{ background: 'var(--primario-100)', color: 'var(--primario-700)' }}>
            <span><Icona nome="trend-up" /></span>
            <div><span className="p-etichetta">{parole.prima.charAt(0).toUpperCase() + parole.prima.slice(1)}</span><strong>{su} ▲ · {giu} ▼</strong><span>{su} attività in crescita, {giu} in calo</span></div>
          </div>
        </div>
        <div className="p-card tabellone">
          <div className="tabellone-riga testa"><span>Attività</span><span>Risultato</span><span>Rispetto all'obiettivo</span><span style={{ textAlign: 'right' }}>%</span><span>{parole.scorso}</span><span>{parole.storico}</span></div>
          {tabellone.map(({ m, x, r, diff, serie }) => {
            const s = coloreRapporto(r)
            return (
              <div key={m.codice} className="tabellone-riga">
                <span className="nome">{m.nome}</span>
                <span className="valori"><strong>{x?.risultato != null ? conta(x.risultato, t) : '—'}</strong><span>/ {x?.obiettivo ?? '—'}</span></span>
                <div className="barra-obiettivo">
                  <div className={`pieno-${s}`} style={{ width: `${Math.min(1.3, r ?? 0) / 1.3 * 100 * t}%` }} />
                  <div className="tacca" style={{ left: `${100 / 1.3}%` }} />
                </div>
                <span className={`pct t-${s}`}>{r === null ? '—' : `${Math.round(r * 100)}%`}</span>
                <span className={`delta ${diff === null || diff === 0 ? '' : diff > 0 ? 'su' : 'giu'}`}>
                  {diff === null ? '—' : diff === 0 ? '= uguale' : `${diff > 0 ? '▲ +' : '▼ '}${diff} ${parole.vsScorso}`}
                </span>
                <GraficoAndamento spark t={t} etichette={etichette} nomeSerie={m.nome} risultati={serie.map((z) => z.risultato)} obiettivi={serie.map((z) => z.obiettivo)} />
              </div>
            )
          })}
          <div className="tabellone-riga riga-zona">
            <span className="nome">{nomePortafoglio}</span>
            <span className="valori"><strong>{portafoglio !== null ? conta(portafoglio, t) : '—'}</strong></span>
            <span className="nota-zona">dato di zona: totale degli uffici, senza obiettivo</span>
            <span />
            <span className={`delta ${variazionePortafoglio === null || variazionePortafoglio === 0 ? '' : variazionePortafoglio > 0 ? 'su' : 'giu'}`}>
              {variazionePortafoglio === null ? '—' : variazionePortafoglio === 0 ? '= uguale' : `${variazionePortafoglio > 0 ? '▲ +' : '▼ '}${variazionePortafoglio} ${parole.vsScorso}`}
            </span>
            <GraficoAndamento spark t={t} etichette={etichette} nomeSerie={nomePortafoglio} risultati={seriePortafoglio.map((z) => z.risultato)} />
          </div>
          <p className="piccolo" style={{ margin: '6px 0 10px' }}>
            La tacca scura sulla barra è l'obiettivo {obiettivoDi} (100%). Barra verde: raggiunto · ambra: almeno 70% · rossa: sotto il 70%.
            {periodo.tipo === 'mese' && ' Nel mese le attività sono la somma delle settimane; il portafoglio è quello dell\'ultima settimana inserita.'}
            {confrontati < conDato && ` Portafoglio: variazione calcolata su ${confrontati} uffici su ${conDato}, quelli che l'hanno inserito in entrambi i periodi.`}
            {nota && ` ${nota}`}
          </p>
        </div>
      </div>
    ),
  }
}

/** Pagina "La tua posizione a Roma": solo per un ufficio, con la sua posizione voce per voce */
function paginaPosizione({ nomeCitta, posizioni, voci, prima, extra }: {
  nomeCitta: string; posizioni: PosizioniCitta['voci']; voci: { codice: string; nome: string }[]; prima: string; extra: string
}): Diapositiva {
  return {
    titolo: `La tua posizione a ${nomeCitta}`,
    contenuto: () => (
      <div className="p-colonna">
        <RiquadriPosizione posizioni={posizioni} voci={voci} prima={prima} />
        <NotaPosizione nomeCitta={nomeCitta} prima={prima} extra={extra} />
      </div>
    ),
  }
}

/**
 * Pagine dell'imbuto della vendita. Con un ufficio solo: il suo imbuto accanto a quello di tutta la città.
 * Con più uffici: l'imbuto del gruppo e, se chiesto, una pagina con i passaggi ufficio per ufficio (colorati rispetto
 * al gruppo). Nella settimana non serve: ogni ufficio ha già il suo imbuto nella sua pagina (decisione di Davide).
 */
function pagineImbuto({ def, nomeGruppo, gruppo, perUfficio, citta, nomeCitta, periodo, tabellaUffici }: {
  def: DefinizioneImbuto; nomeGruppo: string; gruppo: Map<string, number | null>
  perUfficio: { nome: string; valori: Map<string, number | null> }[]
  citta: Map<string, number | null> | null       // tutta la città dell'ufficio (solo le somme), null per gli altri
  nomeCitta: string; periodo: string
  tabellaUffici: boolean                         // aggiungere la pagina "ufficio per ufficio"
}): Diapositiva[] {
  const imbutoGruppo = calcolaImbuto(def, gruppo)
  const imbutoCitta: Imbuto | null = citta ? calcolaImbuto(def, citta) : null
  const out: Diapositiva[] = [{
    titolo: 'Imbuto della vendita',
    contenuto: (t) => (
      <div className="p-colonna">
        <div className="imbuto-griglia">
          <div className="p-card">
            <GraficoImbuto t={t} titolo={nomeGruppo} imbuto={imbutoGruppo} riferimento={imbutoCitta} nomeRiferimento={nomeCitta} />
          </div>
          {imbutoCitta && (
            <div className="p-card">
              <GraficoImbuto t={t} titolo={`Tutta ${nomeCitta}`} imbuto={imbutoCitta} />
            </div>
          )}
        </div>
        <NotaImbuto periodo={periodo + (imbutoCitta ? `. In verde i passaggi almeno come tutta ${nomeCitta}, in arancio quelli sotto` : '')} />
      </div>
    ),
  }]
  if (tabellaUffici && perUfficio.length > 1) {
    const righe = perUfficio.map((u) => ({ nome: u.nome, imbuto: calcolaImbuto(def, u.valori) }))
    // tanti uffici: la tabella si divide in due colonne, così sta in una pagina
    const colonne = righe.length > 14 ? [righe.slice(0, Math.ceil(righe.length / 2)), righe.slice(Math.ceil(righe.length / 2))] : [righe]
    out.push({
      titolo: 'Imbuto della vendita · ufficio per ufficio',
      contenuto: () => (
        <div className="p-colonna">
          <div className="imbuto-tabelle">
            {colonne.map((elenco, i) => (
              <div key={i} className="p-card">
                <TabellaImbuto righe={elenco} riferimento={imbutoGruppo} nomeRiferimento={`Totale ${nomeGruppo}`} compatta={righe.length > 14} />
              </div>
            ))}
          </div>
          <NotaImbuto periodo={`${periodo}. In verde i passaggi almeno come il totale ${nomeGruppo}, in arancio quelli sotto, "—" con meno di 5 casi`} />
        </div>
      ),
    })
  }
  return out
}

// ---------------------------------------------------------------- Presentazione mensile (rapportini mensili)

/** Le voci delle classifiche mensili (decise da Davide il 21/10/2026), due per pagina */
const CLASSIFICHE_MENSILI = ['acquisizioni', 'appuntamenti_vendita', 'incarichi_vendita', 'proposte_vendita', 'accettazioni_vendita', 'vendite_effettuate']
/** I numeri della copertina mensile */
const COPERTINA_MENSILE = ['staff', 'portafoglio_vendita', 'incarichi_vendita', 'vendite_effettuate']

/** "Appuntamenti vendita", "Kiron", "Staff" */
function nomeVoceMensile(voci: VoceMensile[], codice: string): string {
  if (codice === STAFF) return 'Staff'
  const v = voci.find((x) => x.codice === codice)
  return v ? `${v.gruppo}${v.sotto ? ` ${v.sotto}` : ''}` : codice
}

/** Classe e testo della variazione sul mese prima (per le voci "meglio se scende" un aumento è in rosso) */
function deltaMensile(variazione: number | null, voce?: VoceMensile) {
  const classe = variazione === null || variazione === 0 ? '' : variazioneBuona(variazione, voce) ? 'su' : 'giu'
  const testo = variazione === null ? '—' : variazione === 0 ? '= uguale' : `${variazione > 0 ? '▲ +' : '▼ '}${formattaNumero(variazione)}`
  return { classe, testo }
}

function costruisciDiapositiveMensili({ periodo, titolo, nomePresentazione, nomeCitta, voci, mesi, uffici, citta, posizione }: DatiMensili & {
  periodo: Periodo; titolo: string; nomePresentazione: string; nomeCitta: string
}): Diapositiva[] {
  const colonne = colonneMensili(voci)
  const etichette = mesi.map((m) => nomeMeseBreve(m.slice(0, 7)))
  const gruppo = riepilogoMensile(uffici.map((u) => u.totali), colonne)
  const totale = gruppo.andamento[gruppo.andamento.length - 1]
  const inCorso = mesi[mesi.length - 1] >= meseAttuale()
  const mancanti = uffici.filter((u) => u.stato === 'mancante').map((u) => u.ufficio.nome)
  const compilati = uffici.length - mancanti.length
  const out: Diapositiva[] = []

  // 1. Copertina
  const statistiche = COPERTINA_MENSILE.filter((c) => colonne.includes(c)).map((c) => {
    const v = gruppo.variazioni.get(c)!
    const d = deltaMensile(v.variazione, voci.find((x) => x.codice === c))
    return {
      nome: nomeVoceMensile(voci, c), valore: totale.get(c) ?? null,
      sotto: v.variazione === null ? 'nessun confronto con il mese prima' : `${d.testo} rispetto al mese prima${v.confrontati < v.conDato ? ` (su ${v.confrontati} uffici)` : ''}`,
      colore: d.classe === 'su' ? VERDE_CHIARO : d.classe === 'giu' ? ROSA : '#AFC0D4',
    }
  })
  out.push({
    titolo: `${nomePresentazione} mensile`,
    contenuto: (t) => (
      <div className="copertina" style={{ flex: 1 }}>
        <div className="cerchio cerchio-a" /><div className="cerchio cerchio-b" />
        <div>
          <div className="cop-marchio"><Logo dimensione={44} />{nomePresentazione} mensile · Gruppo CEC</div>
          <h1 className="cop-citta">{titolo}</h1>
          <span className="cop-settimana">{descriviPeriodo(periodo)}{inCorso ? ' · mese in corso' : ''} · rapportini mensili</span>
          <div className="cop-stats">
            {statistiche.map((s) => (
              <div key={s.nome} className="cop-stat">
                <span>{s.nome}</span><strong>{s.valore === null ? '—' : conta(s.valore, t)}</strong><span style={{ color: s.colore }}>{s.sotto}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ gap: 22 }}>
          <div className="anello-riga">
            <div className="anello" style={{ background: `conic-gradient(var(--secondario) ${uffici.length ? compilati / uffici.length * 360 * t : 0}deg, rgba(255,255,255,.12) 0)` }}>
              <div><strong>{conta(compilati, t)}</strong><span>su {uffici.length} {uffici.length === 1 ? 'ufficio' : 'uffici'}</span></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200, flex: 1 }}>
              <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{uffici.length === 1 ? 'ha' : 'hanno'} inserito il rapportino del mese</span>
              {mancanti.length > 0 && <span style={{ fontSize: 17, color: ROSA }}>Mancano: {mancanti.join(', ')}</span>}
            </div>
          </div>
          {uffici.length > 1 && (
            <div className="mosaico">
              {uffici.map((u) => <div key={u.ufficio.id} className={CLASSE_MOSAICO[u.stato]} title={u.ufficio.nome}><span>{u.ufficio.nome}</span><span>{SIMBOLO_MOSAICO[u.stato]}</span></div>)}
            </div>
          )}
          {uffici.length > 1 && (
            <div style={{ display: 'flex', gap: 18, fontSize: 13, fontWeight: 600, color: '#AFC0D4' }}>
              <span>✓ completo</span><span>◐ parziale</span><span>✗ mancante</span>
            </div>
          )}
        </div>
      </div>
    ),
  })

  // 2. Totali voce per voce (e, per un ufficio, tutta la sua città)
  const storicoUsato = uffici.some((u) => u.daStorico)
  out.push(paginaTotaliMensili({
    titolo: `Totali · ${titolo}`, riepilogo: gruppo, voci, colonne, etichette,
    nota: storicoUsato ? `${uffici.length === 1 ? 'I numeri vengono' : 'Per alcuni uffici i numeri vengono'} dal file Excel annuale (solo il totale dell'ufficio).` : '',
  }))
  if (citta) {
    out.push(paginaTotaliMensili({
      titolo: `Totali · Tutta ${nomeCitta}`, riepilogo: citta, voci, colonne, etichette,
      nota: `Somma di tutti gli uffici di ${nomeCitta}: ${citta.ufficiConDati} su ${citta.ufficiTotali} hanno inserito il rapportino del mese. I numeri dei singoli uffici non si vedono.`,
    }))
  }

  // 2 ter. Per un ufficio: la sua posizione nella città sulle voci delle classifiche mensili
  if (posizione) {
    out.push(paginaPosizione({
      nomeCitta, posizioni: posizione.voci, prima: 'del mese prima',
      voci: CLASSIFICHE_MENSILI.map((c) => ({ codice: c, nome: nomeVoceMensile(voci, c) })),
      extra: 'Numeri dei rapportini mensili.',
    }))
  }

  // 2 bis. Imbuto della vendita sugli ultimi mesi (il mese presentato e i due prima)
  const codici = codiciImbuto(IMBUTO_MENSILE)
  const mesiImbuto = mesi.slice(-MESI_IMBUTO)
  const ultimiMesi = (andamento: TotaliMese[]) => sommaPeriodi(andamento.slice(-MESI_IMBUTO), codici)
  out.push(...pagineImbuto({
    def: IMBUTO_MENSILE, nomeGruppo: titolo,
    gruppo: ultimiMesi(gruppo.andamento),
    perUfficio: uffici.map((u) => ({ nome: u.ufficio.nome, valori: ultimiMesi(u.totali) })),
    citta: citta ? ultimiMesi(citta.andamento) : null,
    nomeCitta,
    tabellaUffici: true,      // nel mese non ci sono pagine per ufficio
    periodo: `Ultimi ${mesiImbuto.length} mesi (${titoloMese(mesiImbuto[0]).toLowerCase()} – ${titoloMese(mesiImbuto[mesiImbuto.length - 1]).toLowerCase()}), rapportini mensili`,
  }))

  // 3. Classifiche, due voci per pagina (servono almeno due uffici). Ci sono sempre: se nessuno ha
  // ancora inserito una voce, la pagina lo dice invece di sparire.
  const compatta = uffici.length > 16
  const classificaDi = (c: string) => uffici
    .map((u) => ({ ufficio: u.ufficio, valore: u.totali[u.totali.length - 1].get(c) ?? null }))
    .filter((x): x is { ufficio: Ufficio; valore: number } => x.valore !== null)
    .sort((a, b) => b.valore - a.valore || a.ufficio.nome.localeCompare(b.ufficio.nome))
  const conDati = uffici.length > 1 ? CLASSIFICHE_MENSILI.filter((c) => colonne.includes(c)) : []
  const nomeMese = descriviPeriodo(periodo).toLowerCase()
  for (let i = 0; i < conDati.length; i += 2) {
    const coppia = conDati.slice(i, i + 2)
    out.push({
      titolo: `Classifica · ${coppia.map((c) => nomeVoceMensile(voci, c)).join(' e ')}`,
      contenuto: (t) => (
        <div className={`classifiche ${compatta ? 'compatta' : ''}`}>
          {coppia.map((c) => {
            const elenco = classificaDi(c)
            const max = Math.max(1, ...elenco.map((x) => x.valore))
            return (
              <div key={c} className="p-card" style={{ gap: compatta ? 2 : 6 }}>
                <h3>{nomeVoceMensile(voci, c)}</h3>
                {elenco.length === 0 && <p style={{ fontSize: 18, color: 'var(--testo-3)' }}>Nessun ufficio ha ancora inserito questa voce per {nomeMese}.</p>}
                {elenco.map((x) => (
                  <div key={x.ufficio.id} className="barra-classifica">
                    <span title={x.ufficio.nome}>{x.ufficio.nome}</span>
                    <div className="pista"><div style={{ width: `${x.valore / max * 100 * t}%`, background: 'var(--primario)' }} /></div>
                    <span style={{ color: 'var(--primario-800)' }}>{formattaNumero(x.valore)}</span>
                  </div>
                ))}
                <p className="piccolo" style={{ marginTop: 12 }}>Totale del mese di ogni ufficio, dal rapportino mensile.</p>
              </div>
            )
          })}
        </div>
      ),
    })
  }
  return out
}

/** Pagina dei totali mensili: ogni voce con il valore del mese, il confronto con il mese prima e gli ultimi 6 mesi */
function paginaTotaliMensili({ titolo, riepilogo, voci, colonne, etichette, nota }: {
  titolo: string; riepilogo: RiepilogoMensile; voci: VoceMensile[]; colonne: string[]; etichette: string[]; nota: string
}): Diapositiva {
  const totale = riepilogo.andamento[riepilogo.andamento.length - 1]
  let su = 0, giu = 0
  const righe = colonne.map((c) => {
    const voce = voci.find((x) => x.codice === c)
    const v = riepilogo.variazioni.get(c) ?? { variazione: null, confrontati: 0, conDato: 0 }
    const d = deltaMensile(v.variazione, voce)
    if (c !== STAFF && d.classe === 'su') su++
    if (c !== STAFF && d.classe === 'giu') giu++
    return { c, nome: nomeVoceMensile(voci, c), valore: totale.get(c) ?? null, d, v, serie: riepilogo.andamento.map((x) => x.get(c) ?? null) }
  })
  const parziale = righe.some((r) => r.v.confrontati < r.v.conDato)
  const meta = Math.ceil(righe.length / 2)
  const colonna = (elenco: typeof righe, t: number) => (
    <div className="p-card tabellone">
      <div className="tabellone-riga testa"><span>Voce</span><span>Mese</span><span>Mese prima</span><span>Ultimi {etichette.length} mesi</span></div>
      {elenco.map((r) => (
        <div key={r.c} className="tabellone-riga">
          <span className="nome">{r.nome}</span>
          <span className="valori"><strong>{r.valore === null ? '—' : conta(r.valore, t)}</strong></span>
          <span className={`delta ${r.d.classe}`}>{r.d.testo}</span>
          <GraficoAndamento spark t={t} etichette={etichette} nomeSerie={r.nome} risultati={r.serie} />
        </div>
      ))}
    </div>
  )
  return {
    titolo,
    contenuto: (t) => (
      <div className="p-colonna">
        <div className="sintesi-griglia sintesi-compatta">
          <div className="sintesi" style={{ background: 'var(--primario-100)', color: 'var(--primario-700)' }}>
            <span><Icona nome="users-three" /></span>
            <div><span className="p-etichetta">Staff</span><strong>{totale.get(STAFF) == null ? '—' : conta(totale.get(STAFF)!, t)}</strong><span>persone in servizio nel mese</span></div>
          </div>
          <div className="sintesi" style={{ background: 'var(--ok-bg)', color: 'var(--ok-fg)' }}>
            <span><Icona nome="clipboard-text" /></span>
            <div><span className="p-etichetta">Rapportini inseriti</span><strong>{riepilogo.ufficiConDati} su {riepilogo.ufficiTotali}</strong><span>{riepilogo.ufficiTotali === 1 ? 'ufficio' : 'uffici'} con i numeri del mese</span></div>
          </div>
          <div className="sintesi" style={{ background: 'var(--primario-100)', color: 'var(--primario-700)' }}>
            <span><Icona nome="trend-up" /></span>
            <div><span className="p-etichetta">Rispetto al mese prima</span><strong>{su} ▲ · {giu} ▼</strong><span>{su} voci migliorate, {giu} peggiorate</span></div>
          </div>
        </div>
        <div className="tabellone-mensile">
          {colonna(righe.slice(0, meta), t)}
          {colonna(righe.slice(meta), t)}
        </div>
        <p className="piccolo">
          Numeri dei rapportini mensili.
          {parziale && ' Il confronto con il mese prima conta solo gli uffici che hanno la voce in entrambi i mesi.'}
          {' Incarichi scaduti: se aumentano è in rosso.'}
          {nota && ` ${nota}`}
        </p>
      </div>
    ),
  }
}
