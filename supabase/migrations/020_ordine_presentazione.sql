-- =====================================================================
-- 020 — ORDINE DEGLI UFFICI NELLA PRESENTAZIONE DEL MESE
-- Richiesta di Davide del 02/11/2026: le pagine dei singoli uffici nella presentazione del mese
-- (Report mensile → Presentazione e Riunione → Mese) seguono un ordine scelto da lui, che cambia
-- ogni mese. Lo decide l'amministratore generale in Report mensile → Presentazione.
--
-- Una riga per mese con l'elenco degli uffici nell'ordine scelto. Un mese senza riga usa l'ordine
-- dell'ultimo mese salvato prima (lo fa il sito); gli uffici che non sono nell'elenco vanno in fondo,
-- nell'ordine del report di gruppo.
--
-- Si esegue una volta in Supabase → SQL Editor; si può rieseguire senza danni.
-- =====================================================================

create table if not exists ordine_presentazione (
  mese          date primary key check (extract(day from mese) = 1),
  uffici        bigint[] not null,
  aggiornato_da text,
  aggiornato_il timestamptz not null default now()
);

comment on table ordine_presentazione is
  'Ordine delle pagine degli uffici nella presentazione del mese, scelto dall''amministratore generale mese per mese';

create or replace function ordine_presentazione_prima() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.aggiornato_da := nullif(email_corrente(), '');
  new.aggiornato_il := now();
  return new;
end $$;

drop trigger if exists ordine_presentazione_prima on ordine_presentazione;
create trigger ordine_presentazione_prima before insert or update on ordine_presentazione
for each row execute function ordine_presentazione_prima();

-- Lo leggono tutti gli utenti del sito (sono solo numeri degli uffici, nessun dato), lo cambia solo l'amministratore generale
alter table ordine_presentazione enable row level security;
drop policy if exists ordine_lettura on ordine_presentazione;
create policy ordine_lettura on ordine_presentazione for select to authenticated
  using (mio_ruolo() is not null);
drop policy if exists ordine_gestione on ordine_presentazione;
create policy ordine_gestione on ordine_presentazione for all to authenticated
  using (sono_admin_generale()) with check (sono_admin_generale());

revoke all on ordine_presentazione from anon;
grant select, insert, update, delete on ordine_presentazione to authenticated;
