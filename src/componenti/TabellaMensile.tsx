// Tabelle del rapportino mensile: intestazione su due livelli come nel file Excel
// (es. "Proposte" → vendita / locazione) e tabella delle persone di un ufficio,
// modificabile (pagina dell'ufficio) o in sola lettura (report dell'amministratore).
import type { KeyboardEvent, ReactNode } from 'react'
import {
  dataItaliana, formattaAnzianita, formattaNumero, GRUPPI_PERSONE, indicatori, indicatoriAccanto, mesiDiServizio, movimentoNelMese, presenteNelMese, STAFF,
  vociDelRapportino, type TotaliMese,
} from '../lib/mensile'
import { NOMI_RUOLO_PERSONA, type Persona, type VoceMensile } from '../lib/tipi'
import { Logo } from './Interfaccia'

/** Voci consecutive con lo stesso gruppo (es. le due colonne di "Proposte") */
function gruppiDiVoci(voci: VoceMensile[]): { gruppo: string; voci: VoceMensile[] }[] {
  const gruppi: { gruppo: string; voci: VoceMensile[] }[] = []
  for (const v of voci) {
    const ultimo = gruppi[gruppi.length - 1]
    if (ultimo && ultimo.gruppo === v.gruppo && v.sotto) ultimo.voci.push(v)
    else gruppi.push({ gruppo: v.gruppo, voci: [v] })
  }
  return gruppi
}

const SOTTO: Record<string, string> = { vendita: 'vend.', locazione: 'loc.' }

/**
 * Intestazione delle stampe: marchio, titolo, sottotitolo (di solito il mese) e note a destra.
 * Sta nella prima riga dell'intestazione della tabella, quindi si ripete in cima a ogni pagina.
 */
