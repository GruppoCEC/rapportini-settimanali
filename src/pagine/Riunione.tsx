// Modalità riunione: presentazione a tutto schermo per la riunione del lunedì.
// Gli amministratori la usano per la città; uffici e affiliati la vedono come "Presentazione",
// solo con i propri uffici (il database manda loro solo quelli). Prima di avviarla si sceglie
// se presentare una settimana o un mese (il mese somma le settimane, come nel Cruscotto).
// Si avanza con le frecce della tastiera (o i pulsanti), Esc per uscire.
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  classifica, classificaQuota, quotaDaTotali, raggiungimento, sommaTotali, statoCompilazionePeriodo,
  totaliPerPeriodi, totaliPerUfficio, variazioneZona, type StatoCompilazione as Stato, type Totali,
} from '../lib/aggregazioni'
import { esito, formattaEsito, formattaPercentuale, OBIETTIVO_QUOTA } from '../lib/calcoli'
import { AREE_ATTIVE, type Contesto, nomeArea, ufficiVisibili } from '../lib/contesto'
import { nomeDaEmail } from '../lib/account'
import { caricaNote, caricaRilevazioni, type Nota } from '../lib/dati'
import { isAffiliato, isAmministratore } from '../lib/permessi'
import {
  aggiungiMesi, aggiungiSettimane, intervalloSettimana, meseDellaSettimana, nomeMeseBreve, settimaneDelMese,
  ultimaSettimanaConclusa,
} from '../lib/settimane'
import type { Metrica, Rilevazione, Ufficio } from '../lib/tipi'
import { useDati } from '../lib/useDati'
import { BadgeStato, CellaQuota, CellaRisultato, coloreRapporto } from '../componenti/Celle'
import { GraficoAndamento } from '../componenti/Grafici'
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

interface DatiRiunione { dati: Rilevazione[]; note: Nota[] }

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

  const periodi = periodiStorico(periodo)
  const correnti = periodi[periodi.length - 1]
  const carico = useDati<DatiRiunione>(async () => {
    const [dati, note] = await Promise.all([
      caricaRilevazioni(periodi[0][0], correnti[correnti.length - 1], ids),
      caricaNote(correnti, ids),
    ])
    return { dati, note }
  }, [periodi[0][0], correnti.join(','), ids.join(',')])

  const diapositive = carico.dati ? costruisciDiapositive({ ctx, uffici, periodo, periodi, titolo, nomePresentazione, ...carico.dati }) : []
  const daControllare = settimaneDaControllare(correnti)
  const compilati = carico.dati
    ? uffici.filter((u) => statoCompilazionePeriodo(carico.dati!.dati.filter((r) => r.ufficio_id === u.id), ctx.metriche, daControllare) !== 'mancante').length
    : null
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
        <ul className="elenco-icone">
          <li><Icona nome="sigma" />{soloUfficio ? 'totali dell\'ufficio' : amministrazione ? 'totali della città' : 'totali dei tuoi uffici'}, con il confronto sul periodo prima;</li>
          {uffici.length > 1 && <li><Icona nome="ranking" />classifiche per ogni attività;</li>}
          <li><Icona nome="chart-pie-slice" />quota di mercato;</li>
          {AREE_ATTIVE && areeCitta.length > 0 && <li><Icona nome="map-trifold" />confronto tra aree;</li>}
          <li><Icona nome="storefront" />{uffici.length > 1 ? 'una pagina per ogni ufficio, con le sue note.' : 'la pagina dell\'ufficio, con le sue note e l\'andamento.'}</li>
        </ul>
        <p className="piccolo" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
          Durante la presentazione: <kbd>→</kbd> o <kbd>spazio</kbd> avanti, <kbd>←</kbd> indietro, <kbd>Esc</kbd> per uscire.
        </p>
      </section>
      <section className="scheda entra entra-1" style={{ gap: 22 }}>
        <h2>Cosa presentare</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignSelf: 'flex-start' }}>
          <SceltaPeriodo periodo={periodo} onCambia={setPeriodo} />
          <strong style={{ fontSize: 18 }}>{descriviPeriodo(periodo)}</strong>
          {periodo.tipo === 'mese' && <span className="piccolo">Il mese somma le settimane che hanno il giovedì nel mese ({correnti.length} settimane).{meseInCorso(correnti) ? ' Il mese non è ancora finito.' : ''}</span>}
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
          <div><strong>{carico.dati ? diapositive.length : '…'}</strong><span className="piccolo">pagine</span></div>
          <div><strong>{compilati === null ? '…' : `${compilati} / ${uffici.length}`}</strong><span className="piccolo">{uffici.length === 1 ? 'ufficio' : 'uffici'} con i dati inseriti</span></div>
        </div>
        <div>
          <button className="btn btn-primario btn-grande" onClick={avvia} disabled={!carico.dati || uffici.length === 0}>
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

