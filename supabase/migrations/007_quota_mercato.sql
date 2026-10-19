-- =====================================================================
-- 007 — NUOVA FORMULA DELLA QUOTA DI MERCATO
-- Gli "Incarichi in zona" comprendono già quelli in portafoglio, quindi
-- Quota di mercato = Portafoglio ÷ Incarichi in zona (prima era
-- Portafoglio ÷ (Portafoglio + Incarichi in zona)). Obiettivo sempre 20%.
-- Vuota se gli incarichi in zona sono 0 o mancano i dati (mai #DIV/0!).
-- Stessa regola in src/lib/calcoli.ts. Da eseguire una volta in Supabase → SQL Editor.
-- =====================================================================

create or replace view v_quota_settimanale with (security_invoker = true) as
select ufficio_id, ufficio, citta_id, area_id, settimana, mese,
       portafoglio, incarichi_zona,
       round(portafoglio::numeric / nullif(incarichi_zona, 0), 4) as quota
from (
  select ufficio_id, ufficio, citta_id, area_id, settimana, mese,
         max(risultato) filter (where metrica = 'portafoglio')    as portafoglio,
         max(risultato) filter (where metrica = 'incarichi_zona') as incarichi_zona
  from v_rilevazioni
  where metrica in ('portafoglio', 'incarichi_zona')
  group by ufficio_id, ufficio, citta_id, area_id, settimana, mese
) t;

create or replace view v_quota_mensile with (security_invoker = true) as
select ufficio_id, ufficio, citta_id, area_id, mese,
       portafoglio, incarichi_zona,
       round(portafoglio::numeric / nullif(incarichi_zona, 0), 4) as quota
from (
  select ufficio_id, ufficio, citta_id, area_id, mese,
         max(risultato) filter (where metrica = 'portafoglio')    as portafoglio,
         max(risultato) filter (where metrica = 'incarichi_zona') as incarichi_zona
  from v_mesi
  where metrica in ('portafoglio', 'incarichi_zona')
  group by ufficio_id, ufficio, citta_id, area_id, mese
) t;
