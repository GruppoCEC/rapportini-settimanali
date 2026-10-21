# Guida alla messa online — passo per passo

Questa guida porta la piattaforma da "file sul Mac" a "sito online usato dagli uffici".
Si fa **una volta sola** e richiede circa un'ora. Non serve saper programmare: basta seguire
i passi nell'ordine. Se qualcosa non torna, fermati e chiedi a Claude.

Servono questi servizi, tutti gratuiti:

| Servizio | A cosa serve |
|---|---|
| **GitHub** | Custodisce il codice, pubblica il sito e invia i promemoria |
| **GitHub Desktop** | Programma per il Mac che carica le modifiche su GitHub, senza Terminale |
| **Supabase** | Il database: conserva i dati e gestisce gli accessi |
| **Il Gmail dei rapportini** | Spedisce i promemoria. Nel seguito lo chiamiamo `rapportini.gruppo@gmail.com`: **sostituiscilo ovunque con il vostro indirizzo vero** |

> **Come funziona l'accesso.** Ogni ufficio entra con **nome utente e password**, ad esempio
> `somalia`. Supabase però ragiona con le email, quindi per ogni nome utente la piattaforma crea
> da sola un'email "tecnica" basata sul vostro Gmail, ad esempio `rapportini.gruppo+somalia@gmail.com`.
> Gli uffici non la vedranno mai e non devono usarla. Se per errore partisse un messaggio a
> quell'indirizzo, arriverebbe nel vostro Gmail.

---

## Passo 1 — Account GitHub e GitHub Desktop

1. Vai su <https://github.com/signup> e crea un account (se non l'hai già). Il nome utente
   comparirà nell'indirizzo del sito, ad esempio `gruppocec.github.io/rapportini-settimanali`.
2. Scarica **GitHub Desktop** da <https://desktop.github.com>, aprilo e accedi con l'account
   (menu **GitHub Desktop → Settings → Accounts → Sign in**).

## Passo 2 — Pubblicare il progetto su GitHub

1. In GitHub Desktop: menu **File → Add Local Repository…** → **Choose…** → seleziona la cartella
   `Piattaforma Rapportini Settimanali` → **Add Repository**.
2. In basso a sinistra, nel campo **Summary**, scrivi `Prima versione` e clicca **Commit to main**.
3. In alto clicca **Publish repository**:
   - **Name**: `rapportini-settimanali`
   - **togli la spunta** da *Keep this code private* (vedi nota sotto)
   - clicca **Publish Repository**.

> **Perché pubblico?** GitHub Pages è gratuito solo per i repository pubblici. Su GitHub c'è
> **solo il codice**, nessun dato e nessuna password: i dati stanno in Supabase, protetti dalle
> regole di accesso. La cartella `import/`, dove metterai gli Excel storici, è esclusa e non viene caricata.

## Passo 3 — Creare il database su Supabase

1. Vai su <https://supabase.com> → **Start your project** → accedi con **Continue with GitHub**.
2. Clicca **New project**:
   - **Name**: `rapportini`
   - **Database Password**: clicca *Generate a password* e **salvala** in un posto sicuro
   - **Region**: `Central EU (Frankfurt)`, così i dati restano in Europa (GDPR)
   - clicca **Create new project** e attendi 1–2 minuti.
3. Nel menu a sinistra apri **SQL Editor** e clicca **New query**.
4. Sul Mac apri il file `supabase/TUTTO_IN_UNO.sql` con TextEdit. Seleziona tutto con **⌘A**, copia con **⌘C**
   e incolla nell'editor di Supabase con **⌘V**.
5. Clicca **Run**. Deve comparire `Success. No rows returned`.
   ⚠️ Fallo **una volta sola**: se lo ripeti compaiono errori "already exists". Sono innocui, ma vuol dire che era già fatto.

## Passo 4 — Bloccare le iscrizioni libere

