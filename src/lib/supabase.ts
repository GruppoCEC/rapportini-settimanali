// Collegamento al database Supabase.
// Indirizzo e chiave arrivano dalle variabili VITE_SUPABASE_URL e VITE_SUPABASE_KEY
// (in locale dal file .env.local, su GitHub dalle "Variables" del repository).
// La chiave "publishable/anon" è pubblica per natura: i dati sono protetti
// dalle regole di accesso del database, non dalla segretezza della chiave.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chiave = import.meta.env.VITE_SUPABASE_KEY as string | undefined

export const configurato = Boolean(url && chiave)

export const supabase = createClient(url ?? 'http://localhost', chiave ?? 'mancante', {
  auth: {
    persistSession: true,      // si resta collegati anche chiudendo il browser
    autoRefreshToken: true,
    detectSessionInUrl: true,  // legge il "link magico" quando si arriva dall'email
  },
})
