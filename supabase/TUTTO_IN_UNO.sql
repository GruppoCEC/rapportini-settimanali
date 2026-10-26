-- FILE GENERATO AUTOMATICAMENTE da scripts/unisci-sql.mjs — non modificarlo a mano.
-- Contiene, in ordine: 001_tabelle.sql, 002_sicurezza.sql, 003_viste_calcoli.sql, 004_dati_iniziali.sql, 005_mensile.sql, 006_affiliati.sql, 007_quota_mercato.sql, 008_totali_citta.sql, 009_storico_mensile.sql, 010_totali_mensili_citta.sql, 011_settimane_dal_mensile.sql, 012_affiliati_compilano.sql, 013_nota_tre_caselle.sql, 014_posizione_citta.sql, 015_motivo_fine.sql, 016_storico_voce_per_voce.sql, 017_ruolo_da_definire_trasferimenti.sql, 018_uscite_nel_mese_report_uffici_locazioni.sql
-- Da incollare UNA SOLA VOLTA in Supabase → SQL Editor → New query → Run.

-- ▼▼▼ 001_tabelle.sql ▼▼▼
-- =====================================================================
-- 001 — TABELLE
-- Struttura dei dati della piattaforma Rapportini Settimanali.
-- =====================================================================

-- Città: ogni città è una sezione separata (Roma, Milano)
create table citta (
  id   smallint primary key,
  nome text not null unique
);

-- Aree: gruppi di uffici con un responsabile, all'interno di una città
create table aree (
  id       bigint generated always as identity primary key,
  nome     text not null,
  citta_id smallint not null references citta,
  unique (citta_id, nome),
  unique (id, citta_id)               -- serve al controllo "area della stessa città" su uffici
);

-- Uffici
create table uffici (
  id       bigint generated always as identity primary key,
  nome     text not null,
  citta_id smallint not null references citta,
  area_id  bigint,
  attivo   boolean not null default true,
  unique (citta_id, nome),
  -- l'area, se indicata, deve appartenere alla stessa città dell'ufficio
  foreign key (area_id, citta_id) references aree (id, citta_id)
);

-- Account di accesso (uno per ufficio, più quelli di responsabili e amministratori).
-- Si entra con NOME UTENTE e PASSWORD. Supabase richiede comunque un'email
-- tecnica: viene generata dal nome utente con il modello in "impostazioni"
-- e non serve a ricevere posta. Per i promemoria c'è email_promemoria.
--   ufficio         → vede e compila solo il proprio ufficio
--   responsabile    → vede (sola lettura) gli uffici della propria area
--   admin_citta     → vede e gestisce tutta la propria città
--   admin_generale  → vede e gestisce tutto
create table utenti (
  email            text primary key check (email = lower(trim(email)) and email like '%@%'),  -- email tecnica di accesso
  nome_utente      text not null unique check (nome_utente ~ '^[a-z0-9][a-z0-9.-]{2,29}$'),
  nome             text,
  ruolo            text not null check (ruolo in ('ufficio', 'responsabile', 'admin_citta', 'admin_generale')),
  citta_id         smallint references citta,   -- per l'admin generale è la città mostrata all'apertura
  ufficio_id       bigint references uffici,    -- l'ufficio compilato da questo account (facoltativo per admin e responsabili)
  area_id          bigint references aree,      -- obbligatoria per i responsabili
  email_promemoria text check (email_promemoria is null
                     or email_promemoria ~ '^[^@\s,]+@[^@\s,]+\.[^@\s,]+(\s*,\s*[^@\s,]+@[^@\s,]+\.[^@\s,]+)*$'),
  auth_id          uuid unique,                 -- collegamento all'account Supabase (impostato dal sistema)
  attivo           boolean not null default true,
  creato_il        timestamptz not null default now(),
  check (ruolo <> 'ufficio'      or ufficio_id is not null),
  check (ruolo <> 'responsabile' or area_id is not null),
  check (ruolo <> 'admin_citta'  or citta_id is not null),
  check (ruolo =  'admin_generale' or citta_id is not null)
);

-- Impostazioni generali (es. modello dell'email tecnica di accesso)
create table impostazioni (
  chiave text primary key,
  valore text not null
);

-- Promemoria già inviati (evita doppi invii)
create table promemoria_inviati (
  tipo       text not null,       -- venerdi | domenica | lunedi
  settimana  date not null,
  inviato_il timestamptz not null default now(),
  primary key (tipo, settimana)
);

-- Elenco delle voci da compilare
--   attivita → obiettivo + risultato, nel mese si sommano
--   zona     → solo valore (fotografia della zona), nel mese vale l'ultima settimana
create table metriche (
  codice text primary key,
  nome   text not null,
  tipo   text not null check (tipo in ('attivita', 'zona')),
  ordine smallint not null,
  attiva boolean not null default true
);

-- I dati settimanali: una riga per ufficio + settimana + voce
create table rilevazioni (
  ufficio_id    bigint not null references uffici on delete cascade,
  settimana     date not null check (extract(isodow from settimana) = 1),  -- sempre il lunedì
  metrica       text not null references metriche,
  obiettivo     integer check (obiettivo >= 0),
  risultato     integer check (risultato >= 0),
  aggiornato_da text,
  aggiornato_il timestamptz not null default now(),
  primary key (ufficio_id, settimana, metrica)
);
create index rilevazioni_settimana_idx on rilevazioni (settimana);

-- Nota libera della settimana (mostrata in riunione)
create table note_settimana (
  ufficio_id    bigint not null references uffici on delete cascade,
  settimana     date not null check (extract(isodow from settimana) = 1),
  testo         text not null default '' check (length(testo) <= 2000),
  aggiornato_da text,
  aggiornato_il timestamptz not null default now(),
  primary key (ufficio_id, settimana)
);

-- Registro di tutte le modifiche (chi ha cambiato cosa e quando)
create table storico_modifiche (
  id         bigint generated always as identity primary key,
  tabella    text not null,
  operazione text not null,
  ufficio_id bigint,
  settimana  date,
  prima      jsonb,
  dopo       jsonb,
  utente     text,
  quando     timestamptz not null default now()
);
create index storico_ufficio_idx on storico_modifiche (ufficio_id, settimana);


-- ▼▼▼ 002_sicurezza.sql ▼▼▼
-- =====================================================================
-- 002 — SICUREZZA
-- Chi può vedere e modificare cosa. Le regole sono applicate dal
-- database stesso (Row Level Security): valgono anche se qualcuno
-- provasse ad aggirare il sito.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funzioni di supporto: "chi sono io?"
-- (security definer = leggono la tabella utenti senza passare dalle regole,
--  ma restituiscono solo informazioni sull'utente collegato)
-- ---------------------------------------------------------------------

create function email_corrente() returns text
language sql stable
as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create function mio_ruolo() returns text
language sql stable security definer set search_path = public
as $$ select ruolo from utenti where email = email_corrente() and attivo $$;

create function mia_citta() returns smallint
language sql stable security definer set search_path = public
as $$ select citta_id from utenti where email = email_corrente() and attivo $$;

create function sono_admin_generale() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(mio_ruolo() = 'admin_generale', false) $$;

-- Posso amministrare questa città? (admin generale: tutte; admin di città: la sua)
create function gestisco_citta(p_citta smallint) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from utenti me
    where me.email = email_corrente() and me.attivo
      and (me.ruolo = 'admin_generale' or (me.ruolo = 'admin_citta' and me.citta_id = p_citta))
  )
$$;

-- Posso vedere i dati di questo ufficio?
create function posso_leggere_ufficio(p_ufficio bigint) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from utenti me join uffici u on u.id = p_ufficio
    where me.email = email_corrente() and me.attivo
      and (   me.ruolo = 'admin_generale'
           or (me.ruolo = 'admin_citta'  and u.citta_id = me.citta_id)
           or (me.ruolo = 'responsabile' and u.area_id  = me.area_id)
           or me.ufficio_id = p_ufficio)
  )
