# Rapportini Settimanali

Piattaforma web dove gli uffici immobiliari del gruppo inseriscono ogni settimana
le proprie attività e i dati di zona. Sostituisce i file Excel su OneDrive.

- **Ogni ufficio** compila la propria settimana da computer o telefono, entrando con **nome utente e password**. Gli account li creano gli amministratori dalla piattaforma.
- **Promemoria automatici** via Gmail:
  - rapportino settimanale: il sabato alle 10 e il lunedì della riunione alle 9:30 agli uffici che non hanno compilato;
  - rapportino mensile: 3 giorni prima e il giorno prima della scadenza agli uffici che non hanno compilato, e il giorno dopo il riepilogo all'amministratore generale.
- **Cruscotto, stato compilazione, grafici e modalità riunione** a tutto schermo per la riunione del lunedì.
  Uffici e affiliati hanno la loro **Presentazione** con i soli propri uffici; si presenta una settimana o un mese.
  Nella Presentazione di un ufficio c'è anche la pagina con i totali di tutta la sua città (solo le somme).
- **Esiti, totali del mese e quota di mercato** si calcolano da soli: niente più #DIV/0! o totali sbagliati.
- **Roma e Milano** sono sezioni separate, ognuna con la propria riunione del lunedì.
- **Chi vede cosa**:
  - ufficio: solo il proprio;
  - amministratore di città: la sua città;
  - amministratore generale: tutto.

  Aree e responsabili d'area sono predisposti ma disattivati (`AREE_ATTIVE` in `src/lib/contesto.ts`).

## Stato del progetto

| Fase | Contenuto | Stato |
|---|---|---|
| 1 | Account, sito online, accesso | ✅ Online dal 12/10/2026: https://gruppocec.github.io/rapportini-settimanali/ |
| 2 | Database, regole di sicurezza, "Inserisci settimana" | Codice pronto: da provare con 2 uffici pilota |
| 3 | Cruscotto, stato compilazione, promemoria, amministrazione | Codice pronto |
| 4 | Grafici di andamento e modalità riunione | Codice pronto: da provare sul proiettore |
| 5 | Import dello storico dagli Excel | ✅ Caricato il 13/10/2026: 47 uffici, 11.635 valori (gen–ott 2026) |
| 6 | Avvio per tutti gli uffici | Da fare |
| — | Account affiliati in sola consultazione (0.6.0) | Codice pronto: prima di usarli eseguire `006_affiliati.sql` in Supabase (vedi `docs/GUIDA_SETUP.md`, "Affiliati") |
| — | Settimane vuote completate dal rapportino mensile (0.11.0) | Codice pronto: eseguire `011_settimane_dal_mensile.sql` in Supabase, poi pubblicare |
| — | Presentazione mensile con i rapportini mensili (0.10.0) | Codice pronto: eseguire `010_totali_mensili_citta.sql` in Supabase (dopo la 009), poi pubblicare |
| — | Storico mensile 2026 e confronto 2025 dal file Excel annuale (0.9.0) | Codice pronto: eseguire `009_storico_mensile.sql` e `import/sql/STORICO_MENSILE_2026.sql` in Supabase |
| — | Totali della città nella Presentazione degli uffici (0.8.0) | Codice pronto: eseguire `008_totali_citta.sql` in Supabase, poi pubblicare |
| — | Rapportino mensile (0.5.0) | Online in prova ("Work in progress"): gli uffici non possono ancora inserire. Si apre con `mensile_aperto = 'si'` (vedi CHANGELOG) |

**Vederlo subito con dati inventati**: `npm install`, poi `npm run demo`.

## Com'è fatto

```
Colleghi (browser/telefono)
   → Sito (GitHub Pages, pubblicato in automatico a ogni modifica)
   → Supabase (database + accesso con nome utente e password + regole di sicurezza)
   ← GitHub Actions (promemoria via Gmail: settimanali e mensili)
```

| Percorso | Contenuto |
|---|---|
| `src/` | Il sito (React + TypeScript) |
| `src/lib/settimane.ts`, `src/lib/calcoli.ts` | Regole di calcolo (settimane, esiti, quota) |
| `supabase/migrations/` | Struttura del database e regole di accesso |
| `supabase/functions/gestione-account/` | Funzione sul server che crea gli account e reimposta le password |
| `scripts/promemoria.mjs` + `.github/workflows/promemoria.yml` | Promemoria email automatici (il calendario è in `scripts/promemoria-calendario.mjs`) |
| `demo/` | Versione dimostrativa con finto database (`npm run demo`) |
| `supabase/TUTTO_IN_UNO.sql` | Le migrazioni unite, da incollare in Supabase (si rigenera con `npm run sql:unico`) |
| `test/` e `src/**/*.test.ts` | Test automatici, compresi quelli sulle regole di sicurezza |
| `docs/` | Guide in italiano |
| `import/` | File Excel storici: **esclusi da GitHub** |

## Regole di calcolo

- **Settimana**: da lunedì a domenica. Appartiene al mese in cui cade il suo giovedì, quindi ogni mese ha 4 o 5 settimane.
- **Esito** = Risultato − Obiettivo.
- **Mese**:
  - le attività si sommano;
  - i dati di zona (Portafoglio, Incarichi in zona…) prendono il valore dell'ultima settimana.
- **Quota di mercato** = Portafoglio ÷ Incarichi in zona: gli incarichi in zona comprendono già quelli in portafoglio. L'obiettivo è il 20%.

## Comandi (per chi sviluppa)

```bash
npm install        # installa le dipendenze
npm run demo       # versione dimostrativa con dati inventati (nessun account necessario)
npm run dev        # avvia il sito in locale sul database vero (serve .env.local, vedi .env.example)
npm test           # esegue tutti i test
npm run build      # prepara il sito per la pubblicazione
npm run sql:unico  # rigenera supabase/TUTTO_IN_UNO.sql
node scripts/importa-storico.mjs  # legge gli Excel in import/ e prepara resoconto e file SQL
node scripts/crea-account.mjs     # crea in blocco gli account da import/account.csv (prima prova, poi --esegui)
node scripts/ricarica-storico.mjs # sostituisce nel database i dati importati dagli Excel (prima prova, poi --esegui)
```
