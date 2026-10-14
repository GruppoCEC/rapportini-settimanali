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