Gli account li creano solo gli amministratori dalla piattaforma, quindi nessuno deve potersi iscrivere da solo.

1. In Supabase apri **Authentication → Sign In / Providers**.
2. Disattiva **Allow new users to sign up** e clicca **Save**.
3. Nella stessa pagina, controlla che il provider **Email** sia attivo: serve per l'accesso con password.

## Passo 5 — Installare la funzione che crea gli account

Creare un account richiede una chiave segreta, che non può stare nel sito. Per questo c'è una piccola
funzione che gira su Supabase.

1. In Supabase apri **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Come nome scrivi esattamente `gestione-account`.
3. Sul Mac apri il file `supabase/functions/gestione-account/index.ts` con TextEdit, copia tutto il contenuto
   e incollalo nell'editor di Supabase, **al posto** del codice d'esempio.
4. Clicca **Deploy function** e attendi la conferma.

## Passo 6 — Il tuo account da amministratore generale

1. **SQL Editor → New query**. Incolla queste righe, **cambia le due email** con le vostre e clicca **Run**.
   Copia solo le righe di testo: **non** le righe con <code>```sql</code> e <code>```</code>, che servono solo a impaginare la guida.

   ```sql
   -- Modello delle email tecniche di accesso: {utente} viene sostituito dal nome utente
   insert into impostazioni (chiave, valore)
   values ('modello_email_accesso', 'rapportini.gruppo+{utente}@gmail.com');

   -- Il tuo account (1 = Roma, la città che vedi all'apertura)
   insert into utenti (nome_utente, nome, ruolo, citta_id, email_promemoria)
   values ('davide', 'Davide', 'admin_generale', 1, 'la.tua.email@gmail.com');
   ```

   La seconda email (`email_promemoria`) è quella su cui riceverai il riepilogo del rapportino mensile.
2. Apri **Authentication → Users → Add user → Create new user**:
   - **Email**: `rapportini.gruppo+davide@gmail.com`, cioè il vostro Gmail con `+davide` prima della `@`
   - **Password**: scegline una, di almeno 8 caratteri
   - lascia la spunta su **Auto Confirm User**
   - clicca **Create user**.

Questo è l'unico account da creare a mano. Tutti gli altri (uffici, responsabili, amministratore di Milano)
li creerai dalla pagina **Amministrazione** della piattaforma.

## Passo 7 — Collegare il sito a Supabase e pubblicarlo

1. In Supabase ti servono due valori:
   - **Project URL**, del tipo `https://abcdefgh.supabase.co`. Lo trovi in **Project Settings → Data API**, oppure cliccando **Connect** in alto nella pagina del progetto. In alternativa ricavalo dalla barra degli indirizzi del browser: in `supabase.com/dashboard/project/abcdefgh` il codice finale `abcdefgh` dà `https://abcdefgh.supabase.co`.
   - la chiave **publishable** (`sb_publishable_…`), in **Project Settings → API Keys**. Se c'è solo quella, usa la chiave **anon public**.
2. Su GitHub apri il repository → **Settings → Secrets and variables → Actions** → scheda **Variables** →
   **New repository variable**. Creane tre:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | il Project URL |
   | `SUPABASE_KEY` | la chiave publishable/anon |
   | `SITO_URL` | `https://<tuo-utente-github>.github.io/rapportini-settimanali/` |

3. Sempre in **Settings** apri **Pages**. Alla voce **Source** scegli **GitHub Actions**.
4. Vai nella scheda **Actions**, apri *Pubblica il sito* e clicca **Run workflow** → **Run workflow**.
   Dopo 1–2 minuti compare un segno di spunta verde ✅.
5. Apri l'indirizzo del sito (`SITO_URL`), entra con nome utente `davide` e la password del passo 6.

✅ **Verifica della Fase 1**: se vedi il menu con *Cruscotto*, *Riunione*, *Amministrazione* e "Roma" in alto, comunicalo a Claude.

