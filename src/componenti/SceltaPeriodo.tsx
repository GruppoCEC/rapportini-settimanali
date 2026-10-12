// Scelta del periodo per cruscotto e statistiche: una settimana oppure un mese.
import {
  aggiungiSettimane, etichettaSettimana, intervalloSettimana, lunediDi, meseDellaSettimana,
  nomeMese, oggiISO, settimanaPredefinita, settimaneDelMese,
} from '../lib/settimane'

export interface Periodo {
  tipo: 'settimana' | 'mese'
  settimana: string       // lunedì della settimana scelta (o di riferimento per il mese)
}

export function periodoPredefinito(): Periodo {
  return { tipo: 'settimana', settimana: settimanaPredefinita() }
}

/** Primo e ultimo lunedì del periodo */
export function estremiPeriodo(p: Periodo): { da: string; a: string; settimane: string[] } {
  if (p.tipo === 'settimana') return { da: p.settimana, a: p.settimana, settimane: [p.settimana] }
  const settimane = settimaneDelMese(meseDellaSettimana(p.settimana))
  return { da: settimane[0], a: settimane[settimane.length - 1], settimane }
}

export function descriviPeriodo(p: Periodo): string {
  return p.tipo === 'settimana'
    ? `${etichettaSettimana(p.settimana)} (${intervalloSettimana(p.settimana)})`
    : `Mese di ${nomeMese(meseDellaSettimana(p.settimana))}`
}

export default function SceltaPeriodo({ periodo, onCambia }: { periodo: Periodo; onCambia: (p: Periodo) => void }) {
  const ultima = lunediDi(oggiISO())
  const sposta = (verso: 1 | -1) => {
    if (periodo.tipo === 'settimana') return onCambia({ ...periodo, settimana: aggiungiSettimane(periodo.settimana, verso) })
    const settimane = settimaneDelMese(meseDellaSettimana(periodo.settimana))
    const lunedi = verso === 1 ? aggiungiSettimane(settimane[settimane.length - 1], 1) : aggiungiSettimane(settimane[0], -1)
    onCambia({ ...periodo, settimana: lunedi > ultima ? ultima : lunedi })
  }
  const avantiDisabilitato = periodo.tipo === 'settimana'
    ? periodo.settimana >= ultima
    : meseDellaSettimana(periodo.settimana) >= meseDellaSettimana(ultima)

  return (
    <div className="scelta-periodo">
      <div className="interruttore" role="group" aria-label="Periodo">
        {(['settimana', 'mese'] as const).map((t) => (
          <button key={t} className={periodo.tipo === t ? 'attivo' : ''} onClick={() => onCambia({ ...periodo, tipo: t })}>
            {t === 'settimana' ? 'Settimana' : 'Mese'}
          </button>
        ))}
      </div>
      <div className="scelta-settimana">
        <button className="freccia" aria-label="Periodo precedente" onClick={() => sposta(-1)}>‹</button>
        <div className="scelta-settimana-testo">
          <strong>{periodo.tipo === 'settimana' ? etichettaSettimana(periodo.settimana) : nomeMese(meseDellaSettimana(periodo.settimana))}</strong>
          <span>{periodo.tipo === 'settimana' ? intervalloSettimana(periodo.settimana) : `${settimaneDelMese(meseDellaSettimana(periodo.settimana)).length} settimane`}</span>
        </div>
        <button className="freccia" aria-label="Periodo successivo" disabled={avantiDisabilitato} onClick={() => sposta(1)}>›</button>
      </div>
    </div>
  )
}
