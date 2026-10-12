// Cruscotto della città: tabella uffici × attività, totali di area e città,
// confronto tra aree, andamento della città e (solo admin generale) Roma vs Milano.
import { Fragment, useState } from 'react'
import { quotaDaTotali, raggiungimento, serieQuota, serieSettimanale, sommaTotali, statoCompilazione, totaliPerUfficio, type Totali } from '../lib/aggregazioni'
import { formattaPercentuale, OBIETTIVO_QUOTA } from '../lib/calcoli'
import { type Contesto, nomeArea, ufficiVisibili } from '../lib/contesto'
import { caricaRilevazioni } from '../lib/dati'
import { aggiungiSettimane, lunediDi, oggiISO } from '../lib/settimane'
import type { Rilevazione, Ufficio } from '../lib/tipi'
import { useDati } from '../lib/useDati'
import { Caricamento, CellaQuota, CellaRisultato, Legenda } from '../componenti/Celle'
import { GraficoAndamento } from '../componenti/Grafici'
import SceltaPeriodo, { descriviPeriodo, estremiPeriodo, periodoPredefinito, type Periodo } from '../componenti/SceltaPeriodo'

const SETTIMANE_ANDAMENTO = 12
const QUOTA = '__quota'

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

  const periodoDati = useDati(() => caricaRilevazioni(da, a, ids), [da, a, ids.join(',')])
  const andamento = useDati(() => caricaRilevazioni(settimaneAndamento[0], ultima, ids), [ultima, ids.join(',')])
  // Roma vs Milano: solo l'admin generale legge entrambe le città
  const confrontoCitta = useDati(
    () => (generale ? caricaRilevazioni(da, a) : Promise.resolve([] as Rilevazione[])),
    [generale, da, a],
  )

  const attivita = ctx.metriche.filter((m) => m.tipo === 'attivita')
  const areeCitta = ctx.aree.filter((ar) => ar.citta_id === ctx.cittaId)

  return (
    <div className="pagina pagina-larga">
      <div className="scheda barra-filtri">
        <SceltaPeriodo periodo={periodo} onCambia={setPeriodo} />
        {areeCitta.length > 0 && (
          <label>Area
            <select value={areaFiltro} onChange={(e) => setAreaFiltro(e.target.value === 'tutte' ? 'tutte' : Number(e.target.value))}>
              <option value="tutte">Tutte le aree</option>
              {areeCitta.map((ar) => <option key={ar.id} value={ar.id}>{ar.nome}</option>)}
            </select>
          </label>
        )}
      </div>

      {periodoDati.caricamento || periodoDati.errore || !periodoDati.dati ? <Caricamento errore={periodoDati.errore} /> : (() => {
        const righe = periodoDati.dati
        const totali = totaliPerUfficio(righe, ctx.metriche)
        const totaleCitta = sommaTotali(uffici.map((u) => totali.get(u.id)).filter((t): t is Totali => !!t))
        const compilati = periodo.tipo === 'settimana'
          ? uffici.filter((u) => statoCompilazione(righe.filter((r) => r.ufficio_id === u.id), ctx.metriche) !== 'mancante').length
          : null

        // Uffici raggruppati per area (quelli senza area in fondo)
        const gruppi = new Map<number | null, Ufficio[]>()
        for (const u of uffici) gruppi.set(u.area_id, [...(gruppi.get(u.area_id) ?? []), u])
        const ordineGruppi = [...gruppi.keys()].sort((x, y) => (x === null ? 1 : y === null ? -1 : nomeArea(ctx, x).localeCompare(nomeArea(ctx, y))))
        const totaleGruppo = (lista: Ufficio[]) => sommaTotali(lista.map((u) => totali.get(u.id)).filter((t): t is Totali => !!t))

        return (
          <>
            <div className="riquadri">
              {attivita.slice(0, 6).map((m) => {
                const t = totaleCitta.get(m.codice)
                const r = raggiungimento(t)
                return (
                  <div key={m.codice} className="riquadro">
                    <span className="riquadro-titolo">{m.nome}</span>
                    <strong className="riquadro-valore">{t?.risultato ?? '—'}</strong>
                    <span className="piccolo">{t?.obiettivo != null ? `obiettivo ${t.obiettivo} · ${formattaPercentuale(r)}` : 'nessun obiettivo'}</span>
                  </div>
                )
              })}
              <div className="riquadro">
                <span className="riquadro-titolo">Quota di mercato</span>
                <strong className="riquadro-valore">{formattaPercentuale(quotaDaTotali(totaleCitta))}</strong>
                <span className="piccolo">obiettivo {formattaPercentuale(OBIETTIVO_QUOTA)}</span>
              </div>
              {compilati !== null && (
                <div className="riquadro">
                  <span className="riquadro-titolo">Uffici che hanno compilato</span>
                  <strong className="riquadro-valore">{compilati} / {uffici.length}</strong>
                  <span className="piccolo">{uffici.length - compilati === 0 ? 'tutti presenti' : `${uffici.length - compilati} mancanti`}</span>
                </div>
              )}
            </div>

            <div className="scheda">
              <h2>Uffici · {descriviPeriodo(periodo)}</h2>
              <div className="tabella-scorrevole">
                <table className="tabella-riepilogo tabella-cruscotto">
                  <thead>
                    <tr><th>Ufficio</th>{attivita.map((m) => <th key={m.codice}>{m.nome}</th>)}<th>Quota</th></tr>
                  </thead>
                  <tbody>
                    {ordineGruppi.map((areaId) => {
                      const lista = gruppi.get(areaId)!
                      const tg = totaleGruppo(lista)
                      return (
                        <Fragment key={String(areaId)}>
                          {ordineGruppi.length > 1 && <tr className="separatore"><th colSpan={attivita.length + 2}>{nomeArea(ctx, areaId)}</th></tr>}
                          {lista.map((u) => (
                            <tr key={u.id}>
                              <th scope="row">{u.nome}</th>
                              {attivita.map((m) => <CellaRisultato key={m.codice} totale={totali.get(u.id)?.get(m.codice)} />)}
                              <CellaQuota quota={quotaDaTotali(totali.get(u.id))} />
                            </tr>
                          ))}
                          {ordineGruppi.length > 1 && (
                            <tr className="riga-totale">
                              <th scope="row">Totale {nomeArea(ctx, areaId)}</th>
                              {attivita.map((m) => <CellaRisultato key={m.codice} totale={tg.get(m.codice)} />)}
                              <CellaQuota quota={quotaDaTotali(tg)} />
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                    <tr className="riga-totale riga-totale-citta">
                      <th scope="row">Totale {areaFiltro === 'tutte' ? ctx.citta.find((c) => c.id === ctx.cittaId)?.nome : nomeArea(ctx, areaFiltro)}</th>
                      {attivita.map((m) => <CellaRisultato key={m.codice} totale={totaleCitta.get(m.codice)} />)}
                      <CellaQuota quota={quotaDaTotali(totaleCitta)} />
                    </tr>
                  </tbody>
                </table>
              </div>
              <Legenda />
              {periodo.tipo === 'mese' && <p className="piccolo">Mese: somma di {settimane.length} settimane. Quota calcolata sui dati di zona dell'ultima settimana compilata.</p>}
            </div>

            {areaFiltro === 'tutte' && ordineGruppi.length > 1 && (
              <div className="scheda">
                <h2>Confronto tra aree</h2>
                <p className="piccolo">Per confrontare aree di dimensioni diverse, sotto il totale c'è la media per ufficio.</p>
                <div className="tabella-scorrevole">
                  <table className="tabella-riepilogo">
                    <thead><tr><th>Area</th><th>Uffici</th>{attivita.map((m) => <th key={m.codice}>{m.nome}</th>)}<th>Quota</th></tr></thead>
                    <tbody>
                      {ordineGruppi.map((areaId) => {
                        const lista = gruppi.get(areaId)!
                        const tg = totaleGruppo(lista)
                        return (
                          <tr key={String(areaId)}>
                            <th scope="row">{nomeArea(ctx, areaId)}</th>
                            <td className="numero">{lista.length}</td>
                            {attivita.map((m) => {
                              const t = tg.get(m.codice)
                              return (
                                <td key={m.codice} className="numero">
                                  <span className="valore">{t?.risultato ?? '—'}</span>
                                  {t?.risultato != null && <span className="obiettivo">media {(t.risultato / lista.length).toLocaleString('it-IT', { maximumFractionDigits: 1 })}</span>}
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
              </div>
            )}
          </>
        )
      })()}

      <div className="scheda">
        <div className="titolo-con-azioni">
          <h2>Andamento {areaFiltro === 'tutte' ? 'della città' : 'dell\'area'} · ultime {SETTIMANE_ANDAMENTO} settimane</h2>
          <select className="select-compatta" value={voceAndamento} onChange={(e) => setVoceAndamento(e.target.value)} aria-label="Voce del grafico">
            {attivita.map((m) => <option key={m.codice} value={m.codice}>{m.nome}</option>)}
            <option value={QUOTA}>Quota di mercato</option>
          </select>
        </div>
        {andamento.caricamento || !andamento.dati ? <p className="piccolo">{andamento.errore ?? 'Caricamento…'}</p> : (() => {
          const etichette = settimaneAndamento.map((s) => { const [, m, g] = s.split('-').map(Number); return `${g}/${m}` })
          if (voceAndamento === QUOTA) {
            return <GraficoAndamento etichette={etichette} risultati={serieQuota(andamento.dati, settimaneAndamento)} nomeSerie="Quota di mercato" percentuale rigaRiferimento={OBIETTIVO_QUOTA} />
          }
          const s = serieSettimanale(andamento.dati, voceAndamento, settimaneAndamento)
          return <GraficoAndamento etichette={etichette} risultati={s.map((t) => t.risultato)} obiettivi={s.map((t) => t.obiettivo)}
            nomeSerie={ctx.metriche.find((m) => m.codice === voceAndamento)?.nome} />
        })()}
      </div>

      {generale && confrontoCitta.dati && (
        <div className="scheda">
          <h2>Roma e Milano a confronto · {descriviPeriodo(periodo)}</h2>
          <p className="piccolo">Visibile solo all'amministratore generale.</p>
          <div className="tabella-scorrevole">
            <table className="tabella-riepilogo">
              <thead><tr><th>Città</th><th>Uffici</th>{attivita.map((m) => <th key={m.codice}>{m.nome}</th>)}<th>Quota</th></tr></thead>
              <tbody>
                {ctx.citta.map((c) => {
                  const ufficiCitta = ctx.uffici.filter((u) => u.attivo && u.citta_id === c.id)
                  const tot = totaliPerUfficio(confrontoCitta.dati!.filter((r) => ufficiCitta.some((u) => u.id === r.ufficio_id)), ctx.metriche)
                  const tc = sommaTotali([...tot.values()])
                  return (
                    <tr key={c.id}>
                      <th scope="row">{c.nome}</th>
                      <td className="numero">{ufficiCitta.length}</td>
                      {attivita.map((m) => <CellaRisultato key={m.codice} totale={tc.get(m.codice)} />)}
                      <CellaQuota quota={quotaDaTotali(tc)} />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
