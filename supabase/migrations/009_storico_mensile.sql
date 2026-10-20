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
