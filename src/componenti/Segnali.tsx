// Segnali della settimana (src/lib/segnali.ts): a sinistra gli uffici "da seguire", a destra le buone notizie.
// Solo per l'amministrazione.
import { DEVIAZIONI, MINIMO_BASE, perUfficio, SETTIMANE_BASE, SETTIMANE_DI_FILA, type Segnale, type TipoSegnale } from '../lib/segnali'
import { Icona } from './Interfaccia'

const ICONA: Record<TipoSegnale, string> = { calo: 'trend-down', basso: 'warning', crescita: 'trend-up', alto: 'star' }

function Colonna({ titolo, icona, classe, segnali, massimo, vuoto }: {
  titolo: string; icona: string; classe: string; segnali: Segnale[]; massimo?: number; vuoto: string
}) {
  const gruppi = perUfficio(segnali)
  const mostrati = massimo ? gruppi.slice(0, massimo) : gruppi
  return (
    <div className={`segnali-colonna ${classe}`}>
      <h3><Icona nome={icona} />{titolo} <span className="piccolo">({gruppi.length} {gruppi.length === 1 ? 'ufficio' : 'uffici'})</span></h3>
      {gruppi.length === 0 && <p className="piccolo">{vuoto}</p>}
      {mostrati.map((g) => (
        <div key={g.ufficio.id} className="segnale-ufficio">
          <strong>{g.ufficio.nome}</strong>
          <ul>
            {g.segnali.map((s) => (
              <li key={s.metrica.codice + s.tipo}>
                <Icona nome={ICONA[s.tipo]} />
                <span><span className="segnale-testo">{s.testo}</span><span className="segnale-dettaglio">{s.dettaglio}</span></span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {massimo && gruppi.length > massimo && (
        <p className="piccolo segnali-altri">E anche: {gruppi.slice(massimo).map((g) => `${g.ufficio.nome} (${g.segnali.map((x) => x.metrica.nome).join(', ')})`).join(' · ')}.</p>
      )}
    </div>
  )
}

export function ElencoSegnali({ segnali, massimo }: { segnali: Segnale[]; massimo?: number }) {
  return (
    <div className="segnali">
      <Colonna titolo="Da seguire" icona="flag" classe="da-seguire" segnali={segnali.filter((s) => !s.positivo)} massimo={massimo}
        vuoto="Nessun ufficio con cali o settimane fuori dal solito." />
      <Colonna titolo="Buone notizie" icona="confetti" classe="buone-notizie" segnali={segnali.filter((s) => s.positivo)} massimo={massimo}
        vuoto="Nessun ufficio con crescite o settimane eccezionali." />
    </div>
  )
}

/** Come si calcolano i segnali, in parole semplici */
export function NotaSegnali() {
  return (
    <p className="piccolo">
      Ogni ufficio è confrontato con se stesso: la sua media delle {SETTIMANE_BASE} settimane prima.
      "Da {SETTIMANE_DI_FILA} settimane" = tutte le ultime {SETTIMANE_DI_FILA} settimane sotto (o sopra) la media, in media di almeno il 20%.
      "Molto sotto/sopra il solito" = oltre {DEVIAZIONI} volte la normale oscillazione dell'ufficio. Servono almeno {MINIMO_BASE} settimane inserite dall'ufficio;
      le voci molto piccole (media sotto 2 a settimana) non danno segnali. IM3 e +90 non sono considerati.
    </p>
  )
}
