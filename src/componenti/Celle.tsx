// Piccoli elementi riutilizzati nelle tabelle: celle risultato/obiettivo con semaforo, stati.
import { semaforo, type StatoCompilazione } from '../lib/aggregazioni'
import { formattaPercentuale, OBIETTIVO_QUOTA, type Totale } from '../lib/calcoli'

const SIMBOLO = { verde: '✓', giallo: '≈', rosso: '✗', nessuno: '' }
const TITOLO = { verde: 'Obiettivo raggiunto', giallo: 'Almeno il 70% dell\'obiettivo', rosso: 'Sotto il 70% dell\'obiettivo', nessuno: 'Nessun obiettivo' }

/** Risultato grande, obiettivo piccolo sotto, sfondo colorato con simbolo (mai solo colore) */
export function CellaRisultato({ totale }: { totale: Totale | undefined }) {
  if (!totale || (totale.risultato === null && totale.obiettivo === null)) return <td className="cella-vuota">—</td>
  const s = semaforo(totale)
  return (
    <td className={`cella-risultato semaforo-${s}`} title={TITOLO[s]}>
      <span className="valore">{totale.risultato ?? '—'}</span>
      {totale.obiettivo !== null && <span className="obiettivo">/ {totale.obiettivo} {SIMBOLO[s]}</span>}
    </td>
  )
}

export function CellaQuota({ quota }: { quota: number | null }) {
  if (quota === null) return <td className="cella-vuota">—</td>
  const ok = quota >= OBIETTIVO_QUOTA
  return (
    <td className={`cella-risultato ${ok ? 'semaforo-verde' : 'semaforo-rosso'}`} title={ok ? 'Sopra il 20%' : 'Sotto il 20%'}>
      <span className="valore">{formattaPercentuale(quota)}</span>
    </td>
  )
}

const ETICHETTA_STATO: Record<StatoCompilazione, string> = { completo: '✓ Completo', parziale: '◐ Parziale', mancante: '✗ Mancante' }

export function BadgeStato({ stato }: { stato: StatoCompilazione }) {
  return <span className={`badge badge-${stato}`}>{ETICHETTA_STATO[stato]}</span>
}

export function Legenda() {
  return (
    <p className="legenda piccolo">
      <span className="semaforo-verde">✓ obiettivo raggiunto</span>
      <span className="semaforo-giallo">≈ almeno 70%</span>
      <span className="semaforo-rosso">✗ sotto il 70%</span>
      <span>numero grande = risultato · "/ n" = obiettivo</span>
    </p>
  )
}

export function Caricamento({ errore }: { errore?: string | null }) {
  if (errore) return <div className="scheda"><p className="errore">Impossibile caricare i dati: {errore}</p></div>
  return <div className="scheda"><p className="piccolo">Caricamento…</p></div>
}