## Passo 8 — Promemoria automatici via Gmail

I promemoria partono da GitHub:

- **rapportino settimanale**, agli uffici che non hanno inserito nulla:
  - il sabato alle 10, per la settimana in corso;
  - il lunedì della riunione alle 9:30, per la settimana appena chiusa. Se GitHub è in ritardo, questa
    email parte al massimo fino alle 11:30, così arriva prima delle riunioni (Milano alle 12, Roma alle 13);
- **rapportino mensile**: alle 10, 3 giorni prima e il giorno prima della scadenza, agli uffici che non hanno
  inserito nulla. Il giorno dopo la scadenza l'amministratore generale riceve il riepilogo: chi manca, chi
  è incompleto e chi ha inserito in ritardo. Partono solo se:
  - il mensile è aperto agli uffici (`mensile_aperto = 'si'`);
  - per quel mese è fissata una scadenza in **Report mensile → Panoramica**.

1. Accedi al Gmail dei rapportini e attiva la **verifica in due passaggi** su
   <https://myaccount.google.com/security>.
2. Vai su <https://myaccount.google.com/apppasswords>, crea una password per app chiamata `Rapportini`
   e copia il codice di 16 lettere (senza spazi).
3. In Supabase → **Project Settings → API Keys**, copia la chiave **secret** (`sb_secret_…`)
   oppure quella **service_role**. ⚠️ Questa è segreta: va **solo** nel prossimo punto, mai altrove.
4. Su GitHub → **Settings → Secrets and variables → Actions** → scheda **Secrets** → **New repository secret**. Creane tre:

   | Name | Value |
   |---|---|
   | `SUPABASE_SERVICE_KEY` | la chiave secret/service_role |
   | `GMAIL_UTENTE` | `rapportini.gruppo@gmail.com` |
   | `GMAIL_PASSWORD_APP` | il codice di 16 lettere |

5. **Prova**: scheda **Actions** → *Promemoria* → **Run workflow**. Scegli `sabato` (oppure `lunedi`), nel campo
   *email_prova* scrivi la **tua** email e clicca **Run workflow**. Riceverai le email che sarebbero
   partite: l'oggetto inizia con `[PROVA → …]` e indica a chi sarebbero andate.
6. **Prova del mensile**: come al punto 5, ma scegli `mensile_3giorni`, `mensile_vigilia` oppure
   `mensile_riepilogo`. Nel campo *mese* scrivi il mese, per esempio `2026-09`; se lo lasci vuoto vale
   il mese appena concluso. In prova le email partono anche se il mensile non è ancora aperto. Se il
   mese non ha una scadenza, si usa la proposta: il 5 del mese dopo alle 23:59.
7. Quando le prove vanno bene, chiedi a Claude di mettere `PROMEMORIA_ATTIVI = true`: il sito
   comincerà ad annunciare i promemoria agli uffici.

> **Se Google blocca il Gmail dei rapportini** ("Non è stato possibile verificare la tua identità",
> succede con gli account creati da pochi giorni): usa intanto un Gmail più vecchio, ripetendo i punti
> 1–2 con quell'account e mettendo il suo indirizzo in `GMAIL_UTENTE`. Quando il Gmail dei rapportini
> si sblocca, basta aggiornare `GMAIL_UTENTE` e `GMAIL_PASSWORD_APP`: non serve cambiare altro.

> Gli uffici ricevono i promemoria solo se il loro account ha un'**email per i promemoria**:
> si imposta in Amministrazione, dove gli account senza email sono segnalati in rosso.

---

## Fase 2 — Prova con due uffici pilota (dalla piattaforma)

1. **Amministrazione → Aree**: crea le aree di Roma (facoltative).
2. **Amministrazione → Uffici**: aggiungi due uffici pilota.
3. **Amministrazione → Account**: crea un account per ciascun ufficio. La password viene proposta in automatico.
   Clicca **Copia da inviare all'ufficio** e mandala all'ufficio, ad esempio via WhatsApp, insieme alla
   [guida per i colleghi](GUIDA_COLLEGHI.md).

