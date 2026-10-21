# Idee di sviluppo — analisi della piattaforma (21/10/2026)

> Documento per il brainstorming. Scritto il 21/10/2026 sulla versione 0.12.0.
> **Fatto** = realizzato nelle versioni indicate. I punti 3.3.10 (previsione delle vendite), 3.3.11 (segnali di allarme)
> e 3.3.13 (turnover e permanenza) sono i prossimi da ripensare insieme, prima di scrivere codice.

Analisi completa, con due punti di vista: un **agente immobiliare** e un **data analyst** esperto.

---

## 1. Cosa c'è oggi (in breve)

| Area | Cosa fa |
|---|---|
| Settimanale | 8 attività con obiettivo e risultato (App.ti vendita, Proposte, Incarichi, Valutazioni, Vendite, Ribassi, IM3, +90) e 6 dati di zona (Portafoglio, Incarichi in zona, Contatti zona, Telefoni mancanti, Affittati, Vuoti). Nota libera. Quota di mercato calcolata da sola |
| Mensile | 19 voci **persona per persona** (vendita/locazione, Kiron, colloqui, incarichi scaduti…), personale con ruolo e date, staff calcolato, gara a punti dei collaboratori, scadenze e ritardi, stampe, turnover, riepilogo dell'anno. Ancora "Work in progress" per gli uffici |
| Analisi | Cruscotto con semafori, Andamento ufficio (12 settimane, 6 mesi), Riunione/Presentazione a schermo intero con classifiche, Totali della città (solo somme) |
| Automatismi | Promemoria Gmail (sabato, lunedì, scadenze mensili), settimane vuote ricostruite dal mensile, storico Excel 2026 caricato |
| Gestione | Ruoli ufficio / affiliato / admin città / admin generale, backup Excel manuale, registro delle modifiche (`storico_modifiche`) |

**Punti forti**: niente più errori da Excel, regole di calcolo uniche e testate, sicurezza nel database, riunione pronta senza preparazione.

**Il limite principale**: la piattaforma oggi **raccoglie e mostra** i numeri molto bene, ma **li interpreta poco**. Dice "quanto", raramente "perché" e "cosa fare adesso".

---

## 2. Visuale dell'agente immobiliare

### 2.1 Cosa manca nel lavoro di ogni giorno
1. ✅ **Fatto (0.14.0)** — **Il "imbuto" della vendita non si vede.** Le voci ci sono tutte (valutazioni → incarichi → appuntamenti → proposte → accettazioni → vendite), ma nessuna pagina mostra i **passaggi**: "quanti appuntamenti servono per una proposta", "quante proposte diventano accettazioni". È la domanda che un responsabile fa in riunione. *Idea*: una pagina "Imbuto" per ufficio e per città, con i rapporti tra una fase e l'altra e il confronto con la media.
2. **Niente soldi.** Non ci sono provvigioni, fatturato, prezzo medio, valore del portafoglio. Due uffici con 5 vendite possono avere incassi molto diversi. *Idea*: voce mensile "provvigioni incassate" (e magari "provvigioni da incassare"), anche solo per ufficio e non per persona. Da decidere se è un dato che gli uffici accettano di condividere.
3. **Obiettivi solo settimanali e scelti dall'ufficio.** Gli obiettivi vengono copiati dalla settimana prima; non c'è un obiettivo mensile o annuale dato dalla direzione. *Idea*: budget annuale per ufficio (es. vendite e incarichi), diviso in mesi, con l'avanzamento ("sei al 64% dell'obiettivo dell'anno, a ottobre dovresti essere all'80%").
4. ✅ **Fatto (0.13.0)** — **La nota della settimana è testo libero.** In riunione si leggono note diverse ogni volta. *Idea*: tre caselle brevi — "cosa è andato bene", "difficoltà", "mi serve aiuto su…".
5. **Le decisioni della riunione si perdono.** *Idea*: "Impegni della settimana": in riunione si scrive cosa si è promesso ("Somalia: 3 incarichi nuovi"), e il lunedì dopo la presentazione mostra se è stato mantenuto.

### 2.2 Il collaboratore (la persona)
6. ✅ **Fatto (0.16.0, solo amministratori)** — **Scheda del collaboratore.** I numeri persona per persona esistono già nel mensile: manca una pagina con l'andamento di **una persona** mese per mese, utile per il colloquio individuale con il responsabile.
7. ✅ **Fatto (0.16.0, solo amministratori)** — **Inserimento dei nuovi.** Con data di inizio e numeri mensili si può vedere la "curva di crescita" dei nuovi collaboratori: quanto producono al 1°, 3°, 6° mese, rispetto alla media del gruppo. Serve a capire presto chi è in difficoltà.
8. **Gara a punti**: i punti veri non sono ancora stati decisi (nella demo ci sono quelli di esempio). È il passo che manca per usarla davvero.

