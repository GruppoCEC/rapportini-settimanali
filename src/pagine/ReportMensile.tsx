// Pagina "Report mensile" (amministratori): il riepilogo di fine mese di tutto il gruppo,
// come il file Excel "Modello rapportino mensile gruppo", stampabile; i rapportini dei
// singoli uffici; le liste di funzionari, coordinatrici e marketer (base per il punteggio).
import { useEffect, useMemo, useState } from 'react'
import type { Contesto } from '../lib/contesto'
import { leggiNumero } from '../lib/calcoli'
import { caricaConfronto, caricaPersone, caricaValoriMensili, caricaVociMensili } from '../lib/dati'
import {
  aggiungiMesi, dataItaliana, formattaAnzianita, formattaNumero, formattaVariazione, inServizio, mesePredefinito, mesiDiServizio,
  ordinaPersone, ordinaUfficiReport, righeDelMese, sommaTotali, STAFF, statoMensile, titoloMese, totaleUfficio, variazione, type TotaliMese,
} from '../lib/mensile'
import { supabase } from '../lib/supabase'
import { NOMI_RUOLO_PERSONA, type Persona, type RuoloPersona, type Ufficio, type ValoreMensile, type VoceMensile } from '../lib/tipi'
import { useDati } from '../lib/useDati'
import type { StatoCompilazione } from '../lib/aggregazioni'
import { BadgeStato, Caricamento, CLASSE_STATO, ETICHETTA_STATO } from '../componenti/Celle'
import { Icona, useToast } from '../componenti/Interfaccia'
import SceltaMese from '../componenti/SceltaMese'
import { TabellaRapportino, TestataVoci } from '../componenti/TabellaMensile'

type Scheda = 'panoramica' | 'rapportini' | 'personale'

interface DatiUfficio {
  ufficio: Ufficio
  persone: Persona[]
  valori: ValoreMensile[]
  totale: TotaliMese
  stato: StatoCompilazione
}

interface DatiMese {
  voci: VoceMensile[]
  uffici: DatiUfficio[]
  confronto: Map<string, number | null>
}

export default function ReportMensile({ ctx }: { ctx: Contesto }) {
  const [scheda, setScheda] = useState<Scheda>('panoramica')
  const [mese, setMese] = useState(mesePredefinito())
  const generale = ctx.utente.ruolo === 'admin_generale'

  // Il report è unico per tutto il gruppo: l'amministratore generale vede Roma e Milano insieme,
  // l'amministratore di città la sua città (le regole del database filtrano comunque)
  const uffici = useMemo(() => ordinaUfficiReport(ctx.uffici.filter((u) => u.attivo && (generale || u.citta_id === ctx.utente.citta_id))),
    [ctx.uffici, generale, ctx.utente.citta_id])
  const ids = uffici.map((u) => u.id)

  const dati = useDati<DatiMese>(async () => {
    const [voci, persone, valori, confronto] = await Promise.all([
      caricaVociMensili(), caricaPersone(ids), caricaValoriMensili(mese, ids),
      generale ? caricaConfronto(aggiungiMesi(mese, -12)) : Promise.resolve(new Map<string, number | null>()),
    ])
    return {
      voci,
      confronto,
      uffici: uffici.map((ufficio) => {
        const suePersone = persone.filter((p) => p.ufficio_id === ufficio.id)
        const suoiValori = valori.filter((v) => v.ufficio_id === ufficio.id)
        return {
          ufficio, persone: suePersone, valori: suoiValori,
          totale: totaleUfficio(suePersone, suoiValori, mese, voci),
          stato: statoMensile(suePersone.filter((p) => inServizio(p, mese)), suoiValori, voci),
        }
      }),
    }
  }, [mese, ids.join(','), generale])

  const nomeCitta = ctx.citta.find((c) => c.id === ctx.utente.citta_id)?.nome ?? ''
  const titolo = generale ? 'Gruppo' : nomeCitta

  return (
    <div className="pagina entra">
      <div className="intestazione non-stampa">
        <div className="intestazione-titoli">
          <span className="kicker">Report mensile</span>
          <h1 className="titolo-pagina">{titolo}</h1>
        </div>
        <SceltaMese mese={mese} onCambia={setMese} />
      </div>
      <div className="comandi non-stampa">
        <div className="segmentato" role="tablist">
          {(['panoramica', 'rapportini', 'personale'] as Scheda[]).map((s) => (
            <button key={s} role="tab" aria-selected={scheda === s} className={scheda === s ? 'attivo' : ''} onClick={() => setScheda(s)}>
              <Icona nome={{ panoramica: 'table', rapportini: 'storefront', personale: 'users-three' }[s]} />
              {{ panoramica: 'Panoramica', rapportini: 'Singoli rapportini', personale: 'Personale' }[s]}
            </button>
          ))}
        </div>
        <button className="btn btn-secondario" onClick={() => window.print()} disabled={!dati.dati}><Icona nome="printer" />Stampa</button>
      </div>

      {!dati.dati ? <Caricamento errore={dati.errore} /> : (
        <>
          {scheda === 'panoramica' && <Panoramica dati={dati.dati} mese={mese} titolo={titolo} generale={generale} ctx={ctx} onSalvato={dati.ricarica} />}
          {scheda === 'rapportini' && <SingoliRapportini dati={dati.dati} mese={mese} />}
          {scheda === 'personale' && <ListePersonale dati={dati.dati} mese={mese} generale={generale} ctx={ctx} />}
        </>
      )}
    </div>
  )
}

