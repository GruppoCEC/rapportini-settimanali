// Tabelle del rapportino mensile: intestazione su due livelli come nel file Excel
// (es. "Proposte" → vendita / locazione) e tabella delle persone di un ufficio,
// modificabile (pagina dell'ufficio) o in sola lettura (report dell'amministratore).
import type { KeyboardEvent, ReactNode } from 'react'
import {
  dataItaliana, formattaAnzianita, formattaNumero, GRUPPI_PERSONE, indicatori, mesiDiServizio, movimentoNelMese, STAFF, vociDelRapportino, type TotaliMese,
} from '../lib/mensile'
import { NOMI_RUOLO_PERSONA, type Persona, type RuoloPersona, type VoceMensile } from '../lib/tipi'

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

interface PropsTestata {
  voci: VoceMensile[]
  prime: ReactNode[]            // le prime colonne (es. "Ufficio", "Stato", "Staff"), alte due righe
  ultime?: ReactNode[]          // colonne finali (es. "Punteggio")
  titoloStampa?: ReactNode      // riga del titolo, visibile solo in stampa e ripetuta in testa a ogni pagina
}

/** Intestazione su due righe: gruppo sopra, vendita/locazione sotto */
export function TestataVoci({ voci, prime, ultime = [], titoloStampa }: PropsTestata) {
  const gruppi = gruppiDiVoci(voci)
  return (
    <thead>
      {titoloStampa && (
        <tr className="solo-stampa"><th colSpan={prime.length + voci.length + ultime.length} className="titolo-stampa">{titoloStampa}</th></tr>
      )}
      <tr>
        {prime.map((p, i) => <th key={`p${i}`} rowSpan={2} className={i === 0 ? 'ufficio-fisso' : 'centro-testo'}>{p}</th>)}
        {gruppi.map((g) => g.voci.length === 1 && !g.voci[0].sotto
          ? <th key={g.gruppo} rowSpan={2} className="testa-voce">{g.gruppo}</th>
          : <th key={g.gruppo} colSpan={g.voci.length} className="testa-voce testa-gruppo">{g.gruppo}</th>)}
        {ultime.map((u, i) => <th key={`u${i}`} rowSpan={2} className="centro-testo testa-ultima">{u}</th>)}
      </tr>
      <tr>
        {gruppi.filter((g) => g.voci[0].sotto).flatMap((g) => g.voci.map((v) =>
          <th key={v.codice} className="testa-sotto">{SOTTO[v.sotto!] ?? v.sotto}</th>))}
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
  titoloStampa?: string
}

const PLURALE_RUOLO: Record<RuoloPersona, string> = { responsabile: 'responsabili', funzionario: 'funzionari', coordinatrice: 'coordinatrici', marketer: 'marketer' }

/** Intestazione di un indicatore: nome e a chi è riservato */
export function TestaIndicatore({ voce }: { voce: VoceMensile }) {
  return <span className="testa-indicatore" title={`Indicatore: si compila solo per le ${PLURALE_RUOLO[voce.solo_ruolo!]} e non entra nei totali`}>{voce.gruppo}<span>solo {PLURALE_RUOLO[voce.solo_ruolo!].slice(0, 5)}.</span></span>
}

/** Etichetta (e colore della riga) per chi entra o esce dall'ufficio nel mese */
export function EtichettaMovimento({ persona, mese }: { persona: Persona; mese: string }) {
  const m = movimentoNelMese(persona, mese)
  if (m === 'entrata') return <span className="tag tag-ok tag-movimento">Nuovo ingresso dal {dataItaliana(persona.data_inizio)}</span>
  if (m === 'uscita') return <span className="tag tag-ko tag-movimento">Ha lasciato il {dataItaliana(persona.data_fine)}</span>
  return null
}

export const classeMovimento = (persona: Persona, mese: string) =>
  ({ entrata: 'riga-entrata', uscita: 'riga-uscita', nessuno: '' })[movimentoNelMese(persona, mese) ?? 'nessuno']

export function LegendaMovimenti() {
  return (
    <p className="legenda legenda-movimenti">
      <span><span className="quadratino riga-entrata" />verde = nuovo ingresso nel mese</span>
      <span><span className="quadratino riga-uscita" />rosso = ha lasciato l'ufficio nel mese</span>
    </p>
  )
}

/** Il rapportino di un ufficio: una riga per persona, divise nelle due tabelle del file, e il totale */
export function TabellaRapportino({ voci, mese, righe, totale, testo, modificabile, disattivo, errate, onCambia, titoloStampa }: PropsRapportino) {
  const colonne = vociDelRapportino(voci)
  const extra = indicatori(voci).filter((v) => righe.some((p) => p.ruolo === v.solo_ruolo))   // solo se c'è chi li compila
  const tutte = [...colonne, ...extra]
  const conMovimenti = righe.some((p) => movimentoNelMese(p, mese))

  // Invio e frecce su/giù spostano sulla stessa colonna della riga sotto/sopra (come in Excel)
  function tasto(e: KeyboardEvent<HTMLInputElement>, riga: number, colonna: number) {
    const passo = e.key === 'Enter' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!passo) return
    const prossima = [...document.querySelectorAll<HTMLInputElement>(`input[data-colonna="${colonna}"]`)]
      .filter((x) => Number(x.dataset.riga) * passo > riga * passo)
      .sort((a, b) => (Number(a.dataset.riga) - Number(b.dataset.riga)) * passo)[0]
    if (prossima) { e.preventDefault(); prossima.focus(); prossima.select() }
  }

  let indice = 0
  return (
    <>
      <div className="tabella-scorrevole">
        <table className={`tabella tabella-mensile ${modificabile ? 'tabella-mensile-modifica' : ''}`}>
          <TestataVoci voci={colonne} prime={['Persona']} ultime={extra.map((v) => <TestaIndicatore key={v.codice} voce={v} />)} titoloStampa={titoloStampa} />
          <tbody>
            {GRUPPI_PERSONE.map((g) => {
              const persone = righe.filter((p) => g.ruoli.includes(p.ruolo))
              return [
                <tr key={g.titolo} className="separatore"><th className="ufficio-fisso" colSpan={1}>{g.titolo}</th><td colSpan={tutte.length} /></tr>,
                persone.length === 0
                  ? <tr key={`${g.titolo}-vuoto`}><th className="ufficio-fisso piccolo">Nessuna persona</th><td colSpan={tutte.length} /></tr>
                  : persone.map((p) => {
                    const r = indice++
                    return (
                      <tr key={p.id} className={classeMovimento(p, mese)}>
                        <th scope="row" className="ufficio-fisso nome-persona">
                          <span>{p.nome}</span>
                          <span className="piccolo">{NOMI_RUOLO_PERSONA[p.ruolo]} · {formattaAnzianita(mesiDiServizio(p.data_inizio, mese))}</span>
                          <EtichettaMovimento persona={p} mese={mese} />
                        </th>
                        {tutte.map((v, c) => {
                          if (v.solo_ruolo && v.solo_ruolo !== p.ruolo) return <td key={v.codice} className="cella-esclusa" />
                          const classe = `destra ${v.solo_ruolo ? 'cella-indicatore' : ''}`
                          const valore = testo(p.id, v.codice)
                          if (!modificabile) return <td key={v.codice} className={`${classe} ${valore === '' ? 'cella-vuota' : ''}`}>{valore === '' ? '—' : valore}</td>
                          return (
                            <td key={v.codice} className={classe}>
                              <input inputMode="numeric" value={valore} disabled={disattivo} data-riga={r} data-colonna={c}
                                aria-label={`${p.nome} – ${v.gruppo}${v.sotto ? ` ${v.sotto}` : ''}`}
                                className={errate?.has(`${p.id}|${v.codice}`) ? 'non-valido' : ''}
                                onKeyDown={(e) => tasto(e, r, c)}
                                onChange={(e) => onCambia?.(p.id, v.codice, e.target.value)} />
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
              {extra.map((v) => <td key={v.codice} className="cella-esclusa" title="Indicatore: non entra nei totali" />)}
            </tr>
          </tbody>
        </table>
      </div>
      {conMovimenti && <LegendaMovimenti />}
    </>
  )
}
