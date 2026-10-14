// Lettura dei dati dal database. Le regole di accesso filtrano già
// automaticamente: ognuno riceve solo le righe che può vedere.
import { supabase } from './supabase'
import type { Metrica, Persona, Rilevazione, Utente, ValoreMensile, VoceMensile } from './tipi'

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

/** Tutte le righe di una tabella, a pagine da 1000 (per il backup) */
async function tutteLeRighe<T>(tabella: string, colonne: string, ordine: string): Promise<T[]> {
  const righe: T[] = []
  for (let inizio = 0; ; inizio += PAGINA) {
    const { data, error } = await supabase.from(tabella).select(colonne).order(ordine).range(inizio, inizio + PAGINA - 1)
    if (error) throw new Error(error.message)
    righe.push(...(data as T[]))
    if (data.length < PAGINA) return righe
  }
}

/** Tutto ciò che serve al backup in Excel (l'amministratore generale vede entrambe le città) */
export async function caricaTuttoPerBackup() {
  const [rilevazioni, note, utenti, metriche] = await Promise.all([
    caricaRilevazioni('2000-01-01', '2100-12-31'),
    tutteLeRighe<Nota>('note_settimana', 'ufficio_id, settimana, testo', 'settimana'),
    tutteLeRighe<Utente>('utenti', '*', 'nome_utente'),
    tutteLeRighe<Metrica>('metriche', '*', 'ordine'),
  ])
  return { rilevazioni, note: note.filter((n) => n.testo.trim() !== ''), utenti, metriche }
}

// ---------------------------------------------------------------- Rapportino mensile

/** Esegue una richiesta a pagine da 1000 righe e le riunisce */
async function aPagine<T>(richiesta: (da: number, a: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const righe: T[] = []
  for (let inizio = 0; ; inizio += PAGINA) {
    const { data, error } = await richiesta(inizio, inizio + PAGINA - 1)
    if (error) throw new Error(error.message)
    righe.push(...(data as T[]))
    if ((data as T[]).length < PAGINA) return righe
  }
}

/** Le colonne del rapportino mensile, nell'ordine del file Excel */
export async function caricaVociMensili(): Promise<VoceMensile[]> {
  const { data, error } = await supabase.from('voci_mensili').select('codice, gruppo, sotto, ordine, solo_ruolo, accanto_a').eq('attiva', true).order('ordine')
  if (error) throw new Error(error.message)
  return data as VoceMensile[]
}

/** Il personale degli uffici indicati (anche chi ha lasciato l'ufficio) */
export async function caricaPersone(ufficiIds: number[]): Promise<Persona[]> {
  if (ufficiIds.length === 0) return []
  return aPagine<Persona>((da, a) => supabase.from('persone')
    .select('id, ufficio_id, nome, ruolo, data_inizio, data_fine')
    .in('ufficio_id', ufficiIds).order('id').range(da, a))
}

/** I numeri di un mese ('AAAA-MM-01') per gli uffici indicati */
export async function caricaValoriMensili(mese: string, ufficiIds: number[]): Promise<ValoreMensile[]> {
  if (ufficiIds.length === 0) return []
  return aPagine<ValoreMensile>((da, a) => supabase.from('valori_mensili')
    .select('persona_id, ufficio_id, mese, voce, valore, aggiornato_da, aggiornato_il')
    .eq('mese', mese).in('ufficio_id', ufficiIds)
    .order('ufficio_id').order('persona_id').order('voce').range(da, a))
}

/** Totali di gruppo dello stesso mese dell'anno prima, scritti a mano (voce → valore) */
export async function caricaConfronto(mese: string): Promise<Map<string, number | null>> {
  const { data, error } = await supabase.from('confronto_anno_prima').select('voce, valore').eq('mese', mese)
  if (error) throw new Error(error.message)
  return new Map((data as { voce: string; valore: number | null }[]).map((r) => [r.voce, r.valore]))
}

/** Tutto il mensile, per il backup (null se le tabelle non esistono ancora nel database) */
export async function caricaMensilePerBackup() {
  try {
    const [voci, persone, valori] = await Promise.all([
      caricaVociMensili(),
      tutteLeRighe<Persona>('persone', 'id, ufficio_id, nome, ruolo, data_inizio, data_fine', 'id'),
      aPagine<ValoreMensile>((da, a) => supabase.from('valori_mensili')
        .select('persona_id, ufficio_id, mese, voce, valore, aggiornato_da, aggiornato_il')
        .order('mese').order('persona_id').order('voce').range(da, a)),
    ])
    return { voci, persone, valori }
  } catch {
    return null
  }
}