const plurale = (n: number, uno: string, tanti: string) => `${n} ${n === 1 ? uno : tanti}`
const riepilogo = (conta: (s: StatoCompilazione) => number) =>
  [plurale(conta('completo'), 'completo', 'completi'), plurale(conta('parziale'), 'parziale', 'parziali'), plurale(conta('mancante'), 'mancante', 'mancanti')].join(', ')

const nomeCittaBreve = (ctx: Contesto, id: number) => (ctx.citta.find((c) => c.id === id)?.nome ?? '').slice(0, 2).toUpperCase()

// ---------------------------------------------------------------- Panoramica di gruppo

function Panoramica({ dati, mese, titolo, generale, ctx, onSalvato }: {
  dati: DatiMese; mese: string; titolo: string; generale: boolean; ctx: Contesto; onSalvato: () => void
}) {
  const { voci } = dati
  const colonne = [STAFF, ...voci.map((v) => v.codice)]
  const meseAnnoPrima = aggiungiMesi(mese, -12)
  const totale = sommaTotali(dati.uffici.map((u) => u.totale))
  const blocchi = [1, 2].map((b) => dati.uffici.filter((u) => (u.ufficio.blocco_mensile ?? 1) === b)).filter((b) => b.length > 0)
  const conta = (s: StatoCompilazione) => dati.uffici.filter((u) => u.stato === s).length
  const piuCitta = new Set(dati.uffici.map((u) => u.ufficio.citta_id)).size > 1

  // Confronto con l'anno prima, scritto a mano dall'amministratore generale
  const iniziale = () => Object.fromEntries(colonne.map((c) => [c, dati.confronto.get(c)?.toString() ?? '']))
  const [annoPrima, setAnnoPrima] = useState<Record<string, string>>(iniziale)
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [toast, mostraToast] = useToast()
  useEffect(() => { setAnnoPrima(iniziale()) }, [dati.confronto])  // eslint-disable-line react-hooks/exhaustive-deps
  const modificate = colonne.filter((c) => (annoPrima[c] ?? '') !== (dati.confronto.get(c)?.toString() ?? ''))
  const errate = colonne.filter((c) => leggiNumero(annoPrima[c] ?? '') === 'errore')
  const valoreAnnoPrima = (c: string) => { const v = leggiNumero(annoPrima[c] ?? ''); return typeof v === 'number' ? v : null }

  async function salvaConfronto() {
    if (errate.length > 0) { setErrore('Alcune caselle dell\'anno precedente non sono numeri interi.'); return }
    setSalvataggio(true)
    setErrore(null)
    const { error } = await supabase.from('confronto_anno_prima').upsert(
      modificate.map((voce) => ({ mese: meseAnnoPrima, voce, valore: valoreAnnoPrima(voce) })), { onConflict: 'mese,voce' })
    setSalvataggio(false)
    if (error) { setErrore(`Salvataggio non riuscito: ${error.message}`); return }
    mostraToast(`Dati di ${titoloMese(meseAnnoPrima).toLowerCase()} salvati.`)
    onSalvato()
  }

  const rigaUfficio = (u: DatiUfficio) => (
    <tr key={u.ufficio.id}>
      <th scope="row" className="ufficio-fisso">
        {u.ufficio.nome}{piuCitta && u.ufficio.citta_id !== ctx.citta[0]?.id && <span className="sigla-citta">{nomeCittaBreve(ctx, u.ufficio.citta_id)}</span>}
      </th>
      <td className="centro-testo"><span className={`tag tag-simbolo ${CLASSE_STATO[u.stato]}`} title={ETICHETTA_STATO[u.stato]}>{ETICHETTA_STATO[u.stato].charAt(0)}</span></td>
      {colonne.map((c) => <td key={c} className={`destra ${u.totale.get(c) == null ? 'cella-vuota' : ''}`}>{formattaNumero(u.totale.get(c))}</td>)}
    </tr>
  )

  return (
    <>
      <div className="riepilogo-mese non-stampa">
        <span className="tag tag-ok">✓ {plurale(conta('completo'), 'completo', 'completi')}</span>
        <span className="tag tag-quasi">◐ {plurale(conta('parziale'), 'parziale', 'parziali')}</span>
        <span className="tag tag-ko">✗ {plurale(conta('mancante'), 'mancante', 'mancanti')}</span>
        <span className="piccolo">su {dati.uffici.length} uffici · {titoloMese(mese)}</span>
      </div>
      <section className="scheda scheda-stampa">
        <div className="tabella-scorrevole">
          <table className="tabella tabella-mensile tabella-report">
            <TestataVoci voci={voci} prime={['Ufficio', 'Stato', 'Staff']} titoloStampa={<>
              Report mensile · {titolo} · {titoloMese(mese)}
              <span className="legenda-titolo">Stato: ✓ completo · ◐ parziale · ✗ mancante — {riepilogo(conta)} su {dati.uffici.length} uffici · Staff = persone in servizio nel mese</span>
            </>} />
            <tbody>
              {blocchi.map((b, i) => [
                i > 0 && <tr key={`sep${i}`} className="separatore-blocco"><td colSpan={colonne.length + 2} /></tr>,
                ...b.map(rigaUfficio),
              ])}
              <tr className="riga-totale-mese">
                <th scope="row" className="ufficio-fisso">Totale {generale ? 'gruppo' : titolo}</th>
                <td />
                {colonne.map((c) => <td key={c} className="destra">{formattaNumero(totale.get(c))}</td>)}
              </tr>
              {generale && (
                <>
                  <tr className="riga-anno-prima">
                    <th scope="row" className="ufficio-fisso">{titoloMese(meseAnnoPrima)}<span className="piccolo non-stampa">scritto a mano</span></th>
                    <td />
                    {colonne.map((c) => (
                      <td key={c} className="destra">
                        <input inputMode="numeric" value={annoPrima[c] ?? ''} aria-label={`${titoloMese(meseAnnoPrima)} – ${c}`}
                          className={errate.includes(c) ? 'non-valido' : ''}
                          onChange={(e) => { setAnnoPrima((a) => ({ ...a, [c]: e.target.value })); setErrore(null) }} />
                      </td>
                    ))}
                  </tr>
                  <tr className="riga-variazione">
                    <th scope="row" className="ufficio-fisso">Variazione rispetto al {meseAnnoPrima.slice(0, 4)}</th>
                    <td />
                    {colonne.map((c) => {
                      const v = variazione(totale.get(c), valoreAnnoPrima(c))
                      return <td key={c} className={`destra ${v === null ? 'cella-vuota' : v >= 0 ? 'positivo' : 'negativo'}`}>{formattaVariazione(v)}</td>
                    })}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <p className="legenda-stampa">
          Stato: ✓ completo · ◐ parziale · ✗ mancante — {riepilogo(conta)} su {dati.uffici.length} uffici.
          Staff = persone in servizio nel mese.
        </p>
        {generale && (
          <div className="barra-confronto non-stampa">
            <p className="piccolo">
              La riga <strong>{titoloMese(meseAnnoPrima)}</strong> si scrive a mano (totali di gruppo dello stesso mese dell'anno prima): serve a calcolare la variazione.
            </p>
            {errore && <span className="errore">{errore}</span>}
            <button className="btn btn-primario" disabled={modificate.length === 0 || salvataggio} onClick={salvaConfronto}>
              <Icona nome={salvataggio ? 'circle-notch' : 'floppy-disk'} className={salvataggio ? 'gira' : ''} />Salva {titoloMese(meseAnnoPrima).toLowerCase()}
            </button>
          </div>
        )}
      </section>
      {toast}
    </>
  )
}

// ---------------------------------------------------------------- Singoli rapportini

function SingoliRapportini({ dati, mese }: { dati: DatiMese; mese: string }) {
  const [ufficioId, setUfficioId] = useState(dati.uffici[0]?.ufficio.id)
  const u = dati.uffici.find((x) => x.ufficio.id === ufficioId) ?? dati.uffici[0]
  if (!u) return <div className="scheda"><p className="piccolo">Nessun ufficio.</p></div>
  const testo = (pid: number, voce: string) => u.valori.find((v) => v.persona_id === pid && v.voce === voce)?.valore?.toString() ?? ''
  const recente = u.valori.filter((v) => v.aggiornato_il).sort((a, b) => b.aggiornato_il!.localeCompare(a.aggiornato_il!))[0]

  return (
    <section className="scheda scheda-stampa">
      <div className="scheda-titolo non-stampa">
        <select className="select-titolo" aria-label="Ufficio" value={u.ufficio.id} onChange={(e) => setUfficioId(Number(e.target.value))}>
          {dati.uffici.map((x) => <option key={x.ufficio.id} value={x.ufficio.id}>{x.ufficio.nome}</option>)}
        </select>
        <BadgeStato stato={u.stato} />
        {recente?.aggiornato_il && <span className="piccolo">Ultimo salvataggio: {new Date(recente.aggiornato_il).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</span>}
      </div>
      {u.stato === 'mancante' && <p className="avviso avviso-arancio non-stampa"><Icona nome="warning-circle" /><span>{u.ufficio.nome} non ha ancora inserito i numeri di {titoloMese(mese).toLowerCase()}.</span></p>}
      <TabellaRapportino voci={dati.voci} mese={mese} righe={righeDelMese(u.persone, u.valori, mese)} totale={u.totale} testo={testo}
        titoloStampa={`Rapportino mensile · ${u.ufficio.nome} · ${titoloMese(mese)}`} />
      <p className="piccolo non-stampa">Per correggere i numeri di un ufficio apri <strong>Rapportino mensile</strong> e scegli l'ufficio in alto.</p>
    </section>
  )
}

// ---------------------------------------------------------------- Liste del personale

const LISTE: { ruolo: RuoloPersona; titolo: string }[] = [
  { ruolo: 'funzionario', titolo: 'Funzionari' },
  { ruolo: 'coordinatrice', titolo: 'Coordinatrici' },
  { ruolo: 'marketer', titolo: 'Marketer' },
]

function ListePersonale({ dati, mese, generale, ctx }: { dati: DatiMese; mese: string; generale: boolean; ctx: Contesto }) {
  const [citta, setCitta] = useState<number | 'tutte'>('tutte')
  const uffici = dati.uffici.filter((u) => citta === 'tutte' || u.ufficio.citta_id === citta)
  const ordineUfficio = new Map(dati.uffici.map((u, i) => [u.ufficio.id, i]))

  return (
    <>
      <div className="comandi non-stampa">
        {generale && (
          <div className="segmentato">
            {(['tutte', ...ctx.citta.map((c) => c.id)] as (number | 'tutte')[]).map((c) => (
              <button key={c} className={citta === c ? 'attivo' : ''} onClick={() => setCitta(c)}>
                {c === 'tutte' ? 'Tutte le città' : ctx.citta.find((x) => x.id === c)?.nome}
              </button>
            ))}
          </div>
        )}
        <p className="avviso"><Icona nome="info" /><span>Persone in servizio a {titoloMese(mese).toLowerCase()} con i loro numeri del mese. La colonna <strong>Punteggio</strong> si riempirà quando saranno definiti i criteri.</span></p>
      </div>
      {LISTE.map(({ ruolo, titolo }) => {
        const righe = uffici
          .flatMap((u) => u.persone.filter((p) => p.ruolo === ruolo && inServizio(p, mese)).map((p) => ({ p, u })))
          .sort((a, b) => ordineUfficio.get(a.u.ufficio.id)! - ordineUfficio.get(b.u.ufficio.id)! || ordinaPersone(a.p, b.p))
        return (
          <section key={ruolo} className="scheda scheda-stampa">
            <h2 className="non-stampa">{titolo} <span className="piccolo">({righe.length})</span></h2>
            {righe.length === 0 ? <p className="piccolo">Nessuna persona con questo ruolo.</p> : (
              <div className="tabella-scorrevole">
                <table className="tabella tabella-mensile tabella-report">
                  <TestataVoci voci={dati.voci} prime={['Nome', 'Ufficio', 'Inizio', 'Anzianità']} ultime={['Punteggio']}
                    titoloStampa={`${titolo} · ${titoloMese(mese)} (${righe.length})`} />
                  <tbody>
                    {righe.map(({ p, u }) => (
                      <tr key={p.id}>
                        <th scope="row" className="ufficio-fisso">{p.nome}</th>
                        <td>{u.ufficio.nome}</td>
                        <td className="centro-testo">{dataItaliana(p.data_inizio)}</td>
                        <td>{formattaAnzianita(mesiDiServizio(p.data_inizio, mese))}</td>
                        {dati.voci.map((v) => {
                          const valore = u.valori.find((x) => x.persona_id === p.id && x.voce === v.codice)?.valore ?? null
                          return <td key={v.codice} className={`destra ${valore === null ? 'cella-vuota' : ''}`}>{formattaNumero(valore)}</td>
                        })}
                        <td className="centro-testo cella-vuota" title="Criteri da definire">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
      <p className="piccolo non-stampa">Ruoli: {Object.values(NOMI_RUOLO_PERSONA).join(', ')}. I responsabili compaiono nei rapportini degli uffici ma non in queste liste.</p>
    </>
  )
}