$$;

-- Posso modificare i dati di questo ufficio? (i responsabili sono in sola lettura sulla loro area)
create function posso_scrivere_ufficio(p_ufficio bigint) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from utenti me join uffici u on u.id = p_ufficio
    where me.email = email_corrente() and me.attivo
      and (   me.ruolo = 'admin_generale'
           or (me.ruolo = 'admin_citta' and u.citta_id = me.citta_id)
           or me.ufficio_id = p_ufficio)
  )
$$;

-- Posso creare/modificare un utente con questo ruolo in questa città?
-- L'admin di città gestisce solo uffici e responsabili della sua città:
-- non può creare amministratori né toccare l'altra città.
create function posso_gestire_utente(p_ruolo text, p_citta smallint) returns boolean
language sql stable security definer set search_path = public
as $$
  select sono_admin_generale()
      or (mio_ruolo() = 'admin_citta'
          and p_citta = mia_citta()
          and p_ruolo in ('ufficio', 'responsabile'))
$$;

-- ---------------------------------------------------------------------
-- Trigger: coerenza dei dati
-- ---------------------------------------------------------------------

-- Email tecnica di accesso a partire dal nome utente (es. somalia → rapportini.gruppo+somalia@gmail.com).
-- Usata dalla pagina di accesso prima del login, per questo è richiamabile anche da "anon":
-- restituisce solo il risultato del modello, senza dire se l'utente esiste.
create function email_di_accesso(p_nome_utente text) returns text
language sql stable security definer set search_path = public
as $$
  select lower(replace(valore, '{utente}', lower(trim(p_nome_utente))))
  from impostazioni where chiave = 'modello_email_accesso'
$$;

-- Utenti: email tecnica generata dal nome utente, città ricavata da ufficio/area,
-- nome utente non modificabile, controlli di coerenza
create function utenti_coerenza() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  c_ufficio smallint;
  c_area    smallint;
begin
  new.nome_utente := lower(trim(new.nome_utente));
  if tg_op = 'INSERT' then
    new.email := coalesce(new.email, email_di_accesso(new.nome_utente));
    if new.email is null then
      raise exception 'Manca il modello dell''email di accesso nelle impostazioni (vedi guida)';
    end if;
  elsif new.nome_utente <> old.nome_utente or new.email <> old.email then
    raise exception 'Il nome utente non si può cambiare: crea un nuovo account';
  end if;
  new.email := lower(trim(new.email));
  new.email_promemoria := nullif(lower(trim(new.email_promemoria)), '');
  if new.ufficio_id is not null then
    select citta_id into c_ufficio from uffici where id = new.ufficio_id;
    new.citta_id := coalesce(new.citta_id, c_ufficio);
    if c_ufficio <> new.citta_id then
      raise exception 'L''ufficio indicato non appartiene alla città dell''utente';
    end if;
  end if;
  if new.area_id is not null then
    select citta_id into c_area from aree where id = new.area_id;
    new.citta_id := coalesce(new.citta_id, c_area);
    if c_area <> new.citta_id then
      raise exception 'L''area indicata non appartiene alla città dell''utente';
    end if;
  end if;
  return new;
end $$;

create trigger utenti_coerenza before insert or update on utenti
for each row execute function utenti_coerenza();

-- Rilevazioni: annota chi ha salvato, ignora i salvataggi senza cambiamenti,
-- e per i dati di zona non tiene l'obiettivo (non ha senso)
create function rilevazioni_prima_del_salvataggio() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.obiettivo is not distinct from old.obiettivo
     and new.risultato is not distinct from old.risultato then
    return null;                                  -- niente di nuovo: non tocca la riga
  end if;
  if (select tipo from metriche where codice = new.metrica) = 'zona' then
    new.obiettivo := null;
  end if;
  new.aggiornato_da := nullif(email_corrente(), '');
  new.aggiornato_il := now();
  return new;
end $$;

create trigger rilevazioni_prima before insert or update on rilevazioni
for each row execute function rilevazioni_prima_del_salvataggio();

create function note_prima_del_salvataggio() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.testo is not distinct from old.testo then
    return null;
  end if;
  new.aggiornato_da := nullif(email_corrente(), '');
  new.aggiornato_il := now();
  return new;
end $$;

create trigger note_prima before insert or update on note_settimana
for each row execute function note_prima_del_salvataggio();

-- Registro delle modifiche
create function registra_modifica() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into storico_modifiche (tabella, operazione, ufficio_id, settimana, prima, dopo, utente)
    values (tg_table_name, tg_op, old.ufficio_id, old.settimana, to_jsonb(old), null, nullif(email_corrente(), ''));
    return old;
  elsif tg_op = 'UPDATE' then
    insert into storico_modifiche (tabella, operazione, ufficio_id, settimana, prima, dopo, utente)
    values (tg_table_name, tg_op, new.ufficio_id, new.settimana, to_jsonb(old), to_jsonb(new), nullif(email_corrente(), ''));
  else
    insert into storico_modifiche (tabella, operazione, ufficio_id, settimana, prima, dopo, utente)
    values (tg_table_name, tg_op, new.ufficio_id, new.settimana, null, to_jsonb(new), nullif(email_corrente(), ''));
  end if;
  return new;
end $$;

create trigger rilevazioni_registro after insert or update or delete on rilevazioni
for each row execute function registra_modifica();
create trigger note_registro after insert or update or delete on note_settimana
for each row execute function registra_modifica();

-- ---------------------------------------------------------------------
-- Regole di accesso (Row Level Security)
-- ---------------------------------------------------------------------

alter table citta             enable row level security;
alter table aree              enable row level security;
alter table uffici            enable row level security;
alter table utenti            enable row level security;
alter table metriche          enable row level security;
alter table rilevazioni       enable row level security;
alter table note_settimana    enable row level security;
alter table storico_modifiche enable row level security;
-- impostazioni e promemoria_inviati: nessuna regola = accesso solo al sistema (chiave di servizio)
alter table impostazioni       enable row level security;
alter table promemoria_inviati enable row level security;

-- Città e voci: leggibili da chiunque sia abilitato; modificabili solo dall'admin generale
create policy citta_lettura on citta for select to authenticated
  using (mio_ruolo() is not null);
create policy citta_gestione on citta for all to authenticated
  using (sono_admin_generale()) with check (sono_admin_generale());

create policy metriche_lettura on metriche for select to authenticated
  using (mio_ruolo() is not null);
create policy metriche_gestione on metriche for all to authenticated
  using (sono_admin_generale()) with check (sono_admin_generale());

-- Aree: visibili a chi è della stessa città; gestite dagli amministratori della città
create policy aree_lettura on aree for select to authenticated
  using (citta_id = mia_citta() or gestisco_citta(citta_id));
create policy aree_gestione on aree for all to authenticated
  using (gestisco_citta(citta_id)) with check (gestisco_citta(citta_id));

-- Uffici: ognuno vede quelli a cui ha accesso; gestiti dagli amministratori della città
create policy uffici_lettura on uffici for select to authenticated
  using (posso_leggere_ufficio(id) or gestisco_citta(citta_id));
