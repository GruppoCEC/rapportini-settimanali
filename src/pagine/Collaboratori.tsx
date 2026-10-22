// Report mensile → scheda "Collaboratori" (solo amministratori, decisione di Davide del 21/10/2026):
// - scheda della persona: i suoi numeri negli ultimi 12 mesi, confrontati con la media dei colleghi
//   con lo stesso ruolo, il punteggio della gara e un grafico; si stampa per il colloquio individuale;
// - curva dei nuovi: quanto producono i collaboratori al 1°, 2°… mese di servizio, e chi è entrato
//   negli ultimi 12 mesi, con in arancio chi è sotto la metà della media.
// Usa solo i numeri inseriti persona per persona sulla piattaforma (src/lib/collaboratori.ts).
import { useMemo, useState } from 'react'
import {
  curvaCrescita, daSeguire, formattaMedia, haNumeri, media, mediaRuolo, MESI_CURVA, meseDiServizio, MINIMO_PERSONE, nuoviEntrati,
  numeriPersona, rispettoAllaMedia, SOGLIA_DA_SEGUIRE,
} from '../lib/collaboratori'
import { caricaPersone, caricaPunti, caricaValoriMesi, caricaVociMensili } from '../lib/dati'
import {
  aggiungiMesi, dataItaliana, formattaAnzianita, formattaNumero, formattaPunti, indicatoriAccanto, inServizio, mesiDiServizio, ordinaPersone,
  punteggio, RUOLO_GARA, titoloMese, VOCI_CONSISTENZA, vociDelRapportino, type TotaliMese,
} from '../lib/mensile'
import { nomeMeseBreve } from '../lib/settimane'
import { NOMI_RUOLO_PERSONA, type Persona, type RuoloPersona, type Ufficio, type ValoreMensile, type VoceMensile } from '../lib/tipi'
import { useDati } from '../lib/useDati'
import { Caricamento } from '../componenti/Celle'
import { GraficoAndamento, LegendaGrafico } from '../componenti/Grafici'
import { Icona } from '../componenti/Interfaccia'
import { TestataVoci, TitoloStampa, ValoreConIndicatori } from '../componenti/TabellaMensile'

/** "uscita il 01/03/2026" oppure "promosso a responsabile il 01/03/2026" */
const fine = (p: Persona) => `${p.motivo_fine === 'promozione' ? 'promosso a responsabile' : p.motivo_fine === 'trasferimento' ? 'trasferito in un altro ufficio' : 'uscita'} il ${dataItaliana(p.data_fine)}`

/** Quanti mesi mostra la scheda della persona (l'ultimo è quello scelto in alto) */
const MESI_SCHEDA = 12

const PLURALI: Record<RuoloPersona, string> = { responsabile: 'responsabili', collaboratore: 'collaboratori', coordinatrice: 'coordinatrici', marketer: 'marketer', da_definire: 'persone con ruolo da definire' }

interface Dati {
  voci: VoceMensile[]
  persone: Persona[]
  valori: ValoreMensile[]
  punti: Map<string, number>
}

export default function Collaboratori({ uffici, mese }: { uffici: Ufficio[]; mese: string }) {
  const [vista, setVista] = useState<'scheda' | 'curva'>('scheda')
  const mesi = Array.from({ length: MESI_SCHEDA }, (_, i) => aggiungiMesi(mese, i - MESI_SCHEDA + 1))
  const ids = uffici.map((u) => u.id)
  const { dati, errore } = useDati<Dati>(async () => {
    const [voci, persone, valori, punti] = await Promise.all([caricaVociMensili(), caricaPersone(ids), caricaValoriMesi(mesi, ids), caricaPunti()])
    return { voci, persone, valori, punti }
  }, [mese, ids.join(',')])

  return (
    <>
      <div className="comandi non-stampa">
        <div className="segmentato">
          <button className={vista === 'scheda' ? 'attivo' : ''} onClick={() => setVista('scheda')}><Icona nome="user-focus" />Scheda della persona</button>
          <button className={vista === 'curva' ? 'attivo' : ''} onClick={() => setVista('curva')}><Icona nome="chart-line-up" />Curva dei nuovi</button>
        </div>
        <p className="avviso"><Icona nome="info" /><span>Solo i numeri inseriti <strong>persona per persona</strong> sulla piattaforma: per i mesi
          precedenti c'è solo il totale degli uffici (file Excel), quindi all'inizio i mesi saranno pochi. Visibile solo all'amministrazione.</span></p>
      </div>
      {!dati ? <Caricamento errore={errore} /> : vista === 'scheda'
        ? <SchedaPersona dati={dati} uffici={uffici} mesi={mesi} />
        : <CurvaNuovi dati={dati} uffici={uffici} mesi={mesi} />}
    </>
  )
}

