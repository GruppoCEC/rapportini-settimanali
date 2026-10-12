// Piccolo aiuto per caricare dati asincroni in una pagina, con stato di caricamento ed errore.
import { useEffect, useState, type DependencyList } from 'react'

export function useDati<T>(carica: () => Promise<T>, dipendenze: DependencyList) {
  const [dati, setDati] = useState<T | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [caricamento, setCaricamento] = useState(true)
  const [versione, setVersione] = useState(0)

  useEffect(() => {
    let annullato = false
    setCaricamento(true)
    setErrore(null)
    carica()
      .then((d) => { if (!annullato) setDati(d) })
      .catch((e: Error) => { if (!annullato) setErrore(e.message) })
      .finally(() => { if (!annullato) setCaricamento(false) })
    return () => { annullato = true }
  }, [...dipendenze, versione])  // eslint-disable-line react-hooks/exhaustive-deps

  return { dati, errore, caricamento, ricarica: () => setVersione((v) => v + 1) }
}
