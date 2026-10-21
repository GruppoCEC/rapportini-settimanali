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
