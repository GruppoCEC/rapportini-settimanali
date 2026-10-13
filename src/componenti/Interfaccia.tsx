// Elementi grafici comuni: logo, icone, animazione dei numeri, dialogo di conferma, messaggio a comparsa.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Logo provvisorio: quattro barre su un quadrato arancio */
export function Logo({ dimensione = 40 }: { dimensione?: number }) {
  return (
    <svg className="logo" width={dimensione} height={dimensione} viewBox="0 0 34 34" aria-hidden="true">
      <rect width="34" height="34" rx="9" fill="var(--secondario)" />
      <path d="M9 24V16M15 24V10M21 24v-5M27 24V13" stroke="var(--primario-900)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  )
}

/** Icona Phosphor (peso duotone) */
export function Icona({ nome, className = '', style }: { nome: string; className?: string; style?: React.CSSProperties }) {
  return <i className={`ph-duotone ph-${nome} ${className}`} style={style} aria-hidden="true" />
}

const DURATA = 950

/**
 * Avanzamento dell'animazione da 0 a 1 in circa un secondo, ripartendo da capo quando cambia `chiave`.
 * Numeri e barre lo moltiplicano per "crescere". Se la scheda non è visibile o il sistema chiede
 * meno animazioni, vale subito 1.
 */
export function useProgresso(chiave: string | number): number {
  const [t, setT] = useState(1)
  useLayoutEffect(() => {
    const riduci = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (document.hidden || riduci) { setT(1); return }
    let raf = 0
    const inizio = performance.now()
    const passo = (ora: number) => {
      const p = Math.min(1, (ora - inizio) / DURATA)
      setT(1 - Math.pow(1 - p, 3))
      if (p < 1) raf = requestAnimationFrame(passo)
    }
    setT(0)
    raf = requestAnimationFrame(passo)
    const riserva = setTimeout(() => { cancelAnimationFrame(raf); setT(1) }, DURATA + 250)
    return () => { cancelAnimationFrame(raf); clearTimeout(riserva) }
  }, [chiave])
  return t
}

/** Numero intero animato, formattato all'italiana */
export const conta = (valore: number, t: number) => Math.round(valore * t).toLocaleString('it-IT')

// ---------------------------------------------------------------- Dialogo di conferma

interface Richiesta {
  titolo: string
  testo: string
  conferma: string
  pericolo?: boolean
  risolvi: (si: boolean) => void
}

/**
 * Sostituisce window.confirm con un dialogo nello stile del sito.
 * Uso: const [dialogo, chiedi] = useConferma(); if (await chiedi({...})) ...
 */
export function useConferma(): [ReactNode, (r: Omit<Richiesta, 'risolvi'>) => Promise<boolean>] {
  const [richiesta, setRichiesta] = useState<Richiesta | null>(null)
  const chiedi = useCallback((r: Omit<Richiesta, 'risolvi'>) =>
    new Promise<boolean>((risolvi) => setRichiesta({ ...r, risolvi })), [])
  const chiudi = (si: boolean) => { richiesta?.risolvi(si); setRichiesta(null) }

  useEffect(() => {
    if (!richiesta) return
    const tasto = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); richiesta.risolvi(false); setRichiesta(null) } }
    window.addEventListener('keydown', tasto, true)
    return () => window.removeEventListener('keydown', tasto, true)
  }, [richiesta])

  // Disegnati direttamente nel <body>: dentro una pagina animata la posizione "fissa" non funzionerebbe
  const dialogo = richiesta && createPortal(
    <div className="dialogo-sfondo" onClick={() => chiudi(false)}>
      <div className="dialogo" role="dialog" aria-modal="true" aria-labelledby="dialogo-titolo" onClick={(e) => e.stopPropagation()}>
        <h2 id="dialogo-titolo">{richiesta.titolo}</h2>
        <p>{richiesta.testo}</p>
        <div className="dialogo-azioni">
          <button className="btn btn-secondario" onClick={() => chiudi(false)}>Annulla</button>
          <button className={`btn ${richiesta.pericolo ? 'btn-arancio' : 'btn-primario'}`} autoFocus onClick={() => chiudi(true)}>{richiesta.conferma}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
  return [dialogo, chiedi]
}

// ---------------------------------------------------------------- Messaggio a comparsa

/** Messaggio scuro in basso a destra che sparisce da solo dopo 3,2 secondi */
export function useToast(): [ReactNode, (testo: string) => void] {
  const [testo, setTesto] = useState<string | null>(null)
  const [giro, setGiro] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const mostra = useCallback((t: string) => {
    clearTimeout(timer.current)
    setTesto(t); setGiro((g) => g + 1)
    timer.current = setTimeout(() => setTesto(null), 3200)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  const elemento = testo && createPortal(
    <div key={giro} className="toast" role="status"><Icona nome="check-circle" />{testo}</div>,
    document.body,
  )
  return [elemento, mostra]
}