create policy uffici_gestione on uffici for all to authenticated
  using (gestisco_citta(citta_id)) with check (gestisco_citta(citta_id));

-- Utenti: ognuno vede sé stesso; gli amministratori vedono e gestiscono la propria città
create policy utenti_lettura on utenti for select to authenticated
  using (email = email_corrente() or gestisco_citta(citta_id));
create policy utenti_inserimento on utenti for insert to authenticated
  with check (posso_gestire_utente(ruolo, citta_id));
create policy utenti_modifica on utenti for update to authenticated
  using (posso_gestire_utente(ruolo, citta_id)) with check (posso_gestire_utente(ruolo, citta_id));
create policy utenti_cancellazione on utenti for delete to authenticated
  using (posso_gestire_utente(ruolo, citta_id));

-- Dati settimanali e note
create policy rilevazioni_lettura on rilevazioni for select to authenticated
  using (posso_leggere_ufficio(ufficio_id));
create policy rilevazioni_inserimento on rilevazioni for insert to authenticated
  with check (posso_scrivere_ufficio(ufficio_id));
create policy rilevazioni_modifica on rilevazioni for update to authenticated
  using (posso_scrivere_ufficio(ufficio_id)) with check (posso_scrivere_ufficio(ufficio_id));
create policy rilevazioni_cancellazione on rilevazioni for delete to authenticated
  using (posso_scrivere_ufficio(ufficio_id));

create policy note_lettura on note_settimana for select to authenticated
  using (posso_leggere_ufficio(ufficio_id));
create policy note_inserimento on note_settimana for insert to authenticated
  with check (posso_scrivere_ufficio(ufficio_id));
create policy note_modifica on note_settimana for update to authenticated
  using (posso_scrivere_ufficio(ufficio_id)) with check (posso_scrivere_ufficio(ufficio_id));
create policy note_cancellazione on note_settimana for delete to authenticated
  using (posso_scrivere_ufficio(ufficio_id));

-- Registro modifiche: solo lettura, per gli amministratori della città dell'ufficio
create policy storico_lettura on storico_modifiche for select to authenticated
  using (exists (select 1 from uffici u where u.id = ufficio_id and gestisco_citta(u.citta_id)));

-- ---------------------------------------------------------------------
-- Permessi di base (le regole sopra filtrano poi riga per riga)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on citta, aree, uffici, metriche, rilevazioni, note_settimana to authenticated;
-- utenti: email tecnica e collegamento all'account (auth_id) li gestisce solo il sistema
revoke all on utenti from authenticated;   -- Supabase di norma concede tutto: qui si restringe
grant select, delete on utenti to authenticated;
grant insert (nome_utente, nome, ruolo, citta_id, ufficio_id, area_id, email_promemoria, attivo) on utenti to authenticated;
grant update (nome, ruolo, citta_id, ufficio_id, area_id, email_promemoria, attivo) on utenti to authenticated;
grant execute on function email_di_accesso(text) to anon, authenticated;
grant select on storico_modifiche to authenticated;


-- ▼▼▼ 003_viste_calcoli.sql ▼▼▼
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


-- ▼▼▼ 004_dati_iniziali.sql ▼▼▼
-- =====================================================================
-- 004 — DATI INIZIALI
-- Città e voci da compilare. Uffici, aree e utenti si aggiungono dopo
-- (vedi docs/GUIDA_SETUP.md).
-- =====================================================================

insert into citta (id, nome) values
  (1, 'Roma'),
  (2, 'Milano');

insert into metriche (codice, nome, tipo, ordine) values
  -- Attività: obiettivo + risultato
  ('app_vendita',       'App.ti Vendita',     'attivita',  1),
  ('proposte',          'Proposte',           'attivita',  2),
  ('incarichi',         'Incarichi',          'attivita',  3),
  ('valutazioni',       'Valutazioni',        'attivita',  4),
  ('vendite',           'Vendite',            'attivita',  5),
  ('ribassi',           'Ribassi',            'attivita',  6),
  ('im3',               'IM3',                'attivita',  7),
  ('piu90',             '+90',                'attivita',  8),
  -- Zona: fotografia della settimana
  ('portafoglio',       'Portafoglio',        'zona',     10),
  ('incarichi_zona',    'Incarichi in zona',  'zona',     11),
  ('contatti_zona',     'Contatti zona',      'zona',     12),
  ('telefoni_mancanti', 'Telefoni mancanti',  'zona',     13),
  ('affittati',         'Affittati',          'zona',     14),
  ('vuoti',             'Vuoti',              'zona',     15);


-- ▼▼▼ 005_mensile.sql ▼▼▼
-- =====================================================================
-- 005 — RAPPORTINO MENSILE
-- Il rapportino di fine mese: ogni ufficio registra il proprio personale
-- (con ruolo e data di inizio) e ogni mese inserisce i numeri di ogni persona.
-- Il totale dell'ufficio, lo staff e il report di gruppo si calcolano da soli.
-- Aggiunge solo tabelle nuove (più due colonne su "uffici"): i dati
-- settimanali non vengono toccati.
-- =====================================================================

-- Posizione dell'ufficio nel report mensile di gruppo, come nel file Excel:
-- blocco 1 = prima tabella, blocco 2 = seconda tabella (Industriale S. Giovanni, Oderisi, …)
alter table uffici
  add column blocco_mensile smallint not null default 1 check (blocco_mensile in (1, 2)),
  add column ordine_mensile smallint check (ordine_mensile > 0);

-- Personale degli uffici. Chi lascia l'ufficio non si cancella: si indica la data di fine,
-- così i suoi numeri dei mesi passati restano (servono anche per i punteggi).
create table persone (
  id            bigint generated always as identity primary key,
  ufficio_id    bigint not null references uffici on delete cascade,
  nome          text not null check (length(trim(nome)) between 1 and 80),
  ruolo         text not null check (ruolo in ('responsabile', 'collaboratore', 'coordinatrice', 'marketer')),
  data_inizio   date not null,
  data_fine     date,
  aggiornato_da text,
  aggiornato_il timestamptz not null default now(),
  check (data_fine is null or data_fine >= data_inizio)
);
create index persone_ufficio_idx on persone (ufficio_id);

-- Le colonne del rapportino mensile (gruppo = intestazione in alto, sotto = vendita/locazione).
-- solo_ruolo: voce che si compila solo per quel ruolo ed è un indicatore a parte:
-- non entra nel totale dell'ufficio, nello stato di compilazione né nel report di gruppo
-- (es. "App. vendita fix" delle coordinatrici, indicatore di qualità).
-- accanto_a: la colonna in cui l'indicatore si mostra come esponente (es. 12⁹ negli appuntamenti vendita).
-- con_punti: la voce conta nella gara a punti dei collaboratori (non conta Gestione incarichi).
-- meglio_se_scende: nel report un aumento è negativo (es. Incarichi scaduti → variazione in rosso).
create table voci_mensili (
  codice           text primary key,
  gruppo           text not null,
  sotto            text,
  ordine           smallint not null,
  solo_ruolo       text check (solo_ruolo in ('responsabile', 'collaboratore', 'coordinatrice', 'marketer')),
  accanto_a        text references voci_mensili,
  con_punti        boolean not null default true,
  meglio_se_scende boolean not null default false,
  attiva           boolean not null default true
);

