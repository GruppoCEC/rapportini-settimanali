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
