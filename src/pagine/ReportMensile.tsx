// Pagina "Report mensile" (amministratori; gli affiliati la consultano per i loro uffici, senza gara a punti): il riepilogo di fine mese di tutto il gruppo,
// come il file Excel "Modello rapportino mensile gruppo", stampabile; i rapportini dei
// singoli uffici; le liste di collaboratori, coordinatrici e marketer, con la gara a punti dei collaboratori.
import { useEffect, useMemo, useState } from 'react'
import { PROMEMORIA_ATTIVI, type Contesto } from '../lib/contesto'
import { formattaPercentuale, leggiNumero } from '../lib/calcoli'
import { caricaConfronto, caricaPersone, caricaPunti, caricaScadenza, caricaStorico, caricaValoriMensili, caricaValoriMesi, caricaValoriRiservati, caricaVociMensili, mensileAperto } from '../lib/dati'
import { AvvisoProva } from './RapportinoMensile'
import Collaboratori from './Collaboratori'
import {
  aggiungiMesi, dataItaliana, formattaAnzianita, formattaNumero, formattaPunti, formattaVariazione, inServizio, leggiPunti, mesePredefinito, mesiDiServizio,
  punteggio, RUOLO_GARA, variazioneBuona, vociConPunti, mesiDellAnno, totaleAnnoUfficio, dataOra, lunediVicino, scadenzaPassata, scadenzaProposta, ultimoRitardo,
  indicatoriAccanto, ordinaPersone, ORDINE_RUOLI, turnoverAnno, ordinaUfficiReport, righeDelMese, sommaTotali, STAFF, statoMensile, titoloMese, totaleConStorico, variazione,
  presenteNelMese, vociDelRapportino, vociRiservate, type TotaliMese,
} from '../lib/mensile'
import { supabase } from '../lib/supabase'
import { NOMI_RUOLO_PERSONA, type Persona, type RuoloPersona, type Scadenza, type Ufficio, type ValoreMensile, type VoceMensile } from '../lib/tipi'
import { useDati } from '../lib/useDati'
import type { StatoCompilazione } from '../lib/aggregazioni'
import { BadgeStato, Caricamento } from '../componenti/Celle'
import { Icona, useToast } from '../componenti/Interfaccia'
import SceltaMese from '../componenti/SceltaMese'
import {
  annotazioniIndicatori, TitoloStampa, classeMovimento, EtichettaMovimento, LegendaIndicatori, LegendaMovimenti, TabellaRapportino, TestataVoci, ValoreConIndicatori,
} from '../componenti/TabellaMensile'

type Scheda = 'panoramica' | 'rapportini' | 'personale' | 'collaboratori' | 'anno'

/** Titolo del report per l'affiliato, che vede i suoi uffici anche di città diverse */
const TITOLO_AFFILIATO = 'I miei uffici'
/** "Totale gruppo", "Totale Roma", "Totale miei uffici" */
const nomeTotale = (titolo: string) => titolo === 'Gruppo' ? 'gruppo' : titolo === TITOLO_AFFILIATO ? 'miei uffici' : titolo

interface DatiUfficio {
  ufficio: Ufficio
  persone: Persona[]
  valori: ValoreMensile[]
  totale: TotaliMese
  stato: StatoCompilazione
  ritardo: string | null              // ultimo inserimento arrivato dopo la scadenza
  daStorico: boolean                  // il totale viene dal file Excel annuale (mese compilato prima della piattaforma)
}

interface DatiMese {
  voci: VoceMensile[]
  uffici: DatiUfficio[]
  confronto: Map<string, number | null>
  punti: Map<string, number>          // gara dei collaboratori: punti per unità di ogni voce
  scadenza: Scadenza | null
  riservati: ValoreMensile[]          // numeri solo per la gara, scritti dall'amministratore generale (018: Locazioni effettuate)
}

