// Forma dei dati che arrivano dal database

export type Ruolo = 'ufficio' | 'responsabile' | 'admin_citta' | 'admin_generale' | 'affiliato'

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
  da_mensile?: boolean        // settimana completata dal rapportino mensile (011): solo per i segnali, non si mostra
}

export const NOMI_RUOLO: Record<Ruolo, string> = {
  ufficio: 'Ufficio',
  responsabile: 'Responsabile d\'area',
  admin_citta: 'Amministratore di città',
  admin_generale: 'Amministratore generale',
  affiliato: 'Affiliato',
}

// ---------------------------------------------------------------- Rapportino mensile

/** da_definire (017): persona del rapportino di cui non si conosce ancora il ruolo (conta nello staff e nei totali) */
export type RuoloPersona = 'responsabile' | 'collaboratore' | 'coordinatrice' | 'marketer' | 'da_definire'

export interface Persona {
  id: number
  ufficio_id: number
  nome: string
  ruolo: RuoloPersona
  data_inizio: string         // 'AAAA-MM-GG'
  data_fine: string | null    // vuota finché la persona è in ufficio
  motivo_fine?: MotivoFine | null   // perché è finita (015): vuoto = ha lasciato il gruppo
}

/**
 * Perché una persona non è più nel personale: ha lasciato il gruppo, è stata promossa a responsabile
 * o è passata a un altro ufficio del gruppo (017). Promozioni e trasferimenti non contano nel turnover.
 */
export type MotivoFine = 'uscita' | 'promozione' | 'trasferimento'
export const NOMI_MOTIVO_FINE: Record<MotivoFine, string> = { uscita: 'Ha lasciato il gruppo', promozione: 'Promosso a responsabile', trasferimento: 'Trasferito in un altro ufficio' }

/** Una colonna del rapportino mensile (es. gruppo "Proposte", sotto "vendita") */
export interface VoceMensile {
  codice: string
  gruppo: string
  sotto: string | null
  ordine: number
  solo_ruolo?: RuoloPersona | null   // indicatore di un solo ruolo, fuori dai totali (es. App. vendita fix delle coordinatrici)
  accanto_a?: string | null          // colonna in cui l'indicatore si mostra come esponente (es. appuntamenti_vendita)
  con_punti?: boolean                // conta nella gara a punti dei collaboratori (non Gestione incarichi)
  meglio_se_scende?: boolean         // nel report un aumento è negativo (es. Incarichi scaduti)
  riservata?: boolean                // solo amministrazione, solo per la gara (018: Locazioni effettuate): non è una colonna del rapportino
}

export interface ValoreMensile {
  persona_id: number
  ufficio_id: number
  mese: string                // 'AAAA-MM-01'
  voce: string
  valore: number | null
  aggiornato_da?: string | null
  aggiornato_il?: string
  da_mensile?: boolean        // settimana completata dal rapportino mensile (011): solo per i segnali, non si mostra
}

export const NOMI_RUOLO_PERSONA: Record<RuoloPersona, string> = {
  responsabile: 'Responsabile',
  collaboratore: 'Collaboratore',
  coordinatrice: 'Coordinatrice',
  marketer: 'Marketer',
  da_definire: 'Ruolo da definire',
}

/**
 * Totale di un ufficio in un mese compilato prima della piattaforma, dal file Excel annuale di gruppo
 * (solo il totale dell'ufficio, non le singole persone). voce = colonna del rapportino o 'staff'.
 */
export interface StoricoMensile {
  ufficio_id: number
  mese: string                // 'AAAA-MM-01'
  voce: string
  valore: number | null
}

/** Scadenza per inserire i numeri di un mese (decisa dall'amministratore generale) */
export interface Scadenza {
  mese: string                // 'AAAA-MM-01'
  scadenza: string            // data e ora (ISO)
  blocca: boolean             // dopo la scadenza gli uffici non possono più scrivere
}
