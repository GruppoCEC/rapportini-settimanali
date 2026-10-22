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
