// Posizione del proprio ufficio nella sua città, voce per voce: "8° su 38", la fascia (quale quarto
// della città, solo come colore: Davide non vuole la scritta) e il confronto con il periodo prima.
// Mai nomi o numeri degli altri uffici.
import { fascia, NOMI_FASCIA, type Posizione } from '../lib/aggregazioni'
import { Icona } from './Interfaccia'

/** "↑ 3 posizioni", "↓ 1 posizione", "= stessa posizione" rispetto al periodo prima */
function movimento(p: Posizione): { classe: string; testo: string } | null {
  if (p.prima === null) return null
  const d = p.prima - p.posizione       // positivo = è salito
  if (d === 0) return { classe: '', testo: '= stessa posizione' }
  const n = Math.abs(d)
  return { classe: d > 0 ? 'su' : 'giu', testo: `${d > 0 ? '▲' : '▼'} ${n} ${n === 1 ? 'posizione' : 'posizioni'}` }
}

export function PosizioniCitta({ posizioni, voci, prima, compatto }: {
  posizioni: Map<string, Posizione>
  voci: { codice: string; nome: string }[]   // le voci da mostrare, nell'ordine
  prima: string                               // "rispetto alla settimana prima"
  compatto?: boolean                          // riquadro di "Il mio ufficio"
}) {
  const presenti = voci.filter((v) => posizioni.has(v.codice))
  if (presenti.length === 0) return <p className="piccolo">Nessuna posizione da mostrare: l'ufficio non ha ancora numeri in questo periodo.</p>
  return (
    <div className={`posizioni ${compatto ? 'compatto' : ''}`}>
      {presenti.map((v) => {
        const p = posizioni.get(v.codice)!
        const f = fascia(p.posizione, p.su)
        const m = movimento(p)
        return (
          <div key={v.codice} className={`posizione fascia-${f}`} title={NOMI_FASCIA[f]}>
            <span className="posizione-nome">{v.nome}</span>
            <div className="posizione-numero"><strong>{p.posizione}°</strong><span>su {p.su}</span></div>
            {m && <span className={`delta ${m.classe}`} title={prima}>{m.testo}</span>}
          </div>
        )
      })}
    </div>
  )
}

/** Spiegazione da mettere sotto le posizioni */
export function NotaPosizione({ nomeCitta, prima, extra }: { nomeCitta: string; prima: string; extra?: string }) {
  return (
    <p className="piccolo">
      <Icona nome="lock-simple" /> Posizione del tuo ufficio tra gli uffici di {nomeCitta} che hanno il dato: 1° = il numero più alto.
      A pari numero, pari posizione. Il colore dice in quale quarto della città sei: verde scuro il primo quarto, verde il secondo,
      giallo il terzo, arancio l'ultimo. La freccia confronta con la posizione {prima}. I nomi e i numeri degli altri uffici non si vedono.
      {extra && ` ${extra}`}
    </p>
  )
}
