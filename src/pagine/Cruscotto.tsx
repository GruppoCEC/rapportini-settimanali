// Cruscotto della città: riquadri con i totali, tabella uffici × attività, totali di area e città,
// confronto tra aree, andamento della città e (solo admin generale) Roma vs Milano.
import { Fragment, useState } from 'react'
import { inClassifica, quotaDaTotali, raggiungimento, serieQuota, serieSettimanale, sommaTotali, statoCompilazione, totaliPerUfficio, type Totali } from '../lib/aggregazioni'
import { formattaPercentuale, OBIETTIVO_QUOTA } from '../lib/calcoli'
import { type Contesto, nomeArea, ufficiVisibili } from '../lib/contesto'
import { caricaRilevazioni } from '../lib/dati'
import { isAmministratore } from '../lib/permessi'
import { calcolaSegnali, inizioSegnali } from '../lib/segnali'
import { aggiungiSettimane, lunediDi, notaMeseSettimana, oggiISO } from '../lib/settimane'
import type { Rilevazione, Ufficio } from '../lib/tipi'
import { useDati } from '../lib/useDati'
import { Caricamento, CellaQuota, CellaRisultato, coloreRapporto, Legenda, SIMBOLO } from '../componenti/Celle'
import { GraficoAndamento, LegendaGrafico } from '../componenti/Grafici'
import { conta, Icona, useProgresso } from '../componenti/Interfaccia'
import { ElencoSegnali, NotaSegnali } from '../componenti/Segnali'
import SceltaPeriodo, { descriviPeriodo, estremiPeriodo, periodoPredefinito, type Periodo } from '../componenti/SceltaPeriodo'

const SETTIMANE_ANDAMENTO = 12
const QUOTA = '__quota'

interface Kpi { nome: string; rapporto: number | null; valore: string; sotto: string; riempimento: number }

function RiquadroKpi({ k, ritardo }: { k: Kpi; ritardo: number }) {
  const s = coloreRapporto(k.rapporto)
  const classeTag = { verde: 'tag-ok', giallo: 'tag-quasi', rosso: 'tag-ko', nessuno: 'tag-neutro' }[s]
  return (
    <div className="kpi" style={{ animationDelay: `${ritardo}ms` }}>
      <div className="kpi-testa">
        <span className="kpi-nome">{k.nome}</span>
        <span className={`tag ${classeTag}`}>{k.rapporto === null ? '—' : `${Math.round(k.rapporto * 100)}% ${SIMBOLO[s]}`}</span>
      </div>
      <strong className="kpi-valore">{k.valore}</strong>
      <div className="barra"><div className={`pieno-${s}`} style={{ width: `${k.riempimento * 100}%` }} /></div>
      <span className="kpi-sotto">{k.sotto}</span>
    </div>
  )
}

