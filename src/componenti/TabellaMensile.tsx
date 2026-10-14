// Tabelle del rapportino mensile: intestazione su due livelli come nel file Excel
// (es. "Proposte" → vendita / locazione) e tabella delle persone di un ufficio,
// modificabile (pagina dell'ufficio) o in sola lettura (report dell'amministratore).
import type { KeyboardEvent, ReactNode } from 'react'
import { formattaAnzianita, formattaNumero, GRUPPI_PERSONE, mesiDiServizio, STAFF, type TotaliMese } from '../lib/mensile'
import { NOMI_RUOLO_PERSONA, type Persona, type VoceMensile } from '../lib/tipi'

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
        {ultime.map((u, i) => <th key={`u${i}`} rowSpan={2} className="centro-testo">{u}</th>)}
      </tr>
      <tr>
        {gruppi.filter((g) => g.voci[0].sotto).flatMap((g) => g.voci.map((v) =>
          <th key={v.codice} className="testa-sotto">{SOTTO[v.sotto!] ?? v.sotto}</th>))}
      </tr>
    </thead>
  )
}

interface PropsRapportino {
  voci: VoceMensile[]
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

/** Il rapportino di un ufficio: una riga per persona, divise nelle due tabelle del file, e il totale */
export function TabellaRapportino({ voci, mese, righe, totale, testo, modificabile, disattivo, errate, onCambia, titoloStampa }: PropsRapportino) {
  // Invio e frecce su/giù spostano sulla stessa colonna della riga sotto/sopra (come in Excel)
  function tasto(e: KeyboardEvent<HTMLInputElement>, riga: number, colonna: number) {
    const passo = e.key === 'Enter' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!passo) return
    const prossima = document.querySelector<HTMLInputElement>(`input[data-riga="${riga + passo}"][data-colonna="${colonna}"]`)
    if (prossima) { e.preventDefault(); prossima.focus(); prossima.select() }
  }

  let indice = 0
  return (
    <div className="tabella-scorrevole">
      <table className={`tabella tabella-mensile ${modificabile ? 'tabella-mensile-modifica' : ''}`}>
        <TestataVoci voci={voci} prime={['Persona']} titoloStampa={titoloStampa} />
        <tbody>
          {GRUPPI_PERSONE.map((g) => {
            const persone = righe.filter((p) => g.ruoli.includes(p.ruolo))
            return [
              <tr key={g.titolo} className="separatore"><th className="ufficio-fisso" colSpan={1}>{g.titolo}</th><td colSpan={voci.length} /></tr>,
              persone.length === 0
                ? <tr key={`${g.titolo}-vuoto`}><th className="ufficio-fisso piccolo">Nessuna persona</th><td colSpan={voci.length} /></tr>
                : persone.map((p) => {
                  const r = indice++
                  return (
                    <tr key={p.id}>
                      <th scope="row" className="ufficio-fisso nome-persona">
                        <span>{p.nome}</span>
                        <span className="piccolo">{NOMI_RUOLO_PERSONA[p.ruolo]} · {formattaAnzianita(mesiDiServizio(p.data_inizio, mese))}</span>
                      </th>
                      {voci.map((v, c) => {
                        const valore = testo(p.id, v.codice)
                        if (!modificabile) return <td key={v.codice} className={`destra ${valore === '' ? 'cella-vuota' : ''}`}>{valore === '' ? '—' : valore}</td>
                        return (
                          <td key={v.codice} className="destra">
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
            {voci.map((v) => <td key={v.codice} className="destra">{formattaNumero(totale.get(v.codice))}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