**Verifica della Fase 2**:
- ogni ufficio pilota entra, compila una settimana e salva;
- ognuno vede **solo** il proprio ufficio;
- tu li vedi entrambi in *Cruscotto* e *Stato compilazione*.

## Amministratore di Milano

1. Passa a **Milano** dal menu in alto.
2. In **Amministrazione → Uffici** crea l'ufficio milanese.
3. In **Amministrazione → Account** crea un account con ruolo **Amministratore di città**, scegliendo anche
   il suo ufficio (così potrà compilarlo).

Da quel momento potrà creare da solo uffici e account di Milano, senza vedere Roma.

## Affiliati (account in sola consultazione, dalla versione 0.6.0)

Gli affiliati vedono gli uffici che assegni loro, anche di Roma e Milano insieme, senza poter
scrivere nulla: Cruscotto, Andamento uffici e Report mensile (senza gara a punti). Non ricevono promemoria.

**Una volta sola**, prima di crearli, va aggiunta la loro tabella al database:
1. Apri Supabase → il progetto → **SQL Editor** (icona a sinistra) → **New query**.
2. Apri il file `supabase/migrations/006_affiliati.sql`, copia **tutto** il contenuto e incollalo.
3. Premi **Run**. Deve comparire "Success. No rows returned".
   (Non incollare `TUTTO_IN_UNO.sql`: rifarebbe tutto da capo e darebbe errore.)