export default function ReportMensile({ ctx }: { ctx: Contesto }) {
  const [scheda, setScheda] = useState<Scheda>('panoramica')
  const [mese, setMese] = useState(mesePredefinito())
  const generale = ctx.utente.ruolo === 'admin_generale'
  const affiliato = ctx.utente.ruolo === 'affiliato'

  // Il report è unico per tutto il gruppo: l'amministratore generale vede Roma e Milano insieme,
  // l'amministratore di città la sua città, l'affiliato i suoi uffici (le regole del database filtrano comunque)
  const uffici = useMemo(() => ordinaUfficiReport(ctx.uffici.filter((u) => u.attivo && (generale || affiliato || u.citta_id === ctx.utente.citta_id))),
    [ctx.uffici, generale, affiliato, ctx.utente.citta_id])
  const ids = uffici.map((u) => u.id)

  const dati = useDati<DatiMese>(async () => {
    const [voci, persone, valori, confronto, punti, scadenza, storico, riservati] = await Promise.all([
      caricaVociMensili(), caricaPersone(ids), caricaValoriMensili(mese, ids),
      generale ? caricaConfronto(aggiungiMesi(mese, -12)) : Promise.resolve(new Map<string, number | null>()),
      affiliato ? Promise.resolve(new Map<string, number>()) : caricaPunti(),   // la gara a punti è riservata agli amministratori
      caricaScadenza(mese),
      caricaStorico([mese], ids),
      affiliato ? Promise.resolve([]) : caricaValoriRiservati([mese], ids),
    ])
    return {
      voci,
      confronto,
      punti,
      scadenza,
      riservati,
      uffici: uffici.map((ufficio) => {
        const suePersone = persone.filter((p) => p.ufficio_id === ufficio.id)
        const suoiValori = valori.filter((v) => v.ufficio_id === ufficio.id)
        const { totale, daStorico } = totaleConStorico(suePersone, suoiValori, mese, voci, storico.filter((s) => s.ufficio_id === ufficio.id))
        return {
          ufficio, persone: suePersone, valori: suoiValori, totale, daStorico,
          stato: daStorico ? 'completo' : statoMensile(suePersone.filter((p) => inServizio(p, mese)), suoiValori, voci),
          ritardo: ultimoRitardo(suoiValori, scadenza),
        }
      }),
    }
  }, [mese, ids.join(','), generale, affiliato])

  const aperto = useDati(mensileAperto, [])
  const nomeCitta = ctx.citta.find((c) => c.id === ctx.utente.citta_id)?.nome ?? ''
  const titolo = generale ? 'Gruppo' : affiliato ? TITOLO_AFFILIATO : nomeCitta

  return (
    <div className="pagina entra">
      {aperto.dati === false && !affiliato && <div className="non-stampa"><AvvisoProva amministratore /></div>}
      <div className="intestazione non-stampa">
        <div className="intestazione-titoli">
          <span className="kicker">Report mensile</span>
          <h1 className="titolo-pagina">{titolo}</h1>
        </div>
        {scheda !== 'anno' && <SceltaMese mese={mese} onCambia={setMese} />}
      </div>
      <div className="comandi non-stampa">
        <div className="segmentato" role="tablist">
          {(['panoramica', 'rapportini', 'personale', ...(affiliato ? [] : ['collaboratori']), 'anno'] as Scheda[]).map((s) => (
            <button key={s} role="tab" aria-selected={scheda === s} className={scheda === s ? 'attivo' : ''} onClick={() => setScheda(s)}>
              <Icona nome={{ panoramica: 'table', rapportini: 'storefront', personale: 'users-three', collaboratori: 'user-focus', anno: 'calendar-dots' }[s]} />
              {{ panoramica: 'Panoramica', rapportini: 'Singoli rapportini', personale: 'Personale', collaboratori: 'Collaboratori', anno: 'Riepilogo anno' }[s]}
            </button>
          ))}
        </div>
        <button className="btn btn-secondario" onClick={() => window.print()} disabled={scheda !== 'anno' && scheda !== 'collaboratori' && !dati.dati}><Icona nome="printer" />Stampa</button>
      </div>

      {scheda === 'anno' && <RiepilogoAnno uffici={uffici} titolo={titolo} ctx={ctx} />}
      {/* scheda del collaboratore e curva dei nuovi: solo l'amministrazione (decisione di Davide del 21/10/2026) */}
      {scheda === 'collaboratori' && !affiliato && <Collaboratori uffici={uffici} mese={mese} />}
      {scheda !== 'anno' && scheda !== 'collaboratori' && (!dati.dati ? <Caricamento errore={dati.errore} /> : (
        <>
          {scheda === 'panoramica' && <Panoramica dati={dati.dati} mese={mese} titolo={titolo} generale={generale} affiliato={affiliato} ctx={ctx} onSalvato={dati.ricarica} />}
          {scheda === 'rapportini' && <SingoliRapportini dati={dati.dati} mese={mese} affiliato={affiliato} />}
          {scheda === 'personale' && <ListePersonale dati={dati.dati} mese={mese} generale={generale} affiliato={affiliato} ctx={ctx} onSalvato={dati.ricarica} />}
        </>
      ))}
    </div>
  )
}

const plurale = (n: number, uno: string, tanti: string) => `${n} ${n === 1 ? uno : tanti}`

const nomeCittaBreve = (ctx: Contesto, id: number) => (ctx.citta.find((c) => c.id === id)?.nome ?? '').slice(0, 2).toUpperCase()

// ---------------------------------------------------------------- Panoramica di gruppo

