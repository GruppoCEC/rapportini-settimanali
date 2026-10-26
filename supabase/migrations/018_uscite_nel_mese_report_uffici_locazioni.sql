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