function costruisciDiapositive({ ctx, uffici, periodo, periodi, titolo, nomePresentazione, dati, note }: {
  ctx: Contesto; uffici: Ufficio[]; periodo: Periodo; periodi: string[][]; titolo: string; nomePresentazione: string
  dati: Rilevazione[]; note: Nota[]
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
  const serie = (andamentoGruppo: Totali[], codice: string) => andamentoGruppo.map((t) => t.get(codice) ?? { obiettivo: null, risultato: null })

  const diQuesto = nelPeriodo(correnti)
  const totali = totaliPerUfficio(diQuesto, ctx.metriche)
  const totaliPrec = totaliPerUfficio(nelPeriodo(periodi[periodi.length - 2]), ctx.metriche)
  const somma = (t: Map<number, Totali>, lista: Ufficio[]) => sommaTotali(lista.map((u) => t.get(u.id)).filter((x): x is Totali => !!x))
  const totaleCitta = somma(totali, uffici)
  const totaleCittaPrec = somma(totaliPrec, uffici)
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
  const andamentoCitta = andamento(uffici)
  const serieCitta = (codice: string) => serie(andamentoCitta, codice)
  let raggiunte = 0, su = 0, giu = 0
  const tabellone = attivita.map((m) => {
    const x = totaleCitta.get(m.codice)
    const r = raggiungimento(x)
    const prima = totaleCittaPrec.get(m.codice)?.risultato
    const diff = x?.risultato != null && prima != null ? x.risultato - prima : null
    if (r !== null && r >= 1) raggiunte++
    if (diff !== null && diff > 0) su++
    if (diff !== null && diff < 0) giu++
    return { m, x, r, diff, serie: serieCitta(m.codice) }
  })
  const quotaOk = quotaCitta !== null && quotaCitta >= OBIETTIVO_QUOTA
  // Portafoglio: dato di zona, senza obiettivo; stessa variazione della copertina
  const nomePortafoglio = ctx.metriche.find((m) => m.codice === 'portafoglio')?.nome ?? 'Portafoglio'
  const seriePortafoglio = serieCitta('portafoglio')
  out.push({
    titolo: `Totali · ${titolo}`,
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
                <GraficoAndamento spark t={t} etichette={etichetteBrevi} nomeSerie={m.nome} risultati={serie.map((z) => z.risultato)} obiettivi={serie.map((z) => z.obiettivo)} />
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
            <GraficoAndamento spark t={t} etichette={etichetteBrevi} nomeSerie={nomePortafoglio} risultati={seriePortafoglio.map((z) => z.risultato)} />
          </div>
          <p className="piccolo" style={{ margin: '6px 0 10px' }}>
            La tacca scura sulla barra è l'obiettivo {obiettivoDi} (100%). Barra verde: raggiunto · ambra: almeno 70% · rossa: sotto il 70%.
            {periodo.tipo === 'mese' && ' Nel mese le attività sono la somma delle settimane; il portafoglio è quello dell\'ultima settimana inserita.'}
            {confrontati < conDato && ` Portafoglio: variazione calcolata su ${confrontati} uffici su ${conDato}, quelli che l'hanno inserito in entrambi i periodi.`}
          </p>
        </div>
      </div>
    ),
  })

  // 3. Classifiche, due attività per pagina (solo quelle con almeno un risultato; servono almeno due uffici)
  const compatta = uffici.length > 16
  const conDati = uffici.length > 1 ? attivita.filter((m) => classifica(uffici, totali, m.codice).length > 0) : []
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
    const s = stati.get(u.id)!
    const ultimo = diQuesto.filter((r) => r.ufficio_id === u.id && r.aggiornato_il).sort((a, b) => b.aggiornato_il!.localeCompare(a.aggiornato_il!))[0]
    const raggiunti = attivita.filter((m) => { const x = tu?.get(m.codice); return x?.obiettivo != null && x.risultato != null && x.risultato >= x.obiettivo }).length
    const quota = quotaDaTotali(tu)
    const qOk = quota !== null && quota >= OBIETTIVO_QUOTA
    const minis = [
      ...attivita.map((m) => {
        const valori = serie(andamentoUfficio, m.codice)
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
                    <p key={n.settimana} style={{ color: 'var(--testo)' }}>
                      {periodo.tipo === 'mese' && <strong style={{ color: 'var(--secondario-800)' }}>Settimana del {etichettaBreve(n.settimana)}: </strong>}
                      “{n.testo}”
                    </p>
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
        </div>
      ),
    })
  }

  return out
}
