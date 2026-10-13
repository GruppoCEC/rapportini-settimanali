// Scelta del periodo per cruscotto e statistiche: una settimana oppure un mese.
import {
  aggiungiSettimane, etichettaSettimana, lunediDi, meseDellaSettimana, nomeMese, oggiISO,
  settimaneDelMese, ultimaSettimanaConclusa,
} from '../lib/settimane'
import { Icona } from './Interfaccia'

export interface Periodo {
  tipo: 'settimana' | 'mese'
  settimana: string       // lunedì della settimana scelta (o di riferimento per il mese)
}

export function periodoPredefinito(): Periodo {
  return { tipo: 'settimana', settimana: ultimaSettimanaConclusa() }
}

/** Primo e ultimo lunedì del periodo */
export function estremiPeriodo(p: Periodo): { da: string; a: string; settimane: string[] } {
  if (p.tipo === 'settimana') return { da: p.settimana, a: p.settimana, settimane: [p.settimana] }
  const settimane = settimaneDelMese(meseDellaSettimana(p.settimana))
  return { da: settimane[0], a: settimane[settimane.length - 1], settimane }
}

/** "Settimana 5 – 11 ottobre 2026" oppure "Ottobre 2026" */
export function descriviPeriodo(p: Periodo): string {
  if (p.tipo === 'settimana') return etichettaSettimana(p.settimana)
  const m = nomeMese(meseDellaSettimana(p.settimana))
  return m.charAt(0).toUpperCase() + m.slice(1)
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
    <div className="comandi">
      <div className="segmentato" role="group" aria-label="Periodo">
        {(['settimana', 'mese'] as const).map((t) => (
          <button key={t} className={periodo.tipo === t ? 'attivo' : ''} aria-pressed={periodo.tipo === t} onClick={() => onCambia({ ...periodo, tipo: t })}>
            {t === 'settimana' ? 'Settimana' : 'Mese'}
          </button>
        ))}
      </div>
      <button className="btn btn-icona" aria-label="Periodo precedente" onClick={() => sposta(-1)}><Icona nome="caret-left" /></button>
      <button className="btn btn-icona" aria-label="Periodo successivo" disabled={avantiDisabilitato} onClick={() => sposta(1)}><Icona nome="caret-right" /></button>
    </div>
  )
}
