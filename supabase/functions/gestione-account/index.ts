// =====================================================================
// Funzione Supabase "gestione-account"
// Crea gli account (nome utente + password), reimposta le password ed
// elimina gli account. Serve una funzione sul server perché creare
// account richiede la chiave di servizio, che non deve mai stare nel sito.
//
// Sicurezza: ogni operazione viene prima verificata "come chi chiama",
// cioè con le stesse regole di accesso del database (002_sicurezza.sql):
// un amministratore di Milano non può creare account a Roma né amministratori.
//
// Si installa da Supabase → Edge Functions (vedi docs/GUIDA_SETUP.md).
// =====================================================================
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function risposta(corpo: Record<string, unknown>, stato = 200) {
  return new Response(JSON.stringify(corpo), { status: stato, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

function traduci(messaggio: string): string {
  if (/duplicate key|already (been )?registered|already exists/i.test(messaggio)) return 'Esiste già un account con questo nome utente.'
  if (/row-level security|permission denied/i.test(messaggio)) return 'Non hai i permessi per questa operazione.'
  if (/nome_utente_check/i.test(messaggio)) return 'Nome utente non valido: da 3 a 30 caratteri, solo lettere minuscole, numeri, punto e trattino.'
  if (/email_promemoria_check/i.test(messaggio)) return 'Email per i promemoria non valida (più indirizzi vanno separati da virgola).'
  if (/password/i.test(messaggio)) return `Password non accettata: ${messaggio}`
  return messaggio
}

const passwordValida = (p: unknown): p is string => typeof p === 'string' && p.length >= 8

/** L'admin generale creato a mano dal pannello Supabase non ha auth_id: lo si cerca per email */
async function cercaAuthId(sistema: SupabaseClient, email: string): Promise<string | null> {
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await sistema.auth.admin.listUsers({ page: pagina, perPage: 100 })
    if (error) throw error
    const trovato = data.users.find((u) => u.email?.toLowerCase() === email)
    if (trovato) return trovato.id
    if (data.users.length < 100) return null
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const chiaveAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const chiaveServizio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // "chiamante" agisce con i permessi di chi ha fatto la richiesta; "sistema" con pieni poteri
    const chiamante = createClient(url, chiaveAnon, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false },
    })
    const sistema = createClient(url, chiaveServizio, { auth: { persistSession: false } })

    const { data: io } = await chiamante.auth.getUser()
    if (!io.user) return risposta({ errore: 'Devi essere collegato.' }, 401)

    const corpo = await req.json()

    if (corpo.azione === 'crea') {
      if (!passwordValida(corpo.password)) return risposta({ errore: 'La password deve avere almeno 8 caratteri.' }, 400)
      // 1) Scheda utente, inserita con i permessi di chi chiama: le regole decidono se può
      const { data: nuovo, error: e1 } = await chiamante.from('utenti').insert({
        nome_utente: corpo.nome_utente, nome: corpo.nome || null, ruolo: corpo.ruolo,
        citta_id: corpo.citta_id ?? null, ufficio_id: corpo.ufficio_id ?? null, area_id: corpo.area_id ?? null,
        email_promemoria: corpo.email_promemoria || null,
      }).select('email').single()
      if (e1) return risposta({ errore: traduci(e1.message) }, 400)

      // 2) Account di accesso con l'email tecnica generata dal database
      const { data: creato, error: e2 } = await sistema.auth.admin.createUser({
        email: nuovo.email, password: corpo.password, email_confirm: true,
      })
      if (e2) {
        await sistema.from('utenti').delete().eq('email', nuovo.email)   // annulla il passo 1
        return risposta({ errore: traduci(e2.message) }, 400)
      }
      await sistema.from('utenti').update({ auth_id: creato.user.id }).eq('email', nuovo.email)
      return risposta({ ok: true })
    }

    if (corpo.azione === 'password' || corpo.azione === 'elimina') {
      // L'account deve essere visibile a chi chiama e gestibile da lui
      const { data: bersaglio } = await chiamante.from('utenti')
        .select('email, ruolo, citta_id, auth_id').eq('nome_utente', String(corpo.nome_utente ?? '').toLowerCase()).maybeSingle()
      if (!bersaglio) return risposta({ errore: 'Account non trovato.' }, 404)
      const { data: puo } = await chiamante.rpc('posso_gestire_utente', { p_ruolo: bersaglio.ruolo, p_citta: bersaglio.citta_id })
      if (!puo) return risposta({ errore: 'Non hai i permessi per questo account.' }, 403)
      const authId = bersaglio.auth_id ?? await cercaAuthId(sistema, bersaglio.email)

      if (corpo.azione === 'password') {
        if (!passwordValida(corpo.password)) return risposta({ errore: 'La password deve avere almeno 8 caratteri.' }, 400)
        if (!authId) return risposta({ errore: 'Questo account non ha un accesso collegato: eliminalo e ricrealo.' }, 400)
        const { error } = await sistema.auth.admin.updateUserById(authId, { password: corpo.password })
        if (error) return risposta({ errore: traduci(error.message) }, 400)
        return risposta({ ok: true })
      }

      if (authId) {
        const { error } = await sistema.auth.admin.deleteUser(authId)
        if (error) return risposta({ errore: traduci(error.message) }, 400)
      }
      await sistema.from('utenti').delete().eq('email', bersaglio.email)
      return risposta({ ok: true })
    }

    return risposta({ errore: 'Operazione sconosciuta.' }, 400)
  } catch (e) {
    return risposta({ errore: `Errore interno: ${e instanceof Error ? e.message : String(e)}` }, 500)
  }
})
