# Storia delle versioni

## 0.5.2 — 15 ottobre 2026

**Promemoria via email** (si attivano quando si completa il passo 8 di `docs/GUIDA_SETUP.md`):
- **rapportino settimanale**: restano le email del venerdì alle 16 e della domenica alle 10 agli uffici che non hanno inserito nulla. **Tolto il riepilogo del lunedì** agli amministratori (decisione di Davide);
- **rapportino mensile** (nuovo), sempre alle 10:
  - 3 giorni prima e il giorno prima della scadenza, agli uffici che non hanno ancora inserito nulla nel mese. L'email dice entro quando compilare e se dopo la scadenza l'inserimento si chiude;
  - il giorno dopo la scadenza, il riepilogo solo all'amministratore generale, città per città: uffici senza dati, rapportini incompleti e inserimenti arrivati dopo la scadenza;
  - la scadenza è quella fissata in Report mensile → Panoramica. Se un mese non ha una scadenza, non partono promemoria. Se la scadenza viene spostata, i promemoria ripartono per la nuova data;
  - non parte nulla finché il mensile è in prova ("Work in progress").
- Prova manuale da GitHub (Actions → Promemoria → Run workflow): nuovi tipi `mensile_3giorni`, `mensile_vigilia` e `mensile_riepilogo`, e campo *mese*.
- Il pulsante nelle email ha il blu della piattaforma.
- Nel riquadro "Scadenza" del Report mensile, una riga spiega quando partono i promemoria. Compare quando i promemoria sono attivi.
- Nessuna modifica al database.

## 0.5.1 — 14 ottobre 2026

- **Riepilogo anno** (Report mensile → Riepilogo anno), per la riunione di chiusura dell'anno a gennaio:
  - **totali dell'anno per ufficio**: stessa tabella della Panoramica (ordine e due tabelle del file di gruppo); ogni voce è la somma dei mesi, con il totale di gruppo. Lo staff è quello dell'ultimo mese. Accanto all'ufficio compare "n mesi su N" se non ha compilato tutti i mesi;
  - **andamento mese per mese**: il totale di gruppo di ogni mese, da gennaio, e il totale dell'anno;
  - per l'anno in corso si sommano solo i mesi conclusi (es. gennaio – settembre);
  - si stampa con la stessa grafica delle altre schede.
- Le stesse regole del mese: chi esce dall'ufficio non conta nel mese in cui esce; App. vendita fix e Gestione incarichi restano come nel report.

## 0.5.0 — 14 ottobre 2026 (rapportino mensile, "Work in progress")

**Rapportino mensile**, al posto del file Excel che gli uffici mandano per email a fine mese.

**Online in prova ("Work in progress")**:
- gli uffici vedono "Inserisci mese" con una fascia "Work in progress" e tutte le caselle bloccate. Lo impedisce anche il database: finché il mensile non è aperto, gli uffici non possono scrivere;
- gli amministratori possono già provarlo e vedere il report con gli uffici veri nell'ordine del file;
- per aprirlo agli uffici basta in Supabase → SQL Editor: `update impostazioni set valore = 'si' where chiave = 'mensile_aperto';`. Non serve ripubblicare il sito: la fascia sparisce e le caselle si sbloccano da sole.

- **Inserisci mese** (uffici, e amministratori che compilano):
  - una riga per persona, con le stesse 19 colonne del file "Rapportino vuoto NUOVO" (portafoglio, acquisizioni, appuntamenti, incarichi, … incarichi scaduti), vendita e locazione separate;
  - totale dell'ufficio e **staff** (numero di persone in servizio nel mese) calcolati da soli;
  - si apre sul mese appena concluso; con Invio si passa alla casella sotto, come in Excel.
- **Personale dell'ufficio**: nome, ruolo (responsabile, collaboratore, coordinatrice, marketer) e **data di inizio**.
  - Si inserisce una volta e vale per tutti i mesi.
  - Chi lascia l'ufficio si chiude con "Ha lasciato": i suoi numeri passati restano.