Poi, per ogni affiliato (solo l'amministratore generale può farlo):
1. **Amministrazione → Account → Nuovo account**, ruolo **Affiliato (consultazione)**.
2. Spunta gli uffici che può vedere, scrivi nome utente e nome, poi **Crea account**.
3. Copia le credenziali che compaiono e mandale all'affiliato.

Gli affiliati sono elencati in fondo alla pagina, nella sezione **Affiliati**: da lì cambi gli uffici
(**Modifica**), dai una nuova password, disattivi o elimini l'account.

## Nuova formula della quota di mercato (dalla versione 0.6.2)

Da ora la quota è **Portafoglio ÷ Incarichi in zona**, perché gli incarichi in zona comprendono già
quelli in portafoglio. Il sito la calcola già così; va aggiornato **una volta sola** anche il database:
1. Supabase → il progetto → **SQL Editor** → **New query**.
2. Copia **tutto** il file `supabase/migrations/007_quota_mercato.sql`, incollalo e premi **Run**.
   Deve comparire "Success. No rows returned".

## Totali della città per gli uffici (dalla versione 0.8.0)

Nella Presentazione di ogni ufficio c'è la pagina con i totali di tutta la sua città. Per farla
funzionare va aggiunta **una volta sola** una funzione al database:
1. Supabase → il progetto → **SQL Editor** → **New query**.
2. Copia **tutto** il file `supabase/migrations/008_totali_citta.sql`, incollalo e premi **Run**.
   Deve comparire "Success. No rows returned".

La funzione manda all'ufficio solo le somme della sua città, mai i numeri dei singoli altri uffici.
Finché non la esegui, la Presentazione degli uffici funziona come prima, senza la pagina della città.

## Storico mensile dal file Excel annuale (dalla versione 0.9.0)

I totali di ogni ufficio da gennaio a settembre 2026 e il confronto con il 2025 vengono dal file
"BIGOLI C.E.C. ANNO 2026". Si caricano **una volta sola**, in due passi:
1. Supabase → il progetto → **SQL Editor** → **New query**. Copia **tutto** il file
   `supabase/migrations/009_storico_mensile.sql`, incollalo e premi **Run**
   ("Success. No rows returned").
2. **New query** di nuovo. Copia **tutto** il file `import/sql/STORICO_MENSILE_2026.sql`, incollalo e premi **Run**.
   In basso compare una tabella con un mese per riga (da gennaio a settembre) e il numero di uffici.
   Se invece compare "Uffici non trovati sulla piattaforma", non è stato cambiato nulla: scrivi il nome indicato a Claude.

Il passo 2 si può rifare quando il file Excel cambia: prima si rigenera il file SQL dal Terminale con
`node scripts/importa-mensile-excel.mjs "Rapportini mensili/BIGOLI C.E.C. ANNO 2026.xlsx"`.
Attenzione: il passo 2 sostituisce anche la riga "anno prima" del Report mensile scritta a mano, per i mesi del 2025.

## Presentazione mensile con i rapportini mensili (dalla versione 0.10.0)

Nella presentazione mensile ogni ufficio vede anche i totali mensili della sua città. Serve **una volta sola**,
dopo la 009:
1. Supabase → il progetto → **SQL Editor** → **New query**.
2. Copia **tutto** il file `supabase/migrations/010_totali_mensili_citta.sql`, incollalo e premi **Run**
   ("Success. No rows returned").

Senza questo passo la presentazione mensile funziona lo stesso, ma senza la pagina della città per gli uffici.

## Settimane completate dal rapportino mensile (dalla versione 0.11.0)

Il database riempie da solo le settimane vuote perché la loro somma sia uguale al rapportino mensile
(App.ti Vendita, Proposte, Incarichi, Valutazioni, Vendite, Ribassi). Si attiva **una volta sola**:
1. Supabase → il progetto → **SQL Editor** → **New query**.
2. Copia **tutto** il file `supabase/migrations/011_settimane_dal_mensile.sql`, incollalo e premi **Run**
   ("Success. No rows returned"). La prima volta completa anche i mesi già caricati (gennaio–settembre 2026).
3. Pubblica il sito con **Push origin** (serve anche ai promemoria).

Da quel momento funziona da solo: non c'è nulla da fare quando arrivano nuovi rapportini mensili.

---

## Provare il sito sul Mac

- **Con dati inventati** (non serve nessun account): apri il Terminale nella cartella del progetto ed esegui
  `npm install` (solo la prima volta), poi `npm run demo`. Il sito si apre nel browser; nella pagina di accesso
  trovi i nomi utente di prova.
- **Con i dati veri**: copia `.env.example` in `.env.local`, inserisci Project URL e chiave (passo 7), poi `npm run dev`.

## Se qualcosa va storto

| Problema | Soluzione |
|---|---|
| Il sito mostra "Configurazione mancante" | Mancano le variabili del passo 7.2, o hanno un nome diverso. Correggi e rilancia *Run workflow* |
| "Nome utente o password errati" al primo accesso | Controlla che l'email del passo 6.2 sia identica al modello del passo 6.1 con `davide` al posto di `{utente}` |
| "La piattaforma non è ancora configurata" | Manca la prima riga SQL del passo 6.1 |
| Creando un account: "La funzione gestione-account non risponde" | La funzione del passo 5 non è installata o ha un nome diverso |
| Creando un account: "Invalid JWT" | In Supabase → **Edge Functions → gestione-account → Details**, disattiva **Verify JWT** e salva: la funzione controlla da sola chi la chiama |
| Errore `421 … Temporary System Problem` | Gmail era occupato. Lo script riprova da solo e, un'ora dopo, GitHub fa un secondo tentativo: chi ha già ricevuto l'email non la riceve di nuovo. Se resta rosso, rilancia a mano **Run workflow** con lo stesso tipo (senza *email_prova*): partono solo le email mancanti |
| I promemoria non arrivano | Scheda **Actions → Promemoria**: apri l'ultima esecuzione e leggi l'errore. Spesso è la password per app Gmail |
| Il segno nella scheda Actions è rosso ❌ | Apri l'esecuzione, copia il messaggio d'errore e mandalo a Claude |
