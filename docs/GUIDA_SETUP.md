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

1. **SQL Editor → New query**. Incolla queste righe, **cambia le due email** con le vostre e clicca **Run**:

   ```sql
   -- Modello delle email tecniche di accesso: {utente} viene sostituito dal nome utente
   insert into impostazioni (chiave, valore)
   values ('modello_email_accesso', 'rapportini.gruppo+{utente}@gmail.com');

   -- Il tuo account (1 = Roma, la città che vedi all'apertura)
   insert into utenti (nome_utente, nome, ruolo, citta_id, email_promemoria)
   values ('davide', 'Davide', 'admin_generale', 1, 'la.tua.email@gmail.com');
   ```

   La seconda email (`email_promemoria`) è quella su cui riceverai il riepilogo del lunedì mattina.
2. Apri **Authentication → Users → Add user → Create new user**:
   - **Email**: `rapportini.gruppo+davide@gmail.com`, cioè il vostro Gmail con `+davide` prima della `@`
   - **Password**: scegline una, di almeno 8 caratteri
   - lascia la spunta su **Auto Confirm User**
   - clicca **Create user**.

Questo è l'unico account da creare a mano. Tutti gli altri (uffici, responsabili, amministratore di Milano)
li creerai dalla pagina **Amministrazione** della piattaforma.

## Passo 7 — Collegare il sito a Supabase e pubblicarlo

1. In Supabase apri **Project Settings** (l'ingranaggio) → **API Keys** (o **Data API**). Ti servono:
   - **Project URL**, del tipo `https://abcdefgh.supabase.co`
   - la chiave **publishable** (`sb_publishable_…`) oppure, se c'è solo quella, la chiave **anon public**
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

I promemoria partono da GitHub: il venerdì alle 16 e la domenica alle 10 agli uffici che non hanno
inserito nulla, il lunedì alle 7:30 agli amministratori con l'elenco di chi manca.

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

5. **Prova**: scheda **Actions** → *Promemoria* → **Run workflow**. Scegli `venerdi`, nel campo
   *email_prova* scrivi la **tua** email e clicca **Run workflow**. Riceverai le email che sarebbero
   partite: l'oggetto inizia con `[PROVA → …]` e indica a chi sarebbero andate.

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
| I promemoria non arrivano | Scheda **Actions → Promemoria**: apri l'ultima esecuzione e leggi l'errore. Spesso è la password per app Gmail |
| Il segno nella scheda Actions è rosso ❌ | Apri l'esecuzione, copia il messaggio d'errore e mandalo a Claude |
