// Piccoli elementi riutilizzati nelle tabelle: celle risultato/obiettivo con semaforo, stati.
import { semaforo, type StatoCompilazione } from '../lib/aggregazioni'
import { formattaPercentuale, OBIETTIVO_QUOTA, type Totale } from '../lib/calcoli'

export const SIMBOLO = { verde: '✓', giallo: '≈', rosso: '✗', nessuno: '' }
const TITOLO = { verde: 'Obiettivo raggiunto', giallo: 'Almeno il 70% dell\'obiettivo', rosso: 'Sotto il 70% dell\'obiettivo', nessuno: 'Nessun obiettivo' }

/** Semaforo di un rapporto risultato/obiettivo (r = 1 vuol dire 100%) */
export function coloreRapporto(r: number | null): 'verde' | 'giallo' | 'rosso' | 'nessuno' {
  if (r === null) return 'nessuno'
  return r >= 1 ? 'verde' : r >= 0.7 ? 'giallo' : 'rosso'
}

/** Risultato grande, obiettivo piccolo accanto, sfondo colorato con simbolo (mai solo colore) */
export function CellaRisultato({ totale }: { totale: Totale | undefined }) {
  if (!totale || (totale.risultato === null && totale.obiettivo === null)) return <td className="cella-vuota">—</td>
  const s = semaforo(totale)
  return (
    <td className={`cella s-${s}`} title={TITOLO[s]}>
      <span className="valore">{totale.risultato?.toLocaleString('it-IT') ?? '—'}</span>
      {totale.obiettivo !== null && <span className="obiettivo">/ {totale.obiettivo} {SIMBOLO[s]}</span>}
    </td>
  )
}

export function CellaQuota({ quota }: { quota: number | null }) {
  if (quota === null) return <td className="cella-vuota">—</td>
  const ok = quota >= OBIETTIVO_QUOTA
  return (
    <td className={`cella ${ok ? 's-verde' : 's-rosso'}`} title={ok ? 'Sopra il 20%' : 'Sotto il 20%'}>
      <span className="valore">{formattaPercentuale(quota)}</span>
    </td>
  )
}

export const ETICHETTA_STATO: Record<StatoCompilazione, string> = { completo: '✓ Completo', parziale: '◐ Parziale', mancante: '✗ Mancante' }
export const CLASSE_STATO: Record<StatoCompilazione, string> = { completo: 'tag-ok', parziale: 'tag-quasi', mancante: 'tag-ko' }

export function BadgeStato({ stato, grande }: { stato: StatoCompilazione; grande?: boolean }) {
  return <span className={`tag ${CLASSE_STATO[stato]} ${grande ? 'tag-grande' : ''}`}>{ETICHETTA_STATO[stato]}</span>
}

export function Legenda() {
  return (
    <p className="legenda">
      <span className="l-ok">✓ obiettivo raggiunto</span>
      <span className="l-quasi">≈ almeno 70%</span>
      <span className="l-ko">✗ sotto il 70%</span>
      <span className="l-nota">numero grande = risultato · "/ n" = obiettivo</span>
    </p>
  )
}

export function Caricamento({ errore }: { errore?: string | null }) {
  if (errore) return <div className="scheda"><p className="errore">Impossibile caricare i dati: {errore}</p></div>
  return <div className="scheda"><p className="piccolo">Caricamento…</p></div>
}
