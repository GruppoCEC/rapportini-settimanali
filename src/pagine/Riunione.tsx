// Modalità riunione: presentazione a tutto schermo per la riunione del lunedì.
// Si avanza con le frecce della tastiera (o i pulsanti), Esc per uscire.
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  classifica, classificaQuota, quotaDaTotali, raggiungimento, serieQuota, serieSettimanale, sommaTotali,
  statoCompilazione, totaliPerUfficio, type Totali,
} from '../lib/aggregazioni'
import { esito, formattaEsito, formattaPercentuale, OBIETTIVO_QUOTA } from '../lib/calcoli'
import { AREE_ATTIVE, type Contesto, nomeArea, ufficiVisibili } from '../lib/contesto'
import { caricaNote, caricaRilevazioni, type Nota } from '../lib/dati'
import { aggiungiSettimane, etichettaSettimana, intervalloSettimana, ultimaSettimanaConclusa } from '../lib/settimane'
import type { Rilevazione, Ufficio } from '../lib/tipi'
import { BadgeStato, CellaQuota, CellaRisultato } from '../componenti/Celle'
import { GraficoAndamento, GraficoClassifica } from '../componenti/Grafici'
import SceltaSettimana from '../componenti/SceltaSettimana'

const SETTIMANE_STORICO = 8

interface Diapositiva {
  titolo: string
  contenuto: ReactNode
}

export default function Riunione({ ctx }: { ctx: Contesto }) {
  const [settimana, setSettimana] = useState(ultimaSettimanaConclusa())
  const [areaFiltro, setAreaFiltro] = useState<number | 'tutte'>('tutte')
  const [presentazione, setPresentazione] = useState<{ dati: Rilevazione[]; note: Nota[] } | null>(null)
  const [stato, setStato] = useState<'pronto' | 'caricamento'>('pronto')
  const [errore, setErrore] = useState<string | null>(null)

  const tutti = ufficiVisibili(ctx)
  const uffici = areaFiltro === 'tutte' ? tutti : tutti.filter((u) => u.area_id === areaFiltro)
  const areeCitta = ctx.aree.filter((a) => a.citta_id === ctx.cittaId)
  const nomeCitta = ctx.citta.find((c) => c.id === ctx.cittaId)?.nome ?? ''

  async function avvia() {
    setStato('caricamento'); setErrore(null)
    try {
      const ids = uffici.map((u) => u.id)
      const [dati, note] = await Promise.all([
        caricaRilevazioni(aggiungiSettimane(settimana, -(SETTIMANE_STORICO - 1)), settimana, ids),
        caricaNote(settimana, ids),
      ])
      setPresentazione({ dati, note })
      document.documentElement.requestFullscreen?.().catch(() => { /* il browser può rifiutare: si resta in finestra */ })
    } catch (e) {
      setErrore((e as Error).message)
    } finally {
      setStato('pronto')
    }
  }

  function esci() {
    setPresentazione(null)
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }

  if (presentazione) {
    const titolo = areaFiltro === 'tutte' ? nomeCitta : `${nomeCitta} · ${nomeArea(ctx, areaFiltro)}`
    return <Presentazione ctx={ctx} uffici={uffici} settimana={settimana} titolo={titolo} {...presentazione} onEsci={esci} />
  }

  return (
    <div className="pagina">
      <div className="scheda">
        <h1>Modalità riunione · {nomeCitta}</h1>
        <p>Una presentazione a tutto schermo da proiettare in riunione:</p>
        <ul>
          <li>totali della città;</li>
          <li>classifiche per ogni attività;</li>
          <li>quota di mercato;</li>
          {AREE_ATTIVE && <li>confronto tra aree;</li>}
          <li>una pagina per ogni ufficio, con le sue note.</li>
        </ul>
        <p className="piccolo">Durante la presentazione: <kbd>→</kbd> o <kbd>spazio</kbd> avanti, <kbd>←</kbd> indietro, <kbd>Esc</kbd> per uscire.</p>
      </div>
      <div className="scheda">
        <h2>Settimana da presentare</h2>
        <SceltaSettimana settimana={settimana} onCambia={setSettimana} />
        {areeCitta.length > 0 && (
          <label>Uffici da includere
            <select value={areaFiltro} onChange={(e) => setAreaFiltro(e.target.value === 'tutte' ? 'tutte' : Number(e.target.value))}>
              <option value="tutte">Tutta la città ({tutti.length} uffici)</option>
              {areeCitta.map((a) => <option key={a.id} value={a.id}>Solo {a.nome}</option>)}
            </select>
          </label>
        )}
        <p><button onClick={avvia} disabled={stato === 'caricamento' || uffici.length === 0}>{stato === 'caricamento' ? 'Preparazione…' : '▶ Avvia la presentazione'}</button></p>
        {errore && <p className="errore">Impossibile caricare i dati: {errore}</p>}
      </div>
    </div>
  )
}

