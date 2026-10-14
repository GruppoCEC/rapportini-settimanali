// Pagina "Report mensile" (amministratori): il riepilogo di fine mese di tutto il gruppo,
// come il file Excel "Modello rapportino mensile gruppo", stampabile; i rapportini dei
// singoli uffici; le liste di collaboratori, coordinatrici e marketer, con la gara a punti dei collaboratori.
import { useEffect, useMemo, useState } from 'react'
import type { Contesto } from '../lib/contesto'
import { leggiNumero } from '../lib/calcoli'
import { caricaConfronto, caricaPersone, caricaPunti, caricaValoriMensili, caricaVociMensili } from '../lib/dati'
import {
  aggiungiMesi, dataItaliana, formattaAnzianita, formattaNumero, formattaPunti, formattaVariazione, inServizio, leggiPunti, mesePredefinito, mesiDiServizio,
  punteggio, RUOLO_GARA, variazioneBuona, vociConPunti,
  indicatoriAccanto, movimentoNelMese, ordinaPersone, ordinaUfficiReport, righeDelMese, sommaTotali, STAFF, statoMensile, titoloMese, totaleUfficio, variazione,
  vociDelRapportino, type TotaliMese,
} from '../lib/mensile'
import { supabase } from '../lib/supabase'
import { NOMI_RUOLO_PERSONA, type Persona, type RuoloPersona, type Ufficio, type ValoreMensile, type VoceMensile } from '../lib/tipi'
import { useDati } from '../lib/useDati'
import type { StatoCompilazione } from '../lib/aggregazioni'
import { BadgeStato, Caricamento } from '../componenti/Celle'
import { Icona, useToast } from '../componenti/Interfaccia'
import SceltaMese from '../componenti/SceltaMese'
import {
  annotazioniIndicatori, classeMovimento, EtichettaMovimento, LegendaIndicatori, LegendaMovimenti, TabellaRapportino, TestataVoci, ValoreConIndicatori,
} from '../componenti/TabellaMensile'

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
  punti: Map<string, number>          // gara dei collaboratori: punti per unità di ogni voce
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
    const [voci, persone, valori, confronto, punti] = await Promise.all([
      caricaVociMensili(), caricaPersone(ids), caricaValoriMensili(mese, ids),
      generale ? caricaConfronto(aggiungiMesi(mese, -12)) : Promise.resolve(new Map<string, number | null>()),
      caricaPunti(),
    ])
    return {
      voci,
      confronto,
      punti,
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
          {scheda === 'personale' && <ListePersonale dati={dati.dati} mese={mese} generale={generale} ctx={ctx} onSalvato={dati.ricarica} />}
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
  const voci = vociDelRapportino(dati.voci)          // l'indicatore delle coordinatrici non va nel report di gruppo
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
            <TestataVoci voci={voci} prime={['Ufficio', 'Staff']} titoloStampa={<>
              Report mensile · {titolo} · {titoloMese(mese)}
              <span className="legenda-titolo">Rapportini: {riepilogo(conta)} su {dati.uffici.length} uffici · Staff = persone in servizio nel mese</span>
            </>} />
            <tbody>
              {blocchi.map((b, i) => [
                i > 0 && <tr key={`sep${i}`} className="separatore-blocco"><td colSpan={colonne.length + 1} /></tr>,
                ...b.map(rigaUfficio),
              ])}
              <tr className="riga-totale-mese">
                <th scope="row" className="ufficio-fisso">Totale {generale ? 'gruppo' : titolo}</th>
                {colonne.map((c) => <td key={c} className="destra">{formattaNumero(totale.get(c))}</td>)}
              </tr>
              {generale && (
                <>
                  <tr className="riga-anno-prima">
                    <th scope="row" className="ufficio-fisso">{titoloMese(meseAnnoPrima)}<span className="piccolo non-stampa">scritto a mano</span></th>
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
                    {colonne.map((c) => {
                      const v = variazione(totale.get(c), valoreAnnoPrima(c))
                      // per le voci "meglio se scende" (es. incarichi scaduti) un aumento è in rosso
                      const buona = v !== null && variazioneBuona(v, voci.find((x) => x.codice === c))
                      return <td key={c} className={`destra ${v === null ? 'cella-vuota' : buona ? 'positivo' : 'negativo'}`}>{formattaVariazione(v)}</td>
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
  { ruolo: 'collaboratore', titolo: 'Collaboratori' },
  { ruolo: 'coordinatrice', titolo: 'Coordinatrici' },
  { ruolo: 'marketer', titolo: 'Marketer' },
]

function ListePersonale({ dati, mese, generale, ctx, onSalvato }: { dati: DatiMese; mese: string; generale: boolean; ctx: Contesto; onSalvato: () => void }) {
  const [citta, setCitta] = useState<number | 'tutte'>('tutte')
  const [vista, setVista] = useState<'liste' | 'scheda'>('liste')
  const uffici = dati.uffici.filter((u) => citta === 'tutte' || u.ufficio.citta_id === citta)
  const ordineUfficio = new Map(dati.uffici.map((u, i) => [u.ufficio.id, i]))
  const conPunti = dati.punti.size > 0
  // Punteggio più alto del mese su tutto il gruppo (anche filtrando per città): quella riga va in giallo
  const migliore = Math.max(-Infinity, ...dati.uffici.flatMap((u) => u.persone
    .filter((p) => p.ruolo === RUOLO_GARA && inServizio(p, mese))
    .map((p) => punteggio(u.valori.filter((v) => v.persona_id === p.id), dati.punti))
    .filter((x): x is number => x !== null)))
  // Persone di un ruolo in servizio nel mese, in ordine di ufficio (come nel file di gruppo), con il punteggio della gara
  const righeDi = (ruolo: RuoloPersona) => uffici
    .flatMap((u) => u.persone.filter((p) => p.ruolo === ruolo && inServizio(p, mese))
      .map((p) => ({ p, u, punti: ruolo === RUOLO_GARA ? punteggio(u.valori.filter((v) => v.persona_id === p.id), dati.punti) : null })))
    .sort((a, b) => ordineUfficio.get(a.u.ufficio.id)! - ordineUfficio.get(b.u.ufficio.id)! || ordinaPersone(a.p, b.p))
  const testoPunti = vociConPunti(dati.voci).filter((v) => dati.punti.has(v.codice))
    .map((v) => `${v.gruppo}${v.sotto ? ` ${SOTTO_BREVE[v.sotto] ?? v.sotto}` : ''} ${formattaPunti(dati.punti.get(v.codice))}`).join(' · ')

  return (
    <>
      <div className="comandi non-stampa">
        <div className="segmentato">
          <button className={vista === 'liste' ? 'attivo' : ''} onClick={() => setVista('liste')}><Icona nome="table" />Liste con i numeri</button>
          <button className={vista === 'scheda' ? 'attivo' : ''} onClick={() => setVista('scheda')}><Icona nome="clipboard-text" />Scheda punteggi</button>
        </div>
        {generale && (
          <div className="segmentato">
            {(['tutte', ...ctx.citta.map((c) => c.id)] as (number | 'tutte')[]).map((c) => (
              <button key={c} className={citta === c ? 'attivo' : ''} onClick={() => setCitta(c)}>
                {c === 'tutte' ? 'Tutte le città' : ctx.citta.find((x) => x.id === c)?.nome}
              </button>
            ))}
          </div>
        )}
        <p className="avviso"><Icona nome="info" /><span>Persone in servizio a {titoloMese(mese).toLowerCase()}. Solo i <strong>collaboratori</strong> partecipano alla gara a punti.</span></p>
      </div>
      {vista === 'scheda' && <SchedaPunteggi righe={righeDi(RUOLO_GARA)} migliore={migliore} mese={mese} conPunti={conPunti} />}
      {vista === 'liste' && <TabellaPunti voci={dati.voci} punti={dati.punti} modificabile={generale} onSalvato={onSalvato} />}
      {vista === 'liste' && LISTE.map(({ ruolo, titolo }) => {
        const colonne = vociDelRapportino(dati.voci)
        const gara = ruolo === RUOLO_GARA
        const righe = righeDi(ruolo)
        const primo = (punti: number | null) => gara && punti !== null && punti === migliore
        return (
          <section key={ruolo} className="scheda scheda-stampa">
            <h2 className="non-stampa">{titolo} <span className="piccolo">({righe.length}){gara ? ' · gara a punti' : ''}</span></h2>
            {righe.length === 0 ? <p className="piccolo">Nessuna persona con questo ruolo.</p> : (
              <div className="tabella-scorrevole">
                <table className="tabella tabella-mensile tabella-report">
                  <TestataVoci voci={colonne} prime={['Nome', 'Ufficio', 'Inizio · anzianità']} ultime={gara ? ['Punteggio'] : []}
                    annotazioni={annotazioniIndicatori(dati.voci, righe.map((x) => x.p)).annotazioni}
                    titoloStampa={`${titolo} · ${titoloMese(mese)} (${righe.length})`} />
                  <tbody>
                    {righe.map(({ p, u, punti }) => (
                      <tr key={p.id} className={primo(punti) ? 'riga-migliore' : classeMovimento(p, mese)}>
                        <th scope="row" className="ufficio-fisso">
                          {p.nome}
                          {primo(punti) && <span className="tag tag-migliore tag-movimento">★ Punteggio più alto del mese</span>}
                          <EtichettaMovimento persona={p} mese={mese} />
                        </th>
                        <td>{u.ufficio.nome}</td>
                        <td className="cella-inizio">{dataItaliana(p.data_inizio)}<span className="piccolo">{formattaAnzianita(mesiDiServizio(p.data_inizio, mese))}</span></td>
                        {colonne.map((v) => {
                          const valoreDi = (voce: string) => u.valori.find((x) => x.persona_id === p.id && x.voce === voce)?.valore ?? null
                          const accanto = indicatoriAccanto(dati.voci, v.codice, p.ruolo)   // es. App. vendita fix delle coordinatrici
                          const valore = valoreDi(v.codice)
                          return (
                            <td key={v.codice} className={`destra ${accanto.length ? 'cella-con-fix' : ''} ${valore === null ? 'cella-vuota' : ''}`}>
                              <ValoreConIndicatori valore={valore} tra={accanto.map((a) => valoreDi(a.codice))} />
                            </td>
                          )
                        })}
                        {gara && (
                          <td className={`destra cella-punteggio ${punti === null ? 'cella-vuota' : ''}`} title={conPunti ? undefined : 'Punti non ancora decisi: vedi la tabella dei punti'}>
                            {formattaPunti(punti)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {gara && testoPunti && <p className="solo-stampa-blocco legenda-punti">Punti: {testoPunti}. Gestione incarichi non dà punti.</p>}
            {gara && righe.some((x) => primo(x.punti)) && (
              <p className="legenda legenda-movimenti"><span><span className="quadratino riga-migliore" />giallo = punteggio più alto del mese ({formattaPunti(migliore)} punti)</span></p>
            )}
            <LegendaIndicatori usati={annotazioniIndicatori(dati.voci, righe.map((x) => x.p)).usati} voci={colonne} />
            {righe.some(({ p }) => movimentoNelMese(p, mese)) && <LegendaMovimenti />}
          </section>
        )
      })}
      <p className="piccolo non-stampa">Ruoli: {Object.values(NOMI_RUOLO_PERSONA).join(', ')}. I responsabili compaiono nei rapportini degli uffici ma non in queste liste.</p>
    </>
  )
}

const SOTTO_BREVE: Record<string, string> = { vendita: 'vend.', locazione: 'loc.' }

// ---------------------------------------------------------------- Scheda punteggi (da stampare e completare a penna)

function SchedaPunteggi({ righe, migliore, mese, conPunti }: {
  righe: { p: Persona; u: DatiUfficio; punti: number | null }[]; migliore: number; mese: string; conPunti: boolean
}) {
  return (
    <section className="scheda scheda-stampa scheda-punteggi">
      <div className="non-stampa">
        <h2>Scheda punteggi · collaboratori <span className="piccolo">({righe.length})</span></h2>
        <p className="piccolo">Pensata per la stampa (A4 verticale): nome, ufficio, data di inizio e punteggio del mese, più una colonna vuota da compilare a penna.
          {!conPunti && ' I punti della gara non sono ancora stati decisi: si scrivono in "Liste con i numeri".'}</p>
      </div>
      {righe.length === 0 ? <p className="piccolo">Nessun collaboratore in servizio.</p> : (
        <div className="tabella-scorrevole">
          <table className="tabella tabella-punteggi">
            <thead>
              <tr className="solo-stampa"><th colSpan={5} className="titolo-stampa">Scheda punteggi collaboratori · {titoloMese(mese)}</th></tr>
              <tr><th>Collaboratore</th><th>Ufficio</th><th>Data di inizio</th><th className="destra">Punteggio</th><th className="colonna-penna">Annotazioni</th></tr>
            </thead>
            <tbody>
              {righe.map(({ p, u, punti }) => {
                const primo = punti !== null && punti === migliore
                return (
                  <tr key={p.id} className={primo ? 'riga-migliore' : ''}>
                    <th scope="row">{p.nome}{primo && <span className="tag tag-migliore tag-movimento">★ Punteggio più alto</span>}</th>
                    <td>{u.ufficio.nome}</td>
                    <td>{dataItaliana(p.data_inizio)}</td>
                    <td className={`destra cella-punteggio ${punti === null ? 'cella-vuota' : ''}`}>{formattaPunti(punti)}</td>
                    <td className="colonna-penna" />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {righe.some((x) => x.punti !== null && x.punti === migliore) && (
        <p className="legenda legenda-movimenti non-stampa"><span><span className="quadratino riga-migliore" />giallo = punteggio più alto del mese ({formattaPunti(migliore)} punti)</span></p>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- Tabella dei punti della gara

/** Quanti punti vale ogni voce per i collaboratori; la modifica solo l'amministratore generale */
function TabellaPunti({ voci, punti, modificabile, onSalvato }: { voci: VoceMensile[]; punti: Map<string, number>; modificabile: boolean; onSalvato: () => void }) {
  const conPunti = vociConPunti(voci)
  const senzaPunti = vociDelRapportino(voci).filter((v) => v.con_punti === false)
  const salvati = useMemo(() => Object.fromEntries(conPunti.map((v) => [v.codice, punti.has(v.codice) ? String(punti.get(v.codice)).replace('.', ',') : ''])),
    [punti, voci])  // eslint-disable-line react-hooks/exhaustive-deps
  const [testi, setTesti] = useState<Record<string, string>>(salvati)
  const [stato, setStato] = useState<'pronto' | 'salvataggio'>('pronto')
  const [errore, setErrore] = useState<string | null>(null)
  const [toast, mostraToast] = useToast()
  useEffect(() => { setTesti(salvati) }, [salvati])

  const cambiate = conPunti.filter((v) => (testi[v.codice] ?? '') !== salvati[v.codice])
  const errate = conPunti.filter((v) => leggiPunti(testi[v.codice] ?? '') === 'errore').map((v) => v.codice)

  async function salva() {
    if (errate.length > 0) { setErrore('Alcuni punti non sono validi: scrivi un numero, anche con la virgola (2,5) o negativo (-3).'); return }
    setStato('salvataggio')
    setErrore(null)
    const daSalvare = cambiate.filter((v) => leggiPunti(testi[v.codice]) !== null).map((v) => ({ voce: v.codice, punti: leggiPunti(testi[v.codice]) as number }))
    const daTogliere = cambiate.filter((v) => leggiPunti(testi[v.codice]) === null).map((v) => v.codice)
    const esiti = await Promise.all([
      daSalvare.length ? supabase.from('punti_mensili').upsert(daSalvare, { onConflict: 'voce' }) : Promise.resolve({ error: null }),
      daTogliere.length ? supabase.from('punti_mensili').delete().in('voce', daTogliere) : Promise.resolve({ error: null }),
    ])
    setStato('pronto')
    const e = esiti.find((r) => r.error)?.error
    if (e) { setErrore(`Salvataggio non riuscito: ${e.message}`); return }
    mostraToast('Punti salvati: punteggi aggiornati.')
    onSalvato()
  }

  return (
    <section className="scheda non-stampa">
      <h2 className="titolo-icona"><span className="icona-quadrata icona-arancio"><Icona nome="trophy" /></span>Come si ottengono i punti</h2>
      <p className="piccolo">
        Gara dei <strong>collaboratori</strong>. Punteggio del mese = per ogni voce, il numero fatto × i punti della voce, tutto sommato.
        Esempio: 3 incarichi vendita a 5 punti = 15 punti. Si possono usare decimali (2,5) e punti negativi (es. -3 per ogni incarico scaduto).
        {senzaPunti.length > 0 && <> {senzaPunti.map((v) => v.gruppo).join(', ')} non {senzaPunti.length === 1 ? 'dà' : 'danno'} punti.</>}
        {!modificabile && ' I punti li decide l\'amministratore generale.'}
      </p>
      <div className="griglia-punti">
        {conPunti.map((v) => (
          <label key={v.codice} className="campo campo-punti">
            <span className="etichetta">{v.gruppo}{v.sotto ? ` ${v.sotto}` : ''}</span>
            <span className="input-punti">
              <input inputMode="decimal" value={testi[v.codice] ?? ''} disabled={!modificabile || stato !== 'pronto'} placeholder="—"
                className={errate.includes(v.codice) ? 'non-valido' : ''}
                onChange={(e) => { setTesti((t) => ({ ...t, [v.codice]: e.target.value })); setErrore(null) }} />
              <span>pt</span>
            </span>
          </label>
        ))}
      </div>
      {modificabile && (
        <div className="barra-confronto">
          {errore ? <span className="errore">{errore}</span> : <span className="piccolo">{cambiate.length > 0 ? 'Punti modificati: salva per aggiornare i punteggi.' : 'Casella vuota = la voce non dà punti.'}</span>}
          <button className="btn btn-primario" disabled={cambiate.length === 0 || stato !== 'pronto'} onClick={salva}>
            <Icona nome={stato === 'salvataggio' ? 'circle-notch' : 'floppy-disk'} className={stato === 'salvataggio' ? 'gira' : ''} />Salva i punti
          </button>
        </div>
      )}
      {toast}
    </section>
  )
}
