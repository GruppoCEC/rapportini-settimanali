-- =====================================================================
-- 021 — CLASSIFICHE DEL MESE (PDF)
-- Richiesta di Davide del 04/11/2026: dopo la riunione di fine mese l'amministrazione manda le
-- classifiche (uffici, collaboratori, miglior collaboratore, miglior coordinatrice, miglior
-- coordinatore). Ora l'amministratore generale carica un PDF per ogni classifica nella pagina
-- "Classifiche" del sito; quando le pubblica, tutti gli account del sito le vedono e le stampano,
-- e (se lo sceglie) parte un'email di avviso con il collegamento diretto.
--
-- - classifiche_mesi: un mese pubblicato o no, e lo stato dell'email di avviso;
-- - classifiche_file: un PDF per mese e classifica (il file sta nello Storage, contenitore "classifiche");
-- - testi_email: oggetto, testo e pulsante dell'email di avviso, che l'amministratore generale cambia dal sito;
-- - pubblica_classifiche(): pubblica il mese e, se richiesto, avvia subito l'invio delle email
--   (lo stesso workflow dei promemoria, scripts/promemoria.mjs). Se l'avvio immediato non riesce
--   (es. manca la chiave di GitHub nel Vault), le email partono al primo giro automatico dei promemoria.
--
-- Prima della pubblicazione i PDF li vede solo l'amministratore generale.
-- Si esegue una volta in Supabase → SQL Editor; si può rieseguire senza danni.
-- =====================================================================

create table if not exists classifiche_mesi (
  mese                date primary key check (extract(day from mese) = 1),
  pubblicato_il       timestamptz,          -- null = non pubblicato (lo vede solo l'amministratore generale)
  pubblicato_da       text,
  avviso_richiesto_il timestamptz,          -- l'amministratore ha chiesto l'email di avviso
  avviso_inviato_il   timestamptz           -- le email sono partite (lo scrive scripts/promemoria.mjs)
);

comment on table classifiche_mesi is
  'Classifiche del mese in PDF: pubblicazione e email di avviso (021)';

create table if not exists classifiche_file (
  mese        date not null check (extract(day from mese) = 1),
  categoria   text not null check (categoria in ('uffici', 'collaboratori', 'miglior_collaboratore', 'miglior_coordinatrice', 'miglior_coordinatore')),
  percorso    text not null,                -- nel contenitore "classifiche" dello Storage, es. 2026-10/uffici-1730000000000.pdf
  nome_file   text not null,                -- il nome del file caricato, per mostrarlo
  dimensione  integer,
  caricato_da text,
  caricato_il timestamptz not null default now(),
  primary key (mese, categoria)
);

comment on table classifiche_file is
  'Un PDF per mese e classifica (021); il file è nello Storage, contenitore "classifiche"';

create or replace function classifiche_file_prima() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.caricato_da := nullif(email_corrente(), '');
  new.caricato_il := now();
  return new;
end $$;

drop trigger if exists classifiche_file_prima on classifiche_file;
create trigger classifiche_file_prima before insert or update on classifiche_file
for each row execute function classifiche_file_prima();

-- Il mese è pubblicato? (serve anche alla regola dello Storage, che conosce solo il percorso "AAAA-MM/…")
create or replace function classifiche_pubblicate(p_mese date) returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from classifiche_mesi where mese = p_mese and pubblicato_il is not null) $$;

-- Lo stesso, dal percorso del file nello Storage ("AAAA-MM/…"); un percorso di altra forma = no
create or replace function classifiche_percorso_pubblicato(p_percorso text) returns boolean
language sql stable security definer set search_path = public
as $$
  select case when p_percorso ~ '^[0-9]{4}-[0-9]{2}/'
    then classifiche_pubblicate(to_date(substr(p_percorso, 1, 7) || '-01', 'YYYY-MM-DD')) else false end
$$;

-- Regole: l'amministratore generale vede e cambia tutto; gli altri account vedono solo i mesi pubblicati
alter table classifiche_mesi enable row level security;
drop policy if exists classifiche_mesi_lettura on classifiche_mesi;
create policy classifiche_mesi_lettura on classifiche_mesi for select to authenticated
  using (sono_admin_generale() or (mio_ruolo() is not null and pubblicato_il is not null));
drop policy if exists classifiche_mesi_gestione on classifiche_mesi;
create policy classifiche_mesi_gestione on classifiche_mesi for all to authenticated
  using (sono_admin_generale()) with check (sono_admin_generale());

