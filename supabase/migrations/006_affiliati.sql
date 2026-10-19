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
