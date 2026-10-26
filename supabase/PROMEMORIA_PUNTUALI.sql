-- =====================================================================
-- PROMEMORIA PUNTUALI (0.20.0, 26/10/2026)
-- GitHub fa partire le azioni programmate anche con ore di ritardo: sabato 24/10 è partito
-- alle 14:32 invece che alle 10 e il promemoria non è stato inviato. Da ora è l'orologio di
-- Supabase (pg_cron) ad avviare il workflow "Promemoria" agli orari giusti, chiedendo a GitHub
-- di partire SUBITO (come il pulsante "Run workflow"), con tipo "automatico": è lo script
-- (scripts/promemoria.mjs) a decidere se in quel momento tocca un promemoria, e ogni email
-- parte una volta sola. Gli orari programmati su GitHub restano come riserva.
--
-- Orari (pg_cron ragiona in ora UTC, come GitHub: due orari per l'ora legale e quella solare):
--   ogni giorno alle 10:00 italiane, più un secondo tentativo alle 11:00 (sabato e mensili)
--   il lunedì alle 9:30 italiane, più un secondo tentativo alle 10:15
--
-- PRIMA di eseguire questo file serve la chiave di GitHub nel Vault di Supabase (vedi
-- CHANGELOG 0.20.0). Non si trova in questo file e non va mai scritta nel progetto.
-- NON è una migrazione (non sta in migrations/): si esegue una volta in Supabase → SQL Editor.
-- Si può rieseguire senza danni.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Chiede a GitHub di avviare il workflow dei promemoria. Ritorna il numero della richiesta
-- (la risposta si legge in net._http_response: 204 = partito).
create or replace function avvia_promemoria() returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  chiave text := (select decrypted_secret from vault.decrypted_secrets where name = 'github_promemoria' limit 1);
begin
  if chiave is null then
    raise warning 'Promemoria: manca la chiave github_promemoria nel Vault, nessun avvio';
    return null;
  end if;
  return net.http_post(
    url := 'https://api.github.com/repos/GruppoCEC/rapportini-settimanali/actions/workflows/promemoria.yml/dispatches',
    body := jsonb_build_object('ref', 'main', 'inputs', jsonb_build_object('tipo', 'automatico')),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || chiave,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'rapportini-gruppo-cec',
      'Content-Type', 'application/json'));
end $$;

-- solo il database (pg_cron) e l'amministratore dall'editor SQL possono usarla
revoke all on function avvia_promemoria() from public, anon, authenticated;

-- orari: si tolgono quelli vecchi (se il file viene rieseguito) e si rimettono
select cron.unschedule(jobid) from cron.job where jobname like 'promemoria-%';
select cron.schedule('promemoria-giornaliero', '0 8,9,10 * * *', 'select avvia_promemoria()');   -- 10:00 (+ 11:00) italiane
select cron.schedule('promemoria-lunedi',      '30 7,8 * * 1',   'select avvia_promemoria()');   -- lunedì 9:30 italiane
select cron.schedule('promemoria-lunedi-bis',  '15 9 * * 1',     'select avvia_promemoria()');   -- lunedì 10:15 (ora legale: 11:15)

-- Controllo: gli orari registrati
select jobname, schedule from cron.job where jobname like 'promemoria-%' order by jobname;
