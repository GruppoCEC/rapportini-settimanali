# Storia delle versioni

## 0.23.1 — 26 ottobre 2026

**Imbuto della vendita con pochi casi** (segnalato da Davide: nelle pagine dei singoli uffici della presentazione, il passaggio proposte → vendite era quasi sempre vuoto e si vedeva solo quello di Roma):
- **causa**: non è un errore di calcolo. Un passaggio si calcola solo con almeno 5 casi nella fase di partenza, e nelle ultime 4 settimane (28/9–25/10) **solo 5 uffici su 47** avevano almeno 5 proposte; per gli altri compariva "—", con accanto il valore di Roma;
- **ora**, con meno di 5 casi, al posto del "—" si vedono **i numeri veri**: *"2 su 3 · pochi casi"* (nell'imbuto grande: *"2 vendite su 3 proposte (pochi casi)"*), in grigio e **senza** il confronto verde/arancio con Roma, perché un rapporto su 2–3 casi sarebbe casuale. Da 5 casi in su resta *"1 vendita ogni N proposte"*, colorato. Vale nella presentazione (settimana e mese), nella tabella ufficio per ufficio del mese e in Il mio ufficio;
- la presentazione del **mese** calcola già l'imbuto sugli **ultimi 3 mesi** (il mese presentato e i due prima);
- nessuna modifica al database: basta pubblicare (Push).

## 0.23.0 — 26 ottobre 2026

**La riunione settimanale che salta per la riunione di fine mese** (richiesta di Davide: martedì 3 novembre c'è la riunione di fine mese, quindi lunedì 2 novembre non c'è quella settimanale):
- in **Report mensile → Panoramica**, accanto alla scadenza, c'è la casella **"Salta la riunione settimanale di lunedì …"**. Si spunta mese per mese, quando la riunione di fine mese è troppo vicina al lunedì. Il lunedì è quello più vicino al giorno della scadenza: quello della stessa settimana se la riunione è da lunedì a giovedì, quello dopo se è da venerdì a domenica (la data si legge accanto alla casella);
- con la casella spuntata, **quel lunedì non parte il promemoria settimanale** ("Oggi c'è la riunione…"); **il sabato prima** l'email parte lo stesso, ma dice *"Lunedì … non c'è la riunione settimanale, ma vi chiediamo di inserirli comunque appena possibile"*. I dati della settimana si inseriscono come sempre;
- i promemoria del mensile e l'ultima chiamata non cambiano; mandato a mano (Run workflow → `lunedi`), il promemoria del lunedì parte comunque;
- **da fare una volta in Supabase**: eseguire `supabase/migrations/019_salta_riunione_settimanale.sql`, poi pubblicare (Push), poi spuntare la casella per ottobre. Provato con le prove automatiche (196) e nella demo.

## 0.22.0 — 26 ottobre 2026

**Ultima chiamata del rapportino mensile** (richiesta di Davide):
- **30 minuti prima della scadenza**, se la scadenza ha il **blocco**, gli uffici che non hanno ancora inserito nulla ricevono l'email *"Ultimi 30 minuti: rapportino di …"*: "inseritelo entro le …, dopo l'inserimento dei dati sarà bloccato". Fissando la scadenza alle 10:00 del giorno della riunione, l'email arriva alle 9:30;
- la avvia l'orologio di Supabase: controlla ogni 5 minuti e chiede a GitHub di partire solo mezz'ora prima di una scadenza con il blocco (file `supabase/PROMEMORIA_PUNTUALI.sql`, aggiornato: non ancora eseguito, va bene così);
- si può anche mandare a mano: Actions → Promemoria → Run workflow → `mensile_ultima_chiamata`;
- le voci riservate (Locazioni effettuate, 0.21.0) non contano per dire se un rapportino è completo;
- in Report mensile → Panoramica, sotto la scadenza, il testo dei promemoria lo dice;
- nessuna modifica al database oltre a `PROMEMORIA_PUNTUALI.sql`; i promemoria mensili partono solo con il mensile aperto agli uffici.

## 0.21.0 — 26 ottobre 2026

**Report mensile pronto per ottobre** (richieste di Davide):
- **chi lascia l'ufficio durante il mese** resta nel rapportino di quel mese, con la riga **rossa** e la scritta "Ha lasciato il …": i suoi numeri **contano nel totale dell'ufficio**, ma **non nello staff** (che resta: chi c'è a fine mese) e **non nella gara a punti**. Vale in Inserisci mese, nel Report mensile (Panoramica, Singoli rapportini, Personale, Collaboratori), nelle presentazioni e nei totali della città. Chi finisce il 1° del mese non ha lavorato nel mese e non compare;
- **report del gruppo per gli uffici**: quando la scadenza del mese (Report mensile → Panoramica) ha il **blocco** ed è passata, in **Inserisci mese**, in cima alla pagina, ogni ufficio vede il report di tutto il gruppo, con la **sua riga evidenziata in giallo** (senza scritte), e lo stampa col pulsante **Stampa il report del gruppo** (si stampa solo il report). Prima del blocco gli uffici continuano a vedere solo i propri numeri;
- **Locazioni effettuate**: in **Report mensile → Personale → Liste con i numeri**, nella lista dei collaboratori, c'è la colonna *Locazioni effettuate*, che **vede e compila solo l'amministratore generale** (pulsante *Salva* nel riquadro sopra le liste). Ha la sua voce di punti in *Come si ottengono i punti* e conta sempre nel punteggio della gara (anche nella Scheda punteggi e nella scheda Collaboratori); non entra nei totali degli uffici e gli uffici non la vedono;
- **da fare una volta in Supabase**: eseguire `supabase/migrations/018_uscite_nel_mese_report_uffici_locazioni.sql`, poi pubblicare (Push). Provato con le prove automatiche (189) e nella demo (report del gruppo stampato con la riga in giallo; 2 locazioni a 4 punti: punteggio da 108 a 116).

## 0.20.0 — 26 ottobre 2026

**Promemoria puntuali** (segnalato da Davide: questa settimana non erano arrivati):
- **causa**: GitHub fa partire le azioni programmate anche con ore di ritardo. Sabato 24/10 il promemoria è partito alle 14:32, fuori dall'orario, e lo script non ha inviato niente; dal 18/10 arrivava una sola esecuzione al giorno, verso le 14–15. Lunedì 26/10 Davide l'ha mandato a mano alle 9:02 (27 email);
- **orologio di Supabase**: da ora è il database (pg_cron) ad avviare i promemoria agli orari giusti, chiedendo a GitHub di partire subito, come il pulsante *Run workflow*: ogni giorno alle 10 (più un tentativo alle 11) e il lunedì alle 9:30 (più un tentativo alle 10:15). Lo script decide se in quel momento tocca un promemoria e ogni email parte una volta sola. Gli orari di GitHub restano come riserva;
- nel workflow c'è il nuovo tipo **automatico** (quello usato da Supabase); a mano si continua a scegliere `sabato`, `lunedi`, ecc.;
- **il sabato** il promemoria può partire fino alle **15:00** (prima fino alle 13): gli uffici chiudono verso quell'ora (Davide);
- **da fare una volta**, in quest'ordine: pubblicare (Push); creare la chiave di GitHub e metterla nel Vault di Supabase; eseguire `supabase/PROMEMORIA_PUNTUALI.sql`; provarla. Passo per passo in `docs/GUIDA_SETUP.md`, Passo 8 → *Orologio di Supabase*.

## 0.19.2 — 23 ottobre 2026

**Stampa della scheda della persona su una pagina** (segnalato da Davide: il grafico finiva tagliato sulla pagina dopo):
- in **Report mensile → Collaboratori → Scheda della persona**, la stampa mette **tabella e grafico sulla stessa pagina**, anche con 12 mesi: il grafico è più basso e largo, le righe della tabella sono più strette e, oltre gli 8 mesi, la tabella si rimpicciolisce un poco;
- in stampa al posto del menu della voce c'è il suo nome nel titolo del grafico ("Andamento mese per mese · incarichi vendita");
- provato stampando in PDF con Chrome dalla demo, con 6 e con 12 mesi; le altre stampe non cambiano;
- nessuna modifica al database: basta pubblicare (Push).

## 0.19.1 — 23 ottobre 2026

**Scheda della persona: anche il fix delle coordinatrici** (richiesta di Davide):
- in **Report mensile → Collaboratori → Scheda della persona**, per le coordinatrici il numero piccolo in alto negli appuntamenti vendita (il fix) compare anche nelle righe in fondo: nel **Totale** è la somma dei mesi, in **Media al mese** e in **Media coordinatrici** è la media al mese (per i colleghi: tra le coordinatrici in servizio che l'hanno scritto, negli stessi mesi);
- nessuna modifica al database: basta pubblicare (Push).

## 0.19.0 — 22 ottobre 2026

**Rapportini mensili degli uffici, persona per persona** (scansioni dei mesi del 2026, decisioni di Davide):
- **file annuale voce per voce**: quando un ufficio ha i numeri persona per persona, una voce che nessuno ha scritto prende il valore del file annuale. Serve per le **vendite effettuate**, che i fogli degli uffici non hanno. Lo staff resta quello delle persone in servizio;
- **ruolo da definire**: nel personale c'è il nuovo ruolo *Ruolo da definire*, per le persone del rapportino di cui il foglio non dice il ruolo. Nel rapportino del mese compaiono in un gruppo a parte (solo se ce ne sono), contano nello staff e nei totali, non nella gara a punti. L'ufficio sceglie il ruolo giusto da **Inserisci mese → Personale → Modifica**;
- **trasferito in un altro ufficio**: nuovo motivo della fine, accanto a *Ha lasciato il gruppo* e *Promosso a responsabile*. Come la promozione **non conta nel turnover**; chi arriva così nel nuovo ufficio non entra nella curva dei nuovi né tra i nuovi entrati;
- gennaio 2026: file `import/sql/MENSILE_UFFICI_2026-01.sql` (solo sul Mac) con 119 persone nuove (responsabili, coordinatrici, marketer…, col nome come nel foglio e inizio il 1° gennaio 2026), le correzioni dei periodi di Emanuel Stefan, Arianna Sapia e Martina Cogliandro e 866 numeri di 38 uffici. I 7 uffici con differenze nel foglio non sono caricati: per loro resta il file annuale. Provato su una copia del database: 36 uffici su 38 tornano col file annuale voce per voce e nello staff;
- **da fare una volta in Supabase**, in questo ordine: `supabase/migrations/016_storico_voce_per_voce.sql`, `supabase/migrations/017_ruolo_da_definire_trasferimenti.sql`, poi `import/sql/MENSILE_UFFICI_2026-01.sql`, poi pubblicare (Push).

## 0.18.0 — 21 ottobre 2026

**Promossi a responsabile: non sono uscite** (segnalato da Davide):
- nel personale si indica il **motivo della fine**: *Ha lasciato il gruppo* oppure *Promosso a responsabile*. Si sceglie in **Inserisci mese → Personale**, premendo *Ha lasciato* o *Modifica*, sotto la data di fine;
- chi è promosso non conta nel mese della promozione (come chi esce), ma **non è un'uscita**: in **Usciti nell'anno** non entra nelle uscite, nel tasso di uscita né nell'anzianità media; compare in un riquadro a parte, **Promossi a responsabile**, e tra i numeri in alto;
- nel rapportino del mese la riga di chi è promosso non è rossa: ha l'etichetta "Promosso a responsabile il…";
- nella scheda Collaboratori si legge "promosso a responsabile il…" invece di "uscita il…";
- storico: Davide ha indicato 10 collaboratori promossi tra il 2024 e il 2026 (file `import/sql/PROMOSSI.sql`, solo sul Mac);
- **da fare una volta in Supabase**, in questo ordine: eseguire `supabase/migrations/015_motivo_fine.sql`, poi `import/sql/PROMOSSI.sql`, poi pubblicare (Push). Senza la 015 il sito funziona come prima.

## 0.17.0 — 21 ottobre 2026

**Segnali della settimana** (punto 3.3.11 dell'analisi, scelte di Davide): invece di guardare tutti gli uffici, la piattaforma indica quelli in cui qualcosa cambia davvero. **Solo per l'amministrazione.**
- tre tipi di segnale, scelti da Davide:
  - **calo prolungato**: un'attività sotto la media dell'ufficio in tutte le ultime 4 settimane, in media almeno del 20%;
  - **fuori dal solito**: la settimana è molto più bassa del normale oscillare di *quell'*ufficio (oltre 2 volte la sua oscillazione abituale);
  - **buone notizie**: lo stesso al contrario (crescita da 4 settimane, settimana molto sopra il solito);
- ogni ufficio è confrontato **con se stesso**, sulle sue 12 settimane prima, non con gli altri uffici;
- per non dare falsi allarmi: servono almeno 8 settimane inserite dall'ufficio; le voci molto piccole (media sotto 2 a settimana) non danno segnali; **le settimane completate dal rapportino mensile non contano**, perché divise in parti uguali (il sito continua a non evidenziarle); IM3 e +90 non sono considerati;
- dove si vedono:
  - **Riunione** (settimana): nuova pagina **Segnali della settimana** dopo l'imbuto, con "Da seguire" a sinistra e "Buone notizie" a destra (i primi 8 uffici per esteso, gli altri per nome);
  - **Cruscotto** (settimana): riquadro **Segnali della settimana** sotto i numeri principali (i primi 6 uffici per esteso);
- nessuna modifica al database: basta pubblicare (Push).

## 0.16.1 — 21 ottobre 2026

**IM3 e +90 fuori da classifiche e posizioni** (decisione di Davide: per ora non si considerano):
- nella **Riunione** settimanale non ci sono più le classifiche di IM3 e +90 (restano 3 pagine di classifiche: App.ti vendita e Proposte, Incarichi e Valutazioni, Vendite e Ribassi);
- nella pagina **La tua posizione** e nel riquadro di **Il mio ufficio** non compaiono più;
- si continuano a inserire e si vedono nei totali, nel cruscotto e nelle pagine degli uffici;
- **Ribassi**: confermato da Davide che più se ne fanno meglio è, quindi resta in classifica dal numero più alto (come prima);
- nessuna modifica al database: basta pubblicare (Push).

## 0.16.0 — 21 ottobre 2026

**Scheda del collaboratore e curva dei nuovi** (richiesta di Davide, punti 2.2.6 e 2.2.7 dell'analisi), **solo per gli amministratori** (più avanti forse anche per gli affiliati). Nel **Report mensile** c'è la nuova scheda **Collaboratori**, con due viste:
- **Scheda della persona**: si sceglie l'ufficio e la persona (anche chi è uscito). Mostra ruolo, ufficio, data di inizio e anzianità; i suoi numeri mese per mese negli ultimi 12 mesi (fino al mese scelto in alto), il totale, la **media al mese** in verde se è almeno come la media degli altri con lo stesso ruolo negli stessi mesi e in rosso se è sotto (incarichi scaduti al contrario); per i collaboratori il **punteggio della gara** di ogni mese, in giallo se è stato il più alto del mese. Sotto, il grafico di una voce a scelta con la linea della media dei colleghi. Con **Stampa** si ottiene la scheda da usare nel colloquio individuale;
- **Curva dei nuovi**: per il 1°, 2°… 12° mese di servizio, la media di una voce a scelta (all'inizio Incarichi vendita) dei collaboratori in quel mese di servizio; un punto compare solo con almeno 3 persone. Sotto, i **collaboratori entrati negli ultimi 12 mesi** con il loro numero mese di servizio per mese di servizio: in **arancio** i mesi "da seguire", sotto la metà della media dei collaboratori nello stesso mese di servizio;
- usano solo i numeri inseriti **persona per persona** sulla piattaforma: lo storico del file Excel ha solo i totali degli uffici, quindi all'inizio i mesi saranno pochi e la curva si riempirà con i prossimi rapportini mensili;
- nel totale della scheda, staff e portafoglio sono quelli dell'ultimo mese (non si sommano, come nel Riepilogo anno);
- grafici: con numeri piccoli l'asse mostra un decimale (prima poteva ripetere "1" due volte);
- nessuna modifica al database: basta pubblicare (Push).

## 0.15.0 — 21 ottobre 2026

**Posizione dell'ufficio nella sua città** (richiesta di Davide, punto 2.4.12 dell'analisi): ogni ufficio vede dove si trova tra gli uffici di Roma o di Milano, voce per voce, **senza vedere i nomi né i numeri degli altri**.
- per ogni voce: la **posizione** ("8° su 31"), il **colore** del quarto della città in cui si trova (verde scuro il primo quarto, verde il secondo, giallo il terzo, arancio l'ultimo; senza scritta, scelta di Davide) e la **freccia** rispetto al periodo prima ("▲ 3 posizioni");
- conta solo chi ha il dato; a pari numero, pari posizione (10, 8, 8, 5 → 1°, 2°, 2°, 4°). Il primo è sempre nel primo quarto, l'ultimo nell'ultimo;
- nella **Presentazione dell'ufficio**, dopo "Totali · Tutta Roma/Milano", la pagina **La tua posizione a Roma** (o Milano):
  - settimana: le attività del rapportino settimanale e la quota di mercato;
  - mese: le 6 voci delle classifiche mensili (acquisizioni, appuntamenti, incarichi, proposte, accettazioni, vendite effettuate);
- in **Il mio ufficio**, sotto l'imbuto, il riquadro **La tua posizione a Roma** per l'ultima settimana conclusa;
- solo per gli account **ufficio**: amministratori e affiliati hanno già le classifiche complete nella Riunione e nella Presentazione;
- il database manda a ogni ufficio **solo la propria riga** (nuove funzioni `posizione_mia_citta` e `posizione_mensile_mia_citta`, stessa protezione dei totali della città);
- **Imbuto nella presentazione settimanale**: tolta la pagina "Imbuto della vendita · ufficio per ufficio", che ripeteva l'imbuto già presente nella pagina di ogni ufficio (segnalato da Davide). Resta nel mese, dove non ci sono pagine per ufficio;
- **da fare una volta in Supabase**: eseguire `supabase/migrations/014_posizione_citta.sql`, poi pubblicare (Push). Senza la 014 la pagina e il riquadro semplicemente non compaiono.

## 0.14.0 — 21 ottobre 2026

**Imbuto della vendita** (richiesta di Davide, punto 2.1.1 dell'analisi): le fasi dalla valutazione alla vendita e i **passaggi** tra una fase e l'altra, sempre nella forma **"1 incarico ogni 3,9 valutazioni"** (scelta di Davide, al posto delle percentuali).
- con i **rapportini settimanali**: Valutazioni → Incarichi → App.ti vendita → Proposte → Vendite, sulle **ultime 4 settimane**;
- con i **rapportini mensili**: Acquisizioni → Incarichi vendita → Appuntamenti vendita → Proposte vendita → Accettazioni vendita → Vendite effettuate, sugli **ultimi 3 mesi**;
- passaggi: 1 incarico ogni N valutazioni (acquisizioni nel mese), 1 proposta ogni N appuntamenti, 1 accettazione ogni N proposte, 1 vendita ogni N accettazioni (nella settimana: 1 vendita ogni N proposte). Meno ne servono, meglio è. Tra incarichi e appuntamenti non c'è un passaggio: non sono la stessa trattativa;
- si guardano più settimane o mesi insieme perché le fasi si contano nello stesso periodo (un'accettazione di oggi può diventare vendita più avanti). Un passaggio si calcola solo con **almeno 5 casi** nella fase di partenza, altrimenti compare "—";
- **Riunione e Presentazione** (settimana e mese), dopo i totali:
  - amministratori e affiliati: l'imbuto della città (o dei propri uffici) e una pagina **ufficio per ufficio** con i passaggi in verde se almeno come il totale, in arancio se sotto;
  - ufficio: il suo imbuto accanto a quello di **tutta la sua città** (solo le somme, come la pagina "Tutta Roma/Milano"), con i passaggi colorati rispetto alla città;
  - nella **settimana**, anche la pagina di **ogni ufficio** ha in fondo il suo imbuto in una riga, colorato rispetto alla città (o al totale dei propri uffici). Nel mese, dove non ci sono pagine per ufficio, resta la tabella "ufficio per ufficio" (decisione di Davide);
- **Il mio ufficio / Andamento uffici**: nuovo riquadro **Imbuto della vendita**, in cima alla pagina, con i pulsanti *Ultime 4 settimane* e *Ultimi 3 mesi* (mesi e settimane già conclusi). Per un ufficio c'è anche l'imbuto di tutta la città;
- corretto: in "Il mio ufficio" la frase sotto il grafico diceva per esempio "Settimane dal 4 a oggi", senza il mese;
- nessuna modifica al database: basta pubblicare (Push).

## 0.13.0 — 21 ottobre 2026

**Nota della settimana a tre caselle** (richiesta di Davide, punto 2.1.4 dell'analisi):
- in **Inserisci settimana** la nota libera diventa tre caselle brevi: **Cosa è andato bene**, **Difficoltà**, **Mi serve aiuto su…** (quest'ultima in arancio). Tutte facoltative, fino a 1000 caratteri ciascuna;
- le note già scritte non si perdono: se una settimana ha la vecchia nota, compare sopra le caselle in sola lettura e si vede ancora in riunione;
- in **riunione** (e nella Presentazione) la pagina dell'ufficio mostra le tre caselle con il loro nome; **Mi serve aiuto** è su sfondo arancio;
- in **Stato compilazione** gli amministratori trovano il riquadro **Richieste di aiuto**: gli uffici che hanno scritto in "Mi serve aiuto su…" in quella settimana, con il testo. Se nessuno chiede aiuto, il riquadro non c'è;
- il **backup in Excel** ha una colonna per ogni casella nel foglio Note; nei fogli degli uffici le caselle sono una sotto l'altra;
- **da fare una volta in Supabase**: eseguire `supabase/migrations/013_nota_tre_caselle.sql`, poi pubblicare (Push). Senza la 013 il sito continua a mostrare le vecchie note, ma le tre caselle non si possono salvare.

## 0.12.0 — 21 ottobre 2026

**Gli affiliati inseriscono i dati dei loro uffici** (richiesta di Davide: chi è operativo in un ufficio non deve avere un secondo accesso):
- gli account **affiliato** non sono più in sola consultazione: inseriscono i dati settimanali (con la nota) e il rapportino mensile (con il personale) in **tutti** gli uffici assegnati, anche di Roma e Milano insieme;
- valgono le stesse regole degli uffici: mensile in prova ("Work in progress"), scadenze, mese chiuso dopo la scadenza;
- nel menu dell'affiliato compaiono **Inserisci settimana** e **Inserisci mese**, con la scelta dell'ufficio in alto; nella testata vede quanti dei suoi uffici hanno compilato;
- il ruolo ora si chiama semplicemente **Affiliato**;
- restano solo all'amministrazione: gara a punti, confronto con l'anno prima, uffici, account e Stato compilazione. I promemoria continuano ad arrivare agli uffici, non agli affiliati;
- **da fare una volta in Supabase**: eseguire `supabase/migrations/012_affiliati_compilano.sql`, poi pubblicare.

## 0.11.1 — 21 ottobre 2026

**Inserisci settimana: niente avviso "Modifiche non salvate" per i soli suggerimenti** (segnalato da Davide):
- aprendo una settimana senza obiettivi o dati di zona (per esempio quelle completate dal rapportino mensile), la pagina propone quelli della settimana prima. Prima questi suggerimenti contavano come modifiche: cambiando settimana compariva "Hai modifiche non salvate. Vuoi abbandonarle?" anche senza aver scritto nulla;
- ora l'avviso compare solo se si scrive qualcosa. **Salva** resta attivo, per salvare i suggerimenti così come sono.

## 0.11.0 — 21 ottobre 2026

**Settimane vuote completate dal rapportino mensile** (richiesta di Davide):
- quando a un ufficio mancano dei numeri settimanali, il database li inserisce da solo nelle settimane vuote, così che la somma delle settimane del mese sia uguale al rapportino mensile;
- voci collegate (decise da Davide):

  | Settimanale | Mensile |
  |---|---|
  | App.ti Vendita | Appuntamenti vendita |
  | Proposte | Proposte vendita |
  | Incarichi | Incarichi vendita |
  | Valutazioni | Acquisizioni |
  | Vendite | Vendite effettuate |
  | Ribassi | Ribassi |

  Portafoglio, IM3, +90 e gli altri dati di zona non si toccano;
- la differenza tra il mensile e le settimane già compilate si divide **in parti uguali** tra le settimane vuote (i resti alle prime). Le settimane scritte dall'ufficio non si toccano mai; gli obiettivi restano com'erano;
- è **automatico**, anche in futuro: si ricalcola quando cambia il rapportino mensile o lo storico Excel, e quando un ufficio scrive una settimana (le altre vuote si aggiustano). Solo per i mesi già finiti;
- se le settimane superano già il mensile, non si inserisce nulla;
- i numeri inseriti così non sono evidenziati nel sito (decisione di Davide). Il database li riconosce solo per ricalcolarli e perché **non fermino i promemoria**: un ufficio senza numeri suoi in una settimana viene comunque avvisato;
- i promemoria (sabato e lunedì) ricalcolano anche i mesi appena finiti, per quando il mensile è stato inserito prima della fine dell'ultima settimana;
- prova sui dati veri (storico gennaio–settembre): circa 8.400 caselle completate, e in ogni ufficio e mese la somma delle settimane è uguale al mensile;
- **da fare una volta in Supabase**: eseguire `supabase/migrations/011_settimane_dal_mensile.sql`, poi pubblicare (Push).

## 0.10.1 — 21 ottobre 2026

**Riepilogo anno: staff e portafoglio non si sommano più** (richiesta di Davide):
- staff, portafoglio immobili vendita e portafoglio immobili locazione dicono quante persone e quanti immobili ci sono, non cosa si è fatto nel mese: sommarli sui mesi dava numeri fuorvianti;
- nel **Riepilogo anno** per ogni ufficio vale il dato dell'**ultimo mese in cui ha inserito il rapportino**; il totale del gruppo è la somma di questi dati (come il portafoglio nei rapportini settimanali);
- le altre voci restano la somma dei mesi;
- la pagina e la stampa lo spiegano. Nessuna modifica al database: basta pubblicare.

## 0.10.0 — 21 ottobre 2026

**Presentazione mensile con i rapportini mensili** (richiesta di Davide):
- scegliendo **Mese** nella Riunione (e nella Presentazione di uffici e affiliati), i numeri vengono dai **rapportini mensili**, non più dalla somma delle settimane;
- per i mesi compilati prima della piattaforma si usa lo storico del file Excel annuale (0.9.0);
- pagine (scelte da Davide):
  1. **copertina**: staff, portafoglio immobili vendita, incarichi vendita e vendite effettuate, con il confronto sul mese prima. Indica quanti uffici hanno inserito il rapportino del mese (mosaico verde/giallo/rosso);
  2. **totali**: tutte le 19 voci del rapportino più lo staff, con il valore del mese, la differenza sul mese prima e il grafichetto degli ultimi 6 mesi. Per gli incarichi scaduti un aumento è in rosso;
  3. per un **ufficio**: anche **Totali · Tutta Roma/Milano** mensile, solo con le somme della città;
  4. **classifiche** degli uffici su 6 voci: acquisizioni, appuntamenti vendita, incarichi vendita, proposte vendita, accettazioni vendita, vendite effettuate (servono almeno due uffici);
- il confronto con il mese prima conta solo gli uffici che hanno la voce in entrambi i mesi. Per lo staff, solo gli uffici che hanno inserito il rapportino in entrambi i mesi;
- niente obiettivi, quota di mercato né gara a punti nel mese: i rapportini mensili non li hanno;
- premendo **Mese** la presentazione parte dal **mese appena concluso** (a ottobre, settembre), come il Report mensile; con › si passa al mese in corso;
- le pagine delle classifiche ci sono sempre: se una voce non ha ancora numeri, la pagina lo scrive (prima la pagina spariva e, nel mese in corso senza rapportini, le classifiche non si vedevano);
- la **Settimana** resta come prima;
- **da fare una volta in Supabase** (per la pagina della città degli uffici): eseguire `supabase/migrations/010_totali_mensili_citta.sql`, dopo la 009.

## 0.9.0 — 20 ottobre 2026

**Storico 2026 e confronto 2025 dal file Excel annuale** (richiesta di Davide, file "BIGOLI C.E.C. ANNO 2026"):
- **storico gennaio–settembre 2026**: il file Excel ha, per ogni mese, il totale di ogni ufficio (non le singole persone). Questi totali sono conservati in una nuova tabella del database (`totali_mensili_storico`);
- il **Report mensile** li usa per un ufficio solo nei mesi in cui l'ufficio non ha numeri inseriti persona per persona:
  - in **Panoramica** accanto all'ufficio compare «Excel»;
  - in **Singoli rapportini** c'è solo la riga del totale, con un avviso;
  - il **Riepilogo anno** somma i mesi dell'Excel e quelli inseriti sulla piattaforma;
- se un ufficio inserisce i numeri di un mese persona per persona (Inserisci mese), valgono quelli al posto del totale dell'Excel. La pagina lo dice con un avviso;
- **confronto con il 2025**: la riga "<Mese> 2025" di ogni foglio va nella riga dell'anno prima del Report mensile (gennaio–dicembre 2025), che finora si scriveva a mano. Resta modificabile;
- controlli fatti sul file:
  - in gennaio, aprile e giugno–settembre la somma degli uffici è identica alla riga TOTALE dell'Excel;
  - in febbraio, marzo e maggio la differenza è esattamente "St. Appio Latino", che non è sulla piattaforma e quindi non è stato importato;
- nuovo script `scripts/importa-mensile-excel.mjs`: legge il file Excel, controlla intestazioni e nomi degli uffici riga per riga, e prepara `import/sql/STORICO_MENSILE_2026.sql` (si può rieseguire: ricarica da capo i mesi del file);
- **da fare una volta in Supabase**: eseguire `009_storico_mensile.sql`, poi `import/sql/STORICO_MENSILE_2026.sql` (vedi `docs/GUIDA_SETUP.md`).

## 0.8.0 — 20 ottobre 2026

**Ogni ufficio vede come va tutta la sua città** (richiesta di Davide):
- nella **Presentazione** di un ufficio, subito dopo i totali dell'ufficio, c'è la nuova pagina **Totali · Tutta Roma** (o **Tutta Milano**);
- è identica alla pagina 2 della Riunione degli amministratori:
  - attività rispetto all'obiettivo della città;
  - quota di mercato;
  - confronto con il periodo prima;
  - portafoglio;
  - grafichetti delle ultime 8 settimane o degli ultimi 6 mesi;
- vale sia per la **Settimana** sia per il **Mese**;
- in fondo alla pagina è indicato quanti uffici della città hanno inserito dati (es. "31 su 38");
- l'ufficio vede **solo le somme della città**, mai i numeri dei singoli altri uffici. Il database gli manda soltanto i totali (nuova funzione `totali_mia_citta`); le regole di accesso ai dati non cambiano;
- affiliati e amministratori non hanno questa pagina: gli amministratori hanno già la Riunione;
- **da fare una volta in Supabase**: eseguire `supabase/migrations/008_totali_citta.sql` (vedi `docs/GUIDA_SETUP.md`). Finché non è eseguito, la Presentazione funziona come prima, senza la pagina della città.

## 0.7.0 — 20 ottobre 2026

**Presentazione per uffici e affiliati, settimanale o mensile** (richiesta di Davide):
- nuova voce di menu **Presentazione** per gli **uffici** e per gli **affiliati**: è la stessa presentazione a tutto schermo della Riunione degli amministratori, ma con i soli dati
  - del proprio ufficio, per un ufficio;
  - degli uffici assegnati, per un affiliato (anche di Roma e Milano insieme);
- prima di avviarla si sceglie **Settimana** o **Mese** (stessi pulsanti e frecce ‹ › del Cruscotto). Vale anche per la **Riunione** degli amministratori;
- nel **mese**:
  - le attività sono la somma delle settimane che hanno il giovedì nel mese; il portafoglio è quello dell'ultima settimana inserita (stesse regole del Cruscotto);
  - il confronto è con il **mese prima** e i grafici mostrano gli **ultimi 6 mesi** (nella settimana: settimana prima e ultime 8 settimane);
  - un ufficio è "completo" se ha completato tutte le settimane già concluse del mese; se il mese non è finito la copertina lo dice ("mese in corso");
  - nella pagina dell'ufficio compaiono le note di tutte le settimane del mese, ognuna con la sua data;
- con un solo ufficio (account di un ufficio) spariscono classifiche, quota di mercato a confronto e mosaico della compilazione: restano copertina, totali e pagina dell'ufficio;
- gli affiliati non vedono nulla della gara a punti (la presentazione non ne ha mai mostrato);
- i dati di ogni ufficio o affiliato sono limitati dal **database**, come nelle altre pagine: nessuna modifica alle regole di accesso;
- corretta la formula scritta nella pagina "Quota di mercato" della presentazione: ora dice Portafoglio ÷ Incarichi in zona (il calcolo era già giusto dalla 0.6.2);
- nessuna modifica al database: basta pubblicare il sito.

## 0.6.2 — 19 ottobre 2026

**Quota di mercato: nuova formula** (richiesta di Davide):
- ora è **Portafoglio ÷ Incarichi in zona**, perché gli incarichi in zona comprendono già quelli in portafoglio. Prima era Portafoglio ÷ (Portafoglio + Incarichi in zona). L'obiettivo resta il 20%;
- vale ovunque: Inserisci settimana, Il mio ufficio / Andamento, Cruscotto, Riunione, backup Excel (anche la formula nelle celle) e calcoli del database;
- la quota viene ricalcolata anche per le **settimane passate**: tutti i valori storici salgono un po' (es. Somalia, prima settimana di febbraio: da 5,6% a 5,9%);
- in Inserisci settimana, se il portafoglio supera gli incarichi in zona compare un avviso: probabilmente i numeri vanno controllati;
- **da fare una volta in Supabase**: eseguire `supabase/migrations/007_quota_mercato.sql` (vedi `docs/GUIDA_SETUP.md`).

**Riunione: portafoglio nella copertina**:
- nella prima pagina della presentazione, accanto a Incarichi, Vendite e Quota di mercato, c'è il **Portafoglio** totale degli uffici;
- sotto c'è la variazione rispetto alla settimana prima, in verde se sale e in rosa se scende;
- la variazione conta solo gli uffici che hanno inserito il portafoglio in entrambe le settimane, così un ufficio che non ha compilato non sembra un calo. In quel caso è indicato "(su N uffici)";
- i quattro riquadri ora sono disposti su due righe.
- anche nella **pagina 2** (Totali della città), in fondo al tabellone delle attività, c'è la riga **Portafoglio** con:
  - il totale degli uffici;
  - la variazione rispetto alla settimana scorsa (stesso calcolo della copertina);
  - il grafichetto delle ultime 8 settimane.
  Non ha la barra dell'obiettivo, perché il portafoglio non ne ha uno.

## 0.6.1 — 19 ottobre 2026

**Nuovi orari dei promemoria settimanali** (richiesta di Davide):
- **sabato alle 10** il primo promemoria, al posto del venerdì alle 16. Riguarda la settimana in corso e chiede di inserire i dati entro domenica sera;
- **lunedì alle 9:30**, giorno della riunione, l'ultimo promemoria, al posto della domenica alle 10. Riguarda la settimana appena chiusa: "Oggi c'è la riunione: vi chiediamo di inserirli subito, prima che inizi";
- se GitHub parte in ritardo, il promemoria del lunedì si può mandare **solo fino alle 11:30**. Così arriva sempre prima delle riunioni (Milano alle 12, Roma alle 13);
- GitHub prova il lunedì alle 9:30, 10:00, 10:30 e 11:00 (con l'ora legale anche alle 11:30, scartata perché troppo tardi). Il sabato prova come prima alle 10, 11 e 12;
- nella prova manuale da GitHub (Actions → Promemoria → Run workflow) i tipi si chiamano ora `sabato` e `lunedi`;
- il sito annuncia i nuovi orari: in testata (es. "sab 24 ottobre, 10:00"), nella pagina di accesso e in Stato compilazione;
- promemoria mensili invariati. Nessuna modifica al database.

## 0.6.0 — 19 ottobre 2026

**Account per gli affiliati, in sola consultazione** (richiesta di Davide):
- nuovo ruolo **Affiliato (consultazione)**. Ogni affiliato vede solo gli uffici che gli vengono assegnati, anche di Roma e Milano insieme;
- menu con tre voci:
  - **Cruscotto**: settimana o mese, con il "Totale miei uffici";
  - **Andamento uffici**;
  - **Report mensile**: Panoramica, Singoli rapportini, Personale e Riepilogo anno;
- non vede la **gara a punti** (punteggi, Scheda punteggi, punti per voce), la scadenza, i ritardi né il confronto con l'anno prima. Queste parti restano agli amministratori (decisione di Davide);
- nella testata compare "Sola consultazione" al posto della città, senza conteggio di compilazione né promemoria. Gli affiliati non ricevono email;
- **Amministrazione → Account** (solo amministratore generale):
  - nel menu Ruolo c'è "Affiliato", con le caselle degli uffici divise tra Roma e Milano;
  - nuova sezione **Affiliati** in fondo: si modificano gli uffici e il nome, si dà una nuova password, si disattiva o si elimina l'account;
- la sola lettura è garantita dal **database**, non solo dal sito:
  - nuova tabella `uffici_affiliato`;
  - `posso_leggere_ufficio` riconosce gli affiliati, mentre le regole di scrittura non cambiano;
  - i punti della gara erano già riservati agli amministratori;
- **da fare una volta in Supabase**: eseguire `supabase/migrations/006_affiliati.sql` (vedi `docs/GUIDA_SETUP.md`, "Affiliati"). La funzione `gestione-account` non cambia;
- test del database sulle nuove regole: l'affiliato legge solo i suoi uffici, non scrive, non vede i punti e non si assegna altri uffici. Solo l'amministratore generale crea affiliati;
- demo: nuovo account di prova `affiliato-demo` (Somalia, Trieste, Brera).

## 0.5.2 — 15 ottobre 2026

**Promemoria via email** (si attivano quando si completa il passo 8 di `docs/GUIDA_SETUP.md`):
- **rapportino settimanale**: restano le email del venerdì alle 16 e della domenica alle 10 agli uffici che non hanno inserito nulla. **Tolto il riepilogo del lunedì** agli amministratori (decisione di Davide);
- **rapportino mensile** (nuovo), sempre alle 10:
  - 3 giorni prima e il giorno prima della scadenza, agli uffici che non hanno ancora inserito nulla nel mese. L'email dice entro quando compilare e se dopo la scadenza l'inserimento si chiude;
  - il giorno dopo la scadenza, il riepilogo solo all'amministratore generale, città per città: uffici senza dati, rapportini incompleti e inserimenti arrivati dopo la scadenza;
  - la scadenza è quella fissata in Report mensile → Panoramica. Se un mese non ha una scadenza, non partono promemoria. Se la scadenza viene spostata, i promemoria ripartono per la nuova data;
  - non parte nulla finché il mensile è in prova ("Work in progress").
- Prova manuale da GitHub (Actions → Promemoria → Run workflow): nuovi tipi `mensile_3giorni`, `mensile_vigilia` e `mensile_riepilogo`, e campo *mese*.
- **Testi delle email riscritti** (scelte di Davide):
  - tono con il "voi", cordiale, senza firma;
  - mittente "Rapportini Gruppo CEC";
  - in fondo, invece di "non rispondere": "Avete difficoltà a inserire i dati? Rispondete pure a questa email";
  - date più leggibili ("dal 12 al 18 ottobre", "lunedì 5 ottobre alle 23:59");
  - pulsanti blu della piattaforma che dicono cosa fare ("Inserisci i dati della settimana", "Inserisci il rapportino del mese").
  - Tutti i testi sono in un'unica sezione di `scripts/promemoria.mjs` ("TESTI DELLE EMAIL"), così si ritoccano facilmente.
- Nel riquadro "Scadenza" del Report mensile, una riga spiega quando partono i promemoria. Compare quando i promemoria sono attivi.
- **Invio più robusto**, dopo un errore "421 Temporary System Problem" di Gmail durante una prova:
  - 2 secondi di pausa tra un'email e l'altra, così Gmail non vede raffiche;
  - se Gmail risponde "riprova più tardi", lo script aspetta (30 secondi, poi 90, poi 3 minuti) e riprova;
  - ogni email viene registrata appena parte: se l'invio si interrompe a metà, il tentativo successivo manda solo quelle mancanti, senza doppioni;
  - un indirizzo rifiutato da Gmail non blocca gli altri uffici, e viene segnalato alla fine;
  - GitHub prova a tre orari invece di due, così c'è sempre un secondo tentativo (anche d'inverno).
- Azioni di GitHub aggiornate (checkout e setup-node v5): sparisce l'avviso "Node.js 20 is deprecated".
- **Promemoria accesi** (configurati e provati il 15 ottobre): il sito li annuncia nella pagina di accesso, nella testata ("Prossimo promemoria") e in Stato compilazione; nel riquadro "Scadenza" del Report mensile spiega quando partono quelli mensili.
- **Corretto**: entrando con un altro account nella stessa finestra (es. prima l'amministratore generale su Roma, poi Beato Angelico), il sito restava sulla città dell'account precedente. Così a Beato Angelico spariva "Inserisci settimana". Ora a ogni accesso si riparte dalla città del nuovo utente, e solo l'amministratore generale può cambiare città.
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
