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
