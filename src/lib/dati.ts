// Lettura dei dati dal database. Le regole di accesso filtrano già
// automaticamente: ognuno riceve solo le righe che può vedere.
import { supabase } from './supabase'
import { totaliCittaDaRighe, type RigaTotaliCitta, type TotaliCitta } from './aggregazioni'
import type { Metrica, Persona, Rilevazione, Scadenza, StoricoMensile, Utente, ValoreMensile, VoceMensile } from './tipi'

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

/** Note degli uffici per le settimane indicate (una sola, o tutte quelle di un mese) */
export async function caricaNote(settimane: string[], ufficiIds: number[]): Promise<Nota[]> {
  if (ufficiIds.length === 0 || settimane.length === 0) return []
  const { data, error } = await supabase.from('note_settimana')
    .select('ufficio_id, settimana, testo').in('settimana', settimane).in('ufficio_id', ufficiIds)
    .order('settimana')
  if (error) throw new Error(error.message)
  return (data as Nota[]).filter((n) => n.testo.trim() !== '')
}

/**
 * Totali di tutta la città dell'ufficio collegato, periodo per periodo (ogni periodo = elenco di lunedì).
 * Il database manda solo le somme, mai i numeri dei singoli altri uffici (008_totali_citta.sql).
 * null se la funzione non c'è ancora nel database o se l'account non è di un ufficio.
 */
export async function caricaTotaliCitta(periodi: string[][]): Promise<TotaliCitta | null> {
  const { data, error } = await supabase.rpc('totali_mia_citta', {
    p_inizi: periodi.map((p) => p[0]),
    p_fini: periodi.map((p) => p[p.length - 1]),
  })
  if (error || !data || (data as RigaTotaliCitta[]).length === 0) return null
  return totaliCittaDaRighe(data as RigaTotaliCitta[], periodi.length)
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
  const { data, error } = await supabase.from('voci_mensili').select('codice, gruppo, sotto, ordine, solo_ruolo, accanto_a, con_punti, meglio_se_scende').eq('attiva', true).order('ordine')
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

/** I numeri di più mesi (es. un anno intero), caricati in parallelo mese per mese */
export async function caricaValoriMesi(mesi: string[], ufficiIds: number[]): Promise<ValoreMensile[]> {
  const perMese = await Promise.all(mesi.map((m) => caricaValoriMensili(m, ufficiIds)))
  return perMese.flat()
}

/**
 * Totali degli uffici dal file Excel annuale (mesi compilati prima della piattaforma), per i mesi indicati.
 * Vuoto se la tabella non c'è ancora nel database (009_storico_mensile.sql): il report funziona come prima.
 */
export async function caricaStorico(mesi: string[], ufficiIds: number[]): Promise<StoricoMensile[]> {
  if (mesi.length === 0 || ufficiIds.length === 0) return []
  try {
    return await aPagine<StoricoMensile>((da, a) => supabase.from('totali_mensili_storico')
      .select('ufficio_id, mese, voce, valore')
      .in('mese', mesi).in('ufficio_id', ufficiIds)
      .order('mese').order('ufficio_id').order('voce').range(da, a))
  } catch {
    return []
  }
}

/** Totali di gruppo dello stesso mese dell'anno prima, scritti a mano o dal file Excel annuale (voce → valore) */
export async function caricaConfronto(mese: string): Promise<Map<string, number | null>> {
  const { data, error } = await supabase.from('confronto_anno_prima').select('voce, valore').eq('mese', mese)
  if (error) throw new Error(error.message)
  return new Map((data as { voce: string; valore: number | null }[]).map((r) => [r.voce, r.valore]))
}

/** Punti della gara dei collaboratori (voce → punti per unità); vuota se non ancora decisi */
export async function caricaPunti(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('punti_mensili').select('voce, punti')
  if (error) throw new Error(error.message)
  return new Map((data as { voce: string; punti: number | string }[]).map((r) => [r.voce, Number(r.punti)]))
}

/**
 * Il rapportino mensile è aperto agli uffici? Finché è "in prova" (Work in progress) no:
 * gli uffici vedono le pagine ma non possono scrivere. Si apre dal database (impostazione mensile_aperto).
 */
export async function mensileAperto(): Promise<boolean> {
  const { data, error } = await supabase.rpc('mensile_aperto')
  return !error && data === true
}

/** Scadenza di inserimento del mese, se l'amministratore l'ha fissata */
export async function caricaScadenza(mese: string): Promise<Scadenza | null> {
  const { data, error } = await supabase.from('scadenze_mensili').select('mese, scadenza, blocca').eq('mese', mese).maybeSingle()
  if (error) throw new Error(error.message)
  return data as Scadenza | null
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
