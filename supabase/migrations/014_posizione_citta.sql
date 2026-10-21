-- =====================================================================
-- 014 — POSIZIONE DELL'UFFICIO NELLA SUA CITTÀ
-- Ogni ufficio vede in che posizione è nella sua città, voce per voce
-- (es. "Incarichi: 8° su 38"), senza vedere i nomi né i numeri degli altri:
-- le funzioni restituiscono SOLO la riga del proprio ufficio.
-- Stessa protezione di 008/010: solo gli account di tipo ufficio.
-- Pari merito: due uffici con lo stesso numero hanno la stessa posizione
-- (10, 8, 8, 5 → 1°, 2°, 2°, 4°). Conta solo chi ha il dato.
-- Da eseguire una volta in Supabase → SQL Editor. Si può rieseguire senza danni.
-- =====================================================================

-- Settimane. p_inizi / p_fini: primo e ultimo lunedì di ogni periodo, dal più vecchio (come 008).
-- Stesse regole di 008: attività = somma delle settimane; zona = ultima settimana compilata.
-- In più la quota di mercato (voce '__quota') = Portafoglio ÷ Incarichi in zona, come in 007.
create or replace function posizione_mia_citta(p_inizi date[], p_fini date[])
returns table (
  periodo          int,      -- posizione del periodo negli elenchi (da 1)
  metrica          text,     -- codice della voce, oppure '__quota'
  posizione        int,      -- 1 = il numero più alto della città
  uffici_con_dato  int,      -- uffici della città con questa voce nel periodo
  uffici_citta     int       -- uffici attivi della città
)
language sql stable security definer set search_path = public
as $$
  with mia as (
    select me.ufficio_id, u.citta_id from utenti me join uffici u on u.id = me.ufficio_id
    where me.email = email_corrente() and me.attivo and me.ruolo = 'ufficio'
  ),
  periodi as (
    select i as periodo, p_inizi[i] as da, p_fini[i] as a
    from generate_subscripts(p_inizi, 1) as i
  ),
  per_ufficio as (
    select p.periodo, r.ufficio_id, r.metrica,
           (case when m.tipo = 'attivita' then sum(r.risultato)
                 else (array_agg(r.risultato order by r.settimana desc) filter (where r.risultato is not null))[1]
            end)::numeric as valore
    from periodi p
    join rilevazioni r on r.settimana between p.da and p.a
    join uffici u on u.id = r.ufficio_id and u.attivo
    join metriche m on m.codice = r.metrica
    where u.citta_id = (select citta_id from mia)
    group by p.periodo, r.ufficio_id, r.metrica, m.tipo
  ),
  con_quota as (
    select periodo, ufficio_id, metrica, valore from per_ufficio
    union all
    select periodo, ufficio_id, '__quota',
           max(valore) filter (where metrica = 'portafoglio') / nullif(max(valore) filter (where metrica = 'incarichi_zona'), 0)
    from per_ufficio
    group by periodo, ufficio_id
  ),
  classifica as (
    select c.*, rank() over (partition by c.periodo, c.metrica order by c.valore desc) as pos,
           count(*) over (partition by c.periodo, c.metrica) as n
    from con_quota c
    where c.valore is not null
  )
  select k.periodo, k.metrica, k.pos::int, k.n::int,
         (select count(*)::int from uffici where attivo and citta_id = (select citta_id from mia))
  from classifica k
  where k.ufficio_id = (select ufficio_id from mia)
  order by k.periodo, k.metrica
$$;

revoke all on function posizione_mia_citta(date[], date[]) from public, anon;
grant execute on function posizione_mia_citta(date[], date[]) to authenticated;

-- Mesi. p_mesi: i mesi ('AAAA-MM-01'), dal più vecchio.
-- Stesse regole di 010: totale dell'ufficio = somma delle persone in servizio nel mese;
-- se l'ufficio non ha numeri persona per persona, vale lo storico del file Excel annuale.
-- Lo staff conta solo per gli uffici che hanno inserito il rapportino del mese.
create or replace function posizione_mensile_mia_citta(p_mesi date[])
returns table (
  periodo          int,      -- posizione del mese nell'elenco (da 1)
  voce             text,     -- colonna del rapportino o 'staff'
  posizione        int,
  uffici_con_dato  int,
  uffici_citta     int
)
language sql stable security definer set search_path = public
as $$
  with mia as (
    select me.ufficio_id, u.citta_id from utenti me join uffici u on u.id = me.ufficio_id
    where me.email = email_corrente() and me.attivo and me.ruolo = 'ufficio'
  ),
  uff as (select id from uffici where attivo and citta_id = (select citta_id from mia)),
  mesi as (
    select i as periodo, p_mesi[i] as mese, (p_mesi[i] + interval '1 month' - interval '1 day')::date as fine
    from generate_subscripts(p_mesi, 1) as i
  ),
  colonne as (select codice from voci_mensili where attiva and solo_ruolo is null),
  in_servizio as (
    select m.periodo, m.mese, p.id as persona_id, p.ufficio_id
    from mesi m join persone p on p.data_inizio <= m.fine and (p.data_fine is null or p.data_fine > m.fine)
    where p.ufficio_id in (select id from uff)
  ),
  calcolati as (
    select s.periodo, s.ufficio_id, v.voce, sum(v.valore) as valore
    from in_servizio s
    join valori_mensili v on v.persona_id = s.persona_id and v.mese = s.mese and v.valore is not null
    where v.voce in (select codice from colonne)
    group by s.periodo, s.ufficio_id, v.voce
  ),
  storico as (
    select m.periodo, t.ufficio_id, t.voce, t.valore::bigint as valore
    from mesi m join totali_mensili_storico t on t.mese = m.mese
    where t.ufficio_id in (select id from uff)
      and (t.voce = 'staff' or t.voce in (select codice from colonne))
      and not exists (select 1 from calcolati c where c.periodo = m.periodo and c.ufficio_id = t.ufficio_id)
  ),
  per_ufficio as (
    select periodo, ufficio_id, voce, valore from calcolati
    union all
    select s.periodo, s.ufficio_id, 'staff', count(*) from in_servizio s
    where not exists (select 1 from storico x where x.periodo = s.periodo and x.ufficio_id = s.ufficio_id)
    group by s.periodo, s.ufficio_id
    union all
    select periodo, ufficio_id, voce, valore from storico
  ),
  con_numeri as (select distinct periodo, ufficio_id from per_ufficio where voce <> 'staff' and valore is not null),
  validi as (
    select x.* from per_ufficio x
    where x.valore is not null
      and (x.voce <> 'staff' or exists (select 1 from con_numeri n where n.periodo = x.periodo and n.ufficio_id = x.ufficio_id))
  ),
  classifica as (
    select v.*, rank() over (partition by v.periodo, v.voce order by v.valore desc) as pos,
           count(*) over (partition by v.periodo, v.voce) as n
    from validi v
  )
  select k.periodo, k.voce, k.pos::int, k.n::int, (select count(*)::int from uff)
  from classifica k
  where k.ufficio_id = (select ufficio_id from mia)
  order by k.periodo, k.voce
$$;

revoke all on function posizione_mensile_mia_citta(date[]) from public, anon;
grant execute on function posizione_mensile_mia_citta(date[]) to authenticated;
