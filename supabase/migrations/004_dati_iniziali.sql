-- =====================================================================
-- 004 — DATI INIZIALI
-- Città e voci da compilare. Uffici, aree e utenti si aggiungono dopo
-- (vedi docs/GUIDA_SETUP.md).
-- =====================================================================

insert into citta (id, nome) values
  (1, 'Roma'),
  (2, 'Milano');

insert into metriche (codice, nome, tipo, ordine) values
  -- Attività: obiettivo + risultato
  ('app_vendita',       'App.ti Vendita',     'attivita',  1),
  ('proposte',          'Proposte',           'attivita',  2),
  ('incarichi',         'Incarichi',          'attivita',  3),
  ('valutazioni',       'Valutazioni',        'attivita',  4),
  ('vendite',           'Vendite',            'attivita',  5),
  ('ribassi',           'Ribassi',            'attivita',  6),
  ('im3',               'IM3',                'attivita',  7),
  ('piu90',             '+90',                'attivita',  8),
  -- Zona: fotografia della settimana
  ('portafoglio',       'Portafoglio',        'zona',     10),
  ('incarichi_zona',    'Incarichi in zona',  'zona',     11),
  ('contatti_zona',     'Contatti zona',      'zona',     12),
  ('telefoni_mancanti', 'Telefoni mancanti',  'zona',     13),
  ('affittati',         'Affittati',          'zona',     14),
  ('vuoti',             'Vuoti',              'zona',     15);
