// Test del database: esegue le migrazioni su un Postgres vero (PGlite)
// e verifica le regole di accesso tra uffici, aree e città.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { riepilogoDaRighe, riepilogoMensile, STAFF, totaleConStorico, vociDelRapportino, type RigaTotaliMensiliCitta } from '../src/lib/mensile'
import type { Persona, StoricoMensile, ValoreMensile, VoceMensile } from '../src/lib/tipi'

const CARTELLA_MIGRAZIONI = join(__dirname, '..', 'supabase', 'migrations')

// Ricrea il minimo indispensabile di Supabase: ruoli e auth.jwt()
const AMBIENTE_SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create role supabase_auth_admin nologin;
  create role service_role nologin;
  create schema auth;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema auth to authenticated, anon;
  grant execute on function auth.jwt() to authenticated, anon;
`

let db: PGlite

/** Esegue una query come l'utente collegato con questa email */
async function come<T = Record<string, unknown>>(email: string, sql: string, params: unknown[] = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ email })}', false);`)
  try {
    return (await db.query<T>(sql, params)).rows
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`)
  }
}

/** Verifica che la query venga rifiutata */
async function rifiutata(email: string, sql: string, params: unknown[] = []) {
  await expect(come(email, sql, params)).rejects.toThrow()
}

const id = async (sql: string) => (await db.query<{ id: number }>(sql)).rows[0].id

let romaA: number, romaB: number, romaC: number, milanoA: number

beforeAll(async () => {
  db = new PGlite()
  await db.exec(AMBIENTE_SUPABASE)
  for (const file of readdirSync(CARTELLA_MIGRAZIONI).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(CARTELLA_MIGRAZIONI, file), 'utf8'))
  }

  // Dati di prova (inseriti come amministratore del database)
  const romaNord = await id(`insert into aree (nome, citta_id) values ('Roma Nord', 1) returning id`)
  const milanoCentro = await id(`insert into aree (nome, citta_id) values ('Milano Centro', 2) returning id`)
  romaA = await id(`insert into uffici (nome, citta_id, area_id) values ('Roma A', 1, ${romaNord}) returning id`)
  romaB = await id(`insert into uffici (nome, citta_id, area_id) values ('Roma B', 1, ${romaNord}) returning id`)
  romaC = await id(`insert into uffici (nome, citta_id) values ('Roma C', 1) returning id`)
  milanoA = await id(`insert into uffici (nome, citta_id, area_id) values ('Milano A', 2, ${milanoCentro}) returning id`)

  await db.exec(`
    insert into impostazioni values ('modello_email_accesso', 'rapportini+{utente}@gmail.com');
    insert into utenti (email, nome_utente, ruolo, ufficio_id) values
      ('a@test.it', 'roma-a', 'ufficio', ${romaA}),
      ('b@test.it', 'roma-b', 'ufficio', ${romaB}),
      ('m@test.it', 'milano-a', 'ufficio', ${milanoA});
    insert into utenti (email, nome_utente, ruolo, area_id) values ('resp@test.it', 'resp', 'responsabile', ${romaNord});
    insert into utenti (email, nome_utente, ruolo, citta_id, ufficio_id) values ('adminmi@test.it', 'adminmi', 'admin_citta', 2, ${milanoA});
    insert into utenti (email, nome_utente, ruolo, citta_id) values ('davide@test.it', 'davide', 'admin_generale', 1);
  `)

  for (const u of [romaA, romaB, romaC, milanoA]) {
    await db.exec(`insert into rilevazioni (ufficio_id, settimana, metrica, obiettivo, risultato)
                   values (${u}, '2026-10-05', 'incarichi', 2, 1)`)
  }
})

const ufficiVisti = async (email: string) =>
  (await come<{ ufficio_id: number }>(email, `select distinct ufficio_id from rilevazioni order by 1`)).map((r) => r.ufficio_id)

describe('Ufficio', () => {
  it('vede solo i propri dati', async () => {
    expect(await ufficiVisti('a@test.it')).toEqual([romaA])
  })

  it('compila il proprio ufficio', async () => {
    await come('a@test.it', `insert into rilevazioni (ufficio_id, settimana, metrica, obiettivo, risultato)
                             values ($1, '2026-10-05', 'vendite', 1, 1)`, [romaA])
  })

  it('non può scrivere su un altro ufficio', async () => {
    await rifiutata('a@test.it', `insert into rilevazioni (ufficio_id, settimana, metrica, risultato)
                                  values ($1, '2026-10-05', 'vendite', 5)`, [romaB])
    const modificate = await come('a@test.it', `update rilevazioni set risultato = 99 where ufficio_id = $1 returning *`, [romaB])
    expect(modificate).toHaveLength(0)
  })

  it('non può promuoversi amministratore', async () => {
    const r = await come('a@test.it', `update utenti set ruolo = 'admin_generale' where email = 'a@test.it' returning *`)
    expect(r).toHaveLength(0)
  })

  it('accetta solo il lunedì come inizio settimana', async () => {
    await rifiutata('a@test.it', `insert into rilevazioni (ufficio_id, settimana, metrica, risultato)
                                  values ($1, '2026-10-06', 'proposte', 1)`, [romaA])
  })
})

describe('Responsabile d\'area', () => {
  it('vede tutti gli uffici della sua area e nient\'altro', async () => {
    expect(await ufficiVisti('resp@test.it')).toEqual([romaA, romaB])
  })

  it('è in sola lettura', async () => {
    await rifiutata('resp@test.it', `insert into rilevazioni (ufficio_id, settimana, metrica, risultato)
                                     values ($1, '2026-10-12', 'vendite', 1)`, [romaA])
  })
})

describe('Amministratore di Milano', () => {
  it('vede solo Milano', async () => {
    expect(await ufficiVisti('adminmi@test.it')).toEqual([milanoA])
    const uffici = await come<{ nome: string }>('adminmi@test.it', `select nome from uffici order by nome`)
    expect(uffici.map((u) => u.nome)).toEqual(['Milano A'])
    const utenti = await come<{ email: string }>('adminmi@test.it', `select email from utenti order by email`)
    expect(utenti.map((u) => u.email)).toEqual(['adminmi@test.it', 'm@test.it'])
  })

  it('aggiunge colleghi e uffici a Milano', async () => {
    await come('adminmi@test.it', `insert into utenti (nome_utente, ruolo, ufficio_id, email_promemoria) values ('brera', 'ufficio', $1, 'Brera@Gmail.com')`, [milanoA])
    const nuovo = (await db.query<{ email: string; email_promemoria: string }>(`select email, email_promemoria from utenti where nome_utente = 'brera'`)).rows[0]
    expect(nuovo).toEqual({ email: 'rapportini+brera@gmail.com', email_promemoria: 'brera@gmail.com' })
    await come('adminmi@test.it', `insert into uffici (nome, citta_id) values ('Milano B', 2)`)
  })

  it('non può creare amministratori né toccare Roma', async () => {
    await rifiutata('adminmi@test.it', `insert into utenti (nome_utente, ruolo, citta_id) values ('xxx', 'admin_citta', 2)`)
    await rifiutata('adminmi@test.it', `insert into utenti (nome_utente, ruolo, citta_id) values ('yyy', 'admin_generale', 2)`)
    await rifiutata('adminmi@test.it', `insert into utenti (nome_utente, ruolo, ufficio_id) values ('zzz', 'ufficio', $1)`, [romaA])
    await rifiutata('adminmi@test.it', `insert into uffici (nome, citta_id) values ('Roma Z', 1)`)
    await rifiutata('adminmi@test.it', `insert into rilevazioni (ufficio_id, settimana, metrica, risultato)
                                        values ($1, '2026-10-12', 'vendite', 1)`, [romaA])
  })

  it('compila il proprio ufficio milanese', async () => {
    await come('adminmi@test.it', `insert into rilevazioni (ufficio_id, settimana, metrica, risultato)
                                   values ($1, '2026-10-12', 'vendite', 1)`, [milanoA])
  })
})

describe('Amministratore generale', () => {
  it('vede entrambe le città', async () => {
    expect(await ufficiVisti('davide@test.it')).toEqual([romaA, romaB, romaC, milanoA])
  })

  it('può nominare l\'amministratore di Milano', async () => {
    await come('davide@test.it', `insert into utenti (nome_utente, ruolo, citta_id) values ('admin-milano', 'admin_citta', 2)`)
  })
})

describe('Email non abilitata', () => {
  it('non vede nulla', async () => {
    expect(await ufficiVisti('estraneo@test.it')).toEqual([])
    expect(await come('estraneo@test.it', `select * from metriche`)).toHaveLength(0)
    expect(await come('estraneo@test.it', `select * from uffici`)).toHaveLength(0)
  })

})

describe('Account con nome utente', () => {
  it('la pagina di accesso ricava l\'email tecnica dal nome utente, anche senza essere collegati', async () => {
    await db.exec(`set role anon`)
    try {
      const r = (await db.query<{ e: string }>(`select email_di_accesso(' Somalia ') as e`)).rows[0]
      expect(r.e).toBe('rapportini+somalia@gmail.com')
    } finally { await db.exec('reset role') }
  })

  it('il nome utente non si può cambiare né duplicare', async () => {
    await rifiutata('davide@test.it', `update utenti set nome_utente = 'altro' where nome_utente = 'roma-a'`)
    await rifiutata('davide@test.it', `insert into utenti (nome_utente, ruolo, ufficio_id) values ('roma-a', 'ufficio', $1)`, [romaA])
    await rifiutata('davide@test.it', `insert into utenti (nome_utente, ruolo, ufficio_id) values ('No Spazi', 'ufficio', $1)`, [romaA])
  })

  it('nessun amministratore può toccare il collegamento all\'account (auth_id)', async () => {
    await rifiutata('adminmi@test.it', `update utenti set auth_id = gen_random_uuid() where nome_utente = 'milano-a'`)
    await rifiutata('davide@test.it', `update utenti set auth_id = gen_random_uuid() where nome_utente = 'roma-a'`)
  })

  it('l\'amministratore aggiorna l\'email dei promemoria, l\'ufficio no', async () => {
    const ok = await come('adminmi@test.it', `update utenti set email_promemoria = 'ufficio.milano@gmail.com' where nome_utente = 'milano-a' returning email_promemoria`)
    expect(ok).toHaveLength(1)
    expect(await come('a@test.it', `update utenti set email_promemoria = 'x@y.it' where nome_utente = 'roma-a' returning *`)).toHaveLength(0)
    await rifiutata('adminmi@test.it', `update utenti set email_promemoria = 'non-una-email' where nome_utente = 'milano-a'`)
  })
})

describe('Salvataggi e registro modifiche', () => {
  it('registra chi salva, ignora i salvataggi identici e non tiene obiettivi sui dati di zona', async () => {
    const conta = async () => (await db.query<{ n: number }>(`select count(*)::int as n from storico_modifiche`)).rows[0].n
    const upsert = `insert into rilevazioni (ufficio_id, settimana, metrica, obiettivo, risultato)
                    values ($1, '2026-10-05', 'portafoglio', 5, 3)
                    on conflict (ufficio_id, settimana, metrica) do update
                    set obiettivo = excluded.obiettivo, risultato = excluded.risultato`
    await come('a@test.it', upsert, [romaA])
    const dopoPrimo = await conta()
    await come('a@test.it', upsert, [romaA])
    expect(await conta()).toBe(dopoPrimo)

    const riga = (await db.query<{ obiettivo: number | null; aggiornato_da: string }>(
      `select obiettivo, aggiornato_da from rilevazioni where ufficio_id = $1 and metrica = 'portafoglio'`, [romaA])).rows[0]
    expect(riga.obiettivo).toBeNull()
    expect(riga.aggiornato_da).toBe('a@test.it')
  })
})

describe('Calcoli', () => {
  it('assegna la settimana al mese del giovedì', async () => {
    const r = (await db.query<{ mese: string; n: number }>(
      `select to_char(mese_della_settimana('2026-09-28'), 'YYYY-MM') as mese, settimana_nel_mese('2026-09-28') as n`)).rows[0]
    expect(r).toEqual({ mese: '2026-10', n: 1 })
  })

  it('somma le attività e prende l\'ultimo valore di zona nel mese, con quota di mercato', async () => {
    // Febbraio dal file di Somalia: App.ti Vendita obiettivi 5/15/15/5, risultati 0/21/33/4
    const u = romaC
    const settimane = ['2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23']
    const ob = [5, 15, 15, 5], ris = [0, 21, 33, 4]
    const port = [2, 3, 1, 1], incZona = [34, 35, 34, 34]
    for (let i = 0; i < 4; i++) {
      await db.exec(`insert into rilevazioni (ufficio_id, settimana, metrica, obiettivo, risultato) values
        (${u}, '${settimane[i]}', 'app_vendita', ${ob[i]}, ${ris[i]}),
        (${u}, '${settimane[i]}', 'portafoglio', null, ${port[i]}),
        (${u}, '${settimane[i]}', 'incarichi_zona', null, ${incZona[i]})`)
    }
    const mese = await come<{ metrica: string; obiettivo: number; risultato: number; esito: number }>('davide@test.it',
      `select metrica, obiettivo, risultato, esito from v_mesi
       where ufficio_id = $1 and mese = '2026-02-01' order by metrica`, [u])
    expect(mese.find((m) => m.metrica === 'app_vendita')).toMatchObject({ obiettivo: 40, risultato: 58, esito: 18 })
    expect(mese.find((m) => m.metrica === 'portafoglio')).toMatchObject({ risultato: 1 })   // non 7!

    const quota = await come<{ settimana: string; quota: string }>('davide@test.it',
      `select to_char(settimana, 'YYYY-MM-DD') as settimana, quota from v_quota_settimanale where ufficio_id = $1 order by settimana`, [u])
    expect(quota.map((q) => Number(q.quota))).toEqual([0.0588, 0.0857, 0.0294, 0.0294])   // Portafoglio ÷ Incarichi in zona
  })

  it('le viste rispettano le regole di accesso', async () => {
    const righe = await come<{ ufficio_id: number }>('a@test.it', `select distinct ufficio_id from v_mesi`)
    expect(righe.map((r) => r.ufficio_id)).toEqual([romaA])
  })
})

describe('Rapportino mensile', () => {
  let pA: number, pB: number, pM: number
  const valore = (persona: number, voce: string, v: number, ufficio?: number) =>
    `insert into valori_mensili (persona_id, ufficio_id, mese, voce, valore) values (${persona}, ${ufficio ?? 'null'}, '2026-09-01', '${voce}', ${v})
     on conflict (persona_id, mese, voce) do update set valore = excluded.valore`

  beforeAll(async () => {
    await db.exec(`update impostazioni set valore = 'si' where chiave = 'mensile_aperto'`)   // per questi test il mensile è aperto
    pB = await id(`insert into persone (ufficio_id, nome, ruolo, data_inizio) values (${romaB}, 'Bruno Bianchi', 'collaboratore', '2020-01-01') returning id`)
    pM = await id(`insert into persone (ufficio_id, nome, ruolo, data_inizio) values (${milanoA}, 'Marta Meli', 'coordinatrice', '2024-05-01') returning id`)
    await db.exec(`${valore(pB, 'colloqui', 4)}; ${valore(pM, 'colloqui', 2)}`)
  })

  it('l\'ufficio registra il proprio personale e i suoi numeri', async () => {
    const [p] = await come<{ id: number; nome: string; aggiornato_da: string }>('a@test.it',
      `insert into persone (ufficio_id, nome, ruolo, data_inizio) values ($1, '  Anna   Rossi ', 'collaboratore', '2023-03-01') returning id, nome, aggiornato_da`, [romaA])
    pA = p.id
    expect(p.nome).toBe('Anna Rossi')
    expect(p.aggiornato_da).toBe('a@test.it')
    await come('a@test.it', valore(pA, 'colloqui', 5, romaA))
    await come('a@test.it', valore(pA, 'proposte_vendita', 1))           // l'ufficio si ricava dalla persona
    const righe = await come<{ ufficio_id: number }>('a@test.it', `select ufficio_id from valori_mensili`)
    expect(righe.map((r) => Number(r.ufficio_id))).toEqual([romaA, romaA])
    expect(await come('a@test.it', `select * from persone`)).toHaveLength(1)
  })

  it('l\'ufficio non vede né modifica il personale e i numeri degli altri', async () => {
    await rifiutata('a@test.it', `insert into persone (ufficio_id, nome, ruolo, data_inizio) values ($1, 'Intruso', 'marketer', '2026-01-01')`, [romaB])
    await rifiutata('a@test.it', valore(pB, 'colloqui', 99, romaA))      // anche dichiarando il proprio ufficio
    expect(await come('a@test.it', `update persone set nome = 'X' where id = $1 returning *`, [pB])).toHaveLength(0)
    expect(await come('a@test.it', `delete from valori_mensili where persona_id = $1 returning *`, [pB])).toHaveLength(0)
    const b = (await db.query<{ valore: number }>(`select valore from valori_mensili where persona_id = $1`, [pB])).rows[0]
    expect(b.valore).toBe(4)
  })

  it('l\'amministratore di Milano vede e compila solo Milano', async () => {
    const persone = await come<{ nome: string }>('adminmi@test.it', `select nome from persone order by nome`)
    expect(persone.map((p) => p.nome)).toEqual(['Marta Meli'])
    await come('adminmi@test.it', valore(pM, 'colloqui', 3))
    await rifiutata('adminmi@test.it', valore(pA, 'colloqui', 1))
  })

  it('l\'amministratore generale vede tutto il gruppo', async () => {
    const r = await come<{ n: number }>('davide@test.it', `select count(distinct ufficio_id)::int as n from valori_mensili`)
    expect(r[0].n).toBe(3)
  })

  it('il confronto con l\'anno prima lo scrive e lo legge solo l\'amministratore generale', async () => {
    await come('davide@test.it', `insert into confronto_anno_prima (mese, voce, valore) values ('2026-09-01', 'staff', 210), ('2026-09-01', 'colloqui', 340)`)
    expect(await come('davide@test.it', `select * from confronto_anno_prima`)).toHaveLength(2)
    await rifiutata('adminmi@test.it', `insert into confronto_anno_prima (mese, voce, valore) values ('2026-08-01', 'staff', 1)`)
    await rifiutata('a@test.it', `insert into confronto_anno_prima (mese, voce, valore) values ('2026-08-01', 'staff', 1)`)
    expect(await come('adminmi@test.it', `select * from confronto_anno_prima`)).toHaveLength(0)
  })

  it('controlli: mese dal giorno 1, persona non spostabile, salvataggi identici ignorati', async () => {
    await rifiutata('a@test.it', `insert into valori_mensili (persona_id, mese, voce, valore) values ($1, '2026-09-15', 'kiron', 1)`, [pA])
    await rifiutata('davide@test.it', `update persone set ufficio_id = $1 where id = $2`, [romaB, pA])
    await rifiutata('a@test.it', `insert into persone (ufficio_id, nome, ruolo, data_inizio, data_fine) values ($1, 'Date', 'marketer', '2026-05-01', '2026-04-01')`, [romaA])
    const conta = async () => (await db.query<{ n: number }>(`select count(*)::int as n from storico_modifiche where tabella = 'valori_mensili'`)).rows[0].n
    const prima = await conta()
    await come('a@test.it', valore(pA, 'colloqui', 5))
    expect(await conta()).toBe(prima)
    await come('a@test.it', valore(pA, 'colloqui', 6))
    expect(await conta()).toBe(prima + 1)
  })

  it('l\'indicatore "App. vendita fix" si compila solo per le coordinatrici', async () => {
    await rifiutata('a@test.it', valore(pA, 'appuntamenti_vendita_fix', 3))            // Anna è collaboratore
    await come('adminmi@test.it', valore(pM, 'appuntamenti_vendita_fix', 12))          // Marta è coordinatrice
    const r = (await db.query<{ valore: number }>(`select valore from valori_mensili where persona_id = $1 and voce = 'appuntamenti_vendita_fix'`, [pM])).rows[0]
    expect(r.valore).toBe(12)
  })

  it('i punti della gara li decide l\'amministratore generale e li vedono solo gli amministratori', async () => {
    await come('davide@test.it', `insert into punti_mensili (voce, punti) values ('incarichi_vendita', 5), ('incarichi_scaduti', -2.5)`)
    expect(await come('adminmi@test.it', `select * from punti_mensili`)).toHaveLength(2)
    expect(await come('a@test.it', `select * from punti_mensili`)).toHaveLength(0)
    await rifiutata('adminmi@test.it', `insert into punti_mensili (voce, punti) values ('kiron', 1)`)
    await rifiutata('davide@test.it', `insert into punti_mensili (voce, punti) values ('gestione_incarichi', 1)`)          // non dà punti
    await rifiutata('davide@test.it', `insert into punti_mensili (voce, punti) values ('appuntamenti_vendita_fix', 1)`)    // indicatore
  })

  it('scadenza: la decide l\'amministratore generale, la vedono tutti; con il blocco gli uffici non scrivono più', async () => {
    await rifiutata('adminmi@test.it', `insert into scadenze_mensili (mese, scadenza) values ('2026-08-01', now() - interval '1 day')`)
    // agosto: scadenza passata, senza blocco → l'ufficio scrive ancora (verrà segnalato in ritardo)
    await come('davide@test.it', `insert into scadenze_mensili (mese, scadenza) values ('2026-08-01', now() - interval '1 day')`)
    expect(await come('a@test.it', `select * from scadenze_mensili`)).toHaveLength(1)
    const agosto = (voce: string, v: number) => `insert into valori_mensili (persona_id, mese, voce, valore) values (${pA}, '2026-08-01', '${voce}', ${v})
      on conflict (persona_id, mese, voce) do update set valore = excluded.valore`
    await come('a@test.it', agosto('colloqui', 1))
    // con il blocco: l'ufficio è respinto, l'amministratore generale può ancora correggere
    await come('davide@test.it', `update scadenze_mensili set blocca = true where mese = '2026-08-01'`)
    await rifiutata('a@test.it', agosto('colloqui', 2))
    await rifiutata('a@test.it', agosto('kiron', 1))
    await come('davide@test.it', agosto('colloqui', 3))
    // scadenza spostata nel futuro: l'ufficio torna a scrivere
    await come('davide@test.it', `update scadenze_mensili set scadenza = now() + interval '1 day' where mese = '2026-08-01'`)
    await come('a@test.it', agosto('colloqui', 4))
  })

  it('in prova (Work in progress) gli uffici non scrivono, gli amministratori sì', async () => {
    await db.exec(`update impostazioni set valore = 'no' where chiave = 'mensile_aperto'`)
    try {
      expect((await come<{ aperto: boolean }>('a@test.it', `select mensile_aperto() as aperto`))[0].aperto).toBe(false)
      await rifiutata('a@test.it', `insert into persone (ufficio_id, nome, ruolo, data_inizio) values ($1, 'Prova', 'marketer', '2026-01-01')`, [romaA])
      await rifiutata('a@test.it', valore(pA, 'ribassi', 1))
      expect(await come('a@test.it', `update persone set nome = 'X' where id = $1 returning *`, [pA])).toHaveLength(0)
      expect(await come('a@test.it', `select * from valori_mensili`)).not.toHaveLength(0)        // vede ancora i suoi dati
      await come('davide@test.it', valore(pA, 'ribassi', 1))
      await come('adminmi@test.it', valore(pM, 'ribassi', 1))
    } finally {
      await db.exec(`update impostazioni set valore = 'si' where chiave = 'mensile_aperto'`)
    }
  })

  it('tutti vedono le 19 colonne del rapportino più l\'indicatore, nessuno estraneo', async () => {
    expect(await come('a@test.it', `select * from voci_mensili where solo_ruolo is null`)).toHaveLength(19)
    expect(await come('a@test.it', `select * from voci_mensili where solo_ruolo = 'coordinatrice'`)).toHaveLength(1)
    expect(await come('estraneo@test.it', `select * from voci_mensili`)).toHaveLength(0)
    expect(await come('estraneo@test.it', `select * from persone`)).toHaveLength(0)
  })
})

describe('Affiliato (sola consultazione)', () => {
  beforeAll(async () => {
    // l'amministratore generale crea l'affiliato e gli assegna un ufficio di Roma e uno di Milano
    await come('davide@test.it', `insert into utenti (nome_utente, ruolo, citta_id) values ('aff', 'affiliato', 1)`)
    await come('davide@test.it', `insert into uffici_affiliato (nome_utente, ufficio_id) values ('aff', $1), ('aff', $2)`, [romaB, milanoA])
  })
  const aff = 'rapportini+aff@gmail.com'

  it('vede solo gli uffici assegnati, anche di città diverse', async () => {
    expect(await ufficiVisti(aff)).toEqual([romaB, milanoA])
    const uffici = await come<{ nome: string }>(aff, `select nome from uffici order by nome`)
    expect(uffici.map((u) => u.nome)).toEqual(['Milano A', 'Roma B'])
    const persone = await come<{ nome: string }>(aff, `select nome from persone order by nome`)
    expect(persone.map((p) => p.nome)).toEqual(['Bruno Bianchi', 'Marta Meli'])
    const valori = await come<{ ufficio_id: number }>(aff, `select distinct ufficio_id from valori_mensili order by 1`)
    expect(valori.map((v) => Number(v.ufficio_id))).toEqual([romaB, milanoA])
    const utenti = await come<{ nome_utente: string }>(aff, `select nome_utente from utenti`)
    expect(utenti.map((u) => u.nome_utente)).toEqual(['aff'])
  })

  it('inserisce i dati dei suoi uffici (dal 21/10/2026), anche di città diverse', async () => {
    await come(aff, `insert into rilevazioni (ufficio_id, settimana, metrica, obiettivo, risultato) values ($1, '2026-10-12', 'vendite', 1, 1), ($2, '2026-10-12', 'vendite', 1, 2)
      on conflict (ufficio_id, settimana, metrica) do update set risultato = excluded.risultato`, [romaB, milanoA])
    await come(aff, `insert into note_settimana (ufficio_id, settimana, testo) values ($1, '2026-10-12', 'Settimana buona')
      on conflict (ufficio_id, settimana) do update set testo = excluded.testo`, [romaB])
    const [p] = await come<{ id: number }>(aff, `insert into persone (ufficio_id, nome, ruolo, data_inizio) values ($1, 'Nuova Collega', 'marketer', '2026-01-01') returning id`, [romaB])
    await come(aff, `insert into valori_mensili (persona_id, mese, voce, valore) values ($1, '2026-09-01', 'colloqui', 3)`, [p.id])
    const scritto = await come<{ aggiornato_da: string }>(aff, `select aggiornato_da from rilevazioni where ufficio_id = $1 and settimana = '2026-10-12' and metrica = 'vendite'`, [milanoA])
    expect(scritto[0].aggiornato_da).toBe(aff)
  })

  it('non scrive sugli uffici che non sono suoi, né sulle parti dell\'amministrazione', async () => {
    await rifiutata(aff, `insert into rilevazioni (ufficio_id, settimana, metrica, risultato) values ($1, '2026-10-12', 'vendite', 1)`, [romaA])
    await rifiutata(aff, `insert into note_settimana (ufficio_id, settimana, testo) values ($1, '2026-10-12', 'x')`, [romaA])
    await rifiutata(aff, `insert into persone (ufficio_id, nome, ruolo, data_inizio) values ($1, 'Intruso', 'marketer', '2026-01-01')`, [romaA])
    expect(await come(aff, `update rilevazioni set risultato = 99 where ufficio_id = $1 returning *`, [romaA])).toHaveLength(0)
    await rifiutata(aff, `insert into punti_mensili (voce, punti) values ('kiron', 5)`)
    await rifiutata(aff, `insert into confronto_anno_prima (mese, voce, valore) values ('2025-09-01', 'kiron', 1)`)
    await rifiutata(aff, `insert into uffici (nome, citta_id) values ('Ufficio Z', 1)`)
  })

  it('con il mensile in prova non scrive il rapportino mensile, come gli uffici', async () => {
    await db.exec(`update impostazioni set valore = 'no' where chiave = 'mensile_aperto'`)
    try {
      await rifiutata(aff, `insert into persone (ufficio_id, nome, ruolo, data_inizio) values ($1, 'Altra Collega', 'marketer', '2026-01-01')`, [romaB])
    } finally { await db.exec(`update impostazioni set valore = 'si' where chiave = 'mensile_aperto'`) }
  })

  it('non vede la gara a punti né il confronto con l\'anno prima', async () => {
    expect(await come(aff, `select * from punti_mensili`)).toHaveLength(0)
    expect(await come(aff, `select * from confronto_anno_prima`)).toHaveLength(0)
  })

  it('non può assegnarsi altri uffici né cambiare ruolo', async () => {
    await rifiutata(aff, `insert into uffici_affiliato (nome_utente, ufficio_id) values ('aff', $1)`, [romaA])
    expect(await come(aff, `update utenti set ruolo = 'admin_generale' where nome_utente = 'aff' returning *`)).toHaveLength(0)
    expect(await come(aff, `select ufficio_id from uffici_affiliato order by 1`)).toHaveLength(2)
  })

  it('lo crea e lo gestisce solo l\'amministratore generale', async () => {
    await rifiutata('adminmi@test.it', `insert into utenti (nome_utente, ruolo, citta_id) values ('aff-mi', 'affiliato', 2)`)
    await rifiutata('adminmi@test.it', `insert into uffici_affiliato (nome_utente, ufficio_id) values ('aff', $1)`, [romaA])
    expect(await come('adminmi@test.it', `delete from uffici_affiliato returning *`)).toHaveLength(0)
    // l'affiliato non compila uffici, e solo gli affiliati hanno uffici assegnati
    await rifiutata('davide@test.it', `insert into utenti (nome_utente, ruolo, citta_id, ufficio_id) values ('aff-x', 'affiliato', 1, $1)`, [romaA])
    await rifiutata('davide@test.it', `insert into uffici_affiliato (nome_utente, ufficio_id) values ('roma-a', $1)`, [romaB])
  })

  it('eliminando l\'account spariscono anche i suoi uffici', async () => {
    await come('davide@test.it', `insert into utenti (nome_utente, ruolo, citta_id) values ('aff-tmp', 'affiliato', 2)`)
    await come('davide@test.it', `insert into uffici_affiliato (nome_utente, ufficio_id) values ('aff-tmp', $1)`, [milanoA])
    await come('davide@test.it', `delete from utenti where nome_utente = 'aff-tmp'`)
    expect((await db.query(`select * from uffici_affiliato where nome_utente = 'aff-tmp'`)).rows).toHaveLength(0)
  })
})

describe('Totali della propria città (Presentazione dell\'ufficio)', () => {
  beforeAll(async () => {
    // febbraio 2025 (settimana del 24/2) e marzo 2025 (3/3 e 10/3), lontani dagli altri test
    await db.exec(`insert into rilevazioni (ufficio_id, settimana, metrica, obiettivo, risultato) values
      (${romaA}, '2025-02-24', 'incarichi', 1, 1), (${romaA}, '2025-02-24', 'portafoglio', null, 40),
      (${romaA}, '2025-03-03', 'incarichi', 2, 1), (${romaA}, '2025-03-03', 'portafoglio', null, 50),
      (${romaA}, '2025-03-10', 'incarichi', 2, 3), (${romaA}, '2025-03-10', 'portafoglio', null, 55),
      (${romaB}, '2025-03-03', 'incarichi', 1, 0), (${romaB}, '2025-03-03', 'portafoglio', null, 30),
      (${romaC}, '2025-02-24', 'portafoglio', null, 25), (${romaC}, '2025-03-10', 'portafoglio', null, 20),
      (${milanoA}, '2025-03-03', 'incarichi', 5, 5), (${milanoA}, '2025-03-03', 'portafoglio', null, 999)`)
  })
  interface Riga { periodo: number; metrica: string; obiettivo: number | null; risultato: number | null; uffici_con_dato: number; uffici_con_dati: number; variazione: number | null; confrontati: number | null; uffici_citta: number }
  const totali = async (email: string, inizi: string[], fini: string[]) =>
    (await come<Riga>(email, `select * from totali_mia_citta($1::date[], $2::date[])`, [inizi, fini]))
      .map((r) => ({ ...r, obiettivo: r.obiettivo === null ? null : Number(r.obiettivo), risultato: r.risultato === null ? null : Number(r.risultato), variazione: r.variazione === null ? null : Number(r.variazione) }))
  const voce = (righe: Riga[], periodo: number, metrica: string) => righe.find((r) => r.periodo === periodo && r.metrica === metrica)

  it('l\'ufficio riceve le somme della sua città, mese per mese, senza l\'altra città', async () => {
    const righe = await totali('a@test.it', ['2025-02-24', '2025-03-03'], ['2025-02-24', '2025-03-24'])
    // marzo: attività sommate su uffici e settimane; portafoglio all'ultima settimana di ogni ufficio
    expect(voce(righe, 2, 'incarichi')).toMatchObject({ obiettivo: 5, risultato: 4, uffici_con_dato: 2, uffici_con_dati: 3, variazione: null, uffici_citta: 3 })
    expect(voce(righe, 2, 'portafoglio')).toMatchObject({ obiettivo: null, risultato: 55 + 30 + 20, uffici_con_dato: 3 })
    // variazione sul mese prima solo per chi ha il dato in entrambi: Roma A +15, Roma C −5 (Roma B non c'era a febbraio)
    expect(voce(righe, 2, 'portafoglio')).toMatchObject({ variazione: 10, confrontati: 2 })
    expect(voce(righe, 1, 'portafoglio')).toMatchObject({ risultato: 65, variazione: null, confrontati: 0, uffici_con_dati: 2 })
  })

  it('anche settimana per settimana', async () => {
    const righe = await totali('b@test.it', ['2025-03-03', '2025-03-10'], ['2025-03-03', '2025-03-10'])
    expect(voce(righe, 2, 'portafoglio')).toMatchObject({ risultato: 75, variazione: 5, confrontati: 1 })
    expect(voce(righe, 1, 'incarichi')).toMatchObject({ obiettivo: 3, risultato: 1 })
  })

  it('l\'ufficio di Milano vede solo Milano', async () => {
    const righe = await totali('m@test.it', ['2025-03-03'], ['2025-03-24'])
    expect(voce(righe, 1, 'portafoglio')).toMatchObject({ risultato: 999, uffici_con_dati: 1 })
  })

  it('agli altri account non restituisce nulla, e senza accesso non si può chiamare', async () => {
    for (const email of ['davide@test.it', 'resp@test.it', 'rapportini+aff@gmail.com', 'estraneo@test.it']) {
      expect(await totali(email, ['2025-03-03'], ['2025-03-24'])).toHaveLength(0)
    }
    await db.exec(`set role anon`)
    try {
      await expect(db.query(`select * from totali_mia_citta(array['2025-03-03']::date[], array['2025-03-24']::date[])`)).rejects.toThrow()
    } finally { await db.exec('reset role') }
  })
})

describe('Storico mensile dal file Excel annuale', () => {
  const inserisci = `insert into totali_mensili_storico (ufficio_id, mese, voce, valore) values ($1, '2026-01-01', 'colloqui', 3), ($1, '2026-01-01', 'staff', 4)`

  it('lo carica solo l\'amministratore generale', async () => {
    for (const u of [romaA, romaB, milanoA]) await come('davide@test.it', inserisci, [u])
    await rifiutata('a@test.it', inserisci, [romaC])
    await rifiutata('adminmi@test.it', inserisci, [romaC])
    await rifiutata('rapportini+aff@gmail.com', inserisci, [romaC])
    expect(await come('adminmi@test.it', `update totali_mensili_storico set valore = 0 returning *`)).toHaveLength(0)
    await rifiutata('davide@test.it', `insert into totali_mensili_storico (ufficio_id, mese, voce, valore) values ($1, '2026-01-15', 'colloqui', 1)`, [romaC])
  })

  it('lo vede chi vede l\'ufficio', async () => {
    const uffici = async (email: string) =>
      (await come<{ ufficio_id: number }>(email, `select distinct ufficio_id from totali_mensili_storico order by 1`)).map((r) => Number(r.ufficio_id))
    expect(await uffici('a@test.it')).toEqual([romaA])
    expect(await uffici('adminmi@test.it')).toEqual([milanoA])
    expect(await uffici('rapportini+aff@gmail.com')).toEqual([romaB, milanoA])
    expect(await uffici('davide@test.it')).toEqual([romaA, romaB, milanoA])
    expect(await uffici('estraneo@test.it')).toEqual([])
  })
})

describe('Totali mensili della propria città (presentazione mensile dell\'ufficio)', () => {
  const MESI = ['2026-01-01', '2026-07-01', '2026-08-01', '2026-09-01']
  beforeAll(async () => {
    // Roma C: a luglio e agosto numeri persona per persona; chi esce ad agosto non conta ad agosto;
    // lo storico di agosto viene ignorato perché ci sono i numeri. Roma B: a luglio solo lo storico.
    const c1 = await id(`insert into persone (ufficio_id, nome, ruolo, data_inizio) values (${romaC}, 'Carla Conti', 'collaboratore', '2021-01-01') returning id`)
    const c2 = await id(`insert into persone (ufficio_id, nome, ruolo, data_inizio, data_fine) values (${romaC}, 'Ciro Costa', 'coordinatrice', '2021-01-01', '2026-08-15') returning id`)
    await db.exec(`insert into valori_mensili (persona_id, mese, voce, valore) values
      (${c1}, '2026-07-01', 'colloqui', 5), (${c2}, '2026-07-01', 'colloqui', 2), (${c1}, '2026-07-01', 'kiron', 1),
      (${c1}, '2026-08-01', 'colloqui', 6), (${c2}, '2026-08-01', 'colloqui', 9),
      (${c2}, '2026-07-01', 'appuntamenti_vendita_fix', 3);
      insert into totali_mensili_storico (ufficio_id, mese, voce, valore) values
      (${romaC}, '2026-08-01', 'colloqui', 99), (${romaB}, '2026-07-01', 'colloqui', 8), (${romaB}, '2026-07-01', 'staff', 6)`)
  })

  const dalDatabase = async (email: string) =>
    riepilogoDaRighe(await come<RigaTotaliMensiliCitta>(email, `select * from totali_mensili_mia_citta($1::date[])`, [MESI]), MESI.length, colonne)
  let colonne: string[] = []

  it('dà gli stessi numeri del Report mensile (stesse regole: persone in servizio, staff, storico)', async () => {
    const voci = (await db.query<VoceMensile>(`select * from voci_mensili where attiva`)).rows
    colonne = [STAFF, ...vociDelRapportino(voci).map((v) => v.codice)]
    const persone = (await db.query<Persona>(`select id::int, ufficio_id::int, nome, ruolo, to_char(data_inizio, 'YYYY-MM-DD') data_inizio, to_char(data_fine, 'YYYY-MM-DD') data_fine from persone`)).rows
    const valori = (await db.query<ValoreMensile>(`select persona_id::int, ufficio_id::int, to_char(mese, 'YYYY-MM-DD') mese, voce, valore from valori_mensili`)).rows
    const storico = (await db.query<StoricoMensile>(`select ufficio_id::int, to_char(mese, 'YYYY-MM-DD') mese, voce, valore from totali_mensili_storico`)).rows
    const roma = [romaA, romaB, romaC]
    const perUfficio = roma.map((u) => MESI.map((m) => totaleConStorico(
      persone.filter((p) => p.ufficio_id === u), valori.filter((v) => v.ufficio_id === u), m, voci, storico.filter((s) => s.ufficio_id === u)).totale))
    const atteso = riepilogoMensile(perUfficio, colonne)
    const ottenuto = await dalDatabase('a@test.it')
    expect(ottenuto).toEqual(atteso)
    // qualche numero a mano: luglio = Roma B dallo storico (8) + Roma C (5 + 2);
    // agosto: di Roma C conta solo Carla (6), non chi è uscito (9) né lo storico (99)
    expect(ottenuto.andamento[1].get('colloqui')).toBe(15)
    const agostoSenzaRomaC = (await db.query<{ n: number }>(`select coalesce(sum(valore), 0)::int n from valori_mensili
      where mese = '2026-08-01' and voce = 'colloqui' and ufficio_id in (${romaA}, ${romaB})`)).rows[0].n
    expect(ottenuto.andamento[2].get('colloqui')).toBe(agostoSenzaRomaC + 6)
    expect(ottenuto.andamento[1].get('appuntamenti_vendita_fix')).toBeUndefined()   // l'indicatore delle coordinatrici è fuori
    expect(ottenuto.ufficiTotali).toBe(3)
  })

  it('l\'ufficio di Milano vede solo Milano; gli altri account non ricevono nulla', async () => {
    const milano = await dalDatabase('m@test.it')
    const settembreMilano = (await db.query<{ n: number }>(`select sum(v.valore)::int n from valori_mensili v join uffici u on u.id = v.ufficio_id
      where u.citta_id = 2 and v.mese = '2026-09-01' and v.voce = 'colloqui'`)).rows[0].n
    expect(milano.andamento[3].get('colloqui')).toBe(settembreMilano)
    for (const email of ['davide@test.it', 'rapportini+aff@gmail.com', 'estraneo@test.it']) {
      expect(await come(email, `select * from totali_mensili_mia_citta($1::date[])`, [MESI])).toHaveLength(0)
    }
  })
})

describe('Settimane completate dal rapportino mensile', () => {
  // marzo 2024: settimane del 4, 11, 18 e 25 marzo (quella del 1° aprile ha il giovedì in aprile)
  const settimana = async (metrica: string) => Object.fromEntries((await db.query<{ settimana: string; risultato: number | null; da_mensile: boolean }>(
    `select to_char(settimana, 'MM-DD') settimana, risultato, da_mensile from rilevazioni
     where ufficio_id = $1 and metrica = $2 and settimana between '2024-03-04' and '2024-03-25' order by 1`, [romaA, metrica])).rows
    .map((r) => [r.settimana, r.risultato]))

  beforeAll(async () => {
    await db.exec(`insert into rilevazioni (ufficio_id, settimana, metrica, obiettivo, risultato) values
      (${romaA}, '2024-03-04', 'incarichi', 2, 3), (${romaA}, '2024-03-11', 'incarichi', 2, 2), (${romaA}, '2024-03-18', 'incarichi', 2, null)`)
    await db.exec(`insert into totali_mensili_storico (ufficio_id, mese, voce, valore) values
      (${romaA}, '2024-03-01', 'incarichi_vendita', 10), (${romaA}, '2024-03-01', 'acquisizioni', 3), (${romaA}, '2024-03-01', 'portafoglio_vendita', 40)`)
  })

  it('divide in parti uguali tra le settimane vuote quello che manca al mensile', async () => {
    // incarichi: 10 nel mese, 3 + 2 già scritti → 5 su due settimane vuote = 3 e 2; l'obiettivo resta
    expect(await settimana('incarichi')).toEqual({ '03-04': 3, '03-11': 2, '03-18': 3, '03-25': 2 })
    expect((await db.query(`select obiettivo from rilevazioni where ufficio_id = $1 and settimana = '2024-03-18' and metrica = 'incarichi'`, [romaA])).rows[0])
      .toEqual({ obiettivo: 2 })
    // valutazioni = acquisizioni: 3 su quattro settimane vuote = 1, 1, 1, 0
    expect(await settimana('valutazioni')).toEqual({ '03-04': 1, '03-11': 1, '03-18': 1, '03-25': 0 })
    // il portafoglio e le voci senza corrispondenza non si toccano
    expect(await settimana('portafoglio')).toEqual({})
    expect(await settimana('im3')).toEqual({})
  })

  it('se l\'ufficio scrive una settimana, le altre vuote si ricalcolano; il suo numero non si tocca più', async () => {
    await come('a@test.it', `insert into rilevazioni (ufficio_id, settimana, metrica, obiettivo, risultato) values ($1, '2024-03-18', 'incarichi', 2, 4)
      on conflict (ufficio_id, settimana, metrica) do update set obiettivo = excluded.obiettivo, risultato = excluded.risultato`, [romaA])
    expect(await settimana('incarichi')).toEqual({ '03-04': 3, '03-11': 2, '03-18': 4, '03-25': 1 })
    const scritta = (await db.query<{ da_mensile: boolean }>(`select da_mensile from rilevazioni where ufficio_id = $1 and settimana = '2024-03-18' and metrica = 'incarichi'`, [romaA])).rows[0]
    expect(scritta.da_mensile).toBe(false)
  })

  it('se cambia il mensile si ricalcola; se le settimane lo superano già, non inserisce nulla', async () => {
    await db.exec(`update totali_mensili_storico set valore = 12 where ufficio_id = ${romaA} and mese = '2024-03-01' and voce = 'incarichi_vendita'`)
    expect((await settimana('incarichi'))['03-25']).toBe(3)
    await db.exec(`update totali_mensili_storico set valore = 5 where ufficio_id = ${romaA} and mese = '2024-03-01' and voce = 'incarichi_vendita'`)
    expect(await settimana('incarichi')).toEqual({ '03-04': 3, '03-11': 2, '03-18': 4 })
  })

  it('vale anche per i rapportini mensili inseriti persona per persona', async () => {
    // maggio 2024: settimane del 29 aprile e del 6, 13, 20, 27 maggio → 4 incarichi = 1, 1, 1, 1, 0
    const persona = await id(`insert into persone (ufficio_id, nome, ruolo, data_inizio) values (${romaB}, 'Bea Bassi', 'collaboratore', '2020-01-01') returning id`)
    await db.exec(`insert into valori_mensili (persona_id, mese, voce, valore) values (${persona}, '2024-05-01', 'incarichi_vendita', 4)`)
    const r = (await db.query<{ s: string; risultato: number }>(`select to_char(settimana, 'MM-DD') s, risultato from rilevazioni
      where ufficio_id = $1 and metrica = 'incarichi' and settimana between '2024-04-29' and '2024-05-27' order by 1`, [romaB])).rows
    expect(r.map((x) => x.risultato)).toEqual([1, 1, 1, 1, 0])
    // tolto il mensile, spariscono anche i numeri inseriti
    await db.exec(`delete from valori_mensili where persona_id = ${persona}`)
    expect((await db.query(`select * from rilevazioni where ufficio_id = $1 and metrica = 'incarichi' and settimana between '2024-04-29' and '2024-05-27'`, [romaB])).rows).toHaveLength(0)
  })

  it('i mesi non ancora finiti non si toccano', async () => {
    const mese = new Date().toISOString().slice(0, 8) + '01'
    await db.exec(`insert into totali_mensili_storico (ufficio_id, mese, voce, valore) values (${romaC}, '${mese}', 'ribassi', 9)`)
    expect((await db.query(`select * from rilevazioni where ufficio_id = $1 and metrica = 'ribassi' and da_mensile`, [romaC])).rows).toHaveLength(0)
  })

  it('nessun account può lanciare la ricostruzione a mano', async () => {
    await rifiutata('davide@test.it', `select ricostruisci_mesi_recenti()`)
    await rifiutata('a@test.it', `select ricostruisci_settimane($1, '2024-03-01')`, [romaA])
  })
})

describe('Migrazioni rieseguite', () => {
  it('006–012 si possono eseguire di nuovo senza errori né perdita di dati', async () => {
    const prima = (await db.query(`select * from uffici_affiliato order by 1, 2`)).rows
    for (const file of ['006_affiliati.sql', '007_quota_mercato.sql', '008_totali_citta.sql', '009_storico_mensile.sql', '010_totali_mensili_citta.sql', '011_settimane_dal_mensile.sql', '012_affiliati_compilano.sql']) {
      await db.exec(readFileSync(join(CARTELLA_MIGRAZIONI, file), 'utf8'))
    }
    expect((await db.query(`select * from uffici_affiliato order by 1, 2`)).rows).toEqual(prima)
    expect(await ufficiVisti('rapportini+aff@gmail.com')).toEqual([romaB, milanoA])
  })
})