-- I numeri del mese: una riga per persona + mese + voce.
-- Casella vuota = "non ancora inserito", 0 = zero (come per la settimana).
create table valori_mensili (
  persona_id    bigint not null references persone on delete cascade,
  ufficio_id    bigint not null references uffici on delete cascade,   -- ricavato dalla persona (vedi trigger)
  mese          date not null check (extract(day from mese) = 1),      -- sempre il giorno 1
  voce          text not null references voci_mensili,
  valore        integer check (valore >= 0),
  aggiornato_da text,
  aggiornato_il timestamptz not null default now(),
  primary key (persona_id, mese, voce)
);
create index valori_mensili_mese_idx on valori_mensili (mese, ufficio_id);

-- Totali di gruppo dello stesso mese dell'anno precedente, scritti a mano
-- dall'amministratore generale (per la riga "Variazione" del report).
-- voce = un codice di voci_mensili oppure 'staff'.
create table confronto_anno_prima (
  mese          date not null check (extract(day from mese) = 1),
  voce          text not null check (voce = 'staff' or voce ~ '^[a-z_]+$'),
  valore        integer check (valore >= 0),
  aggiornato_da text,
  aggiornato_il timestamptz not null default now(),
  primary key (mese, voce)
);

-- Gara a punti dei collaboratori: quanti punti vale ogni unità di una voce
-- (es. 1 incarico vendita = 5 punti; può essere negativo, es. incarichi scaduti).
-- Punteggio del mese = somma di (numero × punti). Li decide l'amministratore generale.
create table punti_mensili (
  voce          text primary key references voci_mensili,
  punti         numeric(6, 2) not null,
  aggiornato_da text,
  aggiornato_il timestamptz not null default now()
);

-- Scadenza per inserire i numeri di un mese, decisa dall'amministratore generale.
-- Chi inserisce o modifica dopo la scadenza viene segnalato nel report (si vede da aggiornato_il);
-- con blocca = true, dopo la scadenza gli uffici non possono più scrivere (gli amministratori sì).
create table scadenze_mensili (
  mese          date primary key check (extract(day from mese) = 1),
  scadenza      timestamptz not null,
  blocca        boolean not null default false,
  aggiornato_da text,
  aggiornato_il timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Trigger: coerenza dei dati e chi ha salvato
-- ---------------------------------------------------------------------

-- Persone: nome ripulito, ufficio non modificabile (per spostare una persona
-- si chiude la scheda nel vecchio ufficio e se ne crea una nel nuovo)
create function persone_prima_del_salvataggio() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.nome := regexp_replace(trim(new.nome), '\s+', ' ', 'g');
  if tg_op = 'UPDATE' then
    if new.ufficio_id <> old.ufficio_id then
      raise exception 'Una persona non si può spostare in un altro ufficio: indica la data di fine e creala nel nuovo ufficio';
    end if;
    if (new.nome, new.ruolo, new.data_inizio, new.data_fine) is not distinct from
       (old.nome, old.ruolo, old.data_inizio, old.data_fine) then
      return null;                                  -- niente di nuovo
    end if;
  end if;
  new.aggiornato_da := nullif(email_corrente(), '');
  new.aggiornato_il := now();
  return new;
end $$;

create trigger persone_prima before insert or update on persone
for each row execute function persone_prima_del_salvataggio();

-- Valori: l'ufficio si ricava sempre dalla persona (così nessuno può scrivere
-- numeri di un'altra persona "travestendoli" da propri), le voci riservate a un ruolo
-- si accettano solo per quel ruolo, salvataggi identici ignorati
create function valori_mensili_prima_del_salvataggio() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  riservata text := (select solo_ruolo from voci_mensili where codice = new.voce);
begin
  new.ufficio_id := (select ufficio_id from persone where id = new.persona_id);
  if riservata is not null and riservata <> (select ruolo from persone where id = new.persona_id) then
    raise exception 'La voce % si compila solo per il ruolo %', new.voce, riservata;
  end if;
  if tg_op = 'UPDATE' and new.valore is not distinct from old.valore then
    return null;
  end if;
  -- mese chiuso dall'amministratore: dopo la scadenza scrivono solo gli amministratori della città
  if exists (select 1 from scadenze_mensili s where s.mese = new.mese and s.blocca and now() > s.scadenza)
     and not gestisco_citta((select citta_id from uffici where id = new.ufficio_id)) then
    raise exception 'Inserimento chiuso: la scadenza per questo mese è passata. Per correzioni contatta l''amministratore';
  end if;
  new.aggiornato_da := nullif(email_corrente(), '');
  new.aggiornato_il := now();
  return new;
end $$;

create trigger valori_mensili_prima before insert or update on valori_mensili
for each row execute function valori_mensili_prima_del_salvataggio();

create function confronto_prima_del_salvataggio() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.valore is not distinct from old.valore then
    return null;
  end if;
  new.aggiornato_da := nullif(email_corrente(), '');
  new.aggiornato_il := now();
  return new;
end $$;

create trigger confronto_prima before insert or update on confronto_anno_prima
for each row execute function confronto_prima_del_salvataggio();

-- Punti: solo per le voci che partecipano alla gara (non Gestione incarichi)
create function punti_prima_del_salvataggio() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not coalesce((select con_punti and solo_ruolo is null from voci_mensili where codice = new.voce), false) then
    raise exception 'La voce % non dà punti', new.voce;
  end if;
  new.aggiornato_da := nullif(email_corrente(), '');
  new.aggiornato_il := now();
  return new;
end $$;

create trigger punti_prima before insert or update on punti_mensili
for each row execute function punti_prima_del_salvataggio();

create function scadenze_prima_del_salvataggio() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.aggiornato_da := nullif(email_corrente(), '');
  new.aggiornato_il := now();
  return new;
end $$;

create trigger scadenze_prima before insert or update on scadenze_mensili
for each row execute function scadenze_prima_del_salvataggio();

-- Registro delle modifiche (stessa tabella dei dati settimanali;
-- nella colonna "settimana" si annota il mese)
create function registra_modifica_mensile() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  riga jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into storico_modifiche (tabella, operazione, ufficio_id, settimana, prima, dopo, utente)
  values (tg_table_name, tg_op, (riga ->> 'ufficio_id')::bigint, (riga ->> 'mese')::date,
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end,
          nullif(email_corrente(), ''));
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger persone_registro after insert or update or delete on persone
for each row execute function registra_modifica_mensile();
create trigger valori_mensili_registro after insert or update or delete on valori_mensili
for each row execute function registra_modifica_mensile();
create trigger confronto_registro after insert or update or delete on confronto_anno_prima
for each row execute function registra_modifica_mensile();
create trigger punti_registro after insert or update or delete on punti_mensili
for each row execute function registra_modifica_mensile();
create trigger scadenze_registro after insert or update or delete on scadenze_mensili
for each row execute function registra_modifica_mensile();

-- ---------------------------------------------------------------------
-- Regole di accesso (stesse funzioni dei dati settimanali, 002_sicurezza.sql)
-- ---------------------------------------------------------------------

-- Rapportino mensile "in prova" (Work in progress): finché l'impostazione mensile_aperto
-- non vale 'si', gli uffici non possono scrivere; gli amministratori della città sì, per provarlo.
-- Per aprirlo a tutti: update impostazioni set valore = 'si' where chiave = 'mensile_aperto';
insert into impostazioni (chiave, valore) values ('mensile_aperto', 'no') on conflict (chiave) do nothing;

create function mensile_aperto() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select valore = 'si' from impostazioni where chiave = 'mensile_aperto'), false) $$;

-- Posso scrivere personale e numeri mensili di questo ufficio?
create function posso_scrivere_mensile(p_ufficio bigint) returns boolean
language sql stable security definer set search_path = public
as $$
  select posso_scrivere_ufficio(p_ufficio)
     and (mensile_aperto() or exists (select 1 from uffici u where u.id = p_ufficio and gestisco_citta(u.citta_id)))
