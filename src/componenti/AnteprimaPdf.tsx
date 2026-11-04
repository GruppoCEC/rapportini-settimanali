// Anteprima della prima pagina di un PDF (pagina Classifiche, richiesta di Davide del 04/11/2026).
// Usa pdf.js (la libreria di Mozilla che legge i PDF), caricata solo quando serve, così il resto del
// sito non si appesantisce. Se il browser non riesce a disegnarla, al suo posto c'è un'icona.
import { useEffect, useRef, useState } from 'react'
import { Icona } from './Interfaccia'

/** pdf.js si carica una volta sola, alla prima anteprima */
let libreria: Promise<typeof import('pdfjs-dist')> | null = null
function caricaPdfJs() {
  libreria ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([pdfjs, lavoratore]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = lavoratore.default
    return pdfjs
  })
  return libreria
}

export function AnteprimaPdf({ carica, chiave, titolo, onClick }: {
  carica: () => Promise<Blob>        // scarica il PDF (si chiama solo quando l'anteprima si disegna)
  chiave: string                     // cambia quando cambia il file: l'anteprima si ridisegna
  titolo: string
  onClick?: () => void
}) {
  const tela = useRef<HTMLCanvasElement>(null)
  const [stato, setStato] = useState<'carico' | 'pronta' | 'errore'>('carico')
  const [pagine, setPagine] = useState(0)

  useEffect(() => {
    let annullato = false
    setStato('carico')
    ;(async () => {
      try {
        const [pdfjs, blob] = await Promise.all([caricaPdfJs(), carica()])
        const documento = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
        const pagina = await documento.getPage(1)
        const c = tela.current
        if (annullato || !c) return
        // disegnata nitida: larghezza della cornice × densità dello schermo (al massimo il doppio)
        const larghezza = (c.parentElement?.clientWidth || 320) * Math.min(2, window.devicePixelRatio || 1)
        const vista = pagina.getViewport({ scale: larghezza / pagina.getViewport({ scale: 1 }).width })
        c.width = Math.round(vista.width)
        c.height = Math.round(vista.height)
        await pagina.render({ canvasContext: c.getContext('2d')!, viewport: vista }).promise
        if (annullato) return
        setPagine(documento.numPages)
        setStato('pronta')
        documento.destroy()
      } catch {
        if (!annullato) setStato('errore')
      }
    })()
    return () => { annullato = true }
  }, [chiave])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <button type="button" className={`anteprima-pdf ${stato}`} onClick={onClick} title={`Apri ${titolo}`} aria-label={`Anteprima di ${titolo}: apri il PDF`}>
      <canvas ref={tela} aria-hidden="true" />
      {stato === 'carico' && <span className="anteprima-avviso"><Icona nome="circle-notch" className="gira" />Anteprima…</span>}
      {stato === 'errore' && <span className="anteprima-avviso"><Icona nome="file-pdf" />Anteprima non disponibile</span>}
      {stato === 'pronta' && pagine > 1 && <span className="anteprima-pagine">1 di {pagine} pagine</span>}
    </button>
  )
}
