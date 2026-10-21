-- =====================================================================
-- 012 — GLI AFFILIATI INSERISCONO I DATI DEI LORO UFFICI
-- Fino alla 011 gli affiliati erano in sola consultazione. Dal 21/10/2026 (decisione
-- di Davide) inseriscono anche i dati dei loro uffici, così chi è operativo in un ufficio
-- non ha bisogno di un secondo accesso: settimane, note, personale e rapportino mensile,
-- in tutti gli uffici assegnati, con le stesse regole degli uffici (mensile in prova,
-- scadenze, mese chiuso). Gara a punti, confronto con l'anno prima, uffici e account
-- restano dell'amministrazione.
-- Da eseguire una volta in Supabase → SQL Editor, dopo 006. Si può rieseguire senza danni.
-- =====================================================================

-- Posso modificare i dati di questo ufficio? (come in 002_sicurezza.sql, più gli affiliati sui loro uffici)
create or replace function posso_scrivere_ufficio(p_ufficio bigint) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from utenti me join uffici u on u.id = p_ufficio
    where me.email = email_corrente() and me.attivo
      and (   me.ruolo = 'admin_generale'
           or (me.ruolo = 'admin_citta' and u.citta_id = me.citta_id)
           or (me.ruolo = 'affiliato' and exists (
                 select 1 from uffici_affiliato ua where ua.nome_utente = me.nome_utente and ua.ufficio_id = p_ufficio))
           or me.ufficio_id = p_ufficio)
  )
$$;
