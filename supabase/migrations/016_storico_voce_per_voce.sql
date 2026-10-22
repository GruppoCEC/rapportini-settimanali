-- =====================================================================
-- 016 — FILE ANNUALE VOCE PER VOCE
-- Fino alla 015: se in un mese un ufficio aveva numeri persona per persona, il totale
-- veniva SOLO dalle persone e il file annuale (totali_mensili_storico, 009) era ignorato.
-- Caricando i rapportini mensili degli uffici del 2026 (scansioni, persona per persona)
-- alcune voci non ci sono, per esempio le vendite effettuate, che il file annuale ha.
-- Da ora, VOCE PER VOCE: se nessuno ha scritto quella voce persona per persona, vale il
-- totale del file annuale. Lo staff resta com'era: dalle persone in servizio se l'ufficio
-- ha numeri persona per persona, altrimenti dal file annuale.
-- Stessa regola nel sito (src/lib/mensile.ts, totaleConStorico).
-- Riscrive le funzioni di 010, 011 e 014. Da eseguire una volta in Supabase → SQL Editor,
-- dopo la 015. Si può rieseguire senza danni.
-- =====================================================================

create or replace function totale_mensile_ufficio(p_ufficio bigint, p_mese date)
returns table (voce text, valore bigint)
language sql stable security definer set search_path = public
as $$
  with fine as (select (p_mese + interval '1 month' - interval '1 day')::date as d),
  calcolati as (
    select v.voce, sum(v.valore)::bigint as valore
    from valori_mensili v join persone p on p.id = v.persona_id
    where v.ufficio_id = p_ufficio and v.mese = p_mese and v.valore is not null
      and p.data_inizio <= (select d from fine) and (p.data_fine is null or p.data_fine > (select d from fine))
      and v.voce in (select codice from voci_mensili where attiva and solo_ruolo is null)
    group by v.voce
  )
  select voce, valore from calcolati
  union all
  select t.voce, t.valore::bigint from totali_mensili_storico t
  where t.ufficio_id = p_ufficio and t.mese = p_mese and t.voce <> 'staff'
    and not exists (select 1 from calcolati c where c.voce = t.voce)
$$;

create or replace function totali_mensili_mia_citta(p_mesi date[])
returns table (
  posizione        int,      -- posizione del mese nell'elenco (da 1)
  voce             text,     -- colonna del rapportino o 'staff'
  valore           bigint,
  uffici_con_dato  int,      -- uffici con questa voce nel mese
  uffici_con_dati  int,      -- uffici con almeno un numero nel mese (lo staff non conta)
  variazione       bigint,   -- differenza sul mese prima
  confrontati      int,      -- uffici usati per la variazione
  uffici_citta     int       -- uffici attivi della città
)
language sql stable security definer set search_path = public
as $$
  with mia as (
    -- solo gli account di un ufficio: gli amministratori hanno già la Riunione
    select u.citta_id from utenti me join uffici u on u.id = me.ufficio_id
    where me.email = email_corrente() and me.attivo and me.ruolo = 'ufficio'
  ),
  uff as (select id from uffici where attivo and citta_id = (select citta_id from mia)),
  mesi as (
    select i as posizione, p_mesi[i] as mese, (p_mesi[i] + interval '1 month' - interval '1 day')::date as fine
    from generate_subscripts(p_mesi, 1) as i
  ),
  colonne as (select codice from voci_mensili where attiva and solo_ruolo is null),
  in_servizio as (
    select m.posizione, m.mese, p.id as persona_id, p.ufficio_id
    from mesi m join persone p on p.data_inizio <= m.fine and (p.data_fine is null or p.data_fine > m.fine)
    where p.ufficio_id in (select id from uff)
  ),
  calcolati as (
    select s.posizione, s.ufficio_id, v.voce, sum(v.valore) as valore
    from in_servizio s
    join valori_mensili v on v.persona_id = s.persona_id and v.mese = s.mese and v.valore is not null
    where v.voce in (select codice from colonne)
    group by s.posizione, s.ufficio_id, v.voce
  ),
  storico as (
    select m.posizione, t.ufficio_id, t.voce, t.valore::bigint as valore
    from mesi m join totali_mensili_storico t on t.mese = m.mese
    where t.ufficio_id in (select id from uff)
      and (   (t.voce = 'staff' and not exists (select 1 from calcolati c where c.posizione = m.posizione and c.ufficio_id = t.ufficio_id))
           or (t.voce in (select codice from colonne)
               and not exists (select 1 from calcolati c where c.posizione = m.posizione and c.ufficio_id = t.ufficio_id and c.voce = t.voce)))
  ),
  per_ufficio as (
    select posizione, ufficio_id, voce, valore from calcolati
    union all
    select s.posizione, s.ufficio_id, 'staff', count(*) from in_servizio s
    where not exists (select 1 from storico x where x.posizione = s.posizione and x.ufficio_id = s.ufficio_id and x.voce = 'staff')
    group by s.posizione, s.ufficio_id
    union all
    select posizione, ufficio_id, voce, valore from storico
  ),
  -- uffici che nel mese hanno inserito il rapportino (lo staff da solo non basta)
  con_numeri as (select distinct posizione, ufficio_id from per_ufficio where voce <> 'staff' and valore is not null),
  -- il dato vale per conteggi e variazioni? lo staff solo se l'ufficio ha inserito il rapportino
  valutati as (
    select x.*, (x.valore is not null and (x.voce <> 'staff' or exists (
             select 1 from con_numeri n where n.posizione = x.posizione and n.ufficio_id = x.ufficio_id))) as vale
    from per_ufficio x
  )
  select o.posizione, o.voce,
         sum(o.valore)::bigint,
         (count(*) filter (where o.vale))::int,
         (select count(*)::int from con_numeri n where n.posizione = o.posizione),
         (sum(o.valore - p.valore) filter (where o.vale and p.vale))::bigint,
         (count(*) filter (where o.vale and p.vale))::int,
         (select count(*)::int from uff)
  from valutati o
  left join valutati p on p.posizione = o.posizione - 1 and p.ufficio_id = o.ufficio_id and p.voce = o.voce
  group by o.posizione, o.voce
  order by o.posizione, o.voce
$$;

revoke all on function totali_mensili_mia_citta(date[]) from public, anon;
grant execute on function totali_mensili_mia_citta(date[]) to authenticated;

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
      and (   (t.voce = 'staff' and not exists (select 1 from calcolati c where c.periodo = m.periodo and c.ufficio_id = t.ufficio_id))
           or (t.voce in (select codice from colonne)
               and not exists (select 1 from calcolati c where c.periodo = m.periodo and c.ufficio_id = t.ufficio_id and c.voce = t.voce)))
  ),
  per_ufficio as (
    select periodo, ufficio_id, voce, valore from calcolati
    union all
    select s.periodo, s.ufficio_id, 'staff', count(*) from in_servizio s
    where not exists (select 1 from storico x where x.periodo = s.periodo and x.ufficio_id = s.ufficio_id and x.voce = 'staff')
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
