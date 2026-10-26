# Guida per realizzare il video tutorial: il rapportino mensile degli uffici

> **A chi è rivolto questo documento**: a Claude (o a chi monta il video). Contiene tutto quello che serve per
> preparare il video senza dover studiare il codice: a chi parla il video, cosa mostrare, in che ordine, con
> quali parole, e cosa **non** mostrare. Le funzioni descritte sono quelle della versione 0.23 della piattaforma
> "Rapportini Gruppo CEC" (ottobre 2026).

---

## 1. Il video in breve

| | |
|---|---|
| **Argomento** | Come un ufficio compila il **rapportino mensile** sulla piattaforma (menu **Inserisci mese**) e come vede e stampa il **report del gruppo** dopo la chiusura |
| **Chi lo guarda** | Responsabili e personale degli uffici immobiliari del gruppo (Roma e Milano). Non sono tecnici: conoscono bene il vecchio rapportino Excel, non la piattaforma |
| **Obiettivo** | Dopo il video l'ufficio sa: aggiornare il personale, inserire i numeri del mese, salvare, rispettare la scadenza e stampare il report del gruppo |
| **Durata** | 5–7 minuti. Se viene più lungo, meglio due video: (1) personale e numeri, (2) scadenza, email e report del gruppo |
| **Lingua e tono** | Italiano semplice, frasi brevi, del "voi" rivolto all'ufficio ("inserite", "premete"). Calmo e pratico, niente gergo informatico (non dire "database", "campo", "input", "upload") |
| **Formato** | Registrazione dello schermo del computer (non del telefono), con voce fuori campo e brevi scritte in sovrimpressione |

## 2. Regole da rispettare (importanti)

1. **Usare solo la versione dimostrativa** (la "demo", sezione 3), mai il sito vero: il sito vero contiene nomi e numeri reali delle persone degli uffici, che non devono comparire in un video.
2. **Nessuna password vera** sullo schermo. Nella demo la password è `demo` per tutti gli account: si può mostrare.
3. **Entrare come un ufficio** (account `somalia`), non come amministratore: il video deve mostrare esattamente quello che vede un ufficio.
4. **Non mostrare né nominare** le funzioni che gli uffici non hanno: Report mensile (pagina dell'amministrazione), Amministrazione, la colonna "Locazioni effettuate" (la compila solo l'amministratore generale), la gara a punti nei dettagli.
5. **Non inventare funzioni.** Se un passaggio non si trova nella demo come descritto qui, va segnalato invece di "aggiustarlo" nel montaggio.
6. In cima alla demo c'è la striscia *"Versione dimostrativa · dati inventati…"*: si può tagliare dall'inquadratura oppure dire una volta, all'inizio, che si usa una versione di prova con dati inventati.
7. I nomi delle persone nella demo sono inventati: vanno bene sullo schermo.

## 3. Preparare la demo

Dal Terminale, nella cartella del progetto:

```
npm run demo
```

Poi aprire nel browser **http://localhost:5199**.

- Nella pagina di accesso c'è un riquadro **Demo** con i pulsanti degli account: premere **somalia** (inserisce da solo nome utente e password `demo`), poi **Accedi**.
- I dati della demo sono inventati e **si azzerano ricaricando la pagina**: prima di ogni ripresa ricaricare, così si parte sempre dalla stessa situazione.
- La demo si apre sul **mese scorso** (il mese da compilare), con la scadenza fra una settimana alle 10:00 e la chiusura dopo la scadenza. Il **mese prima ancora** è già chiuso: serve per mostrare il report del gruppo (scena 8).
- Nella demo l'ufficio Somalia ha già: un responsabile, alcuni collaboratori, una coordinatrice (con la casellina degli appuntamenti fissati), un marketer che ha lasciato l'ufficio nel mese (riga rossa) e una persona con *Ruolo da definire*. La riga verde si ottiene aggiungendo una persona (scena 4).
- Consigli per la registrazione: finestra del browser a **1600 × 1000** circa, zoom del browser al 100–110%, mouse lento, una pausa di un secondo dopo ogni clic.

## 4. Le cose da sapere prima di registrare

**Che cos'è.** Il rapportino mensile sostituisce il file Excel "rapportino" che gli uffici compilavano a fine mese. Si compila **una riga per persona** dell'ufficio; il **totale dell'ufficio** e lo **staff** si calcolano da soli. I numeri arrivano all'amministrazione per il report del gruppo e la riunione di fine mese.

