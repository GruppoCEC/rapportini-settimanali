-- FILE GENERATO AUTOMATICAMENTE da scripts/unisci-sql.mjs — non modificarlo a mano.
-- Contiene, in ordine: 001_tabelle.sql, 002_sicurezza.sql, 003_viste_calcoli.sql, 004_dati_iniziali.sql
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