function Panoramica({ dati, mese, titolo, generale, affiliato, ctx, onSalvato }: {
  dati: DatiMese; mese: string; titolo: string; generale: boolean; affiliato: boolean; ctx: Contesto; onSalvato: () => void
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
        {u.ritardo && !affiliato && <span className="tag tag-ritardo" title={`Ultimo inserimento il ${dataOra(u.ritardo)}`}>in ritardo</span>}
        {u.daStorico && <span className="tag tag-storico" title="Totale dell'ufficio preso dal file Excel annuale">Excel</span>}
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
      {!affiliato && <GestioneScadenza dati={dati} mese={mese} modificabile={generale} onSalvato={onSalvato} />}
      <section className="scheda scheda-stampa">
        <div className="tabella-scorrevole">
          <table className="tabella tabella-mensile tabella-report">
            <TestataVoci voci={voci} prime={['Ufficio', 'Staff']} titoloStampa={
              <TitoloStampa titolo={`Report mensile · ${titolo}`} sottotitolo={titoloMese(mese)} />} />
            <tbody>
              {blocchi.map((b, i) => [
                i > 0 && <tr key={`sep${i}`} className="separatore-blocco"><td colSpan={colonne.length + 1} /></tr>,
                ...b.map(rigaUfficio),
              ])}
              <tr className="riga-totale-mese">
                <th scope="row" className="ufficio-fisso">Totale {nomeTotale(titolo)}</th>
                {colonne.map((c) => <td key={c} className="destra">{formattaNumero(totale.get(c))}</td>)}
              </tr>
              {generale && (
                <>
                  <tr className="riga-anno-prima">
                    <th scope="row" className="ufficio-fisso">{titoloMese(meseAnnoPrima)}<span className="piccolo non-stampa">modificabile</span></th>
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
          Staff = persone in servizio nel mese. Le righe con i trattini sono gli uffici che non hanno ancora compilato.
          {dati.uffici.some((u) => u.daStorico) && ' «Excel» accanto all\'ufficio: numeri presi dal file Excel annuale (solo il totale dell\'ufficio).'}
        </p>
        {generale && (
          <div className="barra-confronto non-stampa">
            <p className="piccolo">
              La riga <strong>{titoloMese(meseAnnoPrima)}</strong> contiene i totali di gruppo dello stesso mese dell'anno prima (caricati dal file Excel annuale, o scritti a mano): serve a calcolare la variazione.
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

// ---------------------------------------------------------------- Scadenza di inserimento

/** Data e ora nel formato della casella "data e ora" del browser (ora locale) */
function perCasella(iso: string): string {
  const d = new Date(iso)
  const due = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}T${due(d.getHours())}:${due(d.getMinutes())}`
}

/** Es. "lunedì 2 novembre" */
const giornoLungo = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

function GestioneScadenza({ dati, mese, modificabile, onSalvato }: { dati: DatiMese; mese: string; modificabile: boolean; onSalvato: () => void }) {
  const s = dati.scadenza
  const [quando, setQuando] = useState(s ? perCasella(s.scadenza) : scadenzaProposta(mese))
  const [blocca, setBlocca] = useState(s?.blocca ?? false)
  const [saltaLunedi, setSaltaLunedi] = useState(s?.salta_lunedi ?? false)
  const [stato, setStato] = useState<'pronto' | 'salvataggio'>('pronto')
  const [errore, setErrore] = useState<string | null>(null)
  const [toast, mostraToast] = useToast()
  useEffect(() => { setQuando(s ? perCasella(s.scadenza) : scadenzaProposta(mese)); setBlocca(s?.blocca ?? false); setSaltaLunedi(s?.salta_lunedi ?? false) }, [s, mese])

  const passata = scadenzaPassata(s)
  const inRitardo = dati.uffici.filter((u) => u.ritardo).sort((a, b) => a.ritardo!.localeCompare(b.ritardo!))
  const mancanti = dati.uffici.filter((u) => u.stato === 'mancante')
  const modificata = !s || perCasella(s.scadenza) !== quando || s.blocca !== blocca || (s.salta_lunedi ?? false) !== saltaLunedi
  // lunedì della riunione settimanale che può saltare per la riunione di fine mese (019): quello più vicino alla scadenza
  const lunedi = quando ? lunediVicino(quando.slice(0, 10)) : null
  const lunediSalvato = s?.salta_lunedi ? lunediVicino(perCasella(s.scadenza).slice(0, 10)) : null

  async function esegui(promessa: PromiseLike<{ error: { message: string } | null }>, testo: string) {
    setStato('salvataggio')
    setErrore(null)
    const { error } = await promessa
    setStato('pronto')
    if (error) { setErrore(`Salvataggio non riuscito: ${error.message}`); return }
    mostraToast(testo)
    onSalvato()
  }

  return (
    <section className="scheda scheda-scadenza non-stampa">
      <h2 className="titolo-icona"><span className="icona-quadrata icona-ambra"><Icona nome="alarm" /></span>Scadenza di {titoloMese(mese).toLowerCase()}</h2>
      {s ? (
        <p>
          Gli uffici devono compilare entro il <strong>{dataOra(s.scadenza)}</strong>.{' '}
          {s.blocca ? (passata ? 'Inserimento chiuso: gli uffici non possono più modificare.' : 'Dopo la scadenza l\'inserimento si chiude.') : 'Dopo la scadenza possono ancora inserire, ma vengono segnalati in ritardo.'}
        </p>
      ) : <p className="piccolo">Nessuna scadenza per questo mese: gli uffici possono compilare quando vogliono e nessuno viene segnalato in ritardo.{PROMEMORIA_ATTIVI && ' Senza scadenza non partono nemmeno i promemoria email.'}</p>}
      {s && PROMEMORIA_ATTIVI && (
        <p className="piccolo">Promemoria email agli uffici che non hanno inserito nulla: 3 giorni prima e il giorno prima della scadenza, alle 10{s.blocca ? ', e 30 minuti prima della scadenza ("ultimi 30 minuti, poi l\'inserimento sarà bloccato")' : ''}. Il giorno dopo l'amministratore generale riceve il riepilogo.</p>
      )}
      {lunediSalvato && (
        <p className="piccolo"><strong>{giornoLungo(lunediSalvato).replace(/^./, (c) => c.toUpperCase())} la riunione settimanale salta</strong> per la riunione di fine mese{PROMEMORIA_ATTIVI ? ': quel lunedì non parte il promemoria settimanale; quello del sabato prima avvisa che la riunione non c\'è e chiede di inserire i dati comunque' : ''}.</p>
      )}
      {modificabile && (
        <div className="riga-modulo">
          <label className="campo"><span className="etichetta">Data e ora di scadenza</span>
            <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} /></label>
          <label className="casella-spunta"><input type="checkbox" checked={blocca} onChange={(e) => setBlocca(e.target.checked)} />Dopo la scadenza blocca l'inserimento agli uffici</label>
          {lunedi && <label className="casella-spunta"><input type="checkbox" checked={saltaLunedi} onChange={(e) => setSaltaLunedi(e.target.checked)} />Salta la riunione settimanale di {giornoLungo(lunedi)}</label>}
          <button className="btn btn-primario" disabled={!quando || !modificata || stato !== 'pronto'}
            onClick={() => esegui(supabase.from('scadenze_mensili').upsert({ mese, scadenza: new Date(quando).toISOString(), blocca,
              // salta_lunedi solo se la colonna c'è (019) o se è spuntata: senza la 019 il salvataggio non si ferma
              ...(saltaLunedi || s?.salta_lunedi !== undefined ? { salta_lunedi: saltaLunedi } : {}) }, { onConflict: 'mese' }), 'Scadenza salvata.')}>
            <Icona nome="floppy-disk" />{s ? 'Aggiorna scadenza' : 'Fissa la scadenza'}
          </button>
          {s && <button className="btn btn-fantasma btn-pericolo" disabled={stato !== 'pronto'} onClick={() => esegui(supabase.from('scadenze_mensili').delete().eq('mese', mese), 'Scadenza tolta.')}>Togli la scadenza</button>}
        </div>
      )}
      {errore && <span className="errore">{errore}</span>}
      {s && (
        <div className="esito-scadenza">
          <p className={inRitardo.length ? 'in-ritardo' : 'piccolo'}>
            <Icona nome="alarm" /><strong>In ritardo ({inRitardo.length}):</strong>{' '}
            {inRitardo.length ? inRitardo.map((u) => `${u.ufficio.nome} (${dataOra(u.ritardo!)})`).join(' · ') : 'nessuno, finora.'}
          </p>
          {mancanti.length > 0 && (
            <p className={passata ? 'in-ritardo' : 'piccolo'}>
              <Icona nome="hourglass-medium" /><strong>{passata ? 'Ancora mancanti dopo la scadenza' : 'Non hanno ancora compilato'} ({mancanti.length}):</strong>{' '}
              {mancanti.map((u) => u.ufficio.nome).join(' · ')}
            </p>
          )}
        </div>
      )}
      {toast}
    </section>
  )
}

// ---------------------------------------------------------------- Riepilogo dell'anno (riunione di gennaio)

const PRIMO_ANNO = 2026   // il rapportino mensile è sulla piattaforma dal 2026

function RiepilogoAnno({ uffici, titolo, ctx }: { uffici: Ufficio[]; titolo: string; ctx: Contesto }) {
  const ultimo = mesePredefinito()                     // si riepilogano solo i mesi già conclusi
  const anni = Array.from({ length: Number(ultimo.slice(0, 4)) - PRIMO_ANNO + 1 }, (_, i) => String(PRIMO_ANNO + i)).reverse()
  const [anno, setAnno] = useState(anni[0] ?? ultimo.slice(0, 4))
  const mesi = mesiDellAnno(anno, ultimo)
  const ids = uffici.map((u) => u.id)

  const dati = useDati(async () => {
    const [voci, persone, valori, storico] = await Promise.all([caricaVociMensili(), caricaPersone(ids), caricaValoriMesi(mesi, ids), caricaStorico(mesi, ids)])
    return {
      voci,
      righe: uffici.map((ufficio) => ({
        ufficio,
        ...totaleAnnoUfficio(persone.filter((p) => p.ufficio_id === ufficio.id), valori.filter((v) => v.ufficio_id === ufficio.id), mesi, voci,
          storico.filter((s) => s.ufficio_id === ufficio.id)),
      })),
      conStorico: storico.length > 0,
    }
  }, [anno, ids.join(','), ultimo])

  const periodo = mesi.length === 0 ? '' : mesi.length === 12
    ? `gennaio – dicembre ${anno}`
    : `${titoloMese(mesi[0]).split(' ')[0].toLowerCase()} – ${titoloMese(mesi[mesi.length - 1]).toLowerCase()}, anno in corso`

  return (
    <>
      <div className="comandi non-stampa">
        <label className="campo campo-anno"><span className="etichetta">Anno</span>
          <select value={anno} onChange={(e) => setAnno(e.target.value)}>{anni.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        </label>
        <p className="avviso"><Icona nome="info" /><span>Ogni voce è la <strong>somma dei mesi</strong>{periodo ? ` da ${periodo}` : ''}. <strong>Staff e portafoglio immobili</strong> (vendita e locazione) non si sommano: sono quelli dell'ultimo mese compilato da ogni ufficio.</span></p>
      </div>
      {mesi.length === 0 ? <div className="scheda"><p className="piccolo">Nessun mese concluso nel {anno}.</p></div>
        : !dati.dati ? <Caricamento errore={dati.errore} /> : (() => {
          const { voci: tutte, righe, conStorico } = dati.dati
          const voci = vociDelRapportino(tutte)
          const colonne = [STAFF, ...voci.map((v) => v.codice)]
          const totale = sommaTotali(righe.map((r) => r.totale))
          const blocchi = [1, 2].map((b) => righe.filter((r) => (r.ufficio.blocco_mensile ?? 1) === b)).filter((b) => b.length > 0)
          const piuCitta = new Set(righe.map((r) => r.ufficio.citta_id)).size > 1
          const cella = (t: TotaliMese, c: string) => <td key={c} className={`destra ${t.get(c) == null ? 'cella-vuota' : ''}`}>{formattaNumero(t.get(c))}</td>
          return (
            <>
              <section className="scheda scheda-stampa">
                <h2 className="non-stampa">Totali dell'anno per ufficio <span className="piccolo">{periodo}</span></h2>
                <div className="tabella-scorrevole">
                  <table className="tabella tabella-mensile tabella-report">
                    <TestataVoci voci={voci} prime={['Ufficio', 'Staff']}
                      titoloStampa={<TitoloStampa titolo={`Riepilogo dell'anno · ${titolo}`} sottotitolo={periodo} info="Staff e portafoglio: ultimo mese compilato da ogni ufficio" />} />
                    <tbody>
                      {blocchi.map((b, i) => [
                        i > 0 && <tr key={`sep${i}`} className="separatore-blocco"><td colSpan={colonne.length + 1} /></tr>,
                        ...b.map((r) => (
                          <tr key={r.ufficio.id}>
                            <th scope="row" className="ufficio-fisso">
                              {r.ufficio.nome}{piuCitta && r.ufficio.citta_id !== ctx.citta[0]?.id && <span className="sigla-citta">{nomeCittaBreve(ctx, r.ufficio.citta_id)}</span>}
                              {r.mesiCompilati < mesi.length && <span className="mesi-compilati">{r.mesiCompilati} mesi su {mesi.length}</span>}
                            </th>
                            {colonne.map((c) => cella(r.totale, c))}
                          </tr>
                        )),
                      ])}
                      <tr className="riga-totale-mese">
                        <th scope="row" className="ufficio-fisso">Totale {nomeTotale(titolo)}</th>
                        {colonne.map((c) => <td key={c} className="destra">{formattaNumero(totale.get(c))}</td>)}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="legenda-stampa">
                  Staff e portafoglio immobili non si sommano: sono quelli dell'ultimo mese compilato da ogni ufficio.
                  "n mesi su {mesi.length}" accanto all'ufficio: nell'anno ha compilato solo quei mesi, quindi i suoi totali sono parziali.
                  {conStorico && ' I mesi compilati prima della piattaforma vengono dal file Excel annuale (totale di ogni ufficio).'}
                </p>
              </section>

              <section className="scheda scheda-stampa">
                <h2 className="non-stampa">Totale {titolo === 'Gruppo' ? 'del gruppo' : titolo === TITOLO_AFFILIATO ? 'dei miei uffici' : `di ${titolo}`} mese per mese</h2>
                <div className="tabella-scorrevole">
                  <table className="tabella tabella-mensile tabella-report">
                    <TestataVoci voci={voci} prime={['Mese', 'Staff']}
                      titoloStampa={<TitoloStampa titolo={`Andamento mese per mese · ${titolo}`} sottotitolo={periodo} />} />
                    <tbody>
                      {mesi.map((m, i) => {
                        const delMese = sommaTotali(righe.map((r) => r.perMese[i]))
                        return (
                          <tr key={m}>
                            <th scope="row" className="ufficio-fisso">{titoloMese(m).split(' ')[0]}</th>
                            {colonne.map((c) => cella(delMese, c))}
                          </tr>
                        )
                      })}
                      <tr className="riga-totale-mese">
                        <th scope="row" className="ufficio-fisso">Totale {anno}</th>
                        {colonne.map((c) => <td key={c} className="destra">{formattaNumero(totale.get(c))}</td>)}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="legenda-stampa">Nella riga «Totale {anno}» staff e portafoglio immobili sono quelli dell'ultimo mese compilato da ogni ufficio, non la somma dei mesi.</p>
              </section>
            </>
          )
        })()}
    </>
  )
}

