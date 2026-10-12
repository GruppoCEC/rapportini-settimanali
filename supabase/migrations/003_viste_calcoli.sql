-- =====================================================================
-- 003 — CALCOLI AUTOMATICI
-- Esiti, totali del mese e quota di mercato non si digitano mai:
-- li calcola il database. Le viste rispettano le regole di accesso
-- (security_invoker): ognuno vede solo i calcoli sui dati che può vedere.
-- Le stesse regole sono replicate in src/lib/settimane.ts e src/lib/calcoli.ts
-- =====================================================================

-- Una settimana (lun-dom) appartiene al mese in cui cade il suo giovedì
create function mese_della_settimana(p_lunedi date) returns date
language sql immutable
as $$ select date_trunc('month', p_lunedi + 3)::date $$;

-- Numero della settimana nel mese (1ª, 2ª, … 5ª)
create function settimana_nel_mese(p_lunedi date) returns int
language sql immutable
as $$ select ((extract(day from p_lunedi + 3)::int - 1) / 7) + 1 $$;

-- Dettaglio settimanale con esito
create view v_rilevazioni with (security_invoker = true) as
select r.ufficio_id,
       u.nome                          as ufficio,
       u.citta_id,
       u.area_id,
       r.settimana,
       mese_della_settimana(r.settimana) as mese,
       settimana_nel_mese(r.settimana)   as n_settimana,
       r.metrica,
       m.tipo,
       m.ordine,
       r.obiettivo,
       r.risultato,
       case when r.obiettivo is not null and r.risultato is not null
            then r.risultato - r.obiettivo end as esito,
       r.aggiornato_da,
       r.aggiornato_il
from rilevazioni r
join uffici   u on u.id = r.ufficio_id
join metriche m on m.codice = r.metrica;

-- Totali del mese:
--   attività → somma delle settimane
--   zona     → valore dell'ultima settimana compilata del mese (NON si somma)
create view v_mesi with (security_invoker = true) as
select ufficio_id, ufficio, citta_id, area_id, mese, metrica, tipo, ordine,
       obiettivo, risultato,
       case when obiettivo is not null and risultato is not null
            then risultato - obiettivo end as esito,
       settimane_compilate
from (
  select ufficio_id, ufficio, citta_id, area_id, mese, metrica, tipo, ordine,
         case when tipo = 'attivita' then sum(obiettivo) end as obiettivo,
         case when tipo = 'attivita' then sum(risultato)
              else (array_agg(risultato order by settimana desc)
                      filter (where risultato is not null))[1]
         end as risultato,
         count(*) filter (where risultato is not null) as settimane_compilate
  from v_rilevazioni
  group by ufficio_id, ufficio, citta_id, area_id, mese, metrica, tipo, ordine
) t;

-- Quota di mercato = Portafoglio ÷ (Portafoglio + Incarichi in zona); obiettivo 20%
-- Se il denominatore è 0 o mancano i dati la quota è vuota (mai #DIV/0!)
create view v_quota_settimanale with (security_invoker = true) as
select ufficio_id, ufficio, citta_id, area_id, settimana, mese,
       portafoglio, incarichi_zona,
       round(portafoglio::numeric / nullif(portafoglio + incarichi_zona, 0), 4) as quota
from (
  select ufficio_id, ufficio, citta_id, area_id, settimana, mese,
         max(risultato) filter (where metrica = 'portafoglio')    as portafoglio,
         max(risultato) filter (where metrica = 'incarichi_zona') as incarichi_zona
  from v_rilevazioni
  where metrica in ('portafoglio', 'incarichi_zona')
  group by ufficio_id, ufficio, citta_id, area_id, settimana, mese
) t;

create view v_quota_mensile with (security_invoker = true) as
select ufficio_id, ufficio, citta_id, area_id, mese,
       portafoglio, incarichi_zona,
       round(portafoglio::numeric / nullif(portafoglio + incarichi_zona, 0), 4) as quota
from (
  select ufficio_id, ufficio, citta_id, area_id, mese,
         max(risultato) filter (where metrica = 'portafoglio')    as portafoglio,
         max(risultato) filter (where metrica = 'incarichi_zona') as incarichi_zona
  from v_mesi
  where metrica in ('portafoglio', 'incarichi_zona')
  group by ufficio_id, ufficio, citta_id, area_id, mese
) t;

grant select on v_rilevazioni, v_mesi, v_quota_settimanale, v_quota_mensile to authenticated;
revoke all on v_rilevazioni, v_mesi, v_quota_settimanale, v_quota_mensile from anon;
