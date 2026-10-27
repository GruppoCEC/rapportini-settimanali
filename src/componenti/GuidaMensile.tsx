// Guida di benvenuto di "Inserisci mese": una finestra a passi che spiega all'ufficio come si compila
// il rapportino mensile. Ogni passo ha un piccolo disegno fatto con i colori del sito; quando i video
// tutorial saranno pronti basta scrivere il nome del file nel campo `video` del passo (cartella
// public/video/): il video si scarica solo se l'ufficio preme Play.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icona } from './Interfaccia'

interface Passo {
  titolo: string
  testo: ReactNode
  disegno: ReactNode
  video?: string               // es. 'mensile-1-personale.mp4' in public/video/
}

const PASSI: Passo[] = [
  {
    titolo: 'Benvenuti nel rapportino mensile',
    testo: <>Sostituisce il file Excel di fine mese. Si compila <strong>una riga per persona</strong> dell'ufficio: il <strong>totale dell'ufficio</strong> e lo <strong>staff</strong> si calcolano da soli. In pochi passi vi mostriamo come fare.</>,
    disegno: (
      <table className="guida-mini">
        <thead><tr><th>Persona</th><th>Acquisizioni</th><th>Appuntamenti</th><th>Incarichi</th></tr></thead>
        <tbody>
          <tr><th>Mario Rossi<small>Responsabile</small></th><td>3</td><td>5</td><td>2</td></tr>
          <tr><th>Giulia Bianchi<small>Collaboratore</small></th><td>2</td><td>4</td><td>1</td></tr>
          <tr className="guida-totale"><th>Totale ufficio<small>Staff: 2</small></th><td>5</td><td>9</td><td>3</td></tr>
        </tbody>
      </table>
    ),
  },
  {
    titolo: 'Per prima cosa: le date di inizio',
    testo: <>Le date di inizio di <strong>responsabili, coordinatrici e marketer</strong> devono essere riviste, perché non erano a nostra disposizione. Nel riquadro <strong>Personale dell'ufficio</strong> premete <strong>Modifica</strong> accanto a ogni nome e scrivete la data giusta.</>,
    disegno: (
      <div className="guida-colonna">
        <div className="guida-persona">
          <span><strong>Laura Conti</strong><small>Coordinatrice</small></span>
          <span className="guida-date"><s>01/01/2026</s><Icona nome="arrow-right" /><strong>14/03/2019</strong></span>
          <span className="tag tag-quasi">Data da completare</span>
        </div>
        <div className="guida-regole">
          <span><Icona nome="user-circle" /><span><strong>Responsabile</strong>: da quando è responsabile</span></span>
          <span><Icona nome="users-three" /><span><strong>Tutti gli altri</strong>: da quando lavorano nel gruppo</span></span>
        </div>
      </div>
    ),
  },
  {
    titolo: 'Il personale dell\'ufficio',
    testo: <>Il personale si inserisce <strong>una volta sola</strong> e vale per tutti i mesi: nome e cognome, ruolo e data di inizio, poi <strong>Aggiungi</strong>. Chi entra nel mese ha la riga <strong>verde</strong>. Quando qualcuno lascia l'ufficio premete <strong>Ha lasciato</strong>: nel mese in cui esce la sua riga resta, in <strong>rosso</strong>. <strong>Elimina</strong> serve solo a correggere un errore: cancella anche tutti i numeri della persona.</>,
    video: undefined,          // 'mensile-1-personale.mp4'
    disegno: (
      <div className="guida-colonna">
        <div className="guida-persona guida-entrata"><span><strong>Giulia Bianchi</strong><small>Collaboratore</small></span><span className="tag tag-ok">Nuovo ingresso dal 12/10</span></div>
        <div className="guida-persona guida-uscita"><span><strong>Paolo Gallo</strong><small>Marketer</small></span><span className="tag tag-ko">Ha lasciato il 20/10</span></div>
        <div className="guida-pulsanti">
          <span className="btn btn-fantasma">Modifica</span>
          <span className="btn btn-fantasma">Ha lasciato</span>
          <span className="btn btn-fantasma btn-pericolo">Elimina<small>solo errori</small></span>
        </div>
      </div>
    ),
  },
  {
    titolo: 'Inserire i numeri',
    testo: <>Scrivete <strong>solo numeri interi</strong>. Se una persona in un'attività non ha fatto nulla scrivete <strong>0</strong>: la casella vuota vuol dire "non ancora inserito". Con <kbd>Invio</kbd> passate alla casella sotto, come in Excel. Le <strong>coordinatrici</strong> hanno, negli appuntamenti vendita, una casellina in più per gli appuntamenti fissati.</>,
    video: undefined,          // 'mensile-2-numeri.mp4'
    disegno: (
      <div className="guida-caselle">
        <div><span className="guida-casella">4</span><small>4 incarichi</small></div>
        <div><span className="guida-casella">0</span><small>0 = nessuna attività</small></div>
        <div><span className="guida-casella guida-casella-vuota" /><small>vuota = non ancora inserito</small></div>
        <div><span className="guida-casella"><span>9<sup className="valore-fix">7</sup></span></span><small>coordinatrici: 9 appuntamenti, 7 fissati</small></div>
      </div>
    ),
  },
  {
    titolo: 'Salvare',
    testo: <>Ricordatevi di premere <strong>Salva</strong>, in basso a destra: finché non salvate compare <em>Modifiche non salvate</em>. Potete compilare un po' alla volta: salvate e riprendete quando volete, fino alla scadenza.</>,
    disegno: (
      <div className="guida-barra">
        <span className="non-salvato"><span className="pallino" />Modifiche non salvate</span>
        <span className="btn btn-primario"><Icona nome="floppy-disk" />Salva</span>
      </div>
    ),
  },
  {
    titolo: 'Scadenza e report del gruppo',
    testo: <>Ogni mese c'è una <strong>scadenza</strong>, scritta sopra la tabella. Se non avete ancora inserito nulla vi arriva un'email tre giorni prima, il giorno prima e mezz'ora prima. Alla scadenza l'inserimento si chiude: da quel momento, in cima alla pagina trovate il <strong>report di tutto il gruppo</strong>, con il vostro ufficio <strong>in giallo</strong>, e lo stampate con <strong>Stampa il report del gruppo</strong>.</>,
    video: undefined,          // 'mensile-3-scadenza.mp4'
    disegno: (
      <div className="guida-colonna">
        <p className="avviso"><Icona nome="calendar-check" /><span>Da compilare entro il <strong>3 novembre alle 10:00</strong>.</span></p>
        <table className="guida-mini">
          <tbody>
            <tr><th>Altro ufficio</th><td>12</td><td>30</td><td>7</td></tr>
            <tr className="guida-giallo"><th>Il vostro ufficio</th><td>9</td><td>24</td><td>5</td></tr>
            <tr><th>Altro ufficio</th><td>15</td><td>28</td><td>6</td></tr>
          </tbody>
        </table>
        <span className="btn btn-secondario guida-stampa"><Icona nome="printer" />Stampa il report del gruppo</span>
      </div>
    ),
  },
]

