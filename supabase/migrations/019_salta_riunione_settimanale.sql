-- =====================================================================
-- 019 — SALTA LA RIUNIONE SETTIMANALE NELLA SETTIMANA DI FINE MESE
-- Richiesta di Davide del 26/10/2026: quando la riunione di fine mese è troppo vicina al lunedì
-- (es. martedì 3 novembre 2026), la riunione settimanale di quel lunedì salta. Lo decide
-- l'amministratore generale mese per mese, con una casella accanto alla scadenza del mensile
-- (Report mensile → Panoramica).
--
-- Il lunedì che salta è quello più vicino al giorno della scadenza: della stessa settimana se la
-- riunione è da lunedì a giovedì, quello dopo se è da venerdì a domenica (regola in
-- scripts/promemoria-calendario.mjs e src/lib/mensile.ts). Quel lunedì non parte il promemoria
-- settimanale; il sabato prima parte lo stesso, senza nominare la riunione del lunedì.
--
-- Si esegue una volta in Supabase → SQL Editor; si può rieseguire senza danni.
-- =====================================================================

alter table scadenze_mensili add column if not exists salta_lunedi boolean not null default false;

comment on column scadenze_mensili.salta_lunedi is
  'La riunione settimanale del lunedì più vicino alla scadenza non c''è: niente promemoria settimanale quel lunedì';
