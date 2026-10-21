-- =====================================================================
-- 011 — SETTIMANE COMPLETATE DAL RAPPORTINO MENSILE
-- Quando a un ufficio mancano dei numeri settimanali, il database li inserisce
-- da solo nelle settimane vuote, così che la somma delle settimane del mese sia
-- uguale al rapportino mensile (decisione di Davide del 21/10/2026):
--   - solo per le voci presenti in entrambi (tabella corrispondenze_settimana_mese);
--   - la differenza tra mensile e settimane già compilate si divide in parti uguali
--     tra le settimane vuote (i resti alle prime settimane);
--   - solo per i mesi già finiti (tutte le settimane del mese concluse);
--   - le settimane scritte dall'ufficio non si toccano mai.
-- I numeri inseriti così non sono evidenziati nel sito. Il database li riconosce
-- (colonna da_mensile) solo per poterli ricalcolare e perché non fermino i promemoria.
-- Si ricalcola da solo quando cambiano il rapportino mensile, lo storico Excel o le
-- settimane dell'ufficio; i promemoria (scripts/promemoria.mjs) richiamano anche
-- ricostruisci_mesi_recenti() per i mesi appena finiti.
-- Da eseguire una volta in Supabase → SQL Editor, dopo 009. Si può rieseguire senza danni.
-- =====================================================================

alter table rilevazioni add column if not exists da_mensile boolean not null default false;

-- Voce settimanale → voce del rapportino mensile (il portafoglio non si ricostruisce)
create table if not exists corrispondenze_settimana_mese (
  metrica  text primary key references metriche,
  voce     text not null references voci_mensili
);
insert into corrispondenze_settimana_mese (metrica, voce) values
  ('app_vendita', 'appuntamenti_vendita'),
  ('proposte',    'proposte_vendita'),
  ('incarichi',   'incarichi_vendita'),
  ('valutazioni', 'acquisizioni'),
  ('vendite',     'vendite_effettuate'),
  ('ribassi',     'ribassi')
on conflict (metrica) do update set voce = excluded.voce;
alter table corrispondenze_settimana_mese enable row level security;   -- la usano solo le funzioni qui sotto
revoke all on corrispondenze_settimana_mese from anon, authenticated;

-- Salvataggi delle settimane: come in 002_sicurezza.sql, più da_mensile.
-- Un numero scritto da una persona non è mai "da mensile"; lo è solo se lo scrive ricostruisci_settimane.
create or replace function rilevazioni_prima_del_salvataggio() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(current_setting('rapportini.ricostruzione', true), '') <> 'si' then
    new.da_mensile := false;
  end if;
  if tg_op = 'UPDATE'
     and new.obiettivo is not distinct from old.obiettivo
     and new.risultato is not distinct from old.risultato
     and new.da_mensile = old.da_mensile then
    return null;                                  -- niente di nuovo: non tocca la riga
  end if;
  if (select tipo from metriche where codice = new.metrica) = 'zona' then
    new.obiettivo := null;
  end if;
  new.aggiornato_da := nullif(email_corrente(), '');
  new.aggiornato_il := now();
  return new;
end $$;

-- Totale del rapportino mensile di un ufficio, voce per voce (stesse regole di totaleConStorico
-- in src/lib/mensile.ts: persone in servizio nel mese; se non ci sono numeri, lo storico Excel)
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
    and not exists (select 1 from calcolati)
$$;

-- Ricostruisce le settimane vuote di un ufficio in un mese
create or replace function ricostruisci_settimane(p_ufficio bigint, p_mese date) returns void
language plpgsql security definer set search_path = public
as $$
declare
  settimane date[];
  vuote     date[];
  c         record;
  scritto   bigint;
  differenza bigint;
  n         int;
begin
  p_mese := date_trunc('month', p_mese)::date;
  -- le settimane del mese: quelle che hanno il giovedì nel mese (come mese_della_settimana)
  select array_agg(d::date order by d) into settimane
  from generate_series(p_mese - 6, (p_mese + interval '1 month')::date, interval '1 day') as d
  where extract(isodow from d) = 1 and mese_della_settimana(d::date) = p_mese;
  -- solo mesi finiti: l'ultima settimana deve essere conclusa
  if settimane is null or settimane[array_length(settimane, 1)] + 6 >= current_date then
    return;
  end if;

  perform set_config('rapportini.ricostruzione', 'si', true);
  for c in
    select k.metrica, t.valore
    from corrispondenze_settimana_mese k
    left join totale_mensile_ufficio(p_ufficio, p_mese) t on t.voce = k.voce
  loop
    -- quanto ha già scritto l'ufficio, e quali settimane sono vuote
    select coalesce(sum(r.risultato), 0) into scritto
    from rilevazioni r
    where r.ufficio_id = p_ufficio and r.metrica = c.metrica and r.settimana = any(settimane)
      and r.risultato is not null and not r.da_mensile;
    select array_agg(s order by s) into vuote
    from unnest(settimane) as s
    where not exists (select 1 from rilevazioni r
                      where r.ufficio_id = p_ufficio and r.metrica = c.metrica and r.settimana = s
                        and r.risultato is not null and not r.da_mensile);
    if vuote is null then
      continue;
    end if;
    differenza := c.valore - scritto;

    if differenza is null or differenza < 0 then
      -- niente mensile per questa voce, o le settimane lo superano già: via i numeri inseriti prima
      delete from rilevazioni
      where ufficio_id = p_ufficio and metrica = c.metrica and settimana = any(vuote) and da_mensile and obiettivo is null;
      update rilevazioni set risultato = null, da_mensile = false
      where ufficio_id = p_ufficio and metrica = c.metrica and settimana = any(vuote) and da_mensile;
      continue;
    end if;

    n := array_length(vuote, 1);
    for i in 1 .. n loop
      insert into rilevazioni (ufficio_id, settimana, metrica, risultato, da_mensile)
      values (p_ufficio, vuote[i], c.metrica, differenza / n + case when i <= differenza % n then 1 else 0 end, true)
      on conflict (ufficio_id, settimana, metrica)
      do update set risultato = excluded.risultato, da_mensile = true;
    end loop;
  end loop;
  perform set_config('rapportini.ricostruzione', '', true);