$$;

grant execute on function mensile_aperto() to authenticated;

alter table persone              enable row level security;
alter table voci_mensili         enable row level security;
alter table valori_mensili       enable row level security;
alter table confronto_anno_prima enable row level security;
alter table punti_mensili        enable row level security;
alter table scadenze_mensili     enable row level security;

-- Personale e numeri: l'ufficio vede e modifica solo i propri,
-- l'amministratore di città la sua città, l'amministratore generale tutto
create policy persone_lettura on persone for select to authenticated
  using (posso_leggere_ufficio(ufficio_id));
create policy persone_inserimento on persone for insert to authenticated
  with check (posso_scrivere_mensile(ufficio_id));
create policy persone_modifica on persone for update to authenticated
  using (posso_scrivere_mensile(ufficio_id)) with check (posso_scrivere_mensile(ufficio_id));
create policy persone_cancellazione on persone for delete to authenticated
  using (posso_scrivere_mensile(ufficio_id));

create policy valori_mensili_lettura on valori_mensili for select to authenticated
  using (posso_leggere_ufficio(ufficio_id));
create policy valori_mensili_inserimento on valori_mensili for insert to authenticated
  with check (posso_scrivere_mensile(ufficio_id));
create policy valori_mensili_modifica on valori_mensili for update to authenticated
  using (posso_scrivere_mensile(ufficio_id)) with check (posso_scrivere_mensile(ufficio_id));
create policy valori_mensili_cancellazione on valori_mensili for delete to authenticated
  using (posso_scrivere_mensile(ufficio_id));

-- Colonne del rapportino: leggibili da tutti gli abilitati, modificabili dall'amministratore generale
create policy voci_mensili_lettura on voci_mensili for select to authenticated
  using (mio_ruolo() is not null);
create policy voci_mensili_gestione on voci_mensili for all to authenticated
  using (sono_admin_generale()) with check (sono_admin_generale());

-- Confronto con l'anno prima: riguarda il totale di gruppo, quindi solo l'amministratore generale
create policy confronto_gestione on confronto_anno_prima for all to authenticated
  using (sono_admin_generale()) with check (sono_admin_generale());

-- Punti della gara: li vedono gli amministratori, li decide l'amministratore generale
create policy punti_lettura on punti_mensili for select to authenticated
  using (mio_ruolo() in ('admin_generale', 'admin_citta'));
create policy punti_gestione on punti_mensili for all to authenticated
  using (sono_admin_generale()) with check (sono_admin_generale());

-- Scadenze: le vedono tutti (gli uffici devono sapere entro quando compilare), le decide l'amministratore generale
create policy scadenze_lettura on scadenze_mensili for select to authenticated
  using (mio_ruolo() is not null);
create policy scadenze_gestione on scadenze_mensili for all to authenticated
  using (sono_admin_generale()) with check (sono_admin_generale());

revoke all on persone, voci_mensili, valori_mensili, confronto_anno_prima, punti_mensili, scadenze_mensili from anon;
grant select, insert, update, delete on persone, voci_mensili, valori_mensili, confronto_anno_prima, punti_mensili, scadenze_mensili to authenticated;

-- ---------------------------------------------------------------------
-- Le 19 colonne del rapportino (file "Rapportino vuoto NUOVO.xlsx"), più l'indicatore delle coordinatrici.
-- Lo "Staff" non è una colonna da compilare: è il numero di persone, contato in automatico.
-- ---------------------------------------------------------------------
insert into voci_mensili (codice, gruppo, sotto, ordine) values
  ('portafoglio_vendita',    'Portafoglio immobili', 'vendita',    1),
  ('portafoglio_locazione',  'Portafoglio immobili', 'locazione',  2),
  ('acquisizioni',           'Acquisizioni',         null,         3),
  ('appuntamenti_vendita',   'Appuntamenti',         'vendita',    4),
  ('appuntamenti_locazione', 'Appuntamenti',         'locazione',  5),
  ('incarichi_vendita',      'Incarichi',            'vendita',    6),
  ('incarichi_locazione',    'Incarichi',            'locazione',  7),
  ('gestione_incarichi',     'Gestione incarichi',   null,         8),
  ('ribassi',                'Ribassi',              null,         9),
  ('kiron',                  'Kiron',                null,        10),
  ('colloqui',               'Colloqui',             null,        11),
  ('proposte_vendita',       'Proposte',             'vendita',   12),
  ('proposte_locazione',     'Proposte',             'locazione', 13),
  ('accettazioni_vendita',   'Accettazioni',         'vendita',   14),
  ('accettazioni_locazione', 'Accettazioni',         'locazione', 15),
  ('vendite_effettuate',     'Vendite effettuate',   null,        16),
  ('richieste_vendita',      'Richieste',            'vendita',   17),
  ('richieste_locazione',    'Richieste',            'locazione', 18),
  ('incarichi_scaduti',      'Incarichi scaduti',    null,        19);

update voci_mensili set con_punti = false where codice = 'gestione_incarichi';      -- nella gara non dà punti
update voci_mensili set meglio_se_scende = true where codice = 'incarichi_scaduti'; -- se aumentano è un male

-- Indicatore di qualità delle coordinatrici: tra parentesi negli appuntamenti vendita, fuori dai totali
insert into voci_mensili (codice, gruppo, sotto, ordine, solo_ruolo, accanto_a, con_punti) values
  ('appuntamenti_vendita_fix', 'App. vendita fix', null, 50, 'coordinatrice', 'appuntamenti_vendita', false);


-- ▼▼▼ 006_affiliati.sql ▼▼▼
-- =====================================================================
-- 006 — AFFILIATI (account in sola consultazione)
-- Un affiliato vede gli uffici che gli assegna l'amministratore generale,
-- anche di città diverse: dati settimanali e rapportino mensile, senza
-- poter scrivere nulla. Non vede la gara a punti (punti_mensili resta
-- riservata agli amministratori, 005_mensile.sql) né il confronto con l'anno prima.
-- Da eseguire in Supabase → SQL Editor, dopo 001–005. Si può rieseguire senza
-- danni (es. se un primo tentativo si è interrotto a metà): ricrea solo ciò che manca.
-- =====================================================================

-- Nuovo ruolo. citta_id resta obbligatorio: per l'affiliato è la città del primo
-- ufficio assegnato e serve solo all'elenco in Amministrazione.
alter table utenti drop constraint if exists utenti_ruolo_check;
alter table utenti add constraint utenti_ruolo_check
  check (ruolo in ('ufficio', 'responsabile', 'admin_citta', 'admin_generale', 'affiliato'));
-- un affiliato non compila nessun ufficio (posso_scrivere_ufficio guarda ufficio_id)
alter table utenti drop constraint if exists utenti_affiliato_check;
alter table utenti add constraint utenti_affiliato_check
  check (ruolo <> 'affiliato' or (ufficio_id is null and area_id is null));

-- Uffici che ogni affiliato può consultare
create table if not exists uffici_affiliato (
  nome_utente text   not null references utenti (nome_utente) on delete cascade,
  ufficio_id  bigint not null references uffici on delete cascade,
  primary key (nome_utente, ufficio_id)
);

-- Solo gli account con ruolo affiliato possono avere uffici in questa tabella
create or replace function uffici_affiliato_coerenza() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from utenti where nome_utente = new.nome_utente and ruolo = 'affiliato') then
    raise exception 'L''account % non è un affiliato', new.nome_utente;
  end if;
  return new;
