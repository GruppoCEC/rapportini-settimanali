# Guida per realizzare il video tutorial: il rapportino mensile degli uffici

> **A chi è rivolto questo documento**: a Claude (o a chi monta il video). Contiene tutto quello che serve per
> preparare il video senza dover studiare il codice: a chi parla il video, cosa mostrare, in che ordine, con
> quali parole, e cosa **non** mostrare. Le funzioni descritte sono quelle della versione 0.24 della piattaforma
> "Rapportini Gruppo CEC" (ottobre 2026).

---

## 1. Il video in breve

| | |
|---|---|
| **Argomento** | Come un ufficio compila il **rapportino mensile** sulla piattaforma (menu **Inserisci mese**) e come vede e stampa il **report del gruppo** dopo la chiusura |
| **Chi lo guarda** | Responsabili e personale degli uffici immobiliari del gruppo (Roma e Milano). Non sono tecnici: conoscono bene il vecchio rapportino Excel, non la piattaforma |
| **Obiettivo** | Dopo il video l'ufficio sa: aggiornare il personale, inserire i numeri del mese, salvare, rispettare la scadenza e stampare il report del gruppo |
| **Durata** | **Tre video brevi, da 60–90 secondi l'uno**, ciascuno su una sola cosa (scelta di Davide: oltre l'attenzione cala). Ognuno si capisce anche da solo: 1) Il personale · 2) Inserire e salvare i numeri · 3) Scadenza e report del gruppo. Mai oltre i 90 secondi: se un video si allunga, si toglie qualcosa, non si aggiunge un video |
| **Lingua e tono** | Italiano semplice, frasi brevi, del "voi" rivolto all'ufficio ("inserite", "premete"). Calmo e pratico, niente gergo informatico (non dire "database", "campo", "input", "upload") |
| **Formato** | Registrazione dello schermo del computer (non del telefono), con voce fuori campo e brevi scritte in sovrimpressione. Ritmo svelto: niente introduzioni lunghe né saluti, si parte subito dalla pagina; tagliare le attese di caricamento; zoom sulla parte dello schermo di cui si parla |

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

- Nella pagina di accesso c'è un riquadro **Demo** con i pulsanti degli account: premere **somalia** (inserisce da solo nome utente e password `demo`), poi **Entra**.
- I dati della demo sono inventati e **si azzerano ricaricando la pagina**: prima di ogni ripresa ricaricare, così si parte sempre dalla stessa situazione.
- La demo si apre sul **mese scorso** (il mese da compilare), con la scadenza fra una settimana alle 10:00 e la chiusura dopo la scadenza. Il **mese prima ancora** è già chiuso: serve per mostrare il report del gruppo (video 3).
- Aprendo **Inserisci mese** si apre da sola la **guida a passi** (dalla 0.24): prima di registrare chiuderla con **Salta**. Spuntando *Non mostrare più* non si riapre nemmeno ricaricando la pagina.
- In Somalia il responsabile e la coordinatrice hanno la **data di inizio provvisoria** 01/01/2026: sopra la tabella e nel riquadro *Personale dell'ufficio* compare l'avviso arancio *Date di inizio da completare* (si può mostrare nel video 1, vedi sezione 4).
- Nella demo l'ufficio Somalia ha già: un responsabile, alcuni collaboratori, una coordinatrice (con la casellina degli appuntamenti fissati), un marketer che ha lasciato l'ufficio nel mese (riga rossa) e una persona con *Ruolo da definire*. La riga verde si ottiene aggiungendo una persona (video 1).
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
- **Date di inizio provvisorie**: responsabili, coordinatrici e marketer caricati dai rapportini del 2026 hanno come inizio il **01/01/2026**, perché la data vera non c'era. Un avviso arancio li elenca: con **Modifica** l'ufficio scrive la data vera, **per il responsabile da quando è responsabile, per tutti gli altri da quando lavorano nel gruppo** (regola di Davide). Sotto la casella della data la pagina ricorda la regola in base al ruolo.
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

## 5. Scaletta dei tre video