export default function Cruscotto({ ctx }: { ctx: Contesto }) {
  const [periodo, setPeriodo] = useState<Periodo>(periodoPredefinito)
  const [areaFiltro, setAreaFiltro] = useState<number | 'tutte'>('tutte')
  const [voceAndamento, setVoceAndamento] = useState('incarichi')

  const tuttiUffici = ufficiVisibili(ctx)
  const uffici = areaFiltro === 'tutte' ? tuttiUffici : tuttiUffici.filter((u) => u.area_id === areaFiltro)
  const ids = uffici.map((u) => u.id)
  const { da, a, settimane } = estremiPeriodo(periodo)
  const ultima = lunediDi(oggiISO())
  const settimaneAndamento = Array.from({ length: SETTIMANE_ANDAMENTO }, (_, i) => aggiungiSettimane(ultima, i - SETTIMANE_ANDAMENTO + 1))
  const generale = ctx.utente.ruolo === 'admin_generale'
  // l'affiliato vede i suoi uffici, anche di città diverse
  const affiliato = ctx.utente.ruolo === 'affiliato'
  const nomeCitta = affiliato ? 'I miei uffici' : ctx.citta.find((c) => c.id === ctx.cittaId)?.nome ?? ''

  const periodoDati = useDati(() => caricaRilevazioni(da, a, ids), [da, a, ids.join(',')])
  const andamento = useDati(() => caricaRilevazioni(settimaneAndamento[0], ultima, ids), [ultima, ids.join(',')])
  // Roma vs Milano: solo l'admin generale legge entrambe le città
  const confrontoCitta = useDati(
    () => (generale ? caricaRilevazioni(da, a) : Promise.resolve([] as Rilevazione[])),
    [generale, da, a],
  )
  const t = useProgresso(`${periodo.tipo}-${da}-${periodoDati.caricamento}`)
  const tGrafico = useProgresso(`${voceAndamento}-${andamento.caricamento}`)

  const attivita = ctx.metriche.filter((m) => m.tipo === 'attivita')
  const areeCitta = ctx.aree.filter((ar) => ar.citta_id === ctx.cittaId)
  const nota = periodo.tipo === 'settimana' ? notaMeseSettimana(periodo.settimana) : null

  return (
    <div className="pagina pagina-ampia entra">
      <div className="intestazione">
        <div className="intestazione-titoli">
          <span className="kicker">Cruscotto · {nomeCitta}</span>
          <h1 className="titolo-pagina">{descriviPeriodo(periodo)}</h1>
          {nota && <span className="piccolo">Settimana {nota}</span>}
        </div>
        <div className="comandi">
          {areeCitta.length > 0 && (
            <select aria-label="Area" value={areaFiltro} onChange={(e) => setAreaFiltro(e.target.value === 'tutte' ? 'tutte' : Number(e.target.value))}>
              <option value="tutte">Tutte le aree</option>
              {areeCitta.map((ar) => <option key={ar.id} value={ar.id}>{ar.nome}</option>)}
            </select>
          )}
          <SceltaPeriodo periodo={periodo} onCambia={setPeriodo} />
        </div>
      </div>

      {periodoDati.caricamento || periodoDati.errore || !periodoDati.dati ? <Caricamento errore={periodoDati.errore} /> : (() => {
        const righe = periodoDati.dati
        const totali = totaliPerUfficio(righe, ctx.metriche)
        const totaleCitta = sommaTotali(uffici.map((u) => totali.get(u.id)).filter((x): x is Totali => !!x))
        const compilati = periodo.tipo === 'settimana'
          ? uffici.filter((u) => statoCompilazione(righe.filter((r) => r.ufficio_id === u.id), ctx.metriche) !== 'mancante').length
          : null
        const quota = quotaDaTotali(totaleCitta)

        const kpi: Kpi[] = attivita.slice(0, 6).map((m) => {
          const x = totaleCitta.get(m.codice)
          const r = raggiungimento(x)
          return {
            nome: m.nome, rapporto: r,
            valore: x?.risultato != null ? conta(x.risultato, t) : '—',
            sotto: x?.obiettivo != null ? `obiettivo ${x.obiettivo.toLocaleString('it-IT')} · ${formattaPercentuale(r)}` : 'nessun obiettivo',
            riempimento: Math.min(1, r ?? 0) * t,
          }
        })
        kpi.push({
          nome: 'Quota di mercato', rapporto: quota === null ? null : quota / OBIETTIVO_QUOTA,
          valore: quota === null ? '—' : formattaPercentuale(quota * t), sotto: `obiettivo ${formattaPercentuale(OBIETTIVO_QUOTA)}`,
          riempimento: Math.min(1, (quota ?? 0) / (OBIETTIVO_QUOTA * 2)) * t,
        })
        if (compilati !== null && uffici.length > 0) {
          kpi.push({
            nome: 'Uffici che hanno compilato', rapporto: compilati / uffici.length,
            valore: `${conta(compilati, t)} / ${uffici.length}`,
            sotto: uffici.length - compilati === 0 ? 'tutti presenti' : `${uffici.length - compilati} mancanti`,
            riempimento: compilati / uffici.length * t,
          })
        }

        // Uffici raggruppati per area (quelli senza area in fondo)
        const gruppi = new Map<number | null, Ufficio[]>()
        for (const u of uffici) gruppi.set(u.area_id, [...(gruppi.get(u.area_id) ?? []), u])
        const ordineGruppi = [...gruppi.keys()].sort((x, y) => (x === null ? 1 : y === null ? -1 : nomeArea(ctx, x).localeCompare(nomeArea(ctx, y))))
        const totaleGruppo = (lista: Ufficio[]) => sommaTotali(lista.map((u) => totali.get(u.id)).filter((x): x is Totali => !!x))
        let n = 0

        return (
          <>
            <div className="kpi-griglia">
              {kpi.map((k, i) => <RiquadroKpi key={k.nome} k={k} ritardo={i * 45} />)}
            </div>

            {isAmministratore(ctx.utente) && periodo.tipo === 'settimana' && <RiquadroSegnali ctx={ctx} uffici={uffici} settimana={periodo.settimana} />}

            <section className="scheda">
              <h2>Uffici · {descriviPeriodo(periodo)}</h2>
              <div className="tabella-scorrevole">
                <table className="tabella" style={{ minWidth: 1000 }}>
                  <thead>
                    <tr><th className="ufficio-fisso">Ufficio</th>{attivita.map((m) => <th key={m.codice} className="destra">{m.nome}</th>)}<th className="destra">Quota</th></tr>
                  </thead>
                  <tbody>
                    {ordineGruppi.map((areaId) => {
                      const lista = gruppi.get(areaId)!
                      const tg = totaleGruppo(lista)
                      return (
                        <Fragment key={String(areaId)}>
                          {ordineGruppi.length > 1 && <tr className="separatore"><th colSpan={attivita.length + 2}>{nomeArea(ctx, areaId)}</th></tr>}
                          {lista.map((u) => (
                            <tr key={u.id} className="riga-fade" style={{ animationDelay: `${n++ * 25}ms` }}>
                              <th scope="row" className="ufficio-fisso">{u.nome}</th>
                              {attivita.map((m) => <CellaRisultato key={m.codice} totale={totali.get(u.id)?.get(m.codice)} />)}
                              <CellaQuota quota={quotaDaTotali(totali.get(u.id))} />
                            </tr>
                          ))}
                          {ordineGruppi.length > 1 && (
                            <tr className="riga-totale">
                              <th scope="row" className="ufficio-fisso">Totale {nomeArea(ctx, areaId)}</th>
                              {attivita.map((m) => <CellaRisultato key={m.codice} totale={tg.get(m.codice)} />)}
                              <CellaQuota quota={quotaDaTotali(tg)} />
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                    <tr className="riga-totale-citta">
                      <th scope="row" className="ufficio-fisso">Totale {areaFiltro === 'tutte' ? (affiliato ? 'miei uffici' : nomeCitta) : nomeArea(ctx, areaFiltro)}</th>
                      {attivita.map((m) => <CellaRisultato key={m.codice} totale={totaleCitta.get(m.codice)} />)}
                      <CellaQuota quota={quota} />
                    </tr>
                  </tbody>
                </table>
              </div>
              <Legenda />
              {periodo.tipo === 'mese' && <p className="piccolo">Mese: somma di {settimane.length} settimane. Quota calcolata sui dati di zona dell'ultima settimana compilata.</p>}
            </section>

            {areaFiltro === 'tutte' && ordineGruppi.length > 1 && (
              <section className="scheda">
                <h2>Confronto tra aree</h2>
                <p className="piccolo">Per confrontare aree di dimensioni diverse, sotto il totale c'è la media per ufficio.</p>
                <div className="tabella-scorrevole">
                  <table className="tabella">
                    <thead><tr><th>Area</th><th className="destra">Uffici</th>{attivita.map((m) => <th key={m.codice} className="destra">{m.nome}</th>)}<th className="destra">Quota</th></tr></thead>
                    <tbody>
                      {ordineGruppi.map((areaId) => {
                        const lista = gruppi.get(areaId)!
                        const tg = totaleGruppo(lista)
                        return (
                          <tr key={String(areaId)}>
                            <th scope="row">{nomeArea(ctx, areaId)}</th>
                            <td className="destra">{lista.length}</td>
                            {attivita.map((m) => {
                              const x = tg.get(m.codice)
                              return (
                                <td key={m.codice} className="cella">
                                  <span className="valore">{x?.risultato ?? '—'}</span>
                                  {x?.risultato != null && <span className="obiettivo">media {(x.risultato / lista.length).toLocaleString('it-IT', { maximumFractionDigits: 1 })}</span>}
                                </td>
                              )
                            })}
                            <CellaQuota quota={quotaDaTotali(tg)} />
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )
      })()}

      <section className="scheda">
        <div className="scheda-titolo">
          <h2>Andamento {affiliato ? 'dei miei uffici' : areaFiltro === 'tutte' ? 'della città' : 'dell\'area'} · ultime {SETTIMANE_ANDAMENTO} settimane</h2>
          <select value={voceAndamento} onChange={(e) => setVoceAndamento(e.target.value)} aria-label="Voce del grafico">
            {attivita.map((m) => <option key={m.codice} value={m.codice}>{m.nome}</option>)}
            <option value={QUOTA}>Quota di mercato</option>
          </select>
        </div>
        <LegendaGrafico obiettivo={voceAndamento !== QUOTA} />
        {andamento.caricamento || !andamento.dati ? <p className="piccolo">{andamento.errore ?? 'Caricamento…'}</p> : (() => {
          const etichette = settimaneAndamento.map((s) => { const [, m, g] = s.split('-').map(Number); return `${g}/${m}` })
          if (voceAndamento === QUOTA) {
            return <GraficoAndamento t={tGrafico} etichette={etichette} risultati={serieQuota(andamento.dati, settimaneAndamento)} nomeSerie="Quota di mercato" percentuale rigaRiferimento={OBIETTIVO_QUOTA} />
          }
          const s = serieSettimanale(andamento.dati, voceAndamento, settimaneAndamento)
          return <GraficoAndamento t={tGrafico} etichette={etichette} risultati={s.map((x) => x.risultato)} obiettivi={s.map((x) => x.obiettivo)}
            nomeSerie={ctx.metriche.find((m) => m.codice === voceAndamento)?.nome} />
        })()}
      </section>

      {generale && confrontoCitta.dati && (
        <section className="scheda">
          <h2>Roma e Milano a confronto · {descriviPeriodo(periodo)}</h2>
          <p className="piccolo">Visibile solo all'amministratore generale.</p>
          <div className="tabella-scorrevole">
            <table className="tabella" style={{ minWidth: 1000 }}>
              <thead><tr><th>Città</th><th className="destra">Uffici</th>{attivita.map((m) => <th key={m.codice} className="destra">{m.nome}</th>)}<th className="destra">Quota</th></tr></thead>
              <tbody>
                {ctx.citta.map((c) => {
                  const ufficiCitta = ctx.uffici.filter((u) => u.attivo && u.citta_id === c.id)
                  const tot = totaliPerUfficio(confrontoCitta.dati!.filter((r) => ufficiCitta.some((u) => u.id === r.ufficio_id)), ctx.metriche)
                  const tc = sommaTotali([...tot.values()])
                  return (
                    <tr key={c.id}>
                      <th scope="row" style={{ fontWeight: 600, fontSize: 16 }}>{c.nome}</th>
                      <td className="destra">{ufficiCitta.length}</td>
                      {attivita.map((m) => <CellaRisultato key={m.codice} totale={tc.get(m.codice)} />)}
                      <CellaQuota quota={quotaDaTotali(tc)} />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

/** Segnali della settimana (solo amministrazione): i primi uffici da seguire e le buone notizie; l'elenco completo è nella Riunione */
function RiquadroSegnali({ ctx, uffici, settimana }: { ctx: Contesto; uffici: Ufficio[]; settimana: string }) {
  const ids = uffici.map((u) => u.id)
  const { dati, errore } = useDati(async () => calcolaSegnali(await caricaRilevazioni(inizioSegnali(settimana), settimana, ids), uffici,
    ctx.metriche.filter((m) => m.tipo === 'attivita' && inClassifica(m.codice)), settimana), [settimana, ids.join(',')])
  return (
    <section className="scheda entra">
      <h2 className="titolo-icona"><span className="icona-quadrata icona-arancio"><Icona nome="flag" /></span>Segnali della settimana</h2>
      {!dati ? <Caricamento errore={errore} /> : <ElencoSegnali segnali={dati} massimo={6} />}
      <NotaSegnali />
    </section>
  )
}

