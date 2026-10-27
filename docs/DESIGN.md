# Handoff: restyling di Rapportini Settimanali (v6)

## Overview
Nuova veste grafica per il sito `GruppoCEC/rapportini-settimanali` (React + TypeScript + Vite, Supabase). Le **funzioni non cambiano**: stesse pagine, stessi permessi per ruolo, stesse regole di calcolo (`src/lib/calcoli.ts`, `src/lib/aggregazioni.ts`). Cambia solo l'aspetto: colori Tecnocasa/Tecnorete, card bianche, semaforo verde/ambra/rosso, testata più ricca, presentazione della riunione ridisegnata, pagina di accesso nuova, animazioni.

## About the Design Files
`Rapportini Settimanali v6.dc.html` è un **prototipo di riferimento in HTML** (dati inventati), non codice da copiare. Il compito è **ricreare questo aspetto dentro il repo esistente**, mantenendo i componenti React e la logica attuali. Per aprirlo: servire la cartella con un server statico (es. `npx serve .`) e aprire il file; servono `support.js` e la cartella `_ds/` accanto. Il pannello Tweaks permette di cambiare ruolo (`admin_generale`, `admin_citta`, `ufficio`) e partire dalla schermata di accesso.

## Fidelity
**Alta fedeltà.** Colori, tipografia, spaziature, raggi e animazioni sono definitivi. Riprodurli fedelmente in `src/stile.css` (o CSS modules) e nei componenti.

## Strategia di implementazione consigliata
1. Riscrivere `src/stile.css` con i token qui sotto (variabili CSS su `:root`).
2. Caricare i font Google **Manrope** (400–800) e **Bricolage Grotesque** (500/700/800) in `index.html`, e le icone **Phosphor duotone** (`@phosphor-icons/web`, oppure `@phosphor-icons/react` con `weight="duotone"`).
3. Aggiornare i componenti nell'ordine: `App.tsx` (testata + menu) → `componenti/Celle.tsx` (semaforo, badge) → `Cruscotto.tsx` → `StatoCompilazione.tsx` → `InserisciSettimana.tsx` → `AndamentoUfficio.tsx` → `Riunione.tsx` → `Accesso.tsx` → `Amministrazione.tsx` / `Account.tsx`.
4. Aggiornare `componenti/Grafici.tsx` (area riempita, linea obiettivo arancio tratteggiata, tooltip, etichette sui mini grafici).
5. Nessuna modifica a database, permessi, `lib/`.

## Design Tokens

### Colori
| Token | Valore | Uso |
|---|---|---|
| `--tecnocasa` / `--accent` | `#0057A3` | Colore primario: pulsanti, link, linee dei grafici |
| `--accent-900` | `color-mix(in oklch, #0057A3 40%, #000)` (~`#0A2440`) | Testata, totale città, titoli in presentazione |
| `--accent-800` | `#0057A3` 58% + nero | Cerchi decorativi su blu |
| `--accent-700` | `#0057A3` 74% + nero | Testo blu su chiaro |
| `--accent-600` | `#0057A3` 88% + nero | Hover pulsante primario |
| `--accent-100/200` | `#0057A3` 8% / 18% + bianco | Fondi tenui (focus ring, avvisi info) |
| `--tecnorete` / `--accent-2` | `#EE7326` | Secondario: logo, scheda attiva, barra avanzamento, titoletti |
| `--accent-2-300` | `#EE7326` 34% + bianco | Icone/testi arancio su fondo blu |
| `--accent-2-700/800` | `#EE7326` 74% / 58% + nero | Titoletti arancio su chiaro (contrasto) |
| `--accent-2-100` | `#EE7326` 8% + bianco | Fondo riquadro note |
| `--bg` | `#F4F3EF` | Fondo pagina |
| `--surface` | `#FFFFFF` | Card |
| bordo card | `#E6E3DB` (app) / `#E3E6EB` (presentazione) | |
| testo | `#201E1D`; secondario `#4A4F5A` / `#5A6474` | |
| fondo presentazione | `#EDF0F4` | |

**Semaforo** (sostituisce verde/giallo/rosso di `Celle.tsx`; mantenere sempre anche il simbolo ✓ ≈ ✗):
| Stato | Fondo | Testo | Pieno (barre) |
|---|---|---|---|
| ✓ obiettivo raggiunto | `#E4F2EA` | `#1F6B45` | `#2F8A5B` |
| ≈ almeno 70% | `#FBF1DC` | `#8A5A00` | `#D9A23B` |
| ✗ sotto il 70% | `#FBE8E6` | `#A3241C` | `#C2453B` |