// ---------------------------------------------------------------- Scheda della persona

function SchedaPersona({ dati, uffici, mesi }: { dati: Dati; uffici: Ufficio[]; mesi: string[] }) {
  const ultimo = mesi[mesi.length - 1]
  const conPersone = uffici.filter((u) => dati.persone.some((p) => p.ufficio_id === u.id))
  const [ufficioId, setUfficioId] = useState(conPersone[0]?.id)
  // in servizio prima (nell'ordine del rapportino), poi chi è uscito, dal più recente
  const personeUfficio = useMemo(() => {
    const sue = dati.persone.filter((p) => p.ufficio_id === ufficioId)
    const attive = sue.filter((p) => !p.data_fine || p.data_fine > ultimo).sort(ordinaPersone)
    const uscite = sue.filter((p) => p.data_fine && p.data_fine <= ultimo).sort((a, b) => b.data_fine!.localeCompare(a.data_fine!))
    return { attive, uscite }
  }, [dati.persone, ufficioId, ultimo])
  const [scelta, setScelta] = useState<number | null>(null)
  const p = [...personeUfficio.attive, ...personeUfficio.uscite].find((x) => x.id === scelta)
    ?? personeUfficio.attive.find((x) => x.ruolo === RUOLO_GARA) ?? personeUfficio.attive[0] ?? personeUfficio.uscite[0]
  const colonne = vociDelRapportino(dati.voci)
  const [voceGrafico, setVoceGrafico] = useState('incarichi_vendita')

  if (conPersone.length === 0) return <section className="scheda"><p>Nessun ufficio ha ancora inserito il proprio personale.</p></section>

  const scelte = (
    <div className="comandi non-stampa">
      <div className="campo">
        <label htmlFor="collab-ufficio">Ufficio</label>
        <select id="collab-ufficio" value={ufficioId} onChange={(e) => { setUfficioId(Number(e.target.value)); setScelta(null) }}>
          {conPersone.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="collab-persona">Persona</label>
        <select id="collab-persona" value={p?.id} onChange={(e) => setScelta(Number(e.target.value))}>
          <optgroup label="In servizio">
            {personeUfficio.attive.map((x) => <option key={x.id} value={x.id}>{x.nome} · {NOMI_RUOLO_PERSONA[x.ruolo].toLowerCase()}</option>)}
          </optgroup>
          {personeUfficio.uscite.length > 0 && (
            <optgroup label="Non più collaboratori">
              {personeUfficio.uscite.map((x) => <option key={x.id} value={x.id}>{x.nome} · {fine(x)}</option>)}
            </optgroup>
          )}
        </select>
      </div>
    </div>
  )
  if (!p) return scelte

  const ufficio = uffici.find((u) => u.id === p.ufficio_id)!
  const codici = colonne.map((v) => v.codice)
  const gara = p.ruolo === RUOLO_GARA && dati.punti.size > 0
  const plurale = PLURALI[p.ruolo]
  const mesiPersona = mesi.filter((m) => inServizio(p, m))
  const tutteLeRighe = mesiPersona.map((m) => {
    const numeri = numeriPersona(dati.valori, p.id, m, dati.voci)
    const valoriMese = dati.valori.filter((v) => v.mese === m)
    // punteggio più alto del mese tra tutti i collaboratori in servizio (quello va in giallo, come nelle liste)
    const migliore = gara ? Math.max(-Infinity, ...dati.persone.filter((x) => x.ruolo === RUOLO_GARA && inServizio(x, m))
      .map((x) => punteggio(valoriMese.filter((v) => v.persona_id === x.id), dati.punti)).filter((x): x is number => x !== null)) : -Infinity
    return {
      mese: m, numeri, migliore,
      mediaGruppo: mediaRuolo(dati.persone, dati.valori, p.ruolo, m, dati.voci) as TotaliMese,
      punti: gara ? punteggio(valoriMese.filter((v) => v.persona_id === p.id), dati.punti) : null,
      valoreDi: (voce: string) => valoriMese.find((v) => v.persona_id === p.id && v.voce === voce)?.valore ?? null,
    }
  })
  // si parte dal primo mese con numeri: i mesi prima della piattaforma sarebbero solo righe vuote
  const primo = tutteLeRighe.findIndex((r) => haNumeri(r.numeri))
  const righe = primo < 0 ? [] : tutteLeRighe.slice(primo)
  const compilati = righe.filter((r) => haNumeri(r.numeri))
  // Totale dei mesi: le attività si sommano; portafoglio e staff dicono "quanti ce ne sono", quindi vale l'ultimo mese
  const totale = new Map(codici.map((c) => {
    if (VOCI_CONSISTENZA.includes(c)) return [c, [...compilati].reverse().find((r) => r.numeri.get(c) != null)?.numeri.get(c) ?? null]
    const presenti = compilati.map((r) => r.numeri.get(c) ?? null).filter((v): v is number => v !== null)
    return [c, presenti.length ? presenti.reduce((s, v) => s + v, 0) : null]
  }))
  const mediaPersona = media(compilati.map((r) => r.numeri), codici)
  const mediaColleghi = media(compilati.map((r) => r.mediaGruppo), codici)
  const voceScelta = colonne.find((v) => v.codice === voceGrafico) ?? colonne[0]
  const nomeVoce = (v: VoceMensile) => `${v.gruppo}${v.sotto ? ` ${v.sotto}` : ''}`
  const classe = (c: string) => {
    const r = rispettoAllaMedia(mediaPersona.get(c) ?? null, mediaColleghi.get(c) ?? null, colonne.find((v) => v.codice === c))
    return r === 'sopra' ? 't-verde' : r === 'sotto' ? 't-rosso' : ''
  }

  return (
    <>
      {scelte}
      <section className="scheda scheda-stampa">
        <div className="scheda-persona non-stampa">
          <span className="iniziali">{p.nome.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>
          <div>
            <h2>{p.nome}</h2>
            <p className="piccolo">
              {NOMI_RUOLO_PERSONA[p.ruolo]} · {ufficio.nome} · dal {dataItaliana(p.data_inizio)} ({formattaAnzianita(mesiDiServizio(p.data_inizio, ultimo))})
              {p.data_fine && <> · <strong>{fine(p)}</strong></>}
            </p>
          </div>
        </div>
        {compilati.length === 0 ? (
          <p className="piccolo">Nessun numero inserito per questa persona negli ultimi {MESI_SCHEDA} mesi.</p>
        ) : (
          <div className="tabella-scorrevole">
            <table className="tabella tabella-mensile tabella-report">
              <TestataVoci voci={colonne} prime={['Mese']} ultime={gara ? ['Punteggio'] : []}
                titoloStampa={<TitoloStampa titolo={`Scheda di ${p.nome}`}
                  sottotitolo={`${NOMI_RUOLO_PERSONA[p.ruolo]} · ${ufficio.nome} · dal ${dataItaliana(p.data_inizio)}${p.data_fine ? ` · ${fine(p)}` : ''}`}
                  info={`${titoloMese(righe[0]?.mese ?? ultimo)} – ${titoloMese(ultimo)}`} />} />
              <tbody>
                {righe.map((r) => (
                  <tr key={r.mese} className={haNumeri(r.numeri) ? '' : 'riga-vuota'}>
                    <th scope="row" className="ufficio-fisso">{titoloMese(r.mese)}{meseDiServizio(p, r.mese) <= MESI_CURVA && <span className="piccolo">{meseDiServizio(p, r.mese)}° mese di servizio</span>}</th>
                    {colonne.map((v) => (
                      <td key={v.codice} className={`destra ${r.numeri.get(v.codice) === null ? 'cella-vuota' : ''}`}>
                        <ValoreConIndicatori valore={r.numeri.get(v.codice) ?? null} tra={indicatoriAccanto(dati.voci, v.codice, p.ruolo).map((a) => r.valoreDi(a.codice))} />
                      </td>
                    ))}
                    {gara && (
                      <td className={`destra cella-punteggio ${r.punti === null ? 'cella-vuota' : ''} ${r.punti !== null && r.punti === r.migliore ? 'cella-migliore' : ''}`}>
                        {formattaPunti(r.punti)}
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="riga-totale">
                  <th scope="row" className="ufficio-fisso">Totale <span className="piccolo">{compilati.length} {compilati.length === 1 ? 'mese' : 'mesi'}</span></th>
                  {colonne.map((v) => <td key={v.codice} className="destra">{formattaNumero(totale.get(v.codice))}</td>)}
                  {gara && <td className="destra">{formattaPunti(compilati.reduce((s, r) => s + (r.punti ?? 0), 0))}</td>}
                </tr>
                <tr className="riga-media">
                  <th scope="row" className="ufficio-fisso">Media al mese</th>
                  {colonne.map((v) => <td key={v.codice} className={`destra ${classe(v.codice)}`}>{formattaMedia(mediaPersona.get(v.codice))}</td>)}
                  {gara && <td />}
                </tr>
                <tr className="riga-media">
                  <th scope="row" className="ufficio-fisso">Media {plurale} <span className="piccolo">stessi mesi</span></th>
                  {colonne.map((v) => <td key={v.codice} className="destra">{formattaMedia(mediaColleghi.get(v.codice))}</td>)}
                  {gara && <td />}
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="piccolo">
          Media al mese: in <span className="t-verde">verde</span> se è almeno come la media degli altri {plurale} negli stessi mesi,
          in <span className="t-rosso">rosso</span> se è sotto (per gli incarichi scaduti al contrario).
          Nel totale, staff e portafoglio sono quelli dell'ultimo mese inserito.{gara && ' Punteggio in giallo: il più alto del mese tra tutti i collaboratori.'}
        </p>
      </section>

      {compilati.length > 0 && (
        <section className="scheda">
          <div className="scheda-titolo">
            <h2>Andamento mese per mese</h2>
            <select value={voceScelta.codice} onChange={(e) => setVoceGrafico(e.target.value)} aria-label="Voce del grafico">
              {colonne.map((v) => <option key={v.codice} value={v.codice}>{nomeVoce(v)}</option>)}
            </select>
          </div>
          <LegendaGrafico nomi={[p.nome, `media ${plurale}`]} />
          <GraficoAndamento etichette={righe.map((r) => nomeMeseBreve(r.mese.slice(0, 7)))} nomeSerie={p.nome} prefisso="" nomeLinea={`Media ${plurale}`}
            risultati={righe.map((r) => r.numeri.get(voceScelta.codice) ?? null)}
            obiettivi={righe.map((r) => { const v = r.mediaGruppo.get(voceScelta.codice); return v == null ? null : Math.round(v * 10) / 10 })} />
        </section>
      )}
    </>
  )
}

// ---------------------------------------------------------------- Curva dei nuovi

function CurvaNuovi({ dati, uffici, mesi }: { dati: Dati; uffici: Ufficio[]; mesi: string[] }) {
  const ultimo = mesi[mesi.length - 1]
  const colonne = vociDelRapportino(dati.voci).filter((v) => !VOCI_CONSISTENZA.includes(v.codice))
  const [voce, setVoce] = useState('incarichi_vendita')
  const v = colonne.find((x) => x.codice === voce) ?? colonne[0]
  const curva = curvaCrescita(dati.persone, dati.valori, mesi, RUOLO_GARA, v.codice)
  const nuovi = nuoviEntrati(dati.persone, RUOLO_GARA, ultimo)
  const ufficioDi = new Map(uffici.map((u) => [u.id, u.nome]))
  const valore = (p: Persona, m: string) => dati.valori.find((x) => x.persona_id === p.id && x.mese === m && x.voce === v.codice)?.valore ?? null
  const nomeVoce = (x: VoceMensile) => `${x.gruppo}${x.sotto ? ` ${x.sotto}` : ''}`
  const etichette = curva.map((_, i) => `${i + 1}°`)
  const puntiConDati = curva.filter((c) => c.valore !== null).length
  // colonne della tabella: fino al mese di servizio più alto tra i nuovi
  const maxServizio = Math.min(MESI_CURVA, Math.max(1, ...nuovi.map((p) => meseDiServizio(p, ultimo))))

  return (
    <>
      <section className="scheda">
        <div className="scheda-titolo">
          <h2>Curva di crescita dei collaboratori</h2>
          <select value={v.codice} onChange={(e) => setVoce(e.target.value)} aria-label="Voce della curva">
            {colonne.map((x) => <option key={x.codice} value={x.codice}>{nomeVoce(x)}</option>)}
          </select>
        </div>
        <p className="piccolo">Per ogni mese di servizio (1° = il mese in cui hanno iniziato) la media di <strong>{nomeVoce(v).toLowerCase()}</strong> dei
          collaboratori che in quel mese di servizio hanno il numero inserito. Un punto compare solo con almeno {MINIMO_PERSONE} persone.</p>
        {puntiConDati === 0 ? (
          <p className="avviso"><Icona nome="hourglass-medium" /><span>Non ci sono ancora abbastanza dati: servono almeno {MINIMO_PERSONE} collaboratori nello stesso
            mese di servizio con i numeri inseriti persona per persona. La curva si riempie con i prossimi rapportini mensili.</span></p>
        ) : (
          <>
            <LegendaGrafico obiettivo={false} nomi={['media dei collaboratori', '']} />
            <GraficoAndamento etichette={etichette} nomeSerie={nomeVoce(v)} prefisso="Mese di servizio:"
              risultati={curva.map((c) => (c.valore === null ? null : Math.round(c.valore * 10) / 10))} />
            <p className="piccolo">Persone per mese di servizio: {curva.map((c, i) => `${i + 1}° ${c.persone}`).join(' · ')}.</p>
          </>
        )}
      </section>

      <section className="scheda scheda-stampa">
        <h2 className="non-stampa">Entrati negli ultimi {MESI_CURVA} mesi <span className="piccolo">({nuovi.length})</span></h2>
        {nuovi.length === 0 ? <p className="piccolo">Nessun collaboratore entrato negli ultimi {MESI_CURVA} mesi.</p> : (
          <div className="tabella-scorrevole">
            <table className="tabella tabella-mensile tabella-nuovi">
              <thead>
                <tr className="solo-stampa"><th colSpan={3 + maxServizio} className="titolo-stampa">
                  <TitoloStampa titolo="Nuovi collaboratori" sottotitolo={`${nomeVoce(v)} per mese di servizio · fino a ${titoloMese(ultimo)}`} />
                </th></tr>
                <tr>
                  <th className="ufficio-fisso">Collaboratore</th><th>Ufficio</th><th>Inizio</th>
                  {Array.from({ length: maxServizio }, (_, i) => <th key={i} className="destra">{i + 1}° mese</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="riga-media">
                  <th scope="row" className="ufficio-fisso">Media dei collaboratori</th><td /><td />
                  {curva.slice(0, maxServizio).map((c, i) => <td key={i} className="destra">{formattaMedia(c.valore)}</td>)}
                </tr>
                {nuovi.map((p) => {
                  // il valore della persona in ciascun mese di servizio (se quel mese è tra quelli caricati)
                  const perServizio = Array.from({ length: maxServizio }, (_, i) => {
                    const m = aggiungiMesi(`${p.data_inizio.slice(0, 7)}-01`, i)
                    return mesi.includes(m) && inServizio(p, m) ? valore(p, m) : undefined
                  })
                  return (
                    <tr key={p.id}>
                      <th scope="row" className="ufficio-fisso">{p.nome}</th>
                      <td>{ufficioDi.get(p.ufficio_id)}</td>
                      <td className="cella-inizio">{dataItaliana(p.data_inizio)}</td>
                      {perServizio.map((x, i) => {
                        const segnala = x != null && daSeguire(x, curva[i]?.valore ?? null, v)
                        return (
                          <td key={i} className={`destra ${x == null ? 'cella-vuota' : ''} ${segnala ? 'cella-da-seguire' : ''}`}
                            title={segnala ? 'Da seguire: sotto la metà della media dei collaboratori nello stesso mese di servizio' : undefined}>
                            {x === undefined ? '' : formattaNumero(x)}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="piccolo">In <span className="testo-arancio">arancio</span> i mesi "da seguire": sotto il {Math.round(SOGLIA_DA_SEGUIRE * 100)}% della media dei
          collaboratori nello stesso mese di servizio. Casella vuota: numero non inserito o mese prima della piattaforma.</p>
      </section>
    </>
  )
}
