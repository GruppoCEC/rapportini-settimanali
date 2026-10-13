# Storia delle versioni

## 0.3.2 — 13 ottobre 2026

- **Storico ricaricato con le regole delle settimane ricavate dai file.** La regola "1ª settimana = dal giorno 1 alla prima domenica" non corrispondeva a come compilavano quasi tutti gli uffici: in febbraio, marzo e maggio 46–47 uffici hanno riempito la "1ª settimana" con numeri da settimana intera.
  - Regola standard: la 1ª settimana è la prima settimana intera (lun-dom col giovedì nel mese).
  - Se un ufficio ha compilato una settimana in più a fine mese, quella slitta alla settimana seguente insieme al mese dopo. Riguarda 10 uffici, tra cui Montesacro, Jonio, Prati delle Vittorie e Imm. Conca D'Oro.
  - Lanciani usa la regola "dal giorno 1 alla prima domenica" (`import/regole.json`).
  - Ora 33 uffici su 47 hanno la settimana 5–11 ottobre (prima 26). Gli altri 14 non l'avevano ancora compilata negli Excel salvati il 12/10.
- Nuovo `scripts/ricarica-storico.mjs`: sostituisce i dati importati dagli Excel senza toccare quelli inseriti sulla piattaforma.
- La piattaforma ricarica l'elenco degli uffici quando si torna sulla sua scheda del browser.

## 0.3.1 — 13 ottobre 2026

- **Account degli uffici creati in blocco** con `node scripts/crea-account.mjs`: 47 account, uno per ufficio. Prima fa un giro di prova, gli account già esistenti vengono saltati, e scrive le credenziali in `import/CREDENZIALI.csv`, che resta solo sul Mac. 37 uffici hanno l'email per i promemoria.

- **Aree e responsabili d'area disattivati** su richiesta di Davide: spariscono da cruscotto, stato compilazione, riunione e amministrazione. Nel database restano: per riattivarli basta impostare `AREE_ATTIVE = true` in `src/lib/contesto.ts`.
- **Riunione, pagina di ogni ufficio**: 9 grafici di andamento delle ultime 8 settimane (le 8 attività più la quota di mercato), con risultato e obiettivo. Si adattano all'altezza dello schermo e stanno in una schermata sia su un proiettore Full HD sia su un portatile 1366×768.
- Cruscotto e riunione si aprono sull'**ultima settimana conclusa** e non più su quella in corso, ancora da compilare.

## 0.3.0 — 13 ottobre 2026 (Fase 5: import dello storico)

`node scripts/importa-storico.mjs` legge gli Excel in `import/<Città> <anno>/` e prepara `import/REPORT_IMPORT.md` e `import/sql/IMPORTA_n.sql`, senza toccare il database.

Gestisce:
- colonne spostate;
- mesi scritti come testo o come data;
- tabelle senza nome del mese;
- tabelle ripetute;
- file che contengono due anni (si tiene l'ultimo);
- etichette fantasma;
- dati di zona nella colonna sbagliata;
- valori testuali tipo "1 box";
- 12 modi diversi di scrivere "+90".

Inoltre:
- si importano solo le settimane concluse (quelle future sono avanzi del 2025);
- i file quasi identici vengono esclusi;
- i dati già presenti sulla piattaforma non vengono mai sovrascritti;
- i file SQL si possono rieseguire senza creare doppioni.

Settimane:
- regola dell'Excel indicata da Davide: la 1ª settimana va dal giorno 1 alla prima domenica;
- le settimane spezzate tra due mesi si riuniscono nella settimana lunedì–domenica della piattaforma;
- regole particolari in `import/regole.json`: Imm. Garbatella solo da ottobre, Espero con le tabelle 2025 sovrascritte;
- la riga "In contatto" viene ignorata.

Piattaforma: le settimane non sono più numerate ("2ª settimana di ottobre") ma indicate con le date ("Settimana 5 – 11 ottobre 2026"). Per le settimane a cavallo di due mesi compare in quale mese contano nei totali.

## 0.2.0 — 12 ottobre 2026 (Fasi 3 e 4: codice pronto)

**Accesso cambiato su richiesta di Davide**: nome utente e password per ogni ufficio, al posto del link via email.
- Gli account si creano da **Amministrazione**:
  - password proposta in automatico e da copiare per l'ufficio;
  - nuova password e disattivazione;
  - ognuno può cambiarsi la password dalla pagina *Il mio account*.
- Funzione Supabase `gestione-account` per creare, reimpostare ed eliminare gli account. Ogni operazione è verificata con le regole di accesso di chi la chiede.
- Iscrizioni libere disattivate; tolto il blocco all'iscrizione basato sull'email, non più necessario.
- Nuovo campo **email per i promemoria** per ogni account.

Nuove pagine:
- **Andamento uffici / Il mio ufficio**: grafico delle ultime 12 settimane (attività o quota di mercato) e riepilogo degli ultimi 6 mesi.
- **Cruscotto**:
  - settimana o mese, filtro per area;
  - riquadri con i totali della città;
  - tabella uffici × attività con semaforo e totali per area e città;
  - confronto tra aree con la media per ufficio;
  - andamento della città;
  - Roma e Milano a confronto, solo per l'amministratore generale.
- **Stato compilazione**: completi, parziali e mancanti, ultimo salvataggio, email per i promemoria, copia delle email di chi manca.
- **Riunione**, presentazione a tutto schermo con le frecce della tastiera:
  - copertina;
  - totali con confronto sulla settimana precedente;
  - classifiche con i valori sulle barre;
  - quota di mercato;
  - confronto tra aree;
  - una pagina per ufficio con andamento e note.
- **Amministrazione**: account, uffici (aggiungi, rinomina, area, disattiva) e aree.

Promemoria automatici con GitHub Actions e Gmail:
- venerdì alle 16 e domenica alle 10 agli uffici mancanti;
- lunedì alle 7:30 il riepilogo agli amministratori di ogni città;
- ogni promemoria parte una sola volta, con gestione dell'ora legale;
- invio di prova verso un indirizzo a scelta.

Altre novità:
- **Versione dimostrativa** (`npm run demo`) con 17 uffici inventati tra Roma e Milano e 14 settimane di dati.
- Guida per i colleghi: `docs/GUIDA_COLLEGHI.md`.
- 50 test automatici.

## 0.1.0 — 12 ottobre 2026 (Fasi 1 e 2: codice pronto)

- Struttura del progetto: sito React + TypeScript e pubblicazione automatica su GitHub Pages, eseguita solo se i test passano.
- Database Supabase:
  - città (Roma, Milano), aree, uffici, utenti, voci, dati settimanali, note, registro modifiche;
  - regole di accesso per ufficio, responsabile d'area, amministratore di città e amministratore generale.
- Calcoli automatici: esito, totali del mese (attività sommate, dati di zona = ultima settimana) e quota di mercato.
- Pagina **Inserisci settimana**:
  - attività con obiettivo, risultato ed esito colorato;
  - dati di zona proposti dalla settimana precedente;
  - quota di mercato calcolata mentre si scrive;
  - note.