Esito positivo/negativo e quota sopra/sotto 20% usano lo stesso schema verde/rosso.

### Tipografia
- Testo e controlli: **Manrope**, 15px base, line-height 1.55.
- Titoli e numeri grandi: **Bricolage Grotesque** 800, letter-spacing −0.02em, `font-variant-numeric: tabular-nums`.
- Scala: h1 pagina 52px · h2 card 22px · KPI 44px · numeri stato 72px · titoletto (kicker) 13px 700 maiuscolo, letter-spacing .08em, colore `--accent-2-700` · etichette 11–12px 700 maiuscolo.

### Raggi, ombre, spaziature
- Raggi: card 16px · input/pulsanti 10–12px · badge/pillole 999px · celle piccole 6px.
- Ombra card presentazione: `0 1px 2px rgba(19,38,60,.06)`; copertina `0 20px 50px rgba(19,38,60,.25)`; toast/dialog `0 12px 32px rgba(45,43,43,.22)`.
- Spaziature: card padding 22px 24px; griglie KPI gap 16px; pagine padding 36px 44px (32px nella testata), max-width 1320–1360px.
- Input: altezza minima 44px (52px nella pagina di accesso), fondo bianco, bordo `#DAD7CE`, focus ring 2px `--accent`.

## Screens / Views

### 1. Testata + menu (`App.tsx`)
Fascia piena `--accent-900`, testo bianco, padding 16px 32px 0, max-width 1360px.
- **Sinistra**: logo compatto del Gruppo C.E.C. per sfondi scuri (alto 50px, dalla 0.26.0) + "Rapportini Settimanali" (Bricolage 800 22px) + sotto "Gruppo CEC · Roma e Milano" (12px 600 `#AFC0D4`).
- **Città**: per `admin_generale` un selettore a pillola Roma/Milano (contenitore `rgba(255,255,255,.1)` raggio 999, padding 4; opzione attiva fondo bianco testo blu scuro; inattiva `#D5DCE6`). Per gli altri ruoli una pillola fissa con il nome città.
- **Riquadri informativi** (fondo `rgba(255,255,255,.07)`, bordo `rgba(255,255,255,.12)`, raggio 12, padding 8px 14px, icona 22px `--accent-2-300`, etichetta 11px `#AFC0D4`, valore 14px 700):
  - "Settimana in corso" → `etichettaSettimana(settimanaCorrente)`.
  - Admin: "Uffici che hanno compilato" → "N su M" + barra 96×4px arancio. Ufficio: "La tua settimana" → badge stato.
  - "Prossimo promemoria" → prossimo venerdì o domenica (calcolarlo; nel prototipo è fisso).
  - **Non** mostrare la data della riunione.
- **Utente**: cerchio 38px arancio con iniziali (blu scuro, 800) + nome (14px 700) e ruolo (12px `#AFC0D4`); pulsante Esci quadrato 38px `rgba(255,255,255,.08)`.
- **Menu** (sotto, margin-top 14px): voci con icona Phosphor duotone 19px + etichetta. Attiva: fondo `--bg`, testo `--accent-800`, angoli superiori 16px (sembra una scheda attaccata alla pagina), barra 3px `--accent-2` sul bordo superiore che entra con `scaleX` 0→1 (0.5s). Inattive: testo `--accent-100`, icona `--accent-2-300`. Hover: `inset 0 -3px 0 --accent-2`.
- Icone: Inserisci `pencil-simple-line`, Andamento `chart-line-up`, Cruscotto `gauge`, Stato `list-checks`, Riunione `presentation-chart`, Amministrazione `gear-six`.