// ---------------------------------------------------------------- Singoli rapportini

function SingoliRapportini({ dati, mese, affiliato }: { dati: DatiMese; mese: string; affiliato: boolean }) {
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
      {u.daStorico && <p className="avviso"><Icona nome="file-xls" /><span>Per {titoloMese(mese).toLowerCase()} c'è solo il <strong>totale dell'ufficio</strong>, preso dal file Excel annuale: il dettaglio persona per persona non c'è.</span></p>}
      <TabellaRapportino voci={dati.voci} mese={mese} righe={u.daStorico ? [] : righeDelMese(u.persone, mese)} totale={u.totale} testo={testo}
        titoloStampa={<TitoloStampa titolo={`Rapportino mensile · ${u.ufficio.nome}`} sottotitolo={titoloMese(mese)} info={`Staff: ${formattaNumero(u.totale.get(STAFF))} persone`} />} />
      {!affiliato && <p className="piccolo non-stampa">Per correggere i numeri di un ufficio apri <strong>Rapportino mensile</strong> e scegli l'ufficio in alto.</p>}
    </section>
  )
}

// ---------------------------------------------------------------- Liste del personale

const LISTE: { ruolo: RuoloPersona; titolo: string }[] = [
  { ruolo: 'collaboratore', titolo: 'Collaboratori' },
  { ruolo: 'coordinatrice', titolo: 'Coordinatrici' },
  { ruolo: 'marketer', titolo: 'Marketer' },
]

function ListePersonale({ dati, mese, generale, affiliato, ctx, onSalvato }: {
  dati: DatiMese; mese: string; generale: boolean; affiliato: boolean; ctx: Contesto; onSalvato: () => void
}) {
  const [citta, setCitta] = useState<number | 'tutte'>('tutte')
  const conGara = !affiliato                  // punteggi e criteri dei punti: solo gli amministratori
  const piuCitta = new Set(dati.uffici.map((u) => u.ufficio.citta_id)).size > 1
  const [vista, setVista] = useState<'liste' | 'scheda' | 'uscite'>('liste')
  const uffici = dati.uffici.filter((u) => citta === 'tutte' || u.ufficio.citta_id === citta)
  const ordineUfficio = new Map(dati.uffici.map((u, i) => [u.ufficio.id, i]))
  const conPunti = dati.punti.size > 0
  // Punteggio della gara: i numeri del rapportino più quelli riservati all'amministrazione (Locazioni effettuate).
  // Solo per chi è in servizio a fine mese: chi lascia l'ufficio nel mese non partecipa (Davide, 26/10/2026)
  const puntiDi = (p: Persona, u: DatiUfficio) => p.ruolo === RUOLO_GARA && inServizio(p, mese)
    ? punteggio([...u.valori, ...dati.riservati].filter((v) => v.persona_id === p.id), dati.punti) : null
  // Punteggio più alto del mese su tutto il gruppo (anche filtrando per città): quella riga va in giallo
  const migliore = Math.max(-Infinity, ...dati.uffici.flatMap((u) => u.persone
    .map((p) => puntiDi(p, u)).filter((x): x is number => x !== null)))
  // Persone di un ruolo presenti nel mese (anche chi è uscito: riga rossa), in ordine di ufficio (come nel file di gruppo)
  const righeDi = (ruolo: RuoloPersona) => uffici
    .flatMap((u) => u.persone.filter((p) => p.ruolo === ruolo && presenteNelMese(p, mese)).map((p) => ({ p, u, punti: puntiDi(p, u) })))
    .sort((a, b) => ordineUfficio.get(a.u.ufficio.id)! - ordineUfficio.get(b.u.ufficio.id)! || ordinaPersone(a.p, b.p))
  // Locazioni effettuate: le vede e le scrive solo l'amministratore generale (018)
  const riservate = generale ? vociRiservate(dati.voci) : []
  const salvatiRiservati = useMemo(() => Object.fromEntries(dati.riservati.filter((v) => v.mese === mese && v.valore !== null)
    .map((v) => [`${v.persona_id}|${v.voce}`, String(v.valore)])), [dati.riservati, mese])
  const [testiRiservati, setTestiRiservati] = useState<Record<string, string>>(salvatiRiservati)
  useEffect(() => { setTestiRiservati(salvatiRiservati) }, [salvatiRiservati])
  const bozza: BozzaRiservati = { testi: testiRiservati, salvati: salvatiRiservati, cambia: (k, v) => setTestiRiservati((t) => ({ ...t, [k]: v })) }
  const testoPunti = [...vociConPunti(dati.voci), ...riservate].filter((v) => dati.punti.has(v.codice))
    .map((v) => `${v.gruppo}${v.sotto ? ` ${SOTTO_BREVE[v.sotto] ?? v.sotto}` : ''} ${formattaPunti(dati.punti.get(v.codice))}`).join(' · ')

  return (
    <>
      <div className="comandi non-stampa">
        <div className="segmentato">
          <button className={vista === 'liste' ? 'attivo' : ''} onClick={() => setVista('liste')}><Icona nome="table" />Liste con i numeri</button>
          {conGara && <button className={vista === 'scheda' ? 'attivo' : ''} onClick={() => setVista('scheda')}><Icona nome="clipboard-text" />Scheda punteggi</button>}
          <button className={vista === 'uscite' ? 'attivo' : ''} onClick={() => setVista('uscite')}><Icona nome="sign-out" />Usciti nell'anno</button>
        </div>
        {(generale || (affiliato && piuCitta)) && (
          <div className="segmentato">
            {(['tutte', ...ctx.citta.map((c) => c.id)] as (number | 'tutte')[]).map((c) => (
              <button key={c} className={citta === c ? 'attivo' : ''} onClick={() => setCitta(c)}>
                {c === 'tutte' ? 'Tutte le città' : ctx.citta.find((x) => x.id === c)?.nome}
              </button>
            ))}
          </div>
        )}
        {vista !== 'uscite' && <p className="avviso"><Icona nome="info" /><span>Persone presenti a {titoloMese(mese).toLowerCase()}: in rosso chi ha lasciato l'ufficio nel mese (i suoi numeri restano, ma non partecipa alla gara).{conGara && <> Solo i <strong>collaboratori</strong> partecipano alla gara a punti.</>}</span></p>}
      </div>
      {vista === 'uscite' && <SchedaUscite uffici={uffici} annoIniziale={mese.slice(0, 4)} />}
      {vista === 'scheda' && conGara && <SchedaPunteggi righe={righeDi(RUOLO_GARA).filter((x) => inServizio(x.p, mese))} migliore={migliore} mese={mese} conPunti={conPunti} />}
      {vista === 'liste' && conGara && <TabellaPunti voci={dati.voci} punti={dati.punti} modificabile={generale} riservate={riservate} onSalvato={onSalvato} />}
      {vista === 'liste' && riservate.length > 0 && <SalvaRiservati bozza={bozza} voci={riservate} mese={mese} uffici={dati.uffici} onSalvato={onSalvato} />}
      {vista === 'liste' && LISTE.map(({ ruolo, titolo }) => {
        const colonne = vociDelRapportino(dati.voci)
        const gara = ruolo === RUOLO_GARA && conGara
        const riservateGara = gara ? riservate : []
        const righe = righeDi(ruolo)
        const primo = (punti: number | null) => gara && punti !== null && punti === migliore
        return (
          <section key={ruolo} className="scheda scheda-stampa">
            <h2 className="non-stampa">{titolo} <span className="piccolo">({righe.length}){gara ? ' · gara a punti' : ''}</span></h2>
            {righe.length === 0 ? <p className="piccolo">Nessuna persona con questo ruolo.</p> : (
              <div className="tabella-scorrevole">
                <table className="tabella tabella-mensile tabella-report">
                  <TestataVoci voci={colonne} prime={['Nome', 'Ufficio', 'Inizio · anzianità']} ultime={gara ? [...riservateGara.map((v) => v.gruppo), 'Punteggio'] : []}
                    annotazioni={annotazioniIndicatori(dati.voci, righe.map((x) => x.p)).annotazioni}
                    titoloStampa={<TitoloStampa titolo={titolo} sottotitolo={`${titoloMese(mese)} · ${righe.length} persone`}
                      info={gara && conPunti && Number.isFinite(migliore) ? `Gara a punti · punteggio più alto: ${formattaPunti(migliore)}` : undefined} />} />
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
                        {riservateGara.map((v) => {
                          const k = `${p.id}|${v.codice}`
                          // chi ha lasciato l'ufficio nel mese non partecipa alla gara: niente casella
                          if (!inServizio(p, mese)) return <td key={v.codice} className="destra cella-riservata cella-vuota">—</td>
                          return (
                            <td key={v.codice} className="destra cella-riservata">
                              <input inputMode="numeric" className={`non-stampa ${leggiNumero(bozza.testi[k] ?? '') === 'errore' ? 'non-valido' : ''}`}
                                aria-label={`${v.gruppo} – ${p.nome}`} value={bozza.testi[k] ?? ''} placeholder="—"
                                onChange={(e) => bozza.cambia(k, e.target.value)} />
                              <span className="solo-stampa">{bozza.testi[k] ?? ''}</span>
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
            <LegendaMovimenti persone={righe.map((x) => x.p)} mese={mese} />
          </section>
        )
      })}
      <p className="piccolo non-stampa">Ruoli: {Object.values(NOMI_RUOLO_PERSONA).join(', ')}. I responsabili compaiono nei rapportini degli uffici ma non in queste liste.</p>
    </>
  )
}

const SOTTO_BREVE: Record<string, string> = { vendita: 'vend.', locazione: 'loc.' }

// ---------------------------------------------------------------- Usciti nell'anno (turnover)

/** Uscite raggruppate per mese di uscita ('AAAA-MM-01'), già in ordine di data */
function perMese<T extends { persona: Persona }>(usciti: T[]): { mese: string; uscite: T[] }[] {
  const gruppi: { mese: string; uscite: T[] }[] = []
  for (const u of usciti) {
    const m = `${u.persona.data_fine!.slice(0, 7)}-01`
    if (gruppi[gruppi.length - 1]?.mese === m) gruppi[gruppi.length - 1].uscite.push(u)
    else gruppi.push({ mese: m, uscite: [u] })
  }
  return gruppi
}

/** "Settembre 2026" → "Settembre" */
const nomeMeseSolo = (mese: string) => titoloMese(mese).split(' ')[0]

const PLURALI_RUOLO: Record<RuoloPersona, string> = { responsabile: 'Responsabili', collaboratore: 'Collaboratori', coordinatrice: 'Coordinatrici', marketer: 'Marketer', da_definire: 'Ruolo da definire' }

function SchedaUscite({ uffici, annoIniziale }: { uffici: DatiUfficio[]; annoIniziale: string }) {
  const [anno, setAnno] = useState(annoIniziale)
  const persone = uffici.flatMap((u) => u.persone)
  const ufficioDi = new Map(uffici.flatMap((u) => u.persone.map((p) => [p.id, u.ufficio.nome] as const)))
  const anni = [...new Set([annoIniziale, ...persone.filter((p) => p.data_fine).map((p) => p.data_fine!.slice(0, 4))])].sort().reverse()
  const t = turnoverAnno(persone, anno)
  const perRuolo = ORDINE_RUOLI.map((r) => [r, t.usciti.filter((u) => u.persona.ruolo === r).length] as const).filter(([, n]) => n > 0)

  return (
    <section className="scheda scheda-stampa scheda-uscite">
      <div className="scheda-titolo non-stampa">
        <h2>Usciti nel {anno} <span className="piccolo">({t.usciti.length})</span></h2>
        <label className="campo campo-anno"><span className="etichetta">Anno</span>
          <select value={anno} onChange={(e) => setAnno(e.target.value)}>{anni.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        </label>
      </div>
      <div className="riepilogo-turnover">
        <div><span className="etichetta-maiuscola">Uscite</span><strong>{t.usciti.length}</strong></div>
        <div><span className="etichetta-maiuscola">In servizio al 1° gennaio</span><strong>{t.organicoInizio}</strong></div>
        <div><span className="etichetta-maiuscola">Tasso di uscita</span><strong>{t.tasso === null ? '—' : formattaPercentuale(t.tasso)}</strong><span className="piccolo">uscite ÷ in servizio al 1° gennaio</span></div>
        <div><span className="etichetta-maiuscola">Anzianità media all'uscita</span><strong className="testo-medio">{t.anzianitaMedia === null ? '—' : formattaAnzianita(t.anzianitaMedia)}</strong></div>
        <div><span className="etichetta-maiuscola">Promossi a responsabile</span><strong>{t.promossi.length}</strong><span className="piccolo">non contano come uscite</span></div>
        {perRuolo.length > 0 && <div><span className="etichetta-maiuscola">Per ruolo</span><span className="per-ruolo">{perRuolo.map(([r, n]) => `${n === 1 ? NOMI_RUOLO_PERSONA[r] : PLURALI_RUOLO[r]}: ${n}`).join(' · ')}</span></div>}
      </div>
      {t.usciti.length === 0 ? <p className="piccolo">Nessuna uscita registrata nel {anno}.</p> : (
        <div className="tabella-scorrevole">
          <table className="tabella tabella-punteggi tabella-uscite">
            <thead>
              <tr className="solo-stampa"><th colSpan={7} className="titolo-stampa">
                <TitoloStampa titolo={`Usciti nel ${anno}`} sottotitolo={`${t.usciti.length} persone · tasso di uscita ${t.tasso === null ? '—' : formattaPercentuale(t.tasso)}`}
                  info={t.anzianitaMedia === null ? undefined : `Anzianità media all'uscita: ${formattaAnzianita(t.anzianitaMedia)}`} />
              </th></tr>
              <tr><th className="cella-mese-testa">Mese</th><th>Nome</th><th>Ruolo</th><th>Ufficio</th><th>Data di inizio</th><th>Data di uscita</th><th>Anzianità all'uscita</th></tr>
            </thead>
            <tbody>
              {perMese(t.usciti).flatMap(({ mese: m, uscite }) => uscite.map(({ persona: p, mesi }, i) => (
                <tr key={p.id} className={i === 0 ? 'inizio-mese' : ''}>
                  {i === 0 && (
                    // una casella per mese, alta quanto le sue uscite, con il nome scritto in verticale
                    <th rowSpan={uscite.length} className="cella-mese" title={titoloMese(m)}>
                      <span>{uscite.length >= 3 ? nomeMeseSolo(m) : nomeMeseSolo(m).slice(0, 3)}</span>
                    </th>
                  )}
                  <th scope="row">{p.nome}</th>
                  <td>{NOMI_RUOLO_PERSONA[p.ruolo]}</td>
                  <td>{ufficioDi.get(p.id)}</td>
                  <td>{dataItaliana(p.data_inizio)}</td>
                  <td>{dataItaliana(p.data_fine)}</td>
                  <td>{formattaAnzianita(mesi)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}
      {t.promossi.length > 0 && (
        <div className="promossi">
          <h3><Icona nome="medal" />Promossi a responsabile nel {anno} <span className="piccolo">({t.promossi.length})</span></h3>
          <div className="tabella-scorrevole">
            <table className="tabella tabella-punteggi tabella-uscite">
              <thead><tr><th>Nome</th><th>Ruolo</th><th>Ufficio</th><th>Data di inizio</th><th>Promosso il</th><th>Anzianità alla promozione</th></tr></thead>
              <tbody>
                {t.promossi.map(({ persona: p, mesi }) => (
                  <tr key={p.id}>
                    <th scope="row">{p.nome}</th>
                    <td>{NOMI_RUOLO_PERSONA[p.ruolo]}</td>
                    <td>{ufficioDi.get(p.id)}</td>
                    <td>{dataItaliana(p.data_inizio)}</td>
                    <td>{dataItaliana(p.data_fine)}</td>
                    <td>{formattaAnzianita(mesi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="piccolo non-stampa">Sono comprese tutte le persone con data di fine nell'anno, di tutti i ruoli. Chi è stato promosso a responsabile non conta come uscita né nel tasso. Gli uffici seguono il filtro per città qui sopra.</p>
    </section>
  )
}

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
              <tr className="solo-stampa"><th colSpan={5} className="titolo-stampa">
                <TitoloStampa titolo="Scheda punteggi collaboratori" sottotitolo={`${titoloMese(mese)} · ${righe.length} collaboratori`}
                  info={Number.isFinite(migliore) ? <span>Punteggio più alto: <strong>{formattaPunti(migliore)}</strong></span> : undefined} />
              </th></tr>
              <tr><th>Collaboratore</th><th>Ufficio</th><th>Data di inizio</th><th className="destra">Punteggio</th><th className="colonna-penna">Annotazioni</th></tr>
            </thead>
            <tbody>
              {righe.map(({ p, u, punti }, i) => {
                const primo = punti !== null && punti === migliore
                const nuovoUfficio = i > 0 && righe[i - 1].u.ufficio.id !== u.ufficio.id   // linea spessa a ogni cambio di ufficio
                return (
                  <tr key={p.id} className={`${primo ? 'riga-migliore' : ''} ${nuovoUfficio ? 'inizio-ufficio' : ''}`}>
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
      <div className="solo-stampa-blocco stampa-firme"><span>Compilata da</span><span>Data</span></div>
    </section>
  )
}

// ---------------------------------------------------------------- Locazioni effettuate (solo amministratore generale)

/** Le caselle delle voci riservate nella lista dei collaboratori: chiave "persona|voce" */
interface BozzaRiservati { testi: Record<string, string>; salvati: Record<string, string>; cambia: (chiave: string, testo: string) => void }

/** Barra di salvataggio delle Locazioni effettuate (018): le scrive solo l'amministratore generale, contano nel punteggio */
function SalvaRiservati({ bozza, voci, mese, uffici, onSalvato }: {
  bozza: BozzaRiservati; voci: VoceMensile[]; mese: string; uffici: DatiUfficio[]; onSalvato: () => void
}) {
  const [stato, setStato] = useState<'pronto' | 'salvataggio'>('pronto')
  const [errore, setErrore] = useState<string | null>(null)
  const [toast, mostraToast] = useToast()
  const chiavi = [...new Set([...Object.keys(bozza.testi), ...Object.keys(bozza.salvati)])]
  const cambiate = chiavi.filter((k) => (bozza.testi[k] ?? '') !== (bozza.salvati[k] ?? ''))
  const errate = cambiate.filter((k) => leggiNumero(bozza.testi[k] ?? '') === 'errore')
  const ufficioDi = new Map(uffici.flatMap((u) => u.persone.map((p) => [p.id, u.ufficio.id])))

  async function salva() {
    if (errate.length > 0) { setErrore('Scrivi solo numeri interi (0, 1, 2…).'); return }
    setStato('salvataggio')
    setErrore(null)
    const righe = cambiate.map((k) => {
      const [pid, voce] = k.split('|')
      const v = leggiNumero(bozza.testi[k] ?? '')
      return { persona_id: Number(pid), ufficio_id: ufficioDi.get(Number(pid))!, mese, voce, valore: typeof v === 'number' ? v : null }
    })
    const { error } = await supabase.from('valori_riservati').upsert(righe, { onConflict: 'persona_id,mese,voce' })
    setStato('pronto')
    if (error) { setErrore(`Salvataggio non riuscito: ${error.message}`); return }
    mostraToast(`${voci.map((v) => v.gruppo).join(', ')} salvate: punteggi aggiornati.`)
    onSalvato()
  }

  return (
    <section className="scheda non-stampa">
      <h2 className="titolo-icona"><span className="icona-quadrata icona-arancio"><Icona nome="key" /></span>{voci.map((v) => v.gruppo).join(', ')}</h2>
      <p className="piccolo">
        Colonna nella lista dei <strong>collaboratori</strong> qui sotto, accanto al punteggio: la vedi e la compili solo tu (non compare agli uffici
        né agli altri amministratori). Conta nel punteggio della gara con i punti scritti in "Come si ottengono i punti"; non entra nei totali degli uffici.
      </p>
      <div className="barra-confronto">
        {errore ? <span className="errore">{errore}</span>
          : <span className="piccolo">{cambiate.length > 0 ? `${cambiate.length} ${cambiate.length === 1 ? 'casella modificata' : 'caselle modificate'}: salva per aggiornare i punteggi.` : 'Nessuna modifica.'}</span>}
        <button className="btn btn-primario" disabled={cambiate.length === 0 || stato !== 'pronto'} onClick={salva}>
          <Icona nome={stato === 'salvataggio' ? 'circle-notch' : 'floppy-disk'} className={stato === 'salvataggio' ? 'gira' : ''} />Salva
        </button>
      </div>
      {toast}
    </section>
  )
}

// ---------------------------------------------------------------- Tabella dei punti della gara

/** Quanti punti vale ogni voce per i collaboratori; la modifica solo l'amministratore generale */
function TabellaPunti({ voci, punti, modificabile, riservate, onSalvato }: {
  voci: VoceMensile[]; punti: Map<string, number>; modificabile: boolean; riservate: VoceMensile[]; onSalvato: () => void
}) {
  // le voci riservate (Locazioni effettuate) le vede solo l'amministratore generale
  const conPunti = [...vociConPunti(voci), ...riservate.filter((v) => v.con_punti !== false)]
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