Ogni video parte **già nella pagina Inserisci mese** (l'accesso è lo stesso del rapportino settimanale, non serve mostrarlo): nei primi 3 secondi basta la scritta *Menu → Inserisci mese*. Per ogni passaggio: **cosa fare sullo schermo**, **voce fuori campo** (testo proposto, già tagliato sulla durata: da adattare, non da allungare) e **scritta** in sovrimpressione.

### Video 1 — Il personale dell'ufficio (circa 60 s)

| Tempo | Schermo | Voce | Scritta |
|---|---|---|---|
| 0–5 s | Pagina Inserisci mese, in alto | "Prima dei numeri del mese, controllate il personale dell'ufficio." | *Menu → Inserisci mese* |
| 5–25 s | Riquadro **Personale dell'ufficio**: scrivere "Giulia Bianchi", ruolo *Collaboratore*, data di inizio nel mese mostrato → **Aggiungi**; risalire alla sua **riga verde** | "Si inserisce una volta sola e vale per tutti i mesi: nome e cognome, ruolo e data di inizio. Chi entra nel mese ha la riga verde." | *Nuovo ingresso = riga verde* |
| 25–45 s | Mostrare la **riga rossa** già presente (il marketer) e il pulsante **Ha lasciato** con data e motivo (*Ha lasciato il gruppo · Promosso a responsabile · Trasferito in un altro ufficio*), senza salvare | "Quando qualcuno lascia l'ufficio premete Ha lasciato, con l'ultimo giorno e il motivo. Nel mese in cui esce la sua riga resta, in rosso: i suoi numeri contano nel totale." | *Chi esce → Ha lasciato* |
| 45–60 s | Indicare **Elimina** | "Elimina usatelo solo per correggere un errore: cancella anche tutti i numeri di quella persona." | *Elimina = solo errori* |

### Video 2 — Inserire e salvare i numeri (circa 75 s)

| Tempo | Schermo | Voce | Scritta |
|---|---|---|---|
| 0–5 s | Tabella **Numeri di …** | "Ecco come inserire i numeri del mese." | *Menu → Inserisci mese* |
| 5–30 s | Scrivere i numeri di una persona scendendo con **Invio**; scrivere uno **0** | "Una riga per persona, una colonna per attività, come nel vecchio rapportino. Solo numeri interi. Se una persona non ha fatto nulla scrivete zero: la casella vuota vuol dire non ancora inserito. Con Invio passate alla casella sotto." | *0 = nessuna attività · vuoto = non inserito* |
| 30–45 s | Riga della **coordinatrice**: appuntamenti vendita e casellina dei fissati, poi l'esponente | "Per le coordinatrici, accanto agli appuntamenti vendita c'è il numero di quelli fissati." | *Coordinatrici: appuntamenti fissati* |
| 45–55 s | Riga **Totale ufficio** e *Staff* che cambiano | "Il totale dell'ufficio e lo staff si calcolano da soli." | — |
| 55–75 s | In basso *Modifiche non salvate* → **Salva** → *Dati salvati alle …* | "E ricordatevi di premere Salva. Potete salvare e completare più tardi, fino alla scadenza." | *Premete sempre Salva* |

### Video 3 — Scadenza e report del gruppo (circa 60 s)

| Tempo | Schermo | Voce | Scritta |
|---|---|---|---|
| 0–20 s | Avviso *Da compilare entro il …* | "Ogni mese c'è una scadenza, di solito alle dieci del giorno della riunione di fine mese. Se non avete ancora inserito nulla, vi arriva un'email tre giorni prima, il giorno prima e mezz'ora prima." | *Entro la scadenza* |
| 20–30 s | Freccia *Mese precedente* → avviso *Inserimento chiuso il …* | "Alla scadenza l'inserimento si chiude. Per correzioni, contattate l'amministrazione." | *Dopo la scadenza: chiuso* |
| 30–55 s | In cima: **Report del gruppo**, la **riga gialla** dell'ufficio → **Stampa il report del gruppo** → anteprima di stampa | "Da quel momento, in cima alla pagina trovate il report di tutto il gruppo, con il vostro ufficio in giallo. Con questo pulsante lo stampate per la riunione." | *Il vostro ufficio in giallo* |
| 55–60 s | Fermo sul report | — | *Personale · Numeri · Salva · Entro la scadenza* |

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
- [ ] Mostrati (nei tre video): riga verde, riga rossa, totale e staff automatici, report del gruppo con la riga gialla e la stampa
- [ ] Ogni video **sotto i 90 secondi**, senza introduzioni né saluti, attese di caricamento tagliate
- [ ] I testi sullo schermo corrispondono alla sezione 6

## 9. Dove finiscono i video

I tre video si vedono **dentro la guida a passi** che si apre in *Inserisci mese* (`src/componenti/GuidaMensile.tsx`): il video 1 nel passo *Il personale dell'ufficio*, il video 2 in *Inserire i numeri*, il video 3 in *Scadenza e report del gruppo*. Finché un video manca, il passo mostra un disegno.

- **Formato**: MP4 (H.264), 1280×720 o 1920×1080, **al massimo circa 10 MB** l'uno. Il video si scarica solo quando l'ufficio preme Play, quindi non rallenta la piattaforma.
- **Nomi dei file**: `mensile-1-personale.mp4`, `mensile-2-numeri.mp4`, `mensile-3-scadenza.mp4`, nella cartella `public/video/` del progetto.
- **Per attivarli**: nel file della guida, nel passo giusto, si scrive il nome del file nel campo `video` (oggi c'è `video: undefined` con il nome già scritto accanto).
- **Se pesano troppo**: sul Mac si comprimono con il programma di Apple già installato, dal Terminale:
  `avconvert --preset Preset1280x720 --source video-originale.mov --output public/video/mensile-1-personale.mp4`
- **Sottotitoli**: le scritte in sovrimpressione vanno messe nel video (molti guardano senza audio in ufficio).
