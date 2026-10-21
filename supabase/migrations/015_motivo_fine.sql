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
