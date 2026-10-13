// "Il mio ufficio" / "Andamento uffici": riepilogo mese per mese e grafici di andamento.
import { useState } from 'react'
import { quotaDaTotali, serieQuota, serieSettimanale } from '../lib/aggregazioni'
import { OBIETTIVO_QUOTA, totaliPeriodo } from '../lib/calcoli'
import { type Contesto, ufficiVisibili } from '../lib/contesto'
import { caricaRilevazioni } from '../lib/dati'
import { aggiungiSettimane, intervalloSettimana, lunediDi, meseDellaSettimana, nomeMese, oggiISO, settimaneDelMese } from '../lib/settimane'
import { useDati } from '../lib/useDati'
import { GraficoAndamento, LegendaGrafico } from '../componenti/Grafici'
import { useProgresso } from '../componenti/Interfaccia'
import { Caricamento, CellaQuota, CellaRisultato, Legenda } from '../componenti/Celle'

const SETTIMANE_GRAFICO = 12
const MESI_TABELLA = 6
const QUOTA = '__quota'

/** Ultimi n mesi, dal più recente al più vecchio (così sul telefono il mese in corso è subito visibile) */
function ultimiMesi(n: number): string[] {
  const corrente = meseDellaSettimana(lunediDi(oggiISO()))
  const [a, m] = corrente.split('-').map(Number)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - i, 1))
    return d.toISOString().slice(0, 7)
  })
}

const etichettaBreve = (lunedi: string) => {
  const [, m, g] = lunedi.split('-').map(Number)
  return `${g}/${m}`
}

export default function AndamentoUfficio({ ctx }: { ctx: Contesto }) {
  const uffici = ufficiVisibili(ctx)
  const predefinito = uffici.find((u) => u.id === ctx.utente.ufficio_id) ?? uffici[0]
  const [ufficioId, setUfficioId] = useState<number | undefined>(predefinito?.id)
  const [voce, setVoce] = useState(ctx.metriche.find((m) => m.tipo === 'attivita')?.codice ?? QUOTA)

  const mesi = ultimiMesi(MESI_TABELLA)
  const ultima = lunediDi(oggiISO())
  const settimaneGrafico = Array.from({ length: SETTIMANE_GRAFICO }, (_, i) => aggiungiSettimane(ultima, i - SETTIMANE_GRAFICO + 1))
  const da = [settimaneDelMese(mesi[mesi.length - 1])[0], settimaneGrafico[0]].sort()[0]

  const { dati, errore, caricamento } = useDati(
    () => (ufficioId ? caricaRilevazioni(da, ultima, [ufficioId]) : Promise.resolve([])),
    [ufficioId, da, ultima],
  )

  const t = useProgresso(`${ufficioId}-${voce}-${caricamento}`)

  if (!ufficioId) return <div className="scheda"><p>Nessun ufficio da mostrare.</p></div>

  const attivita = ctx.metriche.filter((m) => m.tipo === 'attivita')
  const zona = ctx.metriche.filter((m) => m.tipo === 'zona')
  const ufficio = uffici.find((u) => u.id === ufficioId)

  const totaliMese = mesi.map((mese) => {
    const settimane = new Set(settimaneDelMese(mese))
    return totaliPeriodo((dati ?? []).filter((r) => settimane.has(r.settimana)), ctx.metriche)
  })

  const nomeVoce = voce === QUOTA ? 'Quota di mercato' : ctx.metriche.find((m) => m.codice === voce)?.nome ?? voce
  const serie = voce === QUOTA ? null : serieSettimanale(dati ?? [], voce, settimaneGrafico)
  const isZona = zona.some((m) => m.codice === voce)

  return (
    <div className="pagina pagina-ampia entra">
      <div className="intestazione-titoli">
        <span className="kicker">{ctx.utente.ruolo === 'ufficio' ? 'Il mio ufficio' : 'Andamento uffici'}</span>
        {uffici.length > 1 ? (
          <select className="select-titolo" style={{ alignSelf: 'flex-start' }} aria-label="Ufficio" value={ufficioId} onChange={(e) => setUfficioId(Number(e.target.value))}>
            {uffici.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        ) : <h1 className="titolo-pagina">{ufficio?.nome}</h1>}
      </div>

      {caricamento || errore || !dati ? <Caricamento errore={errore} /> : (
        <>
          <section className="scheda">
            <div className="scheda-titolo">
              <h2>Andamento ultime {SETTIMANE_GRAFICO} settimane</h2>
              <select value={voce} onChange={(e) => setVoce(e.target.value)} aria-label="Voce del grafico">
                <optgroup label="Attività">{attivita.map((m) => <option key={m.codice} value={m.codice}>{m.nome}</option>)}</optgroup>
                <optgroup label="Zona">
                  <option value={QUOTA}>Quota di mercato</option>
                  {zona.map((m) => <option key={m.codice} value={m.codice}>{m.nome}</option>)}
                </optgroup>
              </select>
            </div>
            <LegendaGrafico obiettivo={voce !== QUOTA && !isZona} />
            {voce === QUOTA ? (
              <GraficoAndamento t={t} etichette={settimaneGrafico.map(etichettaBreve)} risultati={serieQuota(dati, settimaneGrafico)}
                nomeSerie="Quota di mercato" percentuale rigaRiferimento={OBIETTIVO_QUOTA} />
            ) : (
              <GraficoAndamento t={t} etichette={settimaneGrafico.map(etichettaBreve)} nomeSerie={nomeVoce}
                risultati={serie!.map((x) => x.risultato)} obiettivi={isZona ? undefined : serie!.map((x) => x.obiettivo)} />
            )}
            <p className="piccolo">Settimane dal {intervalloSettimana(settimaneGrafico[0]).split(' – ')[0]} a oggi. Passa sopra il grafico per vedere i valori.</p>
          </section>

          <section className="scheda entra entra-1">
            <h2>Riepilogo mese per mese</h2>
            <div className="tabella-scorrevole">
              <table className="tabella" style={{ minWidth: 720 }}>
                <thead>
                  <tr><th></th>{mesi.map((m) => <th key={m} className="destra">{nomeMese(m).replace(/ \d+$/, '').replace(/^./, (c) => c.toUpperCase())}</th>)}</tr>
                </thead>
                <tbody>
                  {attivita.map((m) => (
                    <tr key={m.codice}><th scope="row">{m.nome}</th>{totaliMese.map((x, i) => <CellaRisultato key={i} totale={x.get(m.codice)} />)}</tr>
                  ))}
                  <tr className="separatore"><th colSpan={mesi.length + 1}>Zona (valore a fine mese)</th></tr>
                  {zona.map((m) => (
                    <tr key={m.codice}><th scope="row">{m.nome}</th>{totaliMese.map((x, i) => <td key={i} className="destra">{x.get(m.codice)?.risultato?.toLocaleString('it-IT') ?? '—'}</td>)}</tr>
                  ))}
                  <tr><th scope="row" style={{ fontWeight: 600 }}>Quota di mercato</th>{totaliMese.map((x, i) => <CellaQuota key={i} quota={quotaDaTotali(x)} />)}</tr>
                </tbody>
              </table>
            </div>
            <Legenda />
          </section>
        </>
      )}
    </div>
  )
}
