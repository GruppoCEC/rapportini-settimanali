// Report mensile del gruppo per gli uffici (018, richiesta di Davide del 26/10/2026): dopo la scadenza con il
// blocco, ogni ufficio vede e stampa il report di tutto il gruppo, con la propria riga in giallo per trovarla subito.
// I numeri arrivano dalla funzione report_gruppo_mensile del database, che li dà solo dopo il blocco.
import { useEffect } from 'react'
import { caricaReportGruppo } from '../lib/dati'
import { formattaNumero, ordinaUfficiReport, sommaTotali, STAFF, titoloMese, vociDelRapportino, type TotaliMese } from '../lib/mensile'
import type { VoceMensile } from '../lib/tipi'
import { useDati } from '../lib/useDati'
import { Icona } from './Interfaccia'
import { TestataVoci, TitoloStampa } from './TabellaMensile'

/** Durante la stampa del report si nasconde il resto della pagina (stile.css, body.stampa-report-gruppo) */
function stampaSoloReport() {
  const fine = () => { document.body.classList.remove('stampa-report-gruppo'); window.removeEventListener('afterprint', fine) }
  document.body.classList.add('stampa-report-gruppo')
  window.addEventListener('afterprint', fine)
  window.print()
}

export default function ReportGruppoUfficio({ mese, ufficioId, voci }: { mese: string; ufficioId: number; voci: VoceMensile[] }) {
  const dati = useDati(() => caricaReportGruppo(mese), [mese])
  useEffect(() => () => document.body.classList.remove('stampa-report-gruppo'), [])
  if (!dati.dati || dati.dati.length === 0) return null      // funzione non ancora nel database, o nessun dato

  const colonne = vociDelRapportino(voci)
  const codici = [STAFF, ...colonne.map((v) => v.codice)]
  const uffici = ordinaUfficiReport(dati.dati.map((r) => r.ufficio))
  const totaleDi = new Map(dati.dati.map((r) => [r.ufficio.id, r.totale]))
  const totale = sommaTotali(uffici.map((u) => totaleDi.get(u.id)!))
  const blocchi = [1, 2].map((b) => uffici.filter((u) => (u.blocco_mensile ?? 1) === b)).filter((b) => b.length > 0)
  const riga = (id: number, nome: string, t: TotaliMese) => (
    <tr key={id} className={id === ufficioId ? 'riga-migliore' : ''}>
      <th scope="row" className="ufficio-fisso">
        {nome}{id === ufficioId && <span className="tag tag-migliore tag-movimento">Il vostro ufficio</span>}
      </th>
      {codici.map((c) => <td key={c} className={`destra ${t.get(c) == null ? 'cella-vuota' : ''}`}>{formattaNumero(t.get(c))}</td>)}
    </tr>
  )

  return (
    <section className="scheda scheda-stampa report-gruppo-ufficio entra">
      <div className="scheda-titolo non-stampa">
        <h2 className="titolo-icona"><span className="icona-quadrata icona-ambra"><Icona nome="table" /></span>Report del gruppo · {titoloMese(mese).toLowerCase()}</h2>
        <button className="btn btn-secondario" onClick={stampaSoloReport}><Icona nome="printer" />Stampa il report del gruppo</button>
      </div>
      <p className="piccolo non-stampa">L'inserimento di {titoloMese(mese).toLowerCase()} è chiuso: ecco i numeri di tutti gli uffici. La riga del vostro ufficio è in giallo.</p>
      <div className="tabella-scorrevole">
        <table className="tabella tabella-mensile tabella-report">
          <TestataVoci voci={colonne} prime={['Ufficio', 'Staff']} titoloStampa={<TitoloStampa titolo="Report mensile · Gruppo" sottotitolo={titoloMese(mese)} />} />
          <tbody>
            {blocchi.map((b, i) => [
              i > 0 && <tr key={`sep${i}`} className="separatore-blocco"><td colSpan={codici.length + 1} /></tr>,
              ...b.map((u) => riga(u.id, u.nome, totaleDi.get(u.id)!)),
            ])}
            <tr className="riga-totale-mese">
              <th scope="row" className="ufficio-fisso">Totale gruppo</th>
              {codici.map((c) => <td key={c} className="destra">{formattaNumero(totale.get(c))}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="legenda legenda-movimenti">
        <span><span className="quadratino riga-migliore" />giallo = il vostro ufficio</span>
        <span>Staff = persone in servizio a fine mese. Trattini = nessun numero.</span>
      </p>
    </section>
  )
}
