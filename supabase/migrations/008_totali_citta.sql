-- =====================================================================
-- 008 — TOTALI DELLA PROPRIA CITTÀ PER GLI UFFICI
-- Ogni ufficio vede nella sua Presentazione come va tutta la sua città
-- (come la pagina "Totali" della Riunione), senza vedere i numeri dei
-- singoli altri uffici: la funzione restituisce solo le somme.
-- Stesse regole del sito (src/lib/calcoli.ts e aggregazioni.ts):
--   attività → somma delle settimane del periodo
--   zona     → per ogni ufficio l'ultima settimana compilata, poi somma degli uffici
-- La variazione dei dati di zona (es. portafoglio) sul periodo prima conta solo
-- gli uffici che hanno il dato in entrambi i periodi.
-- Da eseguire una volta in Supabase → SQL Editor. Si può rieseguire senza danni.
-- =====================================================================

-- p_inizi / p_fini: primo e ultimo lunedì di ogni periodo (una settimana, o le settimane di un mese),
-- dal più vecchio. Il periodo n si confronta con il periodo n−1.
create or replace function totali_mia_citta(p_inizi date[], p_fini date[])
returns table (
  periodo          int,      -- posizione del periodo negli elenchi (da 1)
  metrica          text,
  obiettivo        bigint,
  risultato        bigint,
  uffici_con_dato  int,      -- uffici con un risultato per questa voce nel periodo
  uffici_con_dati  int,      -- uffici con almeno un risultato nel periodo, per qualunque voce
  variazione       bigint,   -- solo dati di zona: differenza sul periodo prima
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
  periodi as (
    select i as periodo, p_inizi[i] as da, p_fini[i] as a
    from generate_subscripts(p_inizi, 1) as i
  ),
  per_ufficio as (
    select p.periodo, r.ufficio_id, r.metrica, m.tipo,
           case when m.tipo = 'attivita' then sum(r.obiettivo) end as obiettivo,
           case when m.tipo = 'attivita' then sum(r.risultato)
                else (array_agg(r.risultato order by r.settimana desc) filter (where r.risultato is not null))[1]
           end as risultato
    from periodi p
    join rilevazioni r on r.settimana between p.da and p.a
    join uffici u on u.id = r.ufficio_id and u.attivo
    join metriche m on m.codice = r.metrica
    where u.citta_id = (select citta_id from mia)
    group by p.periodo, r.ufficio_id, r.metrica, m.tipo
  )
  select o.periodo, o.metrica,
         sum(o.obiettivo)::bigint,
         sum(o.risultato)::bigint,
         count(o.risultato)::int,
         (select count(distinct x.ufficio_id)::int from per_ufficio x where x.periodo = o.periodo and x.risultato is not null),
         case when o.tipo = 'zona' then sum(o.risultato - p.risultato)::bigint end,
         case when o.tipo = 'zona' then count(o.risultato - p.risultato)::int end,
         (select count(*)::int from uffici where attivo and citta_id = (select citta_id from mia))
  from per_ufficio o
  left join per_ufficio p on p.periodo = o.periodo - 1 and p.ufficio_id = o.ufficio_id and p.metrica = o.metrica
  group by o.periodo, o.metrica, o.tipo
  order by o.periodo, o.metrica
$$;

revoke all on function totali_mia_citta(date[], date[]) from public, anon;
grant execute on function totali_mia_citta(date[], date[]) to authenticated;