**Le colonne** (nell'ordine della pagina; alcune sono divise in *vendita* e *locazione*):
Portafoglio immobili (vendita, locazione) · Acquisizioni · Appuntamenti (vendita, locazione) · Incarichi (vendita, locazione) · Gestione incarichi · Ribassi · Kiron · Colloqui · Proposte (vendita, locazione) · Accettazioni (vendita, locazione) · Vendite effettuate · Richieste (vendita, locazione) · Incarichi scaduti.

**Regole di compilazione**
- Si scrivono **solo numeri interi** (niente virgole, segni o lettere: la casella diventa rossa e il salvataggio si ferma).
- **0 e casella vuota non sono la stessa cosa**: 0 = "non ha fatto nulla", vuota = "non ancora inserito". Se una persona non ha fatto nulla in un'attività, scrivere **0**.
- Con il tasto **Invio** si passa alla casella sotto (come in Excel).
- Il **portafoglio** si scrive persona per persona: l'ufficio vede la somma nella riga *Totale ufficio*.
- **Coordinatrici**: nella colonna *Appuntamenti vendita* hanno una casellina in più per gli **appuntamenti fissati** ("App. vendita fix"). Nel rapportino compare come un numero piccolo in alto a destra (es. 9⁷ = 9 appuntamenti, 7 fissati). È un indicatore di qualità e non entra nei totali.
- Bisogna premere **Salva**. Finché non si salva, in basso compare *"Modifiche non salvate"*. Se si prova a chiudere la pagina o a cambiare mese con modifiche non salvate, la piattaforma lo chiede prima.

**Il personale**
- Si inserisce **una volta sola** e vale per tutti i mesi: nome e cognome, ruolo (*Responsabile, Collaboratore, Coordinatrice, Marketer*; *Ruolo da definire* solo se non si sa ancora) e data di inizio.
- Nella tabella le persone sono raggruppate (*Responsabile e collaboratori*, *Coordinatrici e marketer*); sotto ogni nome ci sono il ruolo e l'anzianità (es. "4 anni e 5 mesi").
- Chi entra nel mese ha la **riga verde** con la scritta *"Nuovo ingresso dal …"*.
- Chi esce: pulsante **Ha lasciato**, con l'ultimo giorno e il motivo: *Ha lasciato il gruppo*, *Promosso a responsabile* oppure *Trasferito in un altro ufficio*. Nel mese in cui esce resta nel rapportino con la **riga rossa**: i suoi numeri di quel mese contano nel totale dell'ufficio, ma non nello staff né nella gara. Dal mese dopo non compare più, e i suoi numeri dei mesi passati restano.
- Chi viene **trasferito**: si chiude con "Trasferito in un altro ufficio" e il nuovo ufficio lo inserisce nel proprio personale.
- **Elimina** serve solo a correggere un inserimento sbagliato: cancella la persona e **tutti** i suoi numeri. Per chi lascia l'ufficio si usa sempre *Ha lasciato*.
- **Staff** = persone in servizio a fine mese, calcolato da solo (comprende il responsabile).

**Scadenza, email e chiusura**
- L'amministrazione fissa una **scadenza** per ogni mese, di solito le **10:00 del giorno della riunione di fine mese**. Sopra la tabella compare *"Da compilare entro il …"*.
- **Email di promemoria** agli uffici che **non hanno inserito nulla**: 3 giorni prima della scadenza e il giorno prima (alle 10), e mezz'ora prima della scadenza (*"Ultimi 30 minuti: rapportino di …"*) quando dopo la scadenza l'inserimento si chiude.
- Dopo la scadenza ci sono due casi, a seconda di come l'ha impostata l'amministrazione:
  - **inserimento chiuso** (il caso di ottobre 2026): compare *"Inserimento chiuso il … Per correzioni contatta l'amministratore."* e le caselle non si possono più modificare;
  - **senza chiusura**: si può ancora inserire, ma l'amministrazione vede che i numeri sono arrivati in ritardo.
- **Report del gruppo**: dopo la chiusura, in cima a *Inserisci mese*, ogni ufficio vede il report di **tutti gli uffici del gruppo**, con la **propria riga evidenziata in giallo**, e lo stampa con il pulsante **Stampa il report del gruppo** (si stampa solo il report). Prima della chiusura ogni ufficio vede solo i propri numeri.

## 5. Scaletta del video (scena per scena)

Per ogni scena: **cosa fare sullo schermo**, **voce fuori campo** (testo proposto, da adattare) e **scritta** in sovrimpressione (facoltativa, breve).

### Scena 1 — Introduzione (20–30 s)
- **Schermo**: pagina di accesso della piattaforma.
- **Voce**: "In questo video vediamo come compilare il rapportino mensile dell'ufficio sulla piattaforma dei rapportini. Sostituisce il file Excel di fine mese: si compila una riga per persona, e il totale dell'ufficio si calcola da solo. Usiamo una versione di prova, con nomi e numeri inventati."
- **Scritta**: *Il rapportino mensile dell'ufficio*

### Scena 2 — Entrare e aprire il rapportino (20 s)
- **Schermo**: premere **somalia** nel riquadro Demo → **Accedi** → nel menu premere **Inserisci mese**.
- **Voce**: "Entrate con il nome utente e la password del vostro ufficio, gli stessi del rapportino settimanale. Nel menu trovate la voce Inserisci mese."
- **Scritta**: *Menu → Inserisci mese*

### Scena 3 — La pagina in alto (30 s)
- **Schermo**: indicare con il mouse il nome dell'ufficio, la riga *Ultimo salvataggio*, le frecce del mese (*Mese precedente* / *Mese successivo*) e l'avviso *"Da compilare entro il …"*.
- **Voce**: "In alto c'è il nome dell'ufficio e, se avete già salvato, quando e chi l'ha fatto. La pagina si apre sul mese da compilare; con le frecce potete vedere i mesi precedenti. Sopra la tabella trovate la scadenza: entro quando inserire il mese."

### Scena 4 — Il personale dell'ufficio (60–80 s)
- **Schermo**: scendere al riquadro **Personale dell'ufficio**.
  1. Aggiungere una persona: *Nome e cognome* "Giulia Bianchi", *Ruolo* Collaboratore, *Data di inizio* un giorno del mese mostrato → **Aggiungi**. Risalire e mostrare la sua **riga verde** nella tabella.
  2. Su un'altra persona premere **Ha lasciato**: la data proposta è quella di oggi; **cambiarla con un giorno del mese mostrato** (altrimenti la riga rossa compare solo nel mese di oggi). Mostrare il menu del motivo, scegliere *Ha lasciato il gruppo* → **Salva**. Mostrare la **riga rossa** e la scritta in alto *"Ha lasciato l'ufficio nel mese"*. In alternativa basta mostrare la riga rossa già presente nella demo (il marketer).
  3. Indicare **Modifica** (per correggere nome, ruolo o date) ed **Elimina**, senza usarlo.
- **Voce**: "Prima dei numeri, controllate il personale. Lo inserite una volta sola e vale per tutti i mesi: nome e cognome, ruolo e data di inizio. Chi entra nel mese ha la riga verde. Quando qualcuno lascia l'ufficio premete Ha lasciato, indicate l'ultimo giorno e il motivo: ha lasciato il gruppo, è stato promosso a responsabile o è stato trasferito in un altro ufficio. Nel mese in cui esce la sua riga resta, in rosso: i suoi numeri contano nel totale, ma non nello staff. Elimina usatelo solo per correggere un errore: cancella anche tutti i numeri di quella persona."
- **Scritta**: *Chi lascia l'ufficio → "Ha lasciato", non "Elimina"*

### Scena 5 — Inserire i numeri (60–90 s)
- **Schermo**: nella tabella **Numeri di …** scrivere i numeri di una persona, usando **Invio** per scendere di casella. Scrivere uno **0** in una casella. In una riga di **coordinatrice**, scrivere gli appuntamenti vendita e il numero degli appuntamenti fissati nella casellina accanto, poi mostrare l'esponente. Indicare la riga **Totale ufficio** che cambia mentre si scrive, e **Staff**.
- **Voce**: "Ora i numeri: una riga per persona, una colonna per attività, come nel vecchio rapportino. Scrivete solo numeri interi. Se una persona non ha fatto nulla in un'attività scrivete zero: la casella vuota vuol dire che il dato non è ancora stato inserito. Con Invio passate alla casella sotto. Per le coordinatrici, accanto agli appuntamenti vendita c'è anche il numero di quelli fissati, che compare piccolo in alto. In fondo, il totale dell'ufficio e lo staff si calcolano da soli."
- **Scritta**: *0 = nessuna attività · vuoto = non ancora inserito*

### Scena 6 — Salvare (20–30 s)
- **Schermo**: indicare in basso *"Modifiche non salvate"* → premere **Salva** → mostrare *"Dati salvati alle …"* e, in alto, *Ultimo salvataggio*.
- **Voce**: "Ricordatevi di premere Salva: finché non salvate, in basso vedete Modifiche non salvate. Potete salvare quante volte volete e tornare a completare il rapportino più tardi, fino alla scadenza."
- **Scritta**: *Premete sempre Salva*

### Scena 7 — Scadenza ed email di promemoria (30–40 s)
- **Schermo**: tornare all'avviso *"Da compilare entro il …"*. Facoltativo: un'immagine d'esempio dell'email (oggetto *"Promemoria: rapportino di …, scadenza …"*), con un indirizzo inventato.
- **Voce**: "Ogni mese l'amministrazione fissa una scadenza, di solito alle dieci del giorno della riunione di fine mese. Gli uffici che non hanno ancora inserito nulla ricevono un'email tre giorni prima, una il giorno prima e un'ultima mezz'ora prima della scadenza. Alla scadenza l'inserimento si chiude: dopo, per qualsiasi correzione, dovete contattare l'amministrazione."

### Scena 8 — Il report del gruppo (40–60 s)
- **Schermo**: con la freccia *Mese precedente* andare al mese già chiuso. Mostrare l'avviso *"Inserimento chiuso il …"*, poi in cima il riquadro **Report del gruppo · …** con la **riga gialla** dell'ufficio → premere **Stampa il report del gruppo** e mostrare l'anteprima di stampa (poi *Annulla*).
- **Voce**: "Quando l'inserimento è chiuso, in cima alla pagina trovate il report di tutto il gruppo, ufficio per ufficio, con la riga del vostro ufficio evidenziata in giallo. Con Stampa il report del gruppo lo stampate per la riunione. I vostri numeri del mese restano visibili sotto, ma non si possono più modificare."
- **Scritta**: *Dopo la scadenza: report del gruppo, la vostra riga in giallo*

### Scena 9 — Riepilogo (20–30 s)
- **Schermo**: la pagina Inserisci mese del mese da compilare, in alto.
- **Voce**: "Riassumendo: controllate il personale, inserite i numeri di ogni persona, scrivete zero quando non c'è attività, salvate, e fatelo entro la scadenza. Dopo la chiusura trovate e stampate il report del gruppo. Per qualsiasi dubbio rispondete a una delle email di promemoria o contattate l'amministrazione."
- **Scritta** (elenco):
  1. *Personale aggiornato*
  2. *Numeri persona per persona (0 se nessuna attività)*
  3. *Salva*
  4. *Entro la scadenza*
  5. *Dopo la chiusura: stampa il report del gruppo*

## 6. Testi esatti dell'interfaccia (da usare tali e quali nel parlato e nelle scritte)

| Dove | Testo sullo schermo |
|---|---|
| Menu | **Inserisci mese** |
| Titolo della tabella | **Numeri di** *mese anno* |
| Riquadro del personale | **Personale dell'ufficio** — campi *Nome e cognome*, *Ruolo*, *Data di inizio*, pulsante **Aggiungi** |
| Pulsanti di una persona | **Modifica** · **Ha lasciato** · **Elimina** |
| Motivi dell'uscita | *Ha lasciato il gruppo* · *Promosso a responsabile* · *Trasferito in un altro ufficio* |
| Etichette nella tabella | *Nuovo ingresso dal …* (verde) · *Ha lasciato il …* (rosso) |
| Ultima riga | **Totale ufficio** con *Staff: N* |
| Salvataggio | pulsante **Salva** · *Modifiche non salvate* · *Dati salvati alle HH:MM.* |
| Scadenza | *Da compilare entro il …* · *Inserimento chiuso il … Per correzioni contatta l'amministratore.* · *Scadenza superata il …* (scadenza senza chiusura) |
| Report del gruppo | **Report del gruppo · mese anno** · pulsante **Stampa il report del gruppo** · *"giallo = il vostro ufficio"* |

## 7. Domande frequenti (utili per le scritte o per un video breve a parte)

- **Ho sbagliato un numero dopo aver salvato.** Correggetelo nella casella e premete di nuovo Salva, fino alla scadenza. Dopo la chiusura contattate l'amministrazione.
- **Una persona non compare nella tabella.** Controllate nel Personale la data di inizio (deve essere entro la fine del mese) e che non abbia una data di fine precedente al mese.
- **La casella è rossa.** C'è qualcosa che non è un numero intero (una virgola, uno spazio, una lettera).
- **Posso compilare un po' alla volta?** Sì: salvate, e riprendete quando volete fino alla scadenza.
- **Il totale non torna con il mio Excel.** Il totale somma le persone in tabella: verificate che tutte siano inserite con le date giuste.

## 8. Controlli prima di consegnare il video

- [ ] Registrato **solo sulla demo**, entrando come ufficio (`somalia`)
- [ ] Nessun dato reale, nessuna password vera, nessun indirizzo email reale
- [ ] Non compaiono Report mensile, Amministrazione né la colonna "Locazioni effettuate"
- [ ] Spiegati: 0 contro casella vuota, il tasto **Salva**, *Ha lasciato* invece di *Elimina*
- [ ] Mostrati: riga verde, riga rossa, totale e staff automatici, report del gruppo con la riga gialla e la stampa
- [ ] Durata entro 7 minuti (altrimenti dividere in due video)
- [ ] I testi sullo schermo corrispondono alla sezione 6
