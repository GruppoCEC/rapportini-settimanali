// Forma dei dati che arrivano dal database

export type Ruolo = 'ufficio' | 'responsabile' | 'admin_citta' | 'admin_generale'

export interface Utente {
  email: string               // email tecnica di accesso (generata dal nome utente)
  nome_utente: string
  nome: string | null
  email_promemoria: string | null
  ruolo: Ruolo
  citta_id: number | null
  ufficio_id: number | null
  area_id: number | null
  attivo: boolean
}

export interface Citta {
  id: number
  nome: string
}

export interface Area {
  id: number
  nome: string
  citta_id: number
}

export interface Ufficio {
  id: number
  nome: string
  citta_id: number
  area_id: number | null
  attivo: boolean
  blocco_mensile?: number           // report mensile: 1 = prima tabella, 2 = seconda (come nel file di gruppo)
  ordine_mensile?: number | null    // report mensile: posizione nella tabella
}

export interface Metrica {
  codice: string
  nome: string
  tipo: 'attivita' | 'zona'
  ordine: number
}

export interface Rilevazione {
  ufficio_id: number
  settimana: string
  metrica: string
  obiettivo: number | null
  risultato: number | null
  aggiornato_da?: string | null
  aggiornato_il?: string
}

export const NOMI_RUOLO: Record<Ruolo, string> = {
  ufficio: 'Ufficio',
  responsabile: 'Responsabile d\'area',
  admin_citta: 'Amministratore di città',
  admin_generale: 'Amministratore generale',
}

// ---------------------------------------------------------------- Rapportino mensile

export type RuoloPersona = 'responsabile' | 'funzionario' | 'coordinatrice' | 'marketer'

export interface Persona {
  id: number
  ufficio_id: number
  nome: string
  ruolo: RuoloPersona
  data_inizio: string         // 'AAAA-MM-GG'
  data_fine: string | null    // vuota finché la persona è in ufficio
}

/** Una colonna del rapportino mensile (es. gruppo "Proposte", sotto "vendita") */
export interface VoceMensile {
  codice: string
  gruppo: string
  sotto: string | null
  ordine: number
  solo_ruolo?: RuoloPersona | null   // indicatore di un solo ruolo, fuori dai totali (es. App. vendita fix delle coordinatrici)
}

export interface ValoreMensile {
  persona_id: number
  ufficio_id: number
  mese: string                // 'AAAA-MM-01'
  voce: string
  valore: number | null
  aggiornato_da?: string | null
  aggiornato_il?: string
}

export const NOMI_RUOLO_PERSONA: Record<RuoloPersona, string> = {
  responsabile: 'Responsabile',
  funzionario: 'Funzionario',
  coordinatrice: 'Coordinatrice',
  marketer: 'Marketer',
}