function Presentazione({ ctx, uffici, settimana, titolo, dati, note, onEsci }: {
  ctx: Contesto; uffici: Ufficio[]; settimana: string; titolo: string; dati: Rilevazione[]; note: Nota[]; onEsci: () => void
}) {
  const [indice, setIndice] = useState(0)
  // I grafici piccoli si adattano all'altezza dello schermo (proiettore, portatile…)
  const [altezzaSchermo, setAltezzaSchermo] = useState(window.innerHeight)
  useEffect(() => {
    const aggiorna = () => setAltezzaSchermo(window.innerHeight)
    window.addEventListener('resize', aggiorna)
    return () => window.removeEventListener('resize', aggiorna)
  }, [])
  const altezzaMini = Math.round(Math.max(100, Math.min(210, (altezzaSchermo - 420) / 3)))
  const attivita = ctx.metriche.filter((m) => m.tipo === 'attivita')
  const settimane = Array.from({ length: SETTIMANE_STORICO }, (_, i) => aggiungiSettimane(settimana, i - SETTIMANE_STORICO + 1))
  const precedente = aggiungiSettimane(settimana, -1)
  const etichetteBrevi = settimane.map((s) => { const [, m, g] = s.split('-').map(Number); return `${g}/${m}` })

  const diQuesta = dati.filter((r) => r.settimana === settimana)
  const totali = totaliPerUfficio(diQuesta, ctx.metriche)
  const totaliPrec = totaliPerUfficio(dati.filter((r) => r.settimana === precedente), ctx.metriche)
  const somma = (t: Map<number, Totali>, lista: Ufficio[]) => sommaTotali(lista.map((u) => t.get(u.id)).filter((x): x is Totali => !!x))
  const totaleCitta = somma(totali, uffici)
  const totaleCittaPrec = somma(totaliPrec, uffici)
  const stati = uffici.map((u) => ({ u, s: statoCompilazione(diQuesta.filter((r) => r.ufficio_id === u.id), ctx.metriche) }))
  const mancanti = stati.filter((x) => x.s === 'mancante').map((x) => x.u.nome)

  const ordinati = [...uffici].sort((a, b) => nomeArea(ctx, a.area_id).localeCompare(nomeArea(ctx, b.area_id)) || a.nome.localeCompare(b.nome))
  const idAree = [...new Set(uffici.map((u) => u.area_id))]

  const diapositive: Diapositiva[] = []

  // 1. Copertina
  diapositive.push({
    titolo: 'Riunione settimanale',
    contenuto: (
      <div className="dia-copertina">
        <h1>{titolo}</h1>
        <p className="dia-sottotitolo">{etichettaSettimana(settimana)}</p>
        <p className="dia-grande">{uffici.length - mancanti.length} uffici su {uffici.length} hanno inserito i dati</p>
        {mancanti.length > 0 && <p className="dia-mancanti">Mancano: {mancanti.join(', ')}</p>}
      </div>
    ),
  })

  // 2. Totali della città con confronto sulla settimana precedente
  diapositive.push({
    titolo: `Totali ${titolo}`,
    contenuto: (
      <div className="riquadri riquadri-grandi">
        {attivita.map((m) => {
          const t = totaleCitta.get(m.codice)
          const prima = totaleCittaPrec.get(m.codice)?.risultato
          const r = raggiungimento(t)
          const diff = t?.risultato != null && prima != null ? t.risultato - prima : null
          return (
            <div key={m.codice} className={`riquadro ${r === null ? '' : r >= 1 ? 'riquadro-verde' : 'riquadro-rosso'}`}>
              <span className="riquadro-titolo">{m.nome}</span>
              <strong className="riquadro-valore">{t?.risultato ?? '—'}</strong>
              <span>{t?.obiettivo != null ? `obiettivo ${t.obiettivo} · ${formattaPercentuale(r)} ${r !== null && r >= 1 ? '✓' : ''}` : 'nessun obiettivo'}</span>
              {diff !== null && <span className="piccolo">{diff === 0 ? '= settimana scorsa' : `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)} rispetto alla settimana scorsa`}</span>}
            </div>
          )
        })}
        <div className={`riquadro ${(quotaDaTotali(totaleCitta) ?? 0) >= OBIETTIVO_QUOTA ? 'riquadro-verde' : 'riquadro-rosso'}`}>
          <span className="riquadro-titolo">Quota di mercato</span>
          <strong className="riquadro-valore">{formattaPercentuale(quotaDaTotali(totaleCitta))}</strong>
          <span>obiettivo {formattaPercentuale(OBIETTIVO_QUOTA)}</span>
        </div>
      </div>
    ),
  })

  // 3. Classifiche, due attività per pagina (solo quelle con almeno un risultato)
  const conDati = attivita.filter((m) => classifica(uffici, totali, m.codice).length > 0)
  for (let i = 0; i < conDati.length; i += 2) {
    const coppia = conDati.slice(i, i + 2)
    diapositive.push({
      titolo: `Classifica · ${coppia.map((m) => m.nome).join(' e ')}`,
      contenuto: (
        <div className="dia-due-colonne">
          {coppia.map((m) => (
            <div key={m.codice}>
              <h2>{m.nome}</h2>
              <GraficoClassifica altezzaRiga={uffici.length > 14 ? 28 : 40} voci={classifica(uffici, totali, m.codice).map((v) => ({
                nome: v.ufficio.nome, valore: v.valore,
                etichetta: v.totale?.obiettivo != null ? `${v.valore} / ${v.totale.obiettivo} ${v.valore >= v.totale.obiettivo ? '✓' : '✗'}` : String(v.valore),
              }))} />
              <p className="piccolo">Valore della settimana · "/ n" = obiettivo dell'ufficio · ✓ raggiunto ✗ non raggiunto</p>
            </div>
          ))}
        </div>
      ),
    })
  }

  // 4. Quota di mercato
  const quote = classificaQuota(uffici, totali)
  if (quote.length > 0) {
    diapositive.push({
      titolo: 'Quota di mercato',
      contenuto: (
        <div>
          <p className="dia-nota">Portafoglio ÷ (Portafoglio + Incarichi in zona) · linea rossa = obiettivo {formattaPercentuale(OBIETTIVO_QUOTA)} · {quote.filter((q) => q.quota >= OBIETTIVO_QUOTA).length} uffici sopra l'obiettivo</p>
          <GraficoClassifica percentuale rigaRiferimento={OBIETTIVO_QUOTA} altezzaRiga={uffici.length > 14 ? 28 : 40}
            voci={quote.map((q) => ({ nome: q.ufficio.nome, valore: q.quota }))} />
        </div>
      ),
    })
  }

  // 5. Confronto tra aree
  if (idAree.length > 1) {
    diapositive.push({
      titolo: 'Confronto tra aree',
      contenuto: (
        <table className="tabella-riepilogo tabella-dia">
          <thead><tr><th>Area</th>{attivita.map((m) => <th key={m.codice}>{m.nome}</th>)}<th>Quota</th></tr></thead>
          <tbody>
            {idAree.sort((a, b) => nomeArea(ctx, a).localeCompare(nomeArea(ctx, b))).map((id) => {
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
      ),
    })
  }

  // 6. Una pagina per ufficio
  for (const u of ordinati) {
    const t = totali.get(u.id)
    const nota = note.find((n) => n.ufficio_id === u.id)
    const suoi = dati.filter((r) => r.ufficio_id === u.id)
    const s = stati.find((x) => x.u.id === u.id)!.s
    // Andamento delle ultime settimane: un grafico piccolo per ogni attività + quota di mercato
    const miniGrafici = [
      ...attivita.map((m) => {
        const serie = serieSettimanale(suoi, m.codice, settimane)
        const ultimo = serie.at(-1)!
        return {
          nome: m.nome,
          valore: ultimo.risultato === null ? '—' : `${ultimo.risultato}${ultimo.obiettivo !== null ? ` / ${ultimo.obiettivo}` : ''}`,
          grafico: <GraficoAndamento compatto altezza={altezzaMini} etichette={etichetteBrevi} nomeSerie={m.nome}
            risultati={serie.map((x) => x.risultato)} obiettivi={serie.map((x) => x.obiettivo)} />,
        }
      }),
      {
        nome: 'Quota di mercato',
        valore: formattaPercentuale(quotaDaTotali(t)),
        grafico: <GraficoAndamento compatto altezza={altezzaMini} etichette={etichetteBrevi} nomeSerie="Quota di mercato"
          percentuale rigaRiferimento={OBIETTIVO_QUOTA} risultati={serieQuota(suoi, settimane)} />,
      },
    ]
    diapositive.push({
      titolo: u.nome,
      contenuto: (
        <div className="dia-ufficio">
          <div>
            <p className="dia-nota">{AREE_ATTIVE && <>{nomeArea(ctx, u.area_id)} · </>}<BadgeStato stato={s} /></p>
            <table className="tabella-dati tabella-dia">
              <thead><tr><th>Attività</th><th>Obiettivo</th><th>Risultato</th><th>Esito</th></tr></thead>
              <tbody>
                {attivita.map((m) => {
                  const x = t?.get(m.codice)
                  const e = esito(x?.obiettivo ?? null, x?.risultato ?? null)
                  return (
                    <tr key={m.codice}>
                      <th scope="row">{m.nome}</th>
                      <td className="numero">{x?.obiettivo ?? '—'}</td>
                      <td className="numero"><strong>{x?.risultato ?? '—'}</strong></td>
                      <td className={`esito ${e === null ? '' : e >= 0 ? 'positivo' : 'negativo'}`}>{formattaEsito(e)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="dia-quota">Quota di mercato: <strong>{formattaPercentuale(quotaDaTotali(t))}</strong>
              {t?.get('portafoglio')?.risultato != null && <span className="piccolo"> · portafoglio {t.get('portafoglio')!.risultato}, incarichi in zona {t.get('incarichi_zona')?.risultato ?? '—'}</span>}
            </p>
            <h3>Note dell'ufficio</h3>
            <p className="dia-testo-nota">{nota?.testo ?? <span className="piccolo">Nessuna nota per questa settimana.</span>}</p>
          </div>
          <div>
            <div className="dia-titolo-grafici">
              <h3>Andamento ultime {SETTIMANE_STORICO} settimane</h3>
              <span className="piccolo"><span className="segno-risultato">━</span> risultato · <span className="segno-obiettivo">┅</span> obiettivo</span>
            </div>
            <div className="griglia-mini">
              {miniGrafici.map((g) => (
                <div key={g.nome} className="mini">
                  <div className="mini-testa"><strong>{g.nome}</strong><span>{g.valore}</span></div>
                  {g.grafico}
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    })
  }

  const totale = diapositive.length
  const vai = useCallback((n: number) => setIndice((i) => Math.min(totale - 1, Math.max(0, i + n))), [totale])

  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); vai(1) }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); vai(-1) }
      else if (e.key === 'Home') setIndice(0)
      else if (e.key === 'End') setIndice(totale - 1)
      else if (e.key === 'Escape') onEsci()
    }
    window.addEventListener('keydown', tasto)
    return () => window.removeEventListener('keydown', tasto)
  }, [vai, totale, onEsci])

  const d = diapositive[indice]
  return (
    <div className="presentazione">
      <header className="presentazione-testata">
        <span className="presentazione-marchio">{titolo} · {intervalloSettimana(settimana)}</span>
        <h2>{d.titolo}</h2>
        <button className="link" onClick={onEsci} aria-label="Esci dalla presentazione">✕ Esci</button>
      </header>
      <main className="presentazione-corpo">{d.contenuto}</main>
      <footer className="presentazione-piede">
        <button className="freccia" onClick={() => vai(-1)} disabled={indice === 0} aria-label="Indietro">‹</button>
        <select value={indice} onChange={(e) => setIndice(Number(e.target.value))} aria-label="Vai alla pagina">
          {diapositive.map((x, i) => <option key={i} value={i}>{i + 1}. {x.titolo}</option>)}
        </select>
        <span className="piccolo">{indice + 1} / {totale}</span>
        <button className="freccia" onClick={() => vai(1)} disabled={indice === totale - 1} aria-label="Avanti">›</button>
      </footer>
    </div>
  )
}
