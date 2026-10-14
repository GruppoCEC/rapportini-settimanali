// Selettore del mese per il rapportino mensile: frecce avanti/indietro e ritorno al mese proposto.
import { aggiungiMesi, meseInCorso, mesePredefinito, titoloMese } from '../lib/mensile'
import { Icona } from './Interfaccia'

export default function SceltaMese({ mese, onCambia }: { mese: string; onCambia: (mese: string) => void }) {
  const ultimo = meseInCorso()                 // non si va oltre il mese in corso
  const proposto = mesePredefinito()
  const etichetta = mese === proposto ? 'Mese appena concluso' : mese === ultimo ? 'Mese in corso' : 'Mese'
  return (
    <div className="scelta-settimana-colonna">
      <div className="scelta-settimana">
        <button className="btn btn-icona" aria-label="Mese precedente" onClick={() => onCambia(aggiungiMesi(mese, -1))}><Icona nome="caret-left" /></button>
        <div className="scelta-settimana-testo">
          <span className="etichetta-maiuscola">{etichetta}</span>
          <strong>{titoloMese(mese)}</strong>
        </div>
        <button className="btn btn-icona" aria-label="Mese successivo" disabled={mese >= ultimo} onClick={() => onCambia(aggiungiMesi(mese, 1))}><Icona nome="caret-right" /></button>
      </div>
      {mese !== proposto && <button className="btn btn-fantasma" onClick={() => onCambia(proposto)}>Torna al mese da compilare</button>}
    </div>
  )
}