alter table classifiche_file enable row level security;
drop policy if exists classifiche_file_lettura on classifiche_file;
create policy classifiche_file_lettura on classifiche_file for select to authenticated
  using (sono_admin_generale() or (mio_ruolo() is not null and classifiche_pubblicate(mese)));
drop policy if exists classifiche_file_gestione on classifiche_file;
create policy classifiche_file_gestione on classifiche_file for all to authenticated
  using (sono_admin_generale()) with check (sono_admin_generale());

revoke all on classifiche_mesi, classifiche_file from anon;
grant select, insert, update, delete on classifiche_mesi, classifiche_file to authenticated;

-- Testo dell'email di avviso, scritto dall'amministratore generale dal sito (Classifiche → Email di avviso).
-- Una riga per email (per ora solo 'classifiche'); senza riga vale il testo di partenza (scripts/testo-classifiche.mjs).
create table if not exists testi_email (
  chiave        text primary key check (chiave in ('classifiche')),
  oggetto       text not null,
  testo         text not null,
  pulsante      text not null,
  aggiornato_da text,
  aggiornato_il timestamptz not null default now()
);

comment on table testi_email is
  'Testi delle email scritti dall''amministratore generale dal sito (021: avviso delle classifiche)';

create or replace function testi_email_prima() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.aggiornato_da := nullif(email_corrente(), '');
  new.aggiornato_il := now();
  return new;
end $$;

drop trigger if exists testi_email_prima on testi_email;
create trigger testi_email_prima before insert or update on testi_email
for each row execute function testi_email_prima();

alter table testi_email enable row level security;
drop policy if exists testi_email_gestione on testi_email;
create policy testi_email_gestione on testi_email for all to authenticated
  using (sono_admin_generale()) with check (sono_admin_generale());
revoke all on testi_email from anon;
grant select, insert, update, delete on testi_email to authenticated;

-- Pubblica le classifiche di un mese; con p_avvisa = true chiede anche l'email di avviso a tutti gli account.
-- L'email parte una volta sola per mese: ripubblicare non la rimanda.
create or replace function pubblica_classifiche(p_mese date, p_avvisa boolean) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not sono_admin_generale() then
    raise exception 'Solo l''amministratore generale può pubblicare le classifiche';
  end if;
  if not exists (select 1 from classifiche_file where mese = p_mese) then
    raise exception 'Nessuna classifica caricata per questo mese';
  end if;
  insert into classifiche_mesi (mese, pubblicato_il, pubblicato_da, avviso_richiesto_il)
  values (p_mese, now(), nullif(email_corrente(), ''), case when p_avvisa then now() end)
  on conflict (mese) do update set
    pubblicato_il = now(),
    pubblicato_da = excluded.pubblicato_da,
    avviso_richiesto_il = coalesce(classifiche_mesi.avviso_richiesto_il, excluded.avviso_richiesto_il);
  -- avvio immediato dell'invio (PROMEMORIA_PUNTUALI.sql); se non c'è, le email partono al prossimo giro automatico
  if p_avvisa then
    begin
      perform avvia_promemoria();
    exception when others then
      raise notice 'Classifiche: invio immediato non avviato (%), le email partiranno al prossimo giro dei promemoria', sqlerrm;
    end;
  end if;
end $$;

revoke all on function pubblica_classifiche(date, boolean) from public, anon;
grant execute on function pubblica_classifiche(date, boolean) to authenticated;

-- Contenitore dei PDF nello Storage di Supabase (privato: i file si aprono solo con le regole qui sotto).
-- Nei test (PGlite) lo Storage non c'è: questa parte si salta.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('classifiche', 'classifiche', false, 20971520, array['application/pdf'])
    on conflict (id) do update set public = false, file_size_limit = 20971520, allowed_mime_types = array['application/pdf'];

    execute 'drop policy if exists classifiche_pdf_lettura on storage.objects';
    execute $p$create policy classifiche_pdf_lettura on storage.objects for select to authenticated
      using (bucket_id = 'classifiche' and (public.sono_admin_generale()
        or (public.mio_ruolo() is not null and public.classifiche_percorso_pubblicato(name))))$p$;
    execute 'drop policy if exists classifiche_pdf_gestione on storage.objects';
    execute $p$create policy classifiche_pdf_gestione on storage.objects for all to authenticated
      using (bucket_id = 'classifiche' and public.sono_admin_generale())
      with check (bucket_id = 'classifiche' and public.sono_admin_generale())$p$;
  end if;
end $$;
