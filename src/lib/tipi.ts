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
