// Modalità riunione: presentazione a tutto schermo per la riunione del lunedì.
// Si avanza con le frecce della tastiera (o i pulsanti), Esc per uscire.
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  classifica, classificaQuota, quotaDaTotali, raggiungimento, serieQuota, serieSettimanale, sommaTotali,
  statoCompilazione, totaliPerUfficio, variazioneZona, type StatoCompilazione as Stato, type Totali,
} from '../lib/aggregazioni'
import { esito, formattaEsito, formattaPercentuale, OBIETTIVO_QUOTA } from '../lib/calcoli'
import { AREE_ATTIVE, type Contesto, nomeArea, ufficiVisibili } from '../lib/contesto'
import { nomeDaEmail } from '../lib/account'
import { caricaNote, caricaRilevazioni, type Nota } from '../lib/dati'
import { aggiungiSettimane, etichettaSettimana, intervalloSettimana, ultimaSettimanaConclusa } from '../lib/settimane'
import type { Metrica, Rilevazione, Ufficio } from '../lib/tipi'
import { useDati } from '../lib/useDati'
import { BadgeStato, CellaQuota, CellaRisultato, coloreRapporto } from '../componenti/Celle'
import { GraficoAndamento } from '../componenti/Grafici'
import { conta, Icona, Logo, useProgresso } from '../componenti/Interfaccia'
import SceltaSettimana from '../componenti/SceltaSettimana'

const SETTIMANE_STORICO = 8

interface Diapositiva {
  titolo: string
  contenuto: (t: number) => ReactNode      // t = avanzamento dell'animazione (0–1)
}

interface DatiRiunione { dati: Rilevazione[]; note: Nota[] }