- **Report mensile** (amministratori), con tre schede:
  - **Panoramica**: il riepilogo di gruppo come il file "Modello rapportino mensile gruppo", Roma e Milano insieme, uffici **nell'ordine del file** e nelle sue due tabelle. In fondo ci sono il totale, la riga dello stesso mese dell'anno prima (scritta a mano dall'amministratore generale) e la variazione %. Sopra la tabella, quanti uffici hanno compilato (completi, parziali, mancanti);
  - **Singoli rapportini**: il rapportino di ogni ufficio, persona per persona;
  - **Personale**: liste separate di collaboratori, coordinatrici e marketer, con ufficio, data di inizio, anzianità e numeri del mese. Per i collaboratori c'è anche il punteggio della gara (vedi sotto).
  - **Scheda punteggi** (Personale → Scheda punteggi): solo i collaboratori, con nome, ufficio, data di inizio, punteggio e una colonna "Annotazioni" vuota da compilare a penna. Si stampa in A4 verticale, con righe alte; il punteggio più alto è in giallo.
  - Pulsante **Stampa**, con caratteri grandi come negli Excel:
    - report e liste su A4 orizzontale; il report di gruppo con 47 uffici occupa 2 pagine e ripete titolo e intestazioni in cima alla seconda;
    - le tabelle sono larghe esattamente quanto il foglio, così il browser non le rimpicciolisce.
  - **Veste grafica delle stampe** (cambia solo l'aspetto):
    - intestazione con marchio, titolo, mese, note e data di stampa, ripetuta su ogni pagina;
    - righe delle intestazioni in blu scuro, sottovoci (vend./loc.) in blu medio;
    - righe alternate per seguire i numeri, gruppi del rapportino in arancio chiaro, totale in blu con testo bianco;
    - piè di pagina con "Pagina X di Y";
    - nella scheda punteggi una linea spessa a ogni cambio di ufficio e, in fondo, gli spazi per "Compilata da" e "Data";
    - nel report di gruppo, in alto a destra solo la data di stampa;
    - in "Usciti nell'anno" il riepilogo va sotto la tabella.
- L'amministratore di città vede solo la sua città, l'ufficio solo il proprio rapportino. Le regole sono nel database e sono verificate dai test automatici.
- **Cambi di personale evidenziati**: nel rapportino, nel riquadro del personale e nelle liste, chi entra nel mese ha la riga **verde** ("Nuovo ingresso dal …") e chi lascia l'ufficio nel mese la riga **rossa** ("Ha lasciato il …"). Anche in stampa.
- **App. vendita fix** delle coordinatrici: si scrive nell'angolo in alto a destra della stessa casella degli Appuntamenti vendita, che resta grande come le altre, solo sulla riga delle coordinatrici, e si legge come esponente: 12⁹ = 12 appuntamenti, 9 fix. È un indicatore di qualità: non entra nel totale dell'ufficio, nello stato di compilazione né nel report di gruppo. Compare nel rapportino dell'ufficio e nella lista delle coordinatrici; nel backup Excel ha una colonna sua.
- **Gara a punti dei collaboratori** (Report mensile → Personale):
  - tabella "Come si ottengono i punti": i punti di ogni voce, tranne Gestione incarichi. Si accettano decimali (2,5) e numeri negativi (es. -3 per ogni incarico scaduto). Li decide l'amministratore generale; l'amministratore di città li vede soltanto;
  - punteggio del mese = numero × punti, sommati su tutte le voci;
  - la lista Collaboratori resta in ordine di ufficio; la riga di chi ha il **punteggio più alto del mese** (su tutto il gruppo) è **gialla**, con la scritta "★ Punteggio più alto del mese". A pari punti si evidenziano entrambi;
  - coordinatrici e marketer non partecipano e non hanno la colonna Punteggio;
  - in stampa, sotto la lista, sono elencati i punti usati.
- **Chi lascia l'ufficio in un mese non conta in quel mese**: niente riga nel rapportino, totali, staff, liste né gara. Nel rapportino dell'ufficio compare al suo posto un avviso rosso ("Ha lasciato l'ufficio nel mese: …"), che non c'è invece nelle liste e nella scheda punteggi dell'amministratore; i numeri dei mesi precedenti restano. Il pulsante "Ha lasciato" propone la data di oggi.
- **Usciti nell'anno** (Personale → Usciti nell'anno), per il turnover:
  - tutte le persone uscite nell'anno scelto, con ruolo, ufficio, data di inizio, data di uscita e anzianità all'uscita, raggruppate per mese: a sinistra una casella con il nome del mese in verticale e una linea spessa tra un mese e l'altro;
  - riepilogo: numero di uscite, persone in servizio al 1° gennaio, tasso di uscita (uscite ÷ in servizio al 1° gennaio), anzianità media all'uscita e uscite per ruolo;
  - si stampa in A4 verticale.
- **Scadenza di inserimento** (Report mensile → Panoramica, solo l'amministratore generale):
  - per ogni mese si fissano data e ora; la proposta è il 5 del mese dopo alle 23:59;
  - chi inserisce o modifica dopo la scadenza viene segnalato: elenco "In ritardo" con data e ora, ed etichetta "in ritardo" accanto all'ufficio. C'è anche l'elenco di chi manca ancora;
  - casella "Dopo la scadenza blocca l'inserimento agli uffici": a scadenza passata gli uffici non possono più scrivere (lo impedisce il database), gli amministratori sì;
  - gli uffici vedono in "Inserisci mese" entro quando compilare, e dopo la scadenza un avviso (in ritardo oppure inserimento chiuso).
- "Funzionario" diventa **collaboratore** in tutto il rapportino mensile.
- Nel report di gruppo la variazione degli **incarichi scaduti** ha i colori invertiti: se aumentano è in rosso.
- **Amministrazione → Uffici**: tabella (1ª o 2ª) e posizione di ogni ufficio nel report mensile.
- **Backup in Excel**: due fogli in più, "Mensile" e "Personale".
- Il menu "Inserisci settimana / Inserisci mese" e le voci un po' più strette, così il menu degli amministratori sta su una riga.
- Nota: nel file Excel di gruppo la formula del TOTALE non contava Villa Lais; la piattaforma conta tutti gli uffici.
- Database: nuovo file `supabase/migrations/005_mensile.sql`, che aggiunge solo tabelle nuove (`persone`, `voci_mensili`, `valori_mensili`, `confronto_anno_prima`) e due colonne su `uffici`.

## 0.4.2 — 14 ottobre 2026

- **Amministratori di città che sono anche un ufficio** (Beato Angelico e Ticinese a Milano):
  - il loro ufficio non compare più tra gli "Uffici senza account";
  - ricevono i promemoria del proprio ufficio;
  - "Inserisci settimana" si apre sul proprio ufficio invece che sul primo della lista.

## 0.4.1 — 13 ottobre 2026

- **Backup in Excel** (Amministrazione → Backup, solo per l'amministratore generale). Scarica un file `.xlsx` con tutti i dati di Roma e Milano:
  - un foglio per ufficio, impostato come i vecchi rapportini: mesi uno sotto l'altro, 5 settimane con obiettivo, risultato ed esito, totale del mese, dati di zona, quota di mercato e note. Esiti, totali e quota sono formule, come negli Excel di partenza;
  - "Dati": tutti i valori, uno per riga, con chi li ha modificati e quando;
  - "Note", "Uffici" e "Account" (senza password).
- Il file si crea nel browser. La libreria Excel si scarica solo quando si preme il pulsante, quindi il sito non diventa più lento.

## 0.4.0 — 13 ottobre 2026 (nuova grafica)

- **Nuova veste grafica** dal design scelto da Davide (`docs/DESIGN.md`): colori blu e arancio, caratteri Manrope e Bricolage Grotesque, card bianche, icone e semaforo verde/ambra/rosso con i simboli ✓ ≈ ✗.
- **Testata nuova**: selettore Roma/Milano a pillola, settimana da compilare, quanti uffici hanno compilato (per un ufficio: lo stato della sua settimana), utente con iniziali, menu a schede con icone.
- **Accesso** su due colonne, con il pulsante per vedere la password.
- **Cruscotto** con riquadri, percentuale e barra colorata; riga del totale città in blu.
- **Riunione** ridisegnata:
  - copertina con anello e mosaico degli uffici;
  - tabellone dei totali con barre, confronto con la settimana scorsa e mini-andamento;
  - classifiche a barre;
  - pagina di ogni ufficio con riquadri e valori scritti sui grafici.
- Grafici ridisegnati (area azzurra, obiettivo arancio tratteggiato), senza più la libreria Chart.js.
- Numeri e barre si animano all'apertura di una pagina (non per chi ha chiesto meno animazioni al sistema).
- Le conferme usano una finestra del sito invece di quella del browser. Dopo il salvataggio compare il messaggio "Dati salvati alle…".
- I promemoria email non sono ancora annunciati nel sito (testata, pagina di accesso, stato compilazione). Si attivano con `PROMEMORIA_ATTIVI = true` in `src/lib/contesto.ts`, dopo il passo 8 della guida.
- Nessuna modifica a database, permessi e calcoli.

## 0.3.2 — 13 ottobre 2026

- **Storico ricaricato con le regole delle settimane ricavate dai file.** La regola "1ª settimana = dal giorno 1 alla prima domenica" non corrispondeva a come compilavano quasi tutti gli uffici: in febbraio, marzo e maggio 46–47 uffici hanno riempito la "1ª settimana" con numeri da settimana intera.
  - Regola standard: la 1ª settimana è la prima settimana intera (lun-dom col giovedì nel mese).
  - Se un ufficio ha compilato una settimana in più a fine mese, quella slitta alla settimana seguente insieme al mese dopo. Riguarda 10 uffici, tra cui Montesacro, Jonio, Prati delle Vittorie e Imm. Conca D'Oro.
  - Lanciani usa la regola "dal giorno 1 alla prima domenica" (`import/regole.json`).
  - Ora 33 uffici su 47 hanno la settimana 5–11 ottobre (prima 26). Gli altri 14 non l'avevano ancora compilata negli Excel salvati il 12/10.
- Nuovo `scripts/ricarica-storico.mjs`: sostituisce i dati importati dagli Excel senza toccare quelli inseriti sulla piattaforma.
- La piattaforma ricarica l'elenco degli uffici quando si torna sulla sua scheda del browser.
- **Obiettivi ripresi dalla settimana precedente**: in una settimana nuova gli obiettivi sono già compilati con quelli dell'ultima settimana che li aveva, con un avviso, e restano modificabili prima di salvare.

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