interface Props {
  nascostaAllInizio: boolean                    // l'utente aveva già spuntato "Non mostrare più"
  onChiudi: (nonMostrarePiu: boolean) => void
}

export default function GuidaMensile({ nascostaAllInizio, onChiudi }: Props) {
  const [indice, setIndice] = useState(0)
  const [nonMostrarePiu, setNonMostrarePiu] = useState(nascostaAllInizio)
  const avanti = useRef<HTMLButtonElement>(null)
  const passo = PASSI[indice]
  const ultimo = indice === PASSI.length - 1
  const chiudi = () => onChiudi(nonMostrarePiu)

  // Esc chiude (come Salta); le frecce cambiano passo
  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onChiudi(nonMostrarePiu) }
      else if (e.key === 'ArrowRight') setIndice((i) => Math.min(PASSI.length - 1, i + 1))
      else if (e.key === 'ArrowLeft') setIndice((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', tasto, true)
    return () => window.removeEventListener('keydown', tasto, true)
  }, [nonMostrarePiu, onChiudi])

  useEffect(() => { avanti.current?.focus() }, [indice])

  // Disegnata direttamente nel <body>, come il dialogo di conferma
  return createPortal(
    <div className="dialogo-sfondo" onClick={chiudi}>
      <div className="dialogo guida" role="dialog" aria-modal="true" aria-labelledby="guida-titolo" onClick={(e) => e.stopPropagation()}>
        <div className="guida-testata">
          <span className="kicker">Come si compila il mese</span>
          <span className="piccolo">{indice + 1} di {PASSI.length}</span>
        </div>
        <div className="guida-disegno" key={indice}>
          {passo.video
            ? <video className="guida-video" src={`${import.meta.env.BASE_URL}video/${passo.video}`} controls preload="none" playsInline />
            : passo.disegno}
        </div>
        <h2 id="guida-titolo">{passo.titolo}</h2>
        <p className="guida-testo">{passo.testo}</p>
        <div className="guida-pallini" role="tablist" aria-label="Passi della guida">
          {PASSI.map((p, i) => (
            <button key={p.titolo} role="tab" aria-selected={i === indice} aria-label={`Passo ${i + 1}: ${p.titolo}`}
              className={i === indice ? 'attivo' : ''} onClick={() => setIndice(i)} />
          ))}
        </div>
        <div className="guida-piede">
          <label className="casella-spunta">
            <input type="checkbox" checked={nonMostrarePiu} onChange={(e) => setNonMostrarePiu(e.target.checked)} />
            Non mostrare più
          </label>
          <div className="guida-azioni">
            {!ultimo && <button className="btn btn-fantasma" onClick={chiudi}>Salta</button>}
            {indice > 0 && <button className="btn btn-secondario" onClick={() => setIndice(indice - 1)}>Indietro</button>}
            <button ref={avanti} className="btn btn-primario" onClick={() => (ultimo ? chiudi() : setIndice(indice + 1))}>
              {ultimo ? 'Ho capito' : 'Avanti'}{!ultimo && <Icona nome="arrow-right" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
