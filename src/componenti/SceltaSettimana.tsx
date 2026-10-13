// Selettore della settimana: frecce avanti/indietro e ritorno alla settimana proposta.
import { aggiungiSettimane, etichettaSettimana, lunediDi, notaMeseSettimana, oggiISO, settimanaPredefinita } from '../lib/settimane'

interface Props {
  settimana: string
  onCambia: (lunedi: string) => void
}

export default function SceltaSettimana({ settimana, onCambia }: Props) {
  const ultima = lunediDi(oggiISO())          // non si compilano settimane future
  const proposta = settimanaPredefinita()
  return (
    <div className="scelta-settimana">
      <button className="freccia" aria-label="Settimana precedente"
        onClick={() => onCambia(aggiungiSettimane(settimana, -1))}>‹</button>
      <div className="scelta-settimana-testo">
        <strong>{etichettaSettimana(settimana)}</strong>
        {notaMeseSettimana(settimana) && <span>{notaMeseSettimana(settimana)}</span>}
      </div>
      <button className="freccia" aria-label="Settimana successiva" disabled={settimana >= ultima}
        onClick={() => onCambia(aggiungiSettimane(settimana, 1))}>›</button>
      {settimana !== proposta && (
        <button className="link" onClick={() => onCambia(proposta)}>Torna alla settimana da compilare</button>
      )}
    </div>
  )
}