export default function Riunione({ ctx }: { ctx: Contesto }) {
  const [settimana, setSettimana] = useState(ultimaSettimanaConclusa())
  const [areaFiltro, setAreaFiltro] = useState<number | 'tutte'>('tutte')
  const [attiva, setAttiva] = useState(false)

  const tutti = ufficiVisibili(ctx)
  const uffici = areaFiltro === 'tutte' ? tutti : tutti.filter((u) => u.area_id === areaFiltro)
  const ids = uffici.map((u) => u.id)
  const areeCitta = ctx.aree.filter((a) => a.citta_id === ctx.cittaId)
  const nomeCitta = ctx.citta.find((c) => c.id === ctx.cittaId)?.nome ?? ''
  const titolo = areaFiltro === 'tutte' ? nomeCitta : `${nomeCitta} · ${nomeArea(ctx, areaFiltro)}`

  const carico = useDati<DatiRiunione>(async () => {
    const [dati, note] = await Promise.all([
      caricaRilevazioni(aggiungiSettimane(settimana, -(SETTIMANE_STORICO - 1)), settimana, ids),
      caricaNote(settimana, ids),
    ])
    return { dati, note }
  }, [settimana, ids.join(',')])

  const diapositive = carico.dati ? costruisciDiapositive({ ctx, uffici, settimana, titolo, ...carico.dati }) : []
  const compilati = carico.dati
    ? uffici.filter((u) => statoCompilazione(carico.dati!.dati.filter((r) => r.settimana === settimana && r.ufficio_id === u.id), ctx.metriche) !== 'mancante').length
    : null

  function avvia() {
    setAttiva(true)
    document.documentElement.requestFullscreen?.().catch(() => { /* il browser può rifiutare: si resta in finestra */ })
  }
  const esci = useCallback(() => {
    setAttiva(false)
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }, [])

  if (attiva && diapositive.length > 0) {
    return <Presentazione diapositive={diapositive} marchio={`${titolo} · ${intervalloSettimana(settimana)}`} onEsci={esci} />
  }

  return (
    <div className="due-colonne entra">
      <section className="scheda" style={{ gap: 18 }}>
        <span className="kicker">Modalità riunione</span>
        <h1 className="titolo-pagina">{nomeCitta}, lunedì mattina</h1>
        <p style={{ fontSize: 18 }}>Una presentazione a tutto schermo da proiettare in riunione:</p>
        <ul className="elenco-icone">
          <li><Icona nome="sigma" />totali della città;</li>
          <li><Icona nome="ranking" />classifiche per ogni attività;</li>
          <li><Icona nome="chart-pie-slice" />quota di mercato;</li>
          {AREE_ATTIVE && <li><Icona nome="map-trifold" />confronto tra aree;</li>}
          <li><Icona nome="storefront" />una pagina per ogni ufficio, con le sue note.</li>
        </ul>
        <p className="piccolo" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
          Durante la presentazione: <kbd>→</kbd> o <kbd>spazio</kbd> avanti, <kbd>←</kbd> indietro, <kbd>Esc</kbd> per uscire.
        </p>
      </section>
      <section className="scheda entra entra-1" style={{ gap: 22 }}>
        <h2>Settimana da presentare</h2>
        <div style={{ alignSelf: 'flex-start' }}><SceltaSettimana settimana={settimana} onCambia={setSettimana} /></div>
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
          <div><strong>{compilati === null ? '…' : `${compilati} / ${uffici.length}`}</strong><span className="piccolo">uffici con i dati inseriti</span></div>
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

function costruisciDiapositive({ ctx, uffici, settimana, titolo, dati, note }: {
  ctx: Contesto; uffici: Ufficio[]; settimana: string; titolo: string; dati: Rilevazione[]; note: Nota[]
}): Diapositiva[] {
  const attivita: Metrica[] = ctx.metriche.filter((m) => m.tipo === 'attivita')
  const settimane = Array.from({ length: SETTIMANE_STORICO }, (_, i) => aggiungiSettimane(settimana, i - SETTIMANE_STORICO + 1))
  const precedente = aggiungiSettimane(settimana, -1)
  const etichetteBrevi = settimane.map((s) => { const [, m, g] = s.split('-').map(Number); return `${g}/${m}` })

  const diQuesta = dati.filter((r) => r.settimana === settimana)
  const totali = totaliPerUfficio(diQuesta, ctx.metriche)
  const totaliPrec = totaliPerUfficio(dati.filter((r) => r.settimana === precedente), ctx.metriche)
  const somma = (t: Map<number, Totali>, lista: Ufficio[]) => sommaTotali(lista.map((u) => t.get(u.id)).filter((x): x is Totali => !!x))
  const totaleCitta = somma(totali, uffici)
  const totaleCittaPrec = somma(totaliPrec, uffici)
  const quotaCitta = quotaDaTotali(totaleCitta)
  const stati = new Map(uffici.map((u) => [u.id, statoCompilazione(diQuesta.filter((r) => r.ufficio_id === u.id), ctx.metriche)]))
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

  // Portafoglio: totale degli uffici e variazione sulla settimana prima (solo uffici con il dato in entrambe)
  const portafoglio = totaleCitta.get('portafoglio')?.risultato ?? null
  const { variazione: variazionePortafoglio, confrontati, conDato } = variazioneZona(uffici, totali, totaliPrec, 'portafoglio')
  const testoVariazione = variazionePortafoglio === null ? 'nessun confronto con la settimana prima'
    : `${variazionePortafoglio === 0 ? 'invariato' : formattaEsito(variazionePortafoglio)} rispetto alla settimana prima`
      + (confrontati < conDato ? ` (su ${confrontati} uffici)` : '')
  const colorePortafoglio = variazionePortafoglio === null || variazionePortafoglio === 0 ? '#AFC0D4' : variazionePortafoglio > 0 ? VERDE_CHIARO : ROSA
  out.push({
    titolo: 'Riunione settimanale',
    contenuto: (t) => (
      <div className="copertina" style={{ flex: 1 }}>
        <div className="cerchio cerchio-a" /><div className="cerchio cerchio-b" />
        <div>
          <div className="cop-marchio"><Logo dimensione={44} />Riunione settimanale · Gruppo CEC</div>
          <h1 className="cop-citta">{titolo}</h1>
          <span className="cop-settimana">{etichettaSettimana(settimana)}</span>
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
              <div><strong>{conta(compilati, t)}</strong><span>su {uffici.length} uffici</span></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200, flex: 1 }}>
              <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>hanno inserito i dati della settimana</span>
              {mancanti.length > 0 && <span style={{ fontSize: 17, color: ROSA }}>Mancano: {mancanti.join(', ')}</span>}
            </div>
          </div>
          <div className="mosaico">
            {uffici.map((u) => {
              const s = stati.get(u.id)!
              return <div key={u.id} className={CLASSE_MOSAICO[s]} title={u.nome}><span>{u.nome}</span><span>{SIMBOLO_MOSAICO[s]}</span></div>
            })}
          </div>
          <div style={{ display: 'flex', gap: 18, fontSize: 13, fontWeight: 600, color: '#AFC0D4' }}><span>✓ completo</span><span>◐ parziale</span><span>✗ mancante</span></div>
        </div>
      </div>
    ),
  })

  // 2. Totali della città con confronto sulla settimana precedente
  const serieCitta = (codice: string) => serieSettimanale(dati.filter((r) => uffici.some((u) => u.id === r.ufficio_id)), codice, settimane)
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
    titolo: `Totali ${titolo}`,
    contenuto: (t) => (
      <div className="p-colonna">
        <div className="sintesi-griglia">
          <div className="sintesi" style={{ background: 'var(--ok-bg)', color: 'var(--ok-fg)' }}>
            <span><Icona nome="target" /></span>
            <div><span className="p-etichetta">Obiettivi raggiunti</span><strong>{conta(raggiunte, t)} su {attivita.length}</strong><span>attività sopra l'obiettivo della città</span></div>
          </div>
          <div className="sintesi" style={{ background: quotaOk ? 'var(--ok-bg)' : 'var(--ko-bg)', color: quotaOk ? 'var(--ok-fg)' : 'var(--ko-fg)' }}>
            <span><Icona nome="chart-pie-slice" /></span>
            <div><span className="p-etichetta">Quota di mercato</span><strong>{formattaPercentuale(quotaCitta)}</strong><span>{quotaCitta === null ? 'dati di zona mancanti' : quotaOk ? '✓ sopra l\'obiettivo del 20%' : '✗ sotto l\'obiettivo del 20%'}</span></div>
          </div>
          <div className="sintesi" style={{ background: 'var(--primario-100)', color: 'var(--primario-700)' }}>
            <span><Icona nome="trend-up" /></span>
            <div><span className="p-etichetta">Rispetto alla settimana scorsa</span><strong>{su} ▲ · {giu} ▼</strong><span>{su} attività in crescita, {giu} in calo</span></div>
          </div>
        </div>
        <div className="p-card tabellone">
          <div className="tabellone-riga testa"><span>Attività</span><span>Risultato</span><span>Rispetto all'obiettivo</span><span style={{ textAlign: 'right' }}>%</span><span>Settimana scorsa</span><span>Ultime {SETTIMANE_STORICO} settimane</span></div>
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
                  {diff === null ? '—' : diff === 0 ? '= uguale' : `${diff > 0 ? '▲ +' : '▼ '}${diff} vs scorsa`}
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
              {variazionePortafoglio === null ? '—' : variazionePortafoglio === 0 ? '= uguale' : `${variazionePortafoglio > 0 ? '▲ +' : '▼ '}${variazionePortafoglio} vs scorsa`}
            </span>
            <GraficoAndamento spark t={t} etichette={etichetteBrevi} nomeSerie={nomePortafoglio} risultati={seriePortafoglio.map((z) => z.risultato)} />
          </div>
          <p className="piccolo" style={{ margin: '6px 0 10px' }}>
            La tacca scura sulla barra è l'obiettivo della città (100%). Barra verde: raggiunto · ambra: almeno 70% · rossa: sotto il 70%.
            {confrontati < conDato && ` Portafoglio: variazione calcolata su ${confrontati} uffici su ${conDato}, quelli che l'hanno inserito in entrambe le settimane.`}
          </p>
        </div>
      </div>
    ),
  })

  // 3. Classifiche, due attività per pagina (solo quelle con almeno un risultato)
  const compatta = uffici.length > 16
  const conDati = attivita.filter((m) => classifica(uffici, totali, m.codice).length > 0)
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
                <p className="piccolo" style={{ marginTop: 12 }}>Valore della settimana · "/ n" = obiettivo dell'ufficio · ✓ raggiunto ✗ non raggiunto</p>
              </div>
            )
          })}
        </div>
      ),
    })
  }

  // 4. Quota di mercato
  const quote = classificaQuota(uffici, totali)
  if (quote.length > 0) {
    const max = Math.max(0.3, ...quote.map((q) => q.quota))
    out.push({
      titolo: 'Quota di mercato',
      contenuto: (t) => (
        <div className={`p-card ${compatta ? 'compatta' : ''}`} style={{ maxWidth: 1200, gap: compatta ? 2 : 8 }}>
          <p style={{ fontSize: 17, fontWeight: 600, color: '#3A4250', marginBottom: 14 }}>
            Portafoglio ÷ (Portafoglio + Incarichi in zona) · linea = obiettivo {formattaPercentuale(OBIETTIVO_QUOTA)} · {quote.filter((q) => q.quota >= OBIETTIVO_QUOTA).length} uffici sopra l'obiettivo
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
    const nota = note.find((n) => n.ufficio_id === u.id)
    const suoi = dati.filter((r) => r.ufficio_id === u.id)
    const s = stati.get(u.id)!
    const ultimo = suoi.filter((r) => r.settimana === settimana && r.aggiornato_il).sort((a, b) => b.aggiornato_il!.localeCompare(a.aggiornato_il!))[0]
    const raggiunti = attivita.filter((m) => { const x = tu?.get(m.codice); return x?.obiettivo != null && x.risultato != null && x.risultato >= x.obiettivo }).length
    const quota = quotaDaTotali(tu)
    const qOk = quota !== null && quota >= OBIETTIVO_QUOTA
    const minis = [
      ...attivita.map((m) => {
        const serie = serieSettimanale(suoi, m.codice, settimane)
        const ul = serie.at(-1)!
        return { nome: m.nome, valore: ul.risultato === null ? '—' : `${ul.risultato}${ul.obiettivo !== null ? ` / ${ul.obiettivo}` : ''}`, ris: serie.map((x) => x.risultato), ob: serie.map((x) => x.obiettivo), pct: false }
      }),
      { nome: 'Quota di mercato', valore: formattaPercentuale(quota), ris: serieQuota(suoi, settimane), ob: undefined, pct: true },
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
                  <p style={{ color: nota?.testo ? 'var(--testo)' : 'var(--testo-tenue)' }}>{nota?.testo ? `“${nota.testo}”` : 'Nessuna nota per questa settimana.'}</p>
                </div>
              </div>
            </div>
            <div className="p-card" style={{ gap: 14 }}>
              <div className="scheda-titolo">
                <h3 style={{ fontSize: 22, margin: 0, marginRight: 'auto' }}>Andamento ultime {SETTIMANE_STORICO} settimane</h3>
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