end $$;

drop trigger if exists uffici_affiliato_coerenza on uffici_affiliato;
create trigger uffici_affiliato_coerenza before insert or update on uffici_affiliato
for each row execute function uffici_affiliato_coerenza();

-- Posso vedere i dati di questo ufficio? (come in 002_sicurezza.sql, più gli affiliati)
create or replace function posso_leggere_ufficio(p_ufficio bigint) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from utenti me join uffici u on u.id = p_ufficio
    where me.email = email_corrente() and me.attivo
      and (   me.ruolo = 'admin_generale'
           or (me.ruolo = 'admin_citta'  and u.citta_id = me.citta_id)
           or (me.ruolo = 'responsabile' and u.area_id  = me.area_id)
           or (me.ruolo = 'affiliato' and exists (
                 select 1 from uffici_affiliato ua where ua.nome_utente = me.nome_utente and ua.ufficio_id = p_ufficio))
           or me.ufficio_id = p_ufficio)
  )
$$;

-- Regole di accesso: l'affiliato vede i propri uffici, l'amministratore generale li assegna
alter table uffici_affiliato enable row level security;

drop policy if exists uffici_affiliato_lettura on uffici_affiliato;
drop policy if exists uffici_affiliato_gestione on uffici_affiliato;
create policy uffici_affiliato_lettura on uffici_affiliato for select to authenticated
  using (sono_admin_generale()
         or nome_utente = (select nome_utente from utenti where email = email_corrente() and attivo));
create policy uffici_affiliato_gestione on uffici_affiliato for all to authenticated
  using (sono_admin_generale()) with check (sono_admin_generale());

revoke all on uffici_affiliato from anon;
grant select, insert, delete on uffici_affiliato to authenticated;


-- ▼▼▼ 007_quota_mercato.sql ▼▼▼
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


-- ▼▼▼ 008_totali_citta.sql ▼▼▼
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


-- ▼▼▼ 009_storico_mensile.sql ▼▼▼
-- =====================================================================
-- 009 — STORICO MENSILE DAL FILE EXCEL ANNUALE
-- Per i mesi compilati prima della piattaforma (es. gennaio–settembre 2026,
-- dal file "BIGOLI C.E.C. ANNO 2026") c'è solo il TOTALE di ogni ufficio,
-- non il dettaglio persona per persona. Si conserva qui, voce per voce.
-- Il Report mensile lo usa per un ufficio solo nei mesi in cui l'ufficio non ha
-- numeri inseriti persona per persona (src/lib/mensile.ts, totaleConStorico).
-- Lo carica l'amministratore generale (file SQL generato da scripts/importa-mensile-excel.mjs);
-- lo vede chi vede l'ufficio. Da eseguire una volta in Supabase → SQL Editor.
-- Si può rieseguire senza danni.
-- =====================================================================

create table if not exists totali_mensili_storico (
  ufficio_id  bigint not null references uffici on delete cascade,
  mese        date not null check (extract(day from mese) = 1),     -- sempre il giorno 1
  voce        text not null check (voce = 'staff' or voce ~ '^[a-z_]+$'),   -- colonna del rapportino o staff
  valore      integer check (valore >= 0),
  primary key (ufficio_id, mese, voce)
);

alter table totali_mensili_storico enable row level security;

drop policy if exists storico_mensile_lettura on totali_mensili_storico;
drop policy if exists storico_mensile_gestione on totali_mensili_storico;
create policy storico_mensile_lettura on totali_mensili_storico for select to authenticated
  using (posso_leggere_ufficio(ufficio_id));
create policy storico_mensile_gestione on totali_mensili_storico for all to authenticated
  using (sono_admin_generale()) with check (sono_admin_generale());

revoke all on totali_mensili_storico from anon;
grant select, insert, update, delete on totali_mensili_storico to authenticated;


-- ▼▼▼ 010_totali_mensili_citta.sql ▼▼▼
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


-- ▼▼▼ 011_settimane_dal_mensile.sql ▼▼▼
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


-- ▼▼▼ 012_affiliati_compilano.sql ▼▼▼
-- =====================================================================
-- 012 — GLI AFFILIATI INSERISCONO I DATI DEI LORO UFFICI
-- Fino alla 011 gli affiliati erano in sola consultazione. Dal 21/10/2026 (decisione
-- di Davide) inseriscono anche i dati dei loro uffici, così chi è operativo in un ufficio
-- non ha bisogno di un secondo accesso: settimane, note, personale e rapportino mensile,
-- in tutti gli uffici assegnati, con le stesse regole degli uffici (mensile in prova,
-- scadenze, mese chiuso). Gara a punti, confronto con l'anno prima, uffici e account
-- restano dell'amministrazione.
-- Da eseguire una volta in Supabase → SQL Editor, dopo 006. Si può rieseguire senza danni.
-- =====================================================================

-- Posso modificare i dati di questo ufficio? (come in 002_sicurezza.sql, più gli affiliati sui loro uffici)
create or replace function posso_scrivere_ufficio(p_ufficio bigint) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from utenti me join uffici u on u.id = p_ufficio
    where me.email = email_corrente() and me.attivo
      and (   me.ruolo = 'admin_generale'
           or (me.ruolo = 'admin_citta' and u.citta_id = me.citta_id)
           or (me.ruolo = 'affiliato' and exists (
                 select 1 from uffici_affiliato ua where ua.nome_utente = me.nome_utente and ua.ufficio_id = p_ufficio))
           or me.ufficio_id = p_ufficio)
  )
$$;


-- ▼▼▼ 013_nota_tre_caselle.sql ▼▼▼
-- =====================================================================
-- 013 — NOTA DELLA SETTIMANA A TRE CASELLE
-- La nota libera diventa tre caselle brevi (richiesta di Davide, 21/10/2026):
--   bene       → cosa è andato bene
--   difficolta → difficoltà della settimana
--   aiuto      → "mi serve aiuto su…": in risalto in riunione e in Stato compilazione
-- La vecchia colonna "testo" resta: le note già scritte non si perdono e si
-- vedono ancora in riunione. Regole di accesso e registro delle modifiche
-- (002_sicurezza.sql) valgono già sull'intera riga.
-- Da eseguire una volta in Supabase → SQL Editor. Si può rieseguire senza danni.
-- =====================================================================

alter table note_settimana
  add column if not exists bene       text not null default '',
  add column if not exists difficolta text not null default '',
  add column if not exists aiuto      text not null default '';

alter table note_settimana drop constraint if exists note_tre_caselle_lunghezza;
alter table note_settimana add constraint note_tre_caselle_lunghezza
  check (length(bene) <= 1000 and length(difficolta) <= 1000 and length(aiuto) <= 1000);

-- Prima del salvataggio: se non cambia nulla non si tocca la riga (come in 002),
-- ma ora si guardano anche le tre caselle, altrimenti una modifica solo lì andrebbe persa.
create or replace function note_prima_del_salvataggio() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.testo      is not distinct from old.testo
     and new.bene       is not distinct from old.bene
     and new.difficolta is not distinct from old.difficolta
     and new.aiuto      is not distinct from old.aiuto then
    return null;
  end if;
  new.aggiornato_da := nullif(email_corrente(), '');
  new.aggiornato_il := now();
  return new;
end $$;


-- ▼▼▼ 014_posizione_citta.sql ▼▼▼
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


