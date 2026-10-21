-- =====================================================================
-- 010 — TOTALI MENSILI DELLA PROPRIA CITTÀ PER GLI UFFICI
-- Nella presentazione mensile ogni ufficio vede come va tutta la sua città
-- con i numeri dei rapportini mensili, senza vedere i singoli altri uffici:
-- la funzione restituisce solo le somme (come 008_totali_citta.sql per le settimane).
-- Stesse regole del Report mensile (src/lib/mensile.ts):
--   totale dell'ufficio = somma delle persone in servizio nel mese (chi esce nel mese non conta);
--   staff = persone in servizio;
--   se l'ufficio non ha numeri persona per persona nel mese, vale lo storico del file Excel
--   annuale (totali_mensili_storico, 009_storico_mensile.sql), staff compreso.
-- La variazione sul mese prima conta solo gli uffici che hanno la voce in entrambi i mesi
-- (per lo staff, solo se l'ufficio ha inserito il rapportino in entrambi i mesi).
-- Da eseguire una volta in Supabase → SQL Editor, dopo 009. Si può rieseguire senza danni.
-- =====================================================================

-- p_mesi: i mesi da riepilogare ('AAAA-MM-01'), dal più vecchio. Il mese n si confronta con il mese n−1.
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
      and (t.voce = 'staff' or t.voce in (select codice from colonne))
      and not exists (select 1 from calcolati c where c.posizione = m.posizione and c.ufficio_id = t.ufficio_id)
  ),
  per_ufficio as (
    select posizione, ufficio_id, voce, valore from calcolati
    union all
    select s.posizione, s.ufficio_id, 'staff', count(*) from in_servizio s
    where not exists (select 1 from storico x where x.posizione = s.posizione and x.ufficio_id = s.ufficio_id)
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