end $$;

-- Dopo ogni modifica del rapportino mensile o dello storico: ricalcola gli uffici e i mesi toccati
create or replace function ricostruisci_dopo_mensile() returns trigger
language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  if coalesce(current_setting('rapportini.ricostruzione', true), '') = 'si' then return null; end if;
  if tg_op in ('INSERT', 'UPDATE') then
    for r in select distinct ufficio_id, mese from nuove loop perform ricostruisci_settimane(r.ufficio_id, r.mese); end loop;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    for r in select distinct ufficio_id, mese from vecchie loop perform ricostruisci_settimane(r.ufficio_id, r.mese); end loop;
  end if;
  return null;
end $$;

-- Dopo che un ufficio scrive le sue settimane: ricalcola le altre settimane vuote dello stesso mese
create or replace function ricostruisci_dopo_settimane() returns trigger
language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  if coalesce(current_setting('rapportini.ricostruzione', true), '') = 'si' then return null; end if;
  if tg_op in ('INSERT', 'UPDATE') then
    for r in select distinct ufficio_id, mese_della_settimana(settimana) as mese from nuove
             where metrica in (select metrica from corrispondenze_settimana_mese)
    loop perform ricostruisci_settimane(r.ufficio_id, r.mese); end loop;
  end if;
  if tg_op = 'DELETE' then
    for r in select distinct ufficio_id, mese_della_settimana(settimana) as mese from vecchie
             where metrica in (select metrica from corrispondenze_settimana_mese)
    loop perform ricostruisci_settimane(r.ufficio_id, r.mese); end loop;
  end if;
  return null;
end $$;

drop trigger if exists valori_mensili_ricostruisci_ins on valori_mensili;
drop trigger if exists valori_mensili_ricostruisci_upd on valori_mensili;
drop trigger if exists valori_mensili_ricostruisci_del on valori_mensili;
create trigger valori_mensili_ricostruisci_ins after insert on valori_mensili
  referencing new table as nuove for each statement execute function ricostruisci_dopo_mensile();
create trigger valori_mensili_ricostruisci_upd after update on valori_mensili
  referencing new table as nuove old table as vecchie for each statement execute function ricostruisci_dopo_mensile();
create trigger valori_mensili_ricostruisci_del after delete on valori_mensili
  referencing old table as vecchie for each statement execute function ricostruisci_dopo_mensile();

drop trigger if exists storico_ricostruisci_ins on totali_mensili_storico;
drop trigger if exists storico_ricostruisci_upd on totali_mensili_storico;
drop trigger if exists storico_ricostruisci_del on totali_mensili_storico;
create trigger storico_ricostruisci_ins after insert on totali_mensili_storico
  referencing new table as nuove for each statement execute function ricostruisci_dopo_mensile();
create trigger storico_ricostruisci_upd after update on totali_mensili_storico
  referencing new table as nuove old table as vecchie for each statement execute function ricostruisci_dopo_mensile();
create trigger storico_ricostruisci_del after delete on totali_mensili_storico
  referencing old table as vecchie for each statement execute function ricostruisci_dopo_mensile();

drop trigger if exists rilevazioni_ricostruisci_ins on rilevazioni;
drop trigger if exists rilevazioni_ricostruisci_upd on rilevazioni;
drop trigger if exists rilevazioni_ricostruisci_del on rilevazioni;
create trigger rilevazioni_ricostruisci_ins after insert on rilevazioni
  referencing new table as nuove for each statement execute function ricostruisci_dopo_settimane();
create trigger rilevazioni_ricostruisci_upd after update on rilevazioni
  referencing new table as nuove old table as vecchie for each statement execute function ricostruisci_dopo_settimane();
create trigger rilevazioni_ricostruisci_del after delete on rilevazioni
  referencing old table as vecchie for each statement execute function ricostruisci_dopo_settimane();

-- I mesi appena finiti, per tutti gli uffici con un rapportino mensile: serve quando il mensile
-- è stato inserito prima che finisse l'ultima settimana del mese. La richiamano i promemoria.
create or replace function ricostruisci_mesi_recenti() returns void
language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  for r in
    select ufficio_id, mese from valori_mensili where mese >= date_trunc('month', current_date - 62)
    union
    select ufficio_id, mese from totali_mensili_storico where mese >= date_trunc('month', current_date - 62)
  loop
    perform ricostruisci_settimane(r.ufficio_id, r.mese);
  end loop;
end $$;

revoke all on function totale_mensile_ufficio(bigint, date) from public, anon, authenticated;
revoke all on function ricostruisci_settimane(bigint, date) from public, anon, authenticated;
revoke all on function ricostruisci_mesi_recenti() from public, anon, authenticated;
grant execute on function ricostruisci_mesi_recenti() to service_role;

-- Prima volta: tutti i mesi che hanno già un rapportino mensile o lo storico Excel
do $$
declare r record;
begin
  for r in
    select distinct ufficio_id, mese from valori_mensili
    union
    select distinct ufficio_id, mese from totali_mensili_storico
  loop
    perform ricostruisci_settimane(r.ufficio_id, r.mese);
  end loop;
end $$;