-- ▼▼▼ 015_motivo_fine.sql ▼▼▼
-- =====================================================================
-- 015 — MOTIVO DELLA FINE NEL PERSONALE
-- Non tutti quelli che "finiscono" come collaboratori lasciano il gruppo: alcuni
-- vengono promossi a responsabile (segnalato da Davide, 21/10/2026).
--   motivo_fine = 'uscita'     → ha lasciato il gruppo (conta nel turnover)
--   motivo_fine = 'promozione' → promosso a responsabile (NON conta nel turnover)
--   vuoto                      → come 'uscita' (tutte le fini registrate prima della 015)
-- Si può indicare solo se c'è una data di fine. Le regole di accesso del personale
-- (005_mensile.sql) valgono già sull'intera riga.
-- Da eseguire una volta in Supabase → SQL Editor. Si può rieseguire senza danni.
-- =====================================================================

alter table persone add column if not exists motivo_fine text;

alter table persone drop constraint if exists persone_motivo_fine;
alter table persone add constraint persone_motivo_fine
  check (motivo_fine is null or (motivo_fine in ('uscita', 'promozione') and data_fine is not null));

-- Prima del salvataggio (come in 005): ora anche un cambio del solo motivo è una modifica,
-- e se la data di fine viene tolta si toglie anche il motivo.
create or replace function persone_prima_del_salvataggio() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.nome := regexp_replace(trim(new.nome), '\s+', ' ', 'g');
  if new.data_fine is null then
    new.motivo_fine := null;
  end if;
  if tg_op = 'UPDATE' then
    if new.ufficio_id <> old.ufficio_id then
      raise exception 'Una persona non si può spostare in un altro ufficio: indica la data di fine e creala nel nuovo ufficio';
    end if;
    if (new.nome, new.ruolo, new.data_inizio, new.data_fine, new.motivo_fine) is not distinct from
       (old.nome, old.ruolo, old.data_inizio, old.data_fine, old.motivo_fine) then
      return null;                                  -- niente di nuovo
    end if;
  end if;
  new.aggiornato_da := nullif(email_corrente(), '');
  new.aggiornato_il := now();
  return new;
end $$;


-- ▼▼▼ 016_storico_voce_per_voce.sql ▼▼▼
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


-- ▼▼▼ 017_ruolo_da_definire_trasferimenti.sql ▼▼▼
-- =====================================================================
-- 017 — RUOLO DA DEFINIRE E TRASFERIMENTI
-- Caricando i rapportini mensili degli uffici (scansioni, persona per persona):
--   ruolo = 'da_definire'          → persona del rapportino di cui il foglio non dice il ruolo
--                                    (decisione di Davide, 22/10/2026: si definirà con gli altri mesi);
--                                    conta nello staff e nei totali, non nella gara a punti
--   motivo_fine = 'trasferimento'  → passata a un altro ufficio del gruppo: la scheda nel vecchio
--                                    ufficio si chiude e se ne apre una nel nuovo (l'ufficio di una
--                                    persona non si cambia, vedi 005). Come la promozione, NON conta
--                                    nel turnover.
-- Da eseguire una volta in Supabase → SQL Editor, dopo la 016. Si può rieseguire senza danni.
-- =====================================================================

alter table persone drop constraint if exists persone_ruolo_check;
alter table persone add constraint persone_ruolo_check
  check (ruolo in ('responsabile', 'collaboratore', 'coordinatrice', 'marketer', 'da_definire'));

alter table persone drop constraint if exists persone_motivo_fine;
alter table persone add constraint persone_motivo_fine
  check (motivo_fine is null or (motivo_fine in ('uscita', 'promozione', 'trasferimento') and data_fine is not null));


