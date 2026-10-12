# Rapportini Settimanali

Piattaforma web dove gli uffici immobiliari del gruppo inseriscono ogni settimana
le proprie attività e i dati di zona. Sostituisce i file Excel su OneDrive.

- **Ogni ufficio** compila la propria settimana da computer o telefono, entrando con **nome utente e password**. Gli account li creano gli amministratori dalla piattaforma.
- **Promemoria automatici** via Gmail:
  - il venerdì e la domenica agli uffici che non hanno compilato;
  - il lunedì mattina agli amministratori, con l'elenco di chi manca.
- **Cruscotto, stato compilazione, grafici e modalità riunione** a tutto schermo per la riunione del lunedì.
- **Esiti, totali del mese e quota di mercato** si calcolano da soli: niente più #DIV/0! o totali sbagliati.
- **Roma e Milano** sono sezioni separate, ognuna con la propria riunione del lunedì.
- **Chi vede cosa**:
  - ufficio: solo il proprio;
  - responsabile d'area: la sua area;
  - amministratore di città: la sua città;
  - amministratore generale: tutto.

## Stato del progetto

| Fase | Contenuto | Stato |
|---|---|---|
| 1 | Account, sito online, accesso | Codice pronto: da mettere online con [docs/GUIDA_SETUP.md](docs/GUIDA_SETUP.md) |
| 2 | Database, regole di sicurezza, "Inserisci settimana" | Codice pronto: da provare con 2 uffici pilota |
| 3 | Cruscotto, stato compilazione, promemoria, amministrazione | Codice pronto |
| 4 | Grafici di andamento e modalità riunione | Codice pronto: da provare sul proiettore |
| 5 | Import dello storico dagli Excel | Da fare: servono i file |
| 6 | Avvio per tutti gli uffici | Da fare |

**Vederlo subito con dati inventati**: `npm install`, poi `npm run demo`.

## Com'è fatto

```
Colleghi (browser/telefono)
   → Sito (GitHub Pages, pubblicato in automatico a ogni modifica)
   → Supabase (database + accesso con nome utente e password + regole di sicurezza)
   ← GitHub Actions (promemoria via Gmail: venerdì, domenica, lunedì)
```

| Percorso | Contenuto |
|---|---|
| `src/` | Il sito (React + TypeScript) |
| `src/lib/settimane.ts`, `src/lib/calcoli.ts` | Regole di calcolo (settimane, esiti, quota) |
| `supabase/migrations/` | Struttura del database e regole di accesso |
| `supabase/functions/gestione-account/` | Funzione sul server che crea gli account e reimposta le password |
| `scripts/promemoria.mjs` + `.github/workflows/promemoria.yml` | Promemoria email automatici |
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
- **Quota di mercato** = Portafoglio ÷ (Portafoglio + Incarichi in zona). L'obiettivo è il 20%.

## Comandi (per chi sviluppa)

```bash
npm install        # installa le dipendenze
npm run demo       # versione dimostrativa con dati inventati (nessun account necessario)
npm run dev        # avvia il sito in locale sul database vero (serve .env.local, vedi .env.example)
npm test           # esegue tutti i test
npm run build      # prepara il sito per la pubblicazione
npm run sql:unico  # rigenera supabase/TUTTO_IN_UNO.sql
```
