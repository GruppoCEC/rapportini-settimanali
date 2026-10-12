// Lettura dei dati dal database. Le regole di accesso filtrano già
// automaticamente: ognuno riceve solo le righe che può vedere.
import { supabase } from './supabase'
import type { Rilevazione } from './tipi'

const PAGINA = 1000   // Supabase restituisce al massimo 1000 righe per richiesta

/** Dati settimanali tra due lunedì (compresi), eventualmente solo per alcuni uffici */
export async function caricaRilevazioni(da: string, a: string, ufficiIds?: number[]): Promise<Rilevazione[]> {
  if (ufficiIds && ufficiIds.length === 0) return []
  const tutte: Rilevazione[] = []
  for (let inizio = 0; ; inizio += PAGINA) {
    let q = supabase.from('rilevazioni')
      .select('ufficio_id, settimana, metrica, obiettivo, risultato, aggiornato_da, aggiornato_il')
      .gte('settimana', da).lte('settimana', a)
    if (ufficiIds) q = q.in('ufficio_id', ufficiIds)
    const { data, error } = await q
      .order('settimana').order('ufficio_id').order('metrica')
      .range(inizio, inizio + PAGINA - 1)
    if (error) throw new Error(error.message)
    tutte.push(...(data as Rilevazione[]))
    if (data.length < PAGINA) return tutte
  }
}

export interface Nota {
  ufficio_id: number
  settimana: string
  testo: string
}

export async function caricaNote(settimana: string, ufficiIds: number[]): Promise<Nota[]> {
  if (ufficiIds.length === 0) return []
  const { data, error } = await supabase.from('note_settimana')
    .select('ufficio_id, settimana, testo').eq('settimana', settimana).in('ufficio_id', ufficiIds)
  if (error) throw new Error(error.message)
  return (data as Nota[]).filter((n) => n.testo.trim() !== '')
}