-- ▼▼▼ 018_uscite_nel_mese_report_uffici_locazioni.sql ▼▼▼
-- =====================================================================
-- 018 — CHI ESCE NEL MESE, REPORT DI GRUPPO PER GLI UFFICI, LOCAZIONI EFFETTUATE
-- Richieste di Davide del 26/10/2026, per il report mensile da ottobre 2026:
--
-- 1. Chi lascia l'ufficio durante il mese: i suoi numeri di quel mese RESTANO nei totali
--    dell'ufficio, ma non conta nello staff (che resta: in servizio a fine mese) né nella gara.
--    "Presente nel mese" = iniziato entro la fine del mese e finito DOPO il 1° del mese
--    (chi finisce il 1° non ha lavorato nel mese). Si riscrivono le funzioni della 016.
--
-- 2. Report mensile del gruppo per gli uffici: dopo la scadenza con il blocco (fissata
--    dall'amministratore in Report mensile → Panoramica) ogni ufficio può vedere e stampare
--    il report di tutto il gruppo, con la sua riga in giallo: funzione report_gruppo_mensile.
--
-- 3. Locazioni effettuate: voce "riservata" della gara a punti dei collaboratori. La scrive
--    solo l'amministratore generale (Report mensile → Personale → Liste con i numeri); la
--    leggono solo gli amministratori; non è una colonna del rapportino né dei totali.
--    Numeri nella tabella valori_riservati (non in valori_mensili: così i totali non cambiano).
--
-- Da eseguire una volta in Supabase → SQL Editor, dopo la 017. Si può rieseguire senza danni.
-- =====================================================================

-- ---------------------------------------------------------------- 3a. voce riservata
alter table voci_mensili add column if not exists riservata boolean not null default false;
insert into voci_mensili (codice, gruppo, sotto, ordine, con_punti, riservata)
values ('locazioni_effettuate', 'Locazioni effettuate', null, 60, true, true)
on conflict (codice) do update set riservata = true, con_punti = true;

-- ---------------------------------------------------------------- 1. totali con chi è uscito nel mese
create or replace function totale_mensile_ufficio(p_ufficio bigint, p_mese date)
returns table (voce text, valore bigint)
language sql stable security definer set search_path = public
as $$
  with fine as (select (p_mese + interval '1 month' - interval '1 day')::date as d),
  calcolati as (
    select v.voce, sum(v.valore)::bigint as valore
    from valori_mensili v join persone p on p.id = v.persona_id
    where v.ufficio_id = p_ufficio and v.mese = p_mese and v.valore is not null
      -- presente nel mese: anche chi è uscito durante il mese (018)
      and p.data_inizio <= (select d from fine) and (p.data_fine is null or p.data_fine > p_mese)
      and v.voce in (select codice from voci_mensili where attiva and solo_ruolo is null and not riservata)
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
  posizione        int,
  voce             text,
  valore           bigint,
  uffici_con_dato  int,
  uffici_con_dati  int,
  variazione       bigint,
  confrontati      int,
  uffici_citta     int
)
language sql stable security definer set search_path = public
as $$
  with mia as (
    select u.citta_id from utenti me join uffici u on u.id = me.ufficio_id
    where me.email = email_corrente() and me.attivo and me.ruolo = 'ufficio'
  ),
  uff as (select id from uffici where attivo and citta_id = (select citta_id from mia)),
  mesi as (
    select i as posizione, p_mesi[i] as mese, (p_mesi[i] + interval '1 month' - interval '1 day')::date as fine
    from generate_subscripts(p_mesi, 1) as i
  ),
  colonne as (select codice from voci_mensili where attiva and solo_ruolo is null and not riservata),
  -- staff: in servizio a fine mese
  in_servizio as (
    select m.posizione, m.mese, p.id as persona_id, p.ufficio_id
    from mesi m join persone p on p.data_inizio <= m.fine and (p.data_fine is null or p.data_fine > m.fine)
    where p.ufficio_id in (select id from uff)
  ),
  -- numeri: tutti i presenti nel mese, anche chi è uscito durante il mese (018)
  presenti as (
    select m.posizione, m.mese, p.id as persona_id, p.ufficio_id
    from mesi m join persone p on p.data_inizio <= m.fine and (p.data_fine is null or p.data_fine > m.mese)
    where p.ufficio_id in (select id from uff)
  ),
  calcolati as (
    select s.posizione, s.ufficio_id, v.voce, sum(v.valore) as valore
    from presenti s
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
  con_numeri as (select distinct posizione, ufficio_id from per_ufficio where voce <> 'staff' and valore is not null),
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
  periodo          int,
  voce             text,
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
  colonne as (select codice from voci_mensili where attiva and solo_ruolo is null and not riservata),
  in_servizio as (
    select m.periodo, m.mese, p.id as persona_id, p.ufficio_id
    from mesi m join persone p on p.data_inizio <= m.fine and (p.data_fine is null or p.data_fine > m.fine)
    where p.ufficio_id in (select id from uff)
  ),
  presenti as (
    select m.periodo, m.mese, p.id as persona_id, p.ufficio_id
    from mesi m join persone p on p.data_inizio <= m.fine and (p.data_fine is null or p.data_fine > m.mese)
    where p.ufficio_id in (select id from uff)
  ),
  calcolati as (
    select s.periodo, s.ufficio_id, v.voce, sum(v.valore) as valore
    from presenti s
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

-- ---------------------------------------------------------------- 2. report di gruppo per gli uffici
-- Il report di tutto il gruppo di un mese, ufficio per ufficio (voci e staff), come nella Panoramica
-- degli amministratori. Per chiunque abbia un account attivo, ma solo DOPO la scadenza con il blocco:
-- prima, gli uffici vedono solo i propri numeri. Staff: le persone in servizio a fine mese; se l'ufficio
-- non ha numeri persona per persona, il totale (staff compreso) del file Excel annuale.
create or replace function report_gruppo_mensile(p_mese date)
returns table (ufficio_id bigint, nome text, citta_id smallint, blocco_mensile smallint, ordine_mensile int, voce text, valore bigint)
language sql stable security definer set search_path = public
as $$
  with permesso as (
    select 1 from utenti me where me.email = email_corrente() and me.attivo
      and exists (select 1 from scadenze_mensili s where s.mese = p_mese and s.blocca and now() > s.scadenza)
  ),
  fine as (select (p_mese + interval '1 month' - interval '1 day')::date as d),
  uff as (select u.* from uffici u where u.attivo and exists (select 1 from permesso)),
  numeri as (
    select u.id as ufficio_id, t.voce, t.valore
    from uff u cross join lateral totale_mensile_ufficio(u.id, p_mese) t
  ),
  -- numeri persona per persona nel mese (non solo dal file annuale)
  con_numeri as (
    select distinct v.ufficio_id from valori_mensili v
    where v.mese = p_mese and v.valore is not null and v.ufficio_id in (select id from uff)
      and v.voce in (select codice from voci_mensili where attiva and solo_ruolo is null and not riservata)
  ),
  staff as (
    select u.id as ufficio_id, 'staff'::text as voce,
      case when u.id in (select ufficio_id from con_numeri)
                  or not exists (select 1 from totali_mensili_storico t where t.ufficio_id = u.id and t.mese = p_mese)
           then nullif((select count(*) from persone p where p.ufficio_id = u.id and p.data_inizio <= (select d from fine)
                        and (p.data_fine is null or p.data_fine > (select d from fine))), 0)
           else (select t.valore::bigint from totali_mensili_storico t where t.ufficio_id = u.id and t.mese = p_mese and t.voce = 'staff')
      end as valore
    from uff u
  ),
  righe as (select * from numeri union all select * from staff)
  select u.id, u.nome, u.citta_id, u.blocco_mensile, u.ordine_mensile::int, r.voce, r.valore
  from uff u left join righe r on r.ufficio_id = u.id
  order by u.id, r.voce
$$;

revoke all on function report_gruppo_mensile(date) from public, anon;
grant execute on function report_gruppo_mensile(date) to authenticated;

-- ---------------------------------------------------------------- 3b. numeri riservati (locazioni effettuate)
create table if not exists valori_riservati (
  persona_id    bigint not null references persone on delete cascade,
  ufficio_id    bigint not null references uffici on delete cascade,   -- ricavato dalla persona (trigger)
  mese          date not null check (extract(day from mese) = 1),
  voce          text not null references voci_mensili,
  valore        integer check (valore >= 0),
  aggiornato_da text,
  aggiornato_il timestamptz not null default now(),
  primary key (persona_id, mese, voce)
);
create index if not exists valori_riservati_mese_idx on valori_riservati (mese, ufficio_id);

create or replace function valori_riservati_prima_del_salvataggio() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not coalesce((select riservata from voci_mensili where codice = new.voce), false) then
    raise exception 'La voce % non è una voce riservata: va nel rapportino mensile', new.voce;
  end if;
  new.ufficio_id := (select ufficio_id from persone where id = new.persona_id);
  if tg_op = 'UPDATE' and new.valore is not distinct from old.valore then
    return null;
  end if;
  new.aggiornato_da := nullif(email_corrente(), '');
  new.aggiornato_il := now();
  return new;
end $$;

drop trigger if exists valori_riservati_prima on valori_riservati;
create trigger valori_riservati_prima before insert or update on valori_riservati
for each row execute function valori_riservati_prima_del_salvataggio();
drop trigger if exists valori_riservati_registro on valori_riservati;
create trigger valori_riservati_registro after insert or update or delete on valori_riservati
for each row execute function registra_modifica_mensile();

alter table valori_riservati enable row level security;
-- leggono gli amministratori (il punteggio della gara lo vedono tutti loro), scrive solo l'amministratore generale
drop policy if exists riservati_lettura on valori_riservati;
create policy riservati_lettura on valori_riservati for select to authenticated
  using (exists (select 1 from uffici u where u.id = ufficio_id and gestisco_citta(u.citta_id)));
drop policy if exists riservati_gestione on valori_riservati;
create policy riservati_gestione on valori_riservati for all to authenticated
  using (sono_admin_generale()) with check (sono_admin_generale());
revoke all on valori_riservati from anon;
grant select, insert, update, delete on valori_riservati to authenticated;

-- le voci riservate non si scrivono nel rapportino degli uffici (valori_mensili)
create or replace function valori_mensili_prima_del_salvataggio() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  riservata text := (select solo_ruolo from voci_mensili where codice = new.voce);
begin
  if coalesce((select v.riservata from voci_mensili v where v.codice = new.voce), false) then
    raise exception 'La voce % è riservata all''amministrazione', new.voce;
  end if;
  new.ufficio_id := (select ufficio_id from persone where id = new.persona_id);
  if riservata is not null and riservata <> (select ruolo from persone where id = new.persona_id) then
    raise exception 'La voce % si compila solo per il ruolo %', new.voce, riservata;
  end if;
  if tg_op = 'UPDATE' and new.valore is not distinct from old.valore then
    return null;
  end if;
  -- mese chiuso dall'amministratore: dopo la scadenza scrivono solo gli amministratori della città
  if exists (select 1 from scadenze_mensili s where s.mese = new.mese and s.blocca and now() > s.scadenza)
     and not gestisco_citta((select citta_id from uffici where id = new.ufficio_id)) then
    raise exception 'Inserimento chiuso: la scadenza per questo mese è passata. Per correzioni contatta l''amministratore';
  end if;
  new.aggiornato_da := nullif(email_corrente(), '');
  new.aggiornato_il := now();
  return new;
end $$;