### 2. Accesso (`Accesso.tsx`)
Griglia a due colonne (`repeat(auto-fit, minmax(min(100%,460px),1fr))`).
- **Sinistra**: pannello `--accent-900`, padding 56px, due cerchi decorativi (`--accent-800` in alto a destra 460px; bianco 5% in basso a sinistra). Logo intero del Gruppo C.E.C. per sfondi scuri (largo 300px, dalla 0.26.0) e sotto "Rapportini Settimanali". Titolo h1 clamp(40px,4.6vw,64px): "La settimana di ogni ufficio, **in un solo posto.**" (seconda parte in `--tecnorete`). Paragrafo dal README. Tre punti con icona in quadrato 40px (`device-mobile`, `bell-ringing`, `presentation-chart`): "Compili da computer o da telefono", "Promemoria automatici il venerdì e la domenica", "Esiti, totali e quota di mercato calcolati da soli, pronti per la riunione del lunedì". In basso due mini‑card bianche decorative (Incarichi 16 su 15, 107% ✓; Quota 21,4% ✓), la seconda spostata di 14px in basso.
- **Destra**: modulo max 420px. Titoletto "Area riservata", h2 36px "Accedi al tuo ufficio", sottotitolo. Campi con icona (`user`, `lock-key`) alti 52px raggio 12; pulsante Mostra/Nascondi con icona occhio. Errore in riquadro rosso con icona. Pulsante "Entra" pieno `--accent`, alto 54px, raggio 12, ombra `0 8px 20px rgba(0,87,163,.25)`, icona `sign-in` (`circle-notch` durante l'attesa, testo "Accesso in corso…"). "Password dimenticata?…" con icona. Solo in demo (`VITE_DEMO`): riquadro tratteggiato con i 3 utenti come pulsanti che compilano nome utente + password.
- Tutti i messaggi di errore restano quelli di `traduciErrore`.

### 3. Inserisci settimana (`InserisciSettimana.tsx`)
- Intestazione: titoletto arancio, nome ufficio h1 52px (o select grande se più uffici), "Ultimo salvataggio…". A destra selettore settimana: pulsanti icona ‹ › (36px) + etichetta ("Settimana in corso"/"Settimana scorsa") + intervallo.
- Due colonne (`auto-fit minmax(440px,1fr)`, gap 56px 72px), ogni sezione in card bianca. Titoli h2 con icona in quadrato 42px raggio 16: Attività `briefcase` (fondo `--accent-200`), Dati di zona `map-pin-area` (fondo `--accent-2-200`), Note `note-pencil` (fondo ambra).
- Tabella attività: input 88px allineati a destra, risultato in grassetto; caselle non valide bordo `--accent-2`. **Esito** in pillola: verde `#E4F2EA/#1F6B45` se ≥0, rosso se <0, larghezza minima 54px.
- Avviso valori proposti: fondo `--accent-100`, icona `info`.
- Quota di mercato: numero 46px colorato (verde/rosso), barra 8px scala 0–40% con tacca nera al 20%, didascalia della formula.
- Barra di salvataggio fissa in basso (`position: sticky`), fondo semitrasparente con blur 8px: messaggio ok/errore con icona, oppure pallino arancio pulsante + "Modifiche non salvate"; pulsante "Salva" (icona `floppy-disk`, `circle-notch` durante il salvataggio). Dopo il salvataggio: toast scuro in basso a destra "Dati salvati alle HH:MM." (3,2s).

### 4. Andamento / Il mio ufficio (`AndamentoUfficio.tsx`)
Card "Andamento ultime 12 settimane" con select della voce (optgroup Attività/Zona) e legenda; grafico (vedi sotto). Card "Riepilogo mese per mese": tabella con celle semaforo, sezione "Zona (valore a fine mese)", riga Quota.

### 5. Cruscotto (`Cruscotto.tsx`)
- Intestazione: titoletto "Cruscotto · Roma", h1 = periodo ("Settimana 5 – 11 ottobre 2026" / "Ottobre 2026"). A destra controllo segmentato Settimana/Mese (contenitore `#E7E5DE` raggio 10 padding 4; opzione attiva bianca con ombra) + frecce ‹ ›.
- **KPI** (griglia `auto-fill minmax(220px,1fr)` gap 16): card bianca; in alto nome (14px 700 `#4A4F5A`) e badge a pillola con % e simbolo ("103% ✓") colorato col semaforo; valore 44px; barra 8px arrotondata colorata col semaforo; nota "obiettivo N · x%". Voci: prime 6 attività + Quota di mercato + Uffici che hanno compilato (solo settimana).
- Tabella uffici in card: celle semaforo (valore grande + "/ obiettivo simbolo"), colonna Quota, nome ufficio fisso a sinistra (sticky); **riga totale città con fondo `--accent-900` e testo bianco**. Legenda sotto.
- Card andamento città 12 settimane con select voce. Card Roma vs Milano (solo admin generale).

### 6. Stato compilazione (`StatoCompilazione.tsx`)
Tre riquadri colorati pieni (fondo semaforo, raggio 16, padding 20px 22px) con numero 72px: Completi / Parziali / Mancanti. Sotto, barra segmentata 10px (verde/ambra/rosso, raggio 4, proporzionale). Card tabella: badge a pillola "✓ Completo" / "◐ Parziale" / "✗ Mancante"; email mancanti in rosso "nessuna: non riceve promemoria"; pulsante "Copia email dei mancanti (N)" → "Copiate" con icona check per 2,5s.

### 7. Riunione (`Riunione.tsx`)
**Pagina di avvio**: elenco contenuti con icone, scorciatoie in `kbd`, selettore settimana, contatori (pagine, uffici compilati), pulsante grande "Avvia la presentazione" (icona `play`).

**Presentazione** a tutto schermo, fondo `#EDF0F4`, griglia righe `auto 1fr auto`:
- Testata `--accent-900`: logo 36px, sopra il titolo il marchio "Roma · 5 – 11 ottobre 2026" (12px 700 maiuscolo arancio chiaro), titolo pagina 32px bianco, pillola "3 / 21", pulsante Esci. Sotto, barra di avanzamento 4px `--tecnorete` (transizione width 0.5s).
- Piede bianco: ‹ select "Vai alla pagina" › + "← → per sfogliare · Esc per uscire". **Il select deve essere controllato** (`value={indice}`).
- Cambio pagina: contenuto da opacity 0 / translateY 18px → 1 / 0, e i numeri/barre ripartono da zero (vedi Animazioni).

Pagine:
1. **Copertina**: un unico pannello `--accent-900` raggio 22, padding 48px 56px, due cerchi decorativi. Sinistra: logo 44 + "Riunione settimanale · Gruppo CEC"; città h1 clamp(80px,10vw,150px) bianco; pillola settimana fondo `--tecnorete` testo blu scuro; tre riquadri traslucidi: Incarichi, Vendite, Quota di mercato (valore 40px, sotto "obiettivo N · x%" in verde chiaro `#8FE0B4` se raggiunto, rosa `#FFB3A8` se no). Destra: anello 210px (`conic-gradient` arancio su bianco 12%, foro 166px) con "13 su 14 uffici" che si riempie animato; testo "hanno inserito i dati della settimana" + "Mancano: …"; **mosaico** di tutti gli uffici (`auto-fill minmax(128px,1fr)` gap 8) colorati per stato (verde ✓, ambra ◐, rosso ✗) con legenda.
2. **Totali**: tre card di sintesi colorate (Obiettivi raggiunti "5 su 8" `target`; Quota di mercato `chart-pie-slice` verde/rossa; Rispetto alla settimana scorsa "5 ▲ · 3 ▼" `trend-up`). Sotto, card "tabellone" con una riga per attività, colonne `minmax(110px,1.2fr) minmax(100px,1fr) minmax(130px,2fr) 60px minmax(110px,1fr) minmax(110px,1fr)`: nome · risultato 38px "/ obiettivo" · barra 18px (scala 0–130%, colore semaforo) con tacca scura al 100% (= 76,9%) · % colorata · pillola "▲ +3 vs scorsa" verde / "▼ 2" rossa · mini grafico 8 settimane (170×46, senza etichette).
3. **Classifiche** (2 attività per pagina): card con barre orizzontali raggio 6; verde `--ok` se obiettivo raggiunto, altrimenti `--accent-2-400`; etichetta "15 / 12 ✓".
4. **Quota di mercato**: card con barre per ufficio, tacca obiettivo 20%, verde sopra / rosso sotto.
5. **Una pagina per ufficio**: riga di 4 card (Compilazione: badge grande + "Salvato ven 9/10, 18:42 da somalia"; Obiettivi raggiunti "5 su 8" + barra verde; Quota di mercato con fondo verde/rosso tenue e "✓ sopra / ✗ sotto l'obiettivo del 20%"; Dati di zona: portafoglio e incarichi in zona). Sotto, due colonne: a sinistra card tabella (esito in pillola verde/rossa) e card note (fondo `--accent-2-100`, icona `quotes` 34px, testo 20px); a destra card "Andamento ultime 8 settimane" con 9 mini grafici (8 attività + quota) in riquadri `#F6F8FA` raggio 12, **con etichetta del valore su ogni punto e data sotto**.

### 8. Amministrazione / Il mio account
Stessa struttura attuale, in card bianche. Esiti in riquadro colorato (verde/rosso) con icona; credenziali con pulsante "Copia da inviare all'ufficio". Conferme (nuova password, elimina, modifiche non salvate) in **dialog** modale invece di `window.confirm`: titolo, testo, Annulla + pulsante colorato (arancio/rosso per azioni distruttive), animazione pop 0.25s, chiusura con Esc o clic sullo sfondo.

## Grafici (`Grafici.tsx`)
- Linea risultato `--accent` 2.5px, punti bianchi bordati; area sotto `--accent` opacità 0.2; obiettivo tratteggiato `4 4` `--accent-2-500`; linea di riferimento quota 20% tratteggiata `--accent-2` con etichetta "obiettivo 20%".
- Griglia: 5 linee orizzontali tratteggiate `2 5`, assi 11px.
- Hover: colonna invisibile per settimana, linea verticale, punto ingrandito, tooltip card (Settimana del 5/10 · Risultato · Obiettivo).
- Mini grafici riunione: 260×150, etichetta valore 12px 700 sopra ogni punto (percentuale con una decimale per la quota), date 10px sotto.

## Interactions & Behavior — Animazioni
- **Entrata pagina**: `rsUp` (opacity 0, translateY 16px → 0) 0.5s `cubic-bezier(.2,.7,.2,1)`; sezioni successive con ritardo 80–160ms; righe di tabella `rsFade` con ritardo 25ms per riga; KPI 45ms per card.
- **Conteggio**: un unico progresso `t` 0→1 in 950ms (easing cubico out) riavviato a ogni cambio pagina/periodo/voce/slide. Numeri = `round(valore × t)`, larghezze barre = `% × t`, grafici rivelati da un `clipPath` largo `W × t`, anello `360° × t`. Fallback: se `document.hidden` o dopo 1,2s impostare `t = 1`. Rispettare `prefers-reduced-motion` (t = 1 subito).
- Toast `rsPop` 0.35s; dialog `rsPop` 0.25s; pallino "modifiche non salvate" pulsante 1.6s infinito.
- Scorciatoie presentazione invariate (→ spazio Invio PagGiù avanti, ← Backspace PagSu indietro, Home/Fine, Esc).

## State Management
Nessuno stato nuovo lato dati. Solo stato UI: progresso animazione `t`, indice tooltip grafico, dialog di conferma, toast. Tutti i dati arrivano dalle query attuali.

## Nota sui marchi
Nel sito **non** devono comparire i nomi "Tecnocasa" o "Tecnorete" né loghi del franchising: si usano solo i due colori (blu e arancio) come palette. I nomi `--tecnocasa`/`--tecnorete` delle variabili sono interni e si possono rinominare (es. `--primario`, `--secondario`).

## Assets
- Font: Manrope, Bricolage Grotesque (Google Fonts).
- Icone: Phosphor, peso duotone.
- Logo: dalla 0.26.0 il logo del Gruppo C.E.C. (cartella "Kit Gruppo CEC", con il manuale d'uso): logo intero nella pagina di accesso, logo compatto (file 04 e 05, tolto solo il margine trasparente) in testata, presentazioni e stampe, favicon (file 09) e icona per iPhone (file 08). File nel sito: `src/immagini/` e `public/`. I colori Tecnocasa `#0057A3` e Tecnorete `#EE7326` vanno confermati con il manuale del marchio.

## Schermate
Cartella `schermate/` (catturate dal prototipo a ~920px di larghezza, ruolo amministratore generale, dati inventati): cruscotto, inserisci settimana, andamento, stato compilazione, avvio riunione, presentazione (copertina, totali, classifica, pagina ufficio), amministrazione, il mio account, accesso. Le lettere a/b/c indicano parti successive della stessa pagina scorrendo. Sono un riferimento visivo: per misure e colori fa fede questo README.

## Files
- `Rapportini Settimanali v6.dc.html` — prototipo completo (tutte le pagine, logica demo, dati inventati).
- `support.js` — runtime necessario per aprire il prototipo.
- `_ds/…/styles.css`, `_ds/…/_ds_bundle.js` — foglio di stile di base usato dal prototipo (classi `.btn`, `.input`, `.table`, `.tag`, `.seg`, `.dialog`).
