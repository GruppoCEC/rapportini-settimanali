// Selettore della settimana: frecce avanti/indietro e ritorno alla settimana proposta.
import { aggiungiSettimane, intervalloSettimana, lunediDi, notaMeseSettimana, oggiISO, settimanaPredefinita } from '../lib/settimane'
import { Icona } from './Interfaccia'

interface Props {
  settimana: string
  onCambia: (lunedi: string) => void
  ultima?: string                     // ultima settimana che si può aprire; di solito quella in corso
}

/** "Settimana in corso", "Settimana scorsa", "Settimana prossima", "Fra 3 settimane" oppure solo "Settimana" */
export function nomeRelativo(settimana: string): string {
  const corrente = lunediDi(oggiISO())
  if (settimana === corrente) return 'Settimana in corso'
  if (settimana === aggiungiSettimane(corrente, -1)) return 'Settimana scorsa'
  if (settimana === aggiungiSettimane(corrente, 1)) return 'Settimana prossima'
  if (settimana > corrente) return `Fra ${Math.round((Date.parse(settimana) - Date.parse(corrente)) / (7 * 86400000))} settimane`
  return 'Settimana'
}

export default function SceltaSettimana({ settimana, onCambia, ultima = lunediDi(oggiISO()) }: Props) {
  const proposta = settimanaPredefinita()
  const nota = notaMeseSettimana(settimana)
  return (
    <div className="scelta-settimana-colonna">
      <div className="scelta-settimana">
        <button className="btn btn-icona" aria-label="Settimana precedente"
          onClick={() => onCambia(aggiungiSettimane(settimana, -1))}><Icona nome="caret-left" /></button>
        <div className="scelta-settimana-testo">
          <span className="etichetta-maiuscola">{nomeRelativo(settimana)}</span>
          <strong>{intervalloSettimana(settimana)}</strong>
          {nota && <span className="piccolo">{nota}</span>}
        </div>
        <button className="btn btn-icona" aria-label="Settimana successiva" disabled={settimana >= ultima}
          onClick={() => onCambia(aggiungiSettimane(settimana, 1))}><Icona nome="caret-right" /></button>
      </div>
      {settimana !== proposta && (
        <button className="btn btn-fantasma" onClick={() => onCambia(proposta)}>Torna alla settimana da compilare</button>
      )}
    </div>
  )
}