### 2.3 La zona
9. **Lavoro di zona.** Contatti zona e Telefoni mancanti ci sono, ma non sono collegati ai risultati. *Idea*: mostrare se gli uffici che lavorano di più la zona hanno poi una quota di mercato che cresce.
10. **Andamento della quota di mercato** nel tempo per ufficio, con l'obiettivo del 20% come linea di riferimento (in parte c'è già nell'Andamento ufficio: da portare nella Presentazione).
11. **Kiron**: rapporto tra mutui (Kiron) e vendite, per vedere quanto ogni ufficio propone il finanziamento.

### 2.4 Confronti e motivazione
12. ✅ **Fatto (0.15.0)** — **Posizione anonima nella città.** Oggi l'ufficio vede i totali della città ma non dove si trova. *Idea*: "sei nel primo 25% della città per incarichi" senza mostrare i nomi degli altri (coerente con la scelta di riservatezza della 0.8.0).
13. **Confronto con l'anno prima per ufficio.** Oggi il confronto 2025 è solo sui totali del gruppo, scritto a mano. Con gli Excel 2025 dei singoli uffici si può fare per ognuno.
14. **Report mensile via email** a ogni ufficio (PDF della propria Presentazione del mese), senza dover entrare.

### 2.5 Comodità
15. **Telefono**: installare il sito come app ("Aggiungi a Home") con icona, e inserimento veloce della settimana in una sola schermata.
16. **Promemoria anche su WhatsApp** (molti agenti leggono poco l'email). Richiede un servizio a pagamento: da valutare.
17. **Password dimenticata** senza passare dall'amministratore.

---

## 3. Visuale del data analyst

### 3.1 Qualità dei dati (prima di tutto)
1. **Numeri ricostruiti dal mensile (0.11.0).** Circa 8.400 caselle settimanali sono state create dividendo il mensile in parti uguali. Sono corrette nel totale del mese, ma **le settimane singole sono "piatte"**: classifiche e grafici settimanali dei mesi passati mostrano un andamento che non è reale. *Proposta*: nelle analisi settimanali, escluderli o segnalarli **solo agli amministratori** (Davide ha deciso di non evidenziarli nel sito: da riconfermare solo per la vista admin).
2. **Due fonti per lo stesso fatto.** Settimanale e mensile raccolgono cose simili con nomi diversi (Valutazioni = Acquisizioni, Incarichi = Incarichi vendita…). *Proposta*: un controllo mensile "le settimane superano il mensile" (oggi in quel caso non si fa nulla e la differenza resta nascosta), con l'elenco degli uffici da verificare.
3. **Dizionario delle voci.** Cosa conta come "proposta", "valutazione", "IM3", "+90"? Se ogni ufficio conta in modo diverso, i confronti non valgono. *Proposta*: una definizione breve per ogni voce, visibile con una "i" accanto alla casella.
4. **Controlli all'inserimento.** Avviso gentile (non blocco) se un numero è molto fuori dal solito dell'ufficio (es. 40 appuntamenti quando la media è 8): prende gli errori di battitura prima della riunione.
5. **Puntualità.** Dal registro delle modifiche si può misurare **quando** ogni ufficio compila (domenica, lunedì mattina, dopo la riunione) e quante correzioni fa dopo la riunione.

### 3.2 Confronti corretti
6. **Per persona, non solo per ufficio.** Un ufficio con 12 persone batte sempre uno con 4. *Proposta*: classifiche "per collaboratore" (numero ÷ staff), accanto a quelle assolute.
7. **Mesi da 4 e da 5 settimane.** Con la regola del giovedì un mese da 5 settimane ha il 25% in più di tempo: il confronto "mese su mese" è falsato. *Proposta*: media per settimana accanto al totale.
8. **Numeri piccoli = classifiche ballerine.** (In parte nell'imbuto: passaggio solo con almeno 5 casi.) Con 1–3 vendite al mese l'ordine cambia per caso. *Proposta*: per le classifiche usare anche la media degli ultimi 3 mesi; nei rapporti dell'imbuto mostrare il dato solo sopra un minimo di casi.
9. **Stagionalità.** Agosto e dicembre sono sempre bassi: il confronto giusto è con lo stesso mese dell'anno prima, non con il mese prima.

### 3.3 Capire e prevedere
10. **➡️ Prossimo brainstorming — Indicatori che anticipano.** Incarichi e acquisizioni di oggi diventano vendite tra qualche mese. Con 10 mesi di storico (presto 12+) si può misurare il ritardo tipico e fare una **previsione semplice delle vendite** del trimestre ("al ritmo di incarichi attuale, a dicembre vi aspettate circa X vendite").
11. ✅ **Fatto (0.17.0, solo amministrazione)** — **Segnali di allarme automatici.** Scelti da Davide: calo prolungato, fuori dal solito, buone notizie. Invece di guardare 47 righe, la piattaforma segnala solo ciò che cambia davvero: "Ufficio X: appuntamenti in calo da 4 settimane", "Ufficio Y: portafoglio −15% in un mese". Tecnicamente: carte di controllo (soglie calcolate sulla variabilità dell'ufficio stesso).
12. **Obiettivi realistici?** Distribuzione del raggiungimento: chi raggiunge sempre il 150% ha probabilmente obiettivi troppo bassi; chi è sempre al 40% troppo alti. Utile per decidere il budget (punto 2.1.3).
13. **➡️ Prossimo brainstorming — Turnover e permanenza.** Con date di inizio e fine: quanti collaboratori restano dopo 6 e 12 mesi, per gruppo di ingresso, e quanto costa in produzione un'uscita.
14. **Profili di ufficio.** Raggruppare gli uffici simili (molta locazione / molta vendita, grandi / piccoli, zona centrale / periferica) per confrontare ognuno con i suoi simili.
15. **Commento automatico della riunione** con l'intelligenza artificiale: 5 righe sui fatti principali della settimana e domande da fare agli uffici, generate dai numeri e dalle note. Costo basso, ma i numeri vanno sempre controllati.

### 3.4 Accesso ai dati per chi analizza
16. **Collegamento a strumenti di analisi** (Looker Studio gratuito, o Metabase) con un accesso in sola lettura al database, per fare analisi senza toccare la piattaforma.
17. **Esportazione CSV "lunga"** (una riga per ufficio-settimana-voce) oltre al backup Excel, comoda per Excel pivot o altri strumenti.

---

## 4. Miglioramenti a ciò che esiste

| # | Cosa | Perché |
|---|---|---|
| 1 | **Aprire il mensile agli uffici** (`mensile_aperto = 'si'`) e dare i punti veri della gara | È pronto ma ancora "Work in progress" |
| 2 | **Doppio inserimento** settimanale + mensile per persona | È lavoro doppio per gli uffici. Da discutere: inserire la settimana per persona e calcolare il mese da solo? O tenere il settimanale per ufficio e il mensile per persona come oggi? È la decisione più importante per il futuro |
| 3 | Admin di Milano, Gmail dedicato dei rapportini, verifica della 008 | Punti aperti noti |
| 4 | Prova con 2 uffici pilota e prova sul proiettore (Fasi 2 e 4) | Nel README risultano ancora da fare |
| 5 | **Backup automatico** settimanale (oggi è solo manuale) | Se nessuno lo scarica, non c'è |
| 6 | **Avviso se i promemoria falliscono** (email a Davide se GitHub Actions dà errore) | Oggi un errore passa inosservato |
| 7 | **Password**: cambio obbligato al primo accesso; per gli admin una seconda verifica | Le password "nome ufficio + 4 cifre" sono facili da indovinare |
| 8 | **Privacy (GDPR)**: nomi e risultati delle persone sono dati personali | Serve un'informativa ai collaboratori, chi può vederli, per quanto si conservano |
| 9 | Riunione: pagina finale "da seguire" con gli uffici segnalati e gli impegni | Rende la riunione più operativa |
| 10 | Aree e responsabili d'area | Restano spenti per scelta di Davide: da riaprire solo se lo chiede lui |

---

## 5. Priorità suggerita (impatto ÷ fatica)

**Subito, poca fatica**
- Aprire il mensile e fissare i punti della gara (4.1)
- Imbuto della vendita (2.1.1) — i dati ci sono già
- Classifiche per persona e media per settimana (3.2.6, 3.2.7)
- Backup automatico e avviso promemoria falliti (4.5, 4.6)
- Dizionario delle voci (3.1.3)

**Prossimi mesi, fatica media**
- Scheda del collaboratore e curva dei nuovi (2.2.6, 2.2.7)
- Segnali di allarme automatici (3.3.11)
- Impegni della riunione (2.1.5)
- Controlli all'inserimento e verifica settimane/mensile (3.1.2, 3.1.4)
- Posizione anonima nella città (2.4.12)

**Strategici, da decidere insieme**
- Budget annuale per ufficio (2.1.3)
- Provvigioni / dati economici (2.1.2)
- Unificare settimanale e mensile (4.2)
- Previsione delle vendite (3.3.10) — dopo 12 mesi di dati
- Commento automatico con l'intelligenza artificiale (3.3.15)

---

## 6. Domande per il brainstorming
1. La piattaforma deve restare un **rapportino** o diventare lo **strumento di guida** degli uffici (obiettivi, impegni, allarmi)?
2. Gli uffici accetterebbero di inserire le **provvigioni**?
3. Il doppio inserimento settimanale + mensile è sostenibile per gli uffici?
4. Chi fissa gli obiettivi: l'ufficio o la direzione?
5. Quanto deve vedere un ufficio degli altri (nomi, posizione anonima, solo totali)?
6. Il collaboratore deve poter vedere i propri numeri e il proprio punteggio?
7. Serve una vista per i responsabili d'area, oppure gli affiliati coprono già questo ruolo?
