// "Il mio ufficio" / "Andamento uffici": riepilogo mese per mese e grafici di andamento.
import { useState } from 'react'
import { quotaDaTotali, serieQuota, serieSettimanale } from '../lib/aggregazioni'
import { OBIETTIVO_QUOTA, totaliPeriodo } from '../lib/calcoli'
import { MENSILE_ATTIVO, type Contesto, ufficiVisibili } from '../lib/contesto'
import {
  caricaPersone, caricaRilevazioni, caricaStorico, caricaTotaliCitta, caricaTotaliMensiliCitta, caricaValoriMesi, caricaVociMensili,
} from '../lib/dati'
import { calcolaImbuto, codiciImbuto, IMBUTO_MENSILE, IMBUTO_SETTIMANALE, MESI_IMBUTO, SETTIMANE_IMBUTO, sommaPeriodi, type Imbuto } from '../lib/imbuto'
import { aggiungiMesi, mesePredefinito, titoloMese, totaleConStorico } from '../lib/mensile'
import {
  aggiungiSettimane, giornoEMese, intervalloSettimane, lunediDi, meseDellaSettimana, nomeMese, oggiISO, settimaneDelMese, ultimaSettimanaConclusa,
} from '../lib/settimane'
import type { Ufficio } from '../lib/tipi'
import { useDati } from '../lib/useDati'
import { GraficoAndamento, LegendaGrafico } from '../componenti/Grafici'
import { GraficoImbuto, NotaImbuto } from '../componenti/Imbuto'
import { Icona, useProgresso } from '../componenti/Interfaccia'
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

      {ufficio && <RiquadroImbuto key={ufficio.id} ufficio={ufficio} conCitta={ctx.utente.ruolo === 'ufficio'} nomeCitta={ctx.citta.find((c) => c.id === ufficio.citta_id)?.nome ?? ''} />}

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
            <p className="piccolo">Settimane dal {giornoEMese(settimaneGrafico[0])} a oggi. Passa sopra il grafico per vedere i valori.</p>
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

/** Le ultime settimane già concluse, dalla più vecchia */
const settimaneImbuto = () => Array.from({ length: SETTIMANE_IMBUTO }, (_, i) => aggiungiSettimane(ultimaSettimanaConclusa(), i - SETTIMANE_IMBUTO + 1))
/** Gli ultimi mesi già conclusi ('AAAA-MM-01'), dal più vecchio */
const mesiImbuto = () => Array.from({ length: MESI_IMBUTO }, (_, i) => aggiungiMesi(mesePredefinito(), i - MESI_IMBUTO + 1))

/**
 * Imbuto della vendita dell'ufficio sulle ultime 4 settimane (rapportini settimanali) o sugli ultimi 3 mesi
 * (rapportini mensili). Per un account ufficio, accanto c'è quello di tutta la sua città (solo le somme).
 */
function RiquadroImbuto({ ufficio, conCitta, nomeCitta }: { ufficio: Ufficio; conCitta: boolean; nomeCitta: string }) {
  const [tipo, setTipo] = useState<'settimane' | 'mesi'>('settimane')
  const { dati, errore } = useDati<{ ufficio: Imbuto; citta: Imbuto | null; periodo: string }>(async () => {
    if (tipo === 'settimane') {
      const settimane = settimaneImbuto()
      const codici = codiciImbuto(IMBUTO_SETTIMANALE)
      const [righe, citta] = await Promise.all([
        caricaRilevazioni(settimane[0], settimane[settimane.length - 1], [ufficio.id]),
        conCitta ? caricaTotaliCitta(settimane.map((s) => [s])) : null,
      ])
      const somma = new Map(codici.map((c) => {
        const valori = righe.filter((r) => r.metrica === c && r.risultato !== null).map((r) => r.risultato!)
        return [c, valori.length ? valori.reduce((a, b) => a + b, 0) : null]
      }))
      const risultatiDi = (t: Map<string, { risultato: number | null }>) => new Map(codici.map((c) => [c, t.get(c)?.risultato ?? null]))
      return {
        ufficio: calcolaImbuto(IMBUTO_SETTIMANALE, somma),
        citta: citta ? calcolaImbuto(IMBUTO_SETTIMANALE, sommaPeriodi(citta.andamento.map(risultatiDi), codici)) : null,
        periodo: `Ultime ${settimane.length} settimane concluse (${intervalloSettimane(settimane[0], settimane[settimane.length - 1])}), rapportini settimanali`,
      }
    }
    const mesi = mesiImbuto()
    const codici = codiciImbuto(IMBUTO_MENSILE)
    const [voci, persone, valori, storico, citta] = await Promise.all([
      caricaVociMensili(), caricaPersone([ufficio.id]), caricaValoriMesi(mesi, [ufficio.id]), caricaStorico(mesi, [ufficio.id]),
      conCitta ? caricaTotaliMensiliCitta(mesi, codici) : null,
    ])
    const perMese = mesi.map((m) => totaleConStorico(persone, valori, m, voci, storico).totale)
    return {
      ufficio: calcolaImbuto(IMBUTO_MENSILE, sommaPeriodi(perMese, codici)),
      citta: citta ? calcolaImbuto(IMBUTO_MENSILE, sommaPeriodi(citta.andamento, codici)) : null,
      periodo: `Ultimi ${mesi.length} mesi conclusi (${titoloMese(mesi[0]).toLowerCase()} – ${titoloMese(mesi[mesi.length - 1]).toLowerCase()}), rapportini mensili`,
    }
  }, [tipo, ufficio.id, conCitta])
  const t = useProgresso(`${tipo}-${ufficio.id}-${!!dati}`)

  return (
    <section className="scheda entra">
      <div className="scheda-titolo">
        <h2 className="titolo-icona"><span className="icona-quadrata icona-blu"><Icona nome="funnel" /></span>Imbuto della vendita</h2>
        {MENSILE_ATTIVO && (
          <div className="segmentato" role="tablist">
            {([['settimane', `Ultime ${SETTIMANE_IMBUTO} settimane`], ['mesi', `Ultimi ${MESI_IMBUTO} mesi`]] as const).map(([k, nome]) => (
              <button key={k} role="tab" aria-selected={tipo === k} className={tipo === k ? 'attivo' : ''} onClick={() => setTipo(k)}>{nome}</button>
            ))}
          </div>
        )}
      </div>
      {!dati ? <Caricamento errore={errore} /> : (
        <>
          <div className="imbuto-griglia">
            <GraficoImbuto t={t} titolo={ufficio.nome} imbuto={dati.ufficio} riferimento={dati.citta} nomeRiferimento={nomeCitta} />
            {dati.citta && <GraficoImbuto t={t} titolo={`Tutta ${nomeCitta}`} imbuto={dati.citta} />}
          </div>
          <NotaImbuto periodo={dati.periodo + (dati.citta ? `. In verde i passaggi almeno come tutta ${nomeCitta}, in arancio quelli sotto (la città mostra solo le somme, mai i singoli uffici)` : '')} />
        </>
      )}
    </section>
  )
}