export function TitoloStampa({ titolo, sottotitolo, info }: { titolo: ReactNode; sottotitolo?: ReactNode; info?: ReactNode }) {
  return (
    <div className="stampa-testata">
      <Logo altezza={64} sfondo="chiaro" />
      <div className="stampa-titoli">
        <span className="stampa-kicker">Gruppo CEC · Rapportini mensili</span>
        <strong>{titolo}</strong>
        {sottotitolo && <span className="stampa-sotto">{sottotitolo}</span>}
      </div>
      <div className="stampa-info">
        {info}
        <span className="stampa-data">Stampato il {new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>
    </div>
  )
}

interface PropsTestata {
  voci: VoceMensile[]
  prime: ReactNode[]            // le prime colonne (es. "Ufficio", "Stato", "Staff"), alte due righe
  ultime?: ReactNode[]          // colonne finali (es. "Punteggio")
  titoloStampa?: ReactNode      // riga del titolo, visibile solo in stampa e ripetuta in testa a ogni pagina
  annotazioni?: Map<string, string>   // testo in più sotto una colonna (es. "(fix)" negli appuntamenti vendita)
}

/** Intestazione su due righe: gruppo sopra, vendita/locazione sotto */
export function TestataVoci({ voci, prime, ultime = [], titoloStampa, annotazioni }: PropsTestata) {
  const nota = (codice: string) => annotazioni?.get(codice) && <sup className="nota-fix">{annotazioni.get(codice)}</sup>
  const gruppi = gruppiDiVoci(voci)
  return (
    <thead>
      {titoloStampa && (
        <tr className="solo-stampa"><th colSpan={prime.length + voci.length + ultime.length} className="titolo-stampa">{titoloStampa}</th></tr>
      )}
      <tr>
        {prime.map((p, i) => <th key={`p${i}`} rowSpan={2} className={i === 0 ? 'ufficio-fisso' : 'centro-testo'}>{p}</th>)}
        {gruppi.map((g) => g.voci.length === 1 && !g.voci[0].sotto
          ? <th key={g.gruppo} rowSpan={2} className="testa-voce">{g.gruppo}{nota(g.voci[0].codice)}</th>
          : <th key={g.gruppo} colSpan={g.voci.length} className="testa-voce testa-gruppo">{g.gruppo}</th>)}
        {ultime.map((u, i) => <th key={`u${i}`} rowSpan={2} className="centro-testo">{u}</th>)}
      </tr>
      <tr>
        {gruppi.filter((g) => g.voci[0].sotto).flatMap((g) => g.voci.map((v) =>
          <th key={v.codice} className="testa-sotto">{SOTTO[v.sotto!] ?? v.sotto}{nota(v.codice)}</th>))}
      </tr>
    </thead>
  )
}

interface PropsRapportino {
  voci: VoceMensile[]                                  // tutte: colonne del rapportino e indicatori (es. App. vendita fix)
  mese: string
  righe: Persona[]                                     // persone del mese, già ordinate
  totale: TotaliMese
  testo: (personaId: number, voce: string) => string   // contenuto della casella
  modificabile?: boolean
  disattivo?: boolean
  errate?: Set<string>                                 // caselle con valori non validi ("persona|voce")
  onCambia?: (personaId: number, voce: string, valore: string) => void
  titoloStampa?: ReactNode
}

/** Etichetta breve di un indicatore, mostrata come esponente nell'intestazione: "App. vendita fix" → "fix" */
const breve = (v: VoceMensile) => v.gruppo.split(' ').pop()!.toLowerCase()

/** Gli indicatori usati da queste persone, e la nota da mettere sotto la colonna che li ospita */
export function annotazioniIndicatori(voci: VoceMensile[], persone: Persona[]) {
  const usati = indicatori(voci).filter((v) => v.accanto_a && persone.some((p) => p.ruolo === v.solo_ruolo))
  return { usati, annotazioni: new Map(usati.map((v) => [v.accanto_a!, breve(v)])) }
}

/** Numero con gli indicatori della stessa colonna scritti come esponente (es. 9⁷: 9 appuntamenti, 7 fix).
 *  formato: per le medie, che hanno i decimali (es. 12,5⁸·³) */
export function ValoreConIndicatori({ valore, tra, formato = formattaNumero }: { valore: number | null; tra: (number | null)[]; formato?: (n: number | null) => string }) {
  return <>{formato(valore)}{tra.map((x, i) => x !== null && <sup key={i} className="valore-fix">{formato(x)}</sup>)}</>
}

/** Spiega i numeri a esponente */
export function LegendaIndicatori({ usati, voci }: { usati: VoceMensile[]; voci: VoceMensile[] }) {
  if (usati.length === 0) return null
  return (
    <p className="legenda legenda-movimenti">
      {usati.map((v) => {
        const colonna = voci.find((c) => c.codice === v.accanto_a)
        return <span key={v.codice}>9<sup className="valore-fix">7</sup> in {colonna ? `${colonna.gruppo}${colonna.sotto ? ` ${colonna.sotto}` : ''}`.toLowerCase() : ''} = {v.gruppo} delle {v.solo_ruolo === 'coordinatrice' ? 'coordinatrici' : v.solo_ruolo} (il numero piccolo in alto): indicatore di qualità, non entra nei totali</span>
      })}
    </p>
  )
}

/** Etichetta (e colore della riga) per chi entra o esce dall'ufficio nel mese */
export function EtichettaMovimento({ persona, mese }: { persona: Persona; mese: string }) {
  const m = movimentoNelMese(persona, mese)
  if (m === 'entrata') return <span className="tag tag-ok tag-movimento">Nuovo ingresso dal {dataItaliana(persona.data_inizio)}</span>
  if (m === 'uscita') return <span className="tag tag-ko tag-movimento">Ha lasciato il {dataItaliana(persona.data_fine)}</span>
  if (m === 'promozione') return <span className="tag tag-accento tag-movimento">Promosso a responsabile il {dataItaliana(persona.data_fine)}</span>
  if (m === 'trasferimento') return <span className="tag tag-accento tag-movimento">Trasferito in un altro ufficio il {dataItaliana(persona.data_fine)}</span>
  return null
}

// chi lascia l'ufficio nel mese resta nel rapportino con la riga rossa (i suoi numeri contano nel totale);
// chi è promosso o trasferito resta come lui, ma senza il rosso
export const classeMovimento = (persona: Persona, mese: string) =>
  ({ entrata: 'riga-entrata', uscita: 'riga-uscita', promozione: '', trasferimento: '', nessuno: '' })[movimentoNelMese(persona, mese) ?? 'nessuno']

/** Spiega i colori delle righe, solo quelli presenti nelle persone mostrate */
export function LegendaMovimenti({ persone, mese }: { persone: Persona[]; mese: string }) {
  const entrate = persone.some((p) => movimentoNelMese(p, mese) === 'entrata')
  const uscite = persone.some((p) => movimentoNelMese(p, mese) === 'uscita')
  if (!entrate && !uscite) return null
  return (
    <p className="legenda legenda-movimenti">
      {entrate && <span><span className="quadratino riga-entrata" />verde = nuovo ingresso nel mese</span>}
      {uscite && <span><span className="quadratino riga-uscita" />rosso = ha lasciato l'ufficio nel mese (i numeri contano nel totale, non nello staff né nella gara)</span>}
    </p>
  )
}

/** Chi ha lasciato l'ufficio durante il mese: resta nel rapportino (riga rossa), lo si spiega sopra la tabella */
export function AvvisoUscite({ persone, mese }: { persone: Persona[]; mese: string }) {
  const usciti = persone.filter((p) => movimentoNelMese(p, mese) === 'uscita' && presenteNelMese(p, mese))
  if (usciti.length === 0) return null
  return (
    <p className="avviso avviso-uscite non-stampa">
      <span className="quadratino riga-uscita" />
      <span>
        <strong>{usciti.length === 1 ? 'Ha lasciato l\'ufficio' : 'Hanno lasciato l\'ufficio'} nel mese:</strong>{' '}
        {usciti.map((p) => `${p.nome} (${NOMI_RUOLO_PERSONA[p.ruolo].toLowerCase()}, il ${dataItaliana(p.data_fine)})`).join(' · ')}.
        {' '}{usciti.length === 1 ? 'La sua riga è' : 'Le loro righe sono'} in rosso: i numeri del mese contano nel totale dell'ufficio, ma non nello staff né nella gara a punti.
      </span>
    </p>
  )
}

/** Il rapportino di un ufficio: una riga per persona, divise nelle due tabelle del file, e il totale */
export function TabellaRapportino({ voci, mese, righe, totale, testo, modificabile, disattivo, errate, onCambia, titoloStampa }: PropsRapportino) {
  const colonne = vociDelRapportino(voci)
  const { usati, annotazioni } = annotazioniIndicatori(voci, righe)

  // Invio e frecce su/giù spostano sulla stessa colonna della riga sotto/sopra (come in Excel)
  function tasto(e: KeyboardEvent<HTMLInputElement>, riga: number, colonna: string) {
    const passo = e.key === 'Enter' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!passo) return
    const prossima = [...document.querySelectorAll<HTMLInputElement>(`input[data-colonna="${colonna}"]`)]
      .filter((x) => Number(x.dataset.riga) * passo > riga * passo)
      .sort((a, b) => (Number(a.dataset.riga) - Number(b.dataset.riga)) * passo)[0]
    if (prossima) { e.preventDefault(); prossima.focus(); prossima.select() }
  }

  const casella = (p: Persona, v: VoceMensile, r: number, colonna: string, classe = '', segnaposto?: string) => (
    <input key={v.codice} inputMode="numeric" value={testo(p.id, v.codice)} disabled={disattivo} data-riga={r} data-colonna={colonna} placeholder={segnaposto}
      aria-label={`${p.nome} – ${v.gruppo}${v.sotto ? ` ${v.sotto}` : ''}`}
      className={`${classe} ${errate?.has(`${p.id}|${v.codice}`) ? 'non-valido' : ''}`}
      onKeyDown={(e) => tasto(e, r, colonna)}
      onChange={(e) => onCambia?.(p.id, v.codice, e.target.value)} />
  )
  const numero = (t: string) => (t === '' ? null : Number(t))

  let indice = 0
  return (
    <>
      <div className="tabella-scorrevole">
        <table className={`tabella tabella-mensile ${modificabile ? 'tabella-mensile-modifica' : ''}`}>
          <TestataVoci voci={colonne} prime={['Persona']} titoloStampa={titoloStampa} annotazioni={annotazioni} />
          <tbody>
            {GRUPPI_PERSONE.map((g) => {
              const persone = righe.filter((p) => g.ruoli.includes(p.ruolo))
              if (g.soloSePieno && persone.length === 0) return []
              return [
                <tr key={g.titolo} className="separatore"><th className="ufficio-fisso" colSpan={1}>{g.titolo}</th><td colSpan={colonne.length} /></tr>,
                persone.length === 0
                  ? <tr key={`${g.titolo}-vuoto`}><th className="ufficio-fisso piccolo">Nessuna persona</th><td colSpan={colonne.length} /></tr>
                  : persone.map((p) => {
                    const r = indice++
                    return (
                      <tr key={p.id} className={classeMovimento(p, mese)}>
                        <th scope="row" className="ufficio-fisso nome-persona">
                          <span>{p.nome}</span>
                          <span className="piccolo">{NOMI_RUOLO_PERSONA[p.ruolo]} · {formattaAnzianita(mesiDiServizio(p.data_inizio, mese))}</span>
                          <EtichettaMovimento persona={p} mese={mese} />
                        </th>
                        {colonne.map((v, c) => {
                          const accanto = indicatoriAccanto(voci, v.codice, p.ruolo)   // es. App. vendita fix per le coordinatrici
                          const valore = testo(p.id, v.codice)
                          if (!modificabile) {
                            return (
                              <td key={v.codice} className={`destra ${accanto.length ? 'cella-con-fix' : ''} ${valore === '' && !accanto.length ? 'cella-vuota' : ''}`}>
                                <ValoreConIndicatori valore={numero(valore)} tra={accanto.map((a) => numero(testo(p.id, a.codice)))} />
                              </td>
                            )
                          }
                          return (
                            <td key={v.codice} className="destra">
                              {accanto.length === 0 ? casella(p, v, r, String(c)) : (
                                // stesso quadrato degli altri: il fix si scrive nell'angolo in alto a destra, come un esponente
                                <span className="casella-con-fix" title={`In alto a destra: ${accanto.map((a) => a.gruppo).join(', ')} (indicatore di qualità, non entra nei totali)`}>
                                  {casella(p, v, r, String(c), 'input-principale')}
                                  {accanto.map((a) => casella(p, a, r, a.codice, 'input-fix', breve(a)))}
                                </span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  }),
              ]
            })}
            <tr className="riga-totale-mese">
              <th scope="row" className="ufficio-fisso">Totale ufficio<span className="piccolo">Staff: {formattaNumero(totale.get(STAFF))}</span></th>
              {colonne.map((v) => <td key={v.codice} className="destra">{formattaNumero(totale.get(v.codice))}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <LegendaIndicatori usati={usati} voci={colonne} />
      <LegendaMovimenti persone={righe} mese={mese} />
    </>
  )
}
