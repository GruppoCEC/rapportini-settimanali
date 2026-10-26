// =====================================================================
// VERSIONE DIMOSTRATIVA — finto database in memoria, con dati inventati.
// Sostituisce src/lib/supabase.ts solo quando si avvia "npm run demo".
// Imita in modo semplificato le regole di accesso del database vero.
// I dati si azzerano ricaricando la pagina.
// =====================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */
import { aggiungiSettimane, lunediDi, oggiISO, settimanaPredefinita } from '../src/lib/settimane'
import { aggiungiMesi, inServizio, mesePredefinito, mesiDiServizio, riepilogoMensile, STAFF, totaleConStorico, vociDelRapportino } from '../src/lib/mensile'
import { quotaDaTotali, totaliPerUfficio } from '../src/lib/aggregazioni'

export const configurato = true

// ---------------------------------------------------------------- dati inventati
let seme = 7
const caso = () => { seme = (seme * 16807) % 2147483647; return (seme - 1) / 2147483646 }
const tra = (min: number, max: number) => Math.round(min + caso() * (max - min))

const citta = [{ id: 1, nome: 'Roma' }, { id: 2, nome: 'Milano' }]
const aree = [
  { id: 1, nome: 'Roma Nord', citta_id: 1 }, { id: 2, nome: 'Roma Centro', citta_id: 1 }, { id: 3, nome: 'Roma Sud', citta_id: 1 },
  { id: 4, nome: 'Milano Centro', citta_id: 2 }, { id: 5, nome: 'Milano Est', citta_id: 2 },
]
const nomiUffici: [string, number, number][] = [
  ['Somalia', 1, 1], ['Trieste', 1, 1], ['Parioli', 1, 1], ['Flaminio', 1, 1],
  ['Prati', 1, 2], ['Monti', 1, 2], ['Trastevere', 1, 2], ['San Giovanni', 1, 2],
  ['EUR', 1, 3], ['Garbatella', 1, 3], ['Ostiense', 1, 3],
  ['Brera', 2, 4], ['Navigli', 2, 4], ['Porta Romana', 2, 4], ['Isola', 2, 5], ['Città Studi', 2, 5], ['Lambrate', 2, 5],
  // altri 30 uffici inventati, per arrivare a 47 come nel gruppo vero (serve a provare la stampa su più pagine)
  ['Appio', 1, 3], ['Tuscolano', 1, 3], ['Centocelle', 1, 3], ['Pigneto', 1, 2], ['Testaccio', 1, 2], ['Aventino', 1, 2],
  ['Monteverde', 1, 2], ['Portuense', 1, 3], ['Magliana', 1, 3], ['Talenti', 1, 1], ['Montesacro', 1, 1], ['Nomentano', 1, 1],
  ['Salario', 1, 1], ['Balduina', 1, 1], ['Monte Mario', 1, 1], ['Prenestino', 1, 3], ['Torpignattara', 1, 3], ['Cinecittà', 1, 3],
  ['Ostia', 1, 3], ['Aurelio', 1, 2],
  ['Loreto', 2, 5], ['Sempione', 2, 4], ['Bicocca', 2, 5], ['Niguarda', 2, 5], ['Corvetto', 2, 4], ['Barona', 2, 4],
  ['Lorenteggio', 2, 4], ['Bovisa', 2, 5], ['Turro', 2, 5], ['Washington', 2, 4],
]
// Ordine del report mensile come nel file di gruppo: non alfabetico, Roma e Milano mescolate, due tabelle
const ORDINE_MENSILE = [
  ['Trieste', 'Somalia', 'Parioli', 'Brera', 'Prati', 'Monti', 'Navigli', 'Flaminio', 'Trastevere', 'Isola', 'San Giovanni', 'Porta Romana', 'Garbatella', 'Città Studi', 'Lambrate',
    'Appio', 'Loreto', 'Tuscolano', 'Centocelle', 'Sempione', 'Pigneto', 'Testaccio', 'Aventino', 'Bicocca', 'Monteverde', 'Portuense', 'Niguarda', 'Magliana',
    'Talenti', 'Montesacro', 'Corvetto', 'Nomentano', 'Salario', 'Barona', 'Balduina', 'Monte Mario', 'Lorenteggio', 'Prenestino', 'Bovisa', 'Torpignattara', 'Turro', 'Washington'],
  ['EUR', 'Ostiense', 'Cinecittà', 'Ostia', 'Aurelio'],
]
const uffici = nomiUffici.map(([nome, citta_id, area_id], i) => {
  const blocco = Math.max(0, ORDINE_MENSILE.findIndex((b) => b.includes(nome)))
  const posizione = ORDINE_MENSILE[blocco].indexOf(nome)
  return { id: i + 1, nome, citta_id, area_id, attivo: true, blocco_mensile: blocco + 1, ordine_mensile: posizione >= 0 ? posizione + 1 : null }
})
let prossimoIdPersona = 10001   // distinti dagli id assegnati durante la prova (da 100 in su)
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')

const utenti: any[] = [
  { nome_utente: 'davide', nome: 'Davide', ruolo: 'admin_generale', citta_id: 1, ufficio_id: null, area_id: null, email_promemoria: 'rapportini.gruppo@gmail.com' },
  { nome_utente: 'admin-milano', nome: 'Admin Milano (Brera)', ruolo: 'admin_citta', citta_id: 2, ufficio_id: 12, area_id: null, email_promemoria: 'brera@gmail.com' },
  { nome_utente: 'resp-roma-nord', nome: 'Responsabile Roma Nord', ruolo: 'responsabile', citta_id: 1, ufficio_id: null, area_id: 1, email_promemoria: null },
  { nome_utente: 'affiliato-demo', nome: 'Mario Affiliato', ruolo: 'affiliato', citta_id: 1, ufficio_id: null, area_id: null, email_promemoria: null },
  ...uffici.map((u) => ({
    nome_utente: slug(u.nome), nome: `Ufficio ${u.nome}`, ruolo: 'ufficio', citta_id: u.citta_id, ufficio_id: u.id, area_id: null,
    email_promemoria: u.id % 5 === 0 ? null : `${slug(u.nome)}@gmail.com`,
  })),
].map((u) => ({ ...u, email: `${u.nome_utente}@demo`, attivo: true, auth_id: null }))
// Uffici consultati dall'affiliato di prova: Somalia e Trieste (Roma), Brera (Milano)
const uffici_affiliato: any[] = [1, 2, 12].map((ufficio_id) => ({ nome_utente: 'affiliato-demo', ufficio_id }))

const metriche = [
  ['app_vendita', 'App.ti Vendita', 'attivita', 1], ['proposte', 'Proposte', 'attivita', 2], ['incarichi', 'Incarichi', 'attivita', 3],
  ['valutazioni', 'Valutazioni', 'attivita', 4], ['vendite', 'Vendite', 'attivita', 5], ['ribassi', 'Ribassi', 'attivita', 6],
  ['im3', 'IM3', 'attivita', 7], ['piu90', '+90', 'attivita', 8],
  ['portafoglio', 'Portafoglio', 'zona', 10], ['incarichi_zona', 'Incarichi in zona', 'zona', 11], ['contatti_zona', 'Contatti zona', 'zona', 12],
  ['telefoni_mancanti', 'Telefoni mancanti', 'zona', 13], ['affittati', 'Affittati', 'zona', 14], ['vuoti', 'Vuoti', 'zona', 15],
].map(([codice, nome, tipo, ordine]) => ({ codice, nome, tipo, ordine, attiva: true }))

// Obiettivo tipico [min, max] e "bravura" dell'ufficio
const OBIETTIVI: Record<string, [number, number] | null> = {
  app_vendita: [8, 12], proposte: [1, 2], incarichi: [1, 2], valutazioni: [4, 8], vendite: [1, 1], ribassi: [1, 1], im3: null, piu90: null,
}
const rilevazioni: any[] = []
const note: any[] = []
const daCompilare = settimanaPredefinita()
const settimane = Array.from({ length: 14 }, (_, i) => aggiungiSettimane(daCompilare, i - 13))

for (const u of uffici) {
  const bravura = 0.55 + caso() * 0.8
  const zona = { portafoglio: tra(2, 9), incarichi_zona: tra(28, 50), contatti_zona: tra(4000, 7000), telefoni_mancanti: tra(400, 600), affittati: tra(800, 1100), vuoti: tra(250, 350) }
  for (const s of settimane) {
    // Situazione della settimana da compilare: 2 uffici mancanti, 1 parziale
    if (s === daCompilare && (u.id === 3 || u.id === 10 || u.id === 16)) continue
    const parziale = s === daCompilare && (u.id === 7 || u.id === 14)
    const ts = new Date(`${aggiungiSettimane(s, 1)}T0${tra(7, 9)}:${tra(10, 59)}:00`).toISOString()
    const da = utenti.find((x) => x.ufficio_id === u.id && x.ruolo === 'ufficio')!.email
    for (const [codice, ob] of Object.entries(OBIETTIVI)) {
      if (parziale && ['im3', 'piu90', 'ribassi'].includes(codice)) continue
      const obiettivo = ob ? tra(ob[0], ob[1]) : null
      const risultato = ob ? Math.max(0, Math.round(obiettivo! * bravura * (0.4 + caso() * 1.2))) : codice === 'im3' ? tra(250, 420) : tra(0, 30)
      rilevazioni.push({ ufficio_id: u.id, settimana: s, metrica: codice, obiettivo, risultato, aggiornato_da: da, aggiornato_il: ts })
    }
    zona.portafoglio = Math.max(0, zona.portafoglio + tra(-1, 1))
    zona.incarichi_zona = Math.max(10, zona.incarichi_zona + tra(-2, 2))
    zona.telefoni_mancanti = Math.max(0, zona.telefoni_mancanti - tra(0, 6))
    for (const [codice, valore] of Object.entries(zona)) {
      rilevazioni.push({ ufficio_id: u.id, settimana: s, metrica: codice, obiettivo: null, risultato: valore, aggiornato_da: da, aggiornato_il: ts })
    }
  }
  // note della settimana: le tre caselle (013_nota_tre_caselle.sql); qualche ufficio ha ancora la vecchia nota libera
  // (nella settimana in corso e in quella della riunione, appena chiusa)
  for (const [i, settimana] of [aggiungiSettimane(daCompilare, -1), daCompilare].entries()) {
    if (u.id % 3 !== (i === 0 ? 2 : 1)) continue
    const k = u.id % 4
    note.push({
      ufficio_id: u.id, settimana, aggiornato_da: null, aggiornato_il: new Date().toISOString(),
      testo: k === 3 ? 'Avviata campagna volantinaggio sulla zona nord.' : '',
      bene: ['Acquisito incarico in esclusiva in via Chisimaio, trilocale con terrazzo.', 'Due proposte in trattativa, firma prevista la prossima settimana.', 'Tre valutazioni da passaparola di clienti.', ''][k],
      difficolta: ['', 'Settimana rallentata da due colleghi in ferie.', 'Poche richieste sui bilocali.', ''][k],
      aiuto: ['', 'Un venditore vuole ritirare l\'incarico dopo il ribasso: come lo gestiamo?', 'Serve un collega esperto di locazioni per un cliente aziendale.', ''][k],
    })
  }
}

// ---------------------------------------------------------------- rapportino mensile inventato
const voci_mensili = [
  ['portafoglio_vendita', 'Portafoglio immobili', 'vendita'], ['portafoglio_locazione', 'Portafoglio immobili', 'locazione'],
  ['acquisizioni', 'Acquisizioni', null], ['appuntamenti_vendita', 'Appuntamenti', 'vendita'], ['appuntamenti_locazione', 'Appuntamenti', 'locazione'],
  ['incarichi_vendita', 'Incarichi', 'vendita'], ['incarichi_locazione', 'Incarichi', 'locazione'], ['gestione_incarichi', 'Gestione incarichi', null],
  ['ribassi', 'Ribassi', null], ['kiron', 'Kiron', null], ['colloqui', 'Colloqui', null],
  ['proposte_vendita', 'Proposte', 'vendita'], ['proposte_locazione', 'Proposte', 'locazione'],
  ['accettazioni_vendita', 'Accettazioni', 'vendita'], ['accettazioni_locazione', 'Accettazioni', 'locazione'],
  ['vendite_effettuate', 'Vendite effettuate', null], ['richieste_vendita', 'Richieste', 'vendita'], ['richieste_locazione', 'Richieste', 'locazione'],
  ['incarichi_scaduti', 'Incarichi scaduti', null],
].map(([codice, gruppo, sotto], i) => ({ codice, gruppo, sotto, ordine: i + 1, solo_ruolo: null as string | null, attiva: true,
  con_punti: codice !== 'gestione_incarichi', meglio_se_scende: codice === 'incarichi_scaduti' }))
// Indicatore di qualità delle coordinatrici, fuori dai totali
voci_mensili.push({ codice: 'appuntamenti_vendita_fix', gruppo: 'App. vendita fix', sotto: null, ordine: 50, solo_ruolo: 'coordinatrice', accanto_a: 'appuntamenti_vendita', attiva: true, con_punti: false } as any)
// Locazioni effettuate (018): voce riservata all'amministratore generale, solo per la gara a punti
voci_mensili.push({ codice: 'locazioni_effettuate', gruppo: 'Locazioni effettuate', sotto: null, ordine: 60, solo_ruolo: null, attiva: true, con_punti: true, riservata: true } as any)
const valori_riservati: any[] = []
// Punti di ESEMPIO per la gara dei collaboratori (quelli veri li decide Davide in Report mensile → Personale)
const punti_mensili: any[] = Object.entries({
  portafoglio_vendita: 1, portafoglio_locazione: 0.5, acquisizioni: 3, appuntamenti_vendita: 1, appuntamenti_locazione: 0.5,
  incarichi_vendita: 5, incarichi_locazione: 2, ribassi: 1, kiron: 2, colloqui: 1, proposte_vendita: 4, proposte_locazione: 2,
  accettazioni_vendita: 6, accettazioni_locazione: 3, vendite_effettuate: 10, richieste_vendita: 0.5, richieste_locazione: 0.5, incarichi_scaduti: -3,
  locazioni_effettuate: 4,
}).map(([voce, punti]) => ({ voce, punti }))
// Valori tipici di un mese per un collaboratore [min, max]
const TIPICI: Record<string, [number, number]> = {
  portafoglio_vendita: [2, 14], portafoglio_locazione: [0, 4], acquisizioni: [0, 4], appuntamenti_vendita: [6, 36], appuntamenti_locazione: [0, 10],
  incarichi_vendita: [0, 4], incarichi_locazione: [0, 2], gestione_incarichi: [0, 9], ribassi: [0, 4], kiron: [0, 3], colloqui: [0, 8],
  proposte_vendita: [0, 4], proposte_locazione: [0, 2], accettazioni_vendita: [0, 3], accettazioni_locazione: [0, 2], vendite_effettuate: [0, 2],
  richieste_vendita: [2, 22], richieste_locazione: [0, 8], incarichi_scaduti: [0, 3],
}
const NOMI = ['Giulia', 'Marco', 'Francesca', 'Luca', 'Chiara', 'Alessandro', 'Sara', 'Matteo', 'Valentina', 'Andrea', 'Martina', 'Davide', 'Elena', 'Simone', 'Federica', 'Paolo', 'Silvia', 'Stefano', 'Laura', 'Roberto', 'Alessia', 'Giorgio', 'Ilaria', 'Fabio']
const COGNOMI = ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Mancini', 'Costa', 'Giordano', 'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Santoro', 'Mariani']
const meseDaCompilare = mesePredefinito()
const mesiDemo = Array.from({ length: 6 }, (_, i) => aggiungiMesi(meseDaCompilare, i - 5))
const persone: any[] = []
const valori_mensili: any[] = []
const confronto_anno_prima: any[] = []
const dataTra = (annoMin: number, annoMax: number) => `${tra(annoMin, annoMax)}-${String(tra(1, 12)).padStart(2, '0')}-${String(tra(1, 28)).padStart(2, '0')}`
for (const u of uffici) {
  const ruoli = ['responsabile', ...Array(tra(2, 4)).fill('collaboratore'), ...(caso() < 0.75 ? ['coordinatrice'] : []), ...(caso() < 0.55 ? ['marketer'] : [])]
  for (const ruolo of ruoli) {
    persone.push({ id: prossimoIdPersona++, ufficio_id: u.id, nome: `${NOMI[tra(0, NOMI.length - 1)]} ${COGNOMI[tra(0, COGNOMI.length - 1)]}`, ruolo,
      data_inizio: ruolo === 'responsabile' ? dataTra(2008, 2018) : dataTra(2015, 2025), data_fine: null })
  }
  // Qualche cambio di personale: un'uscita due mesi fa e un ingresso nel mese da compilare
  // uscite sparse nei mesi passati dell'anno (per la scheda "Usciti nell'anno")
  if (u.id % 4 === 0) {
    const chi = persone.find((p) => p.ufficio_id === u.id && p.ruolo === 'collaboratore')
    chi.data_fine = `${aggiungiMesi(meseDaCompilare, -1 - (Math.floor(u.id / 4) % 8)).slice(0, 8)}${String(5 + (u.id % 20)).padStart(2, '0')}`
    if (u.id % 12 === 0) chi.motivo_fine = 'promozione'      // qualcuno non è uscito: è stato promosso a responsabile (015)
  }
  // e qualche uscita proprio nel mese da compilare (righe rosse)
  if (u.id % 3 === 1) {
    const chi = persone.filter((p) => p.ufficio_id === u.id && p.ruolo !== 'responsabile' && !p.data_fine).pop()
    if (chi) chi.data_fine = `${meseDaCompilare.slice(0, 8)}${String(tra(10, 28)).padStart(2, '0')}`
  }
  if (u.id % 5 === 2) persone.push({ id: prossimoIdPersona++, ufficio_id: u.id, nome: `${NOMI[tra(0, NOMI.length - 1)]} ${COGNOMI[tra(0, COGNOMI.length - 1)]}`, ruolo: 'collaboratore', data_inizio: `${meseDaCompilare.slice(0, 8)}${String(tra(1, 20)).padStart(2, '0')}`, data_fine: null })
  // qualcuno del rapportino senza ruolo scritto, solo col nome (017)
  if (u.id % 6 === 1) persone.push({ id: prossimoIdPersona++, ufficio_id: u.id, nome: NOMI[tra(0, NOMI.length - 1)], ruolo: 'da_definire', data_inizio: dataTra(2020, 2025), data_fine: null })
}
// un collaboratore passato da un ufficio all'altro due mesi fa (017): non è un'uscita né un nuovo ingresso
{
  const da = persone.find((p) => p.ufficio_id === uffici[0].id && p.ruolo === 'collaboratore' && !p.data_fine)
  const quando = aggiungiMesi(meseDaCompilare, -2)
  da.data_fine = quando; da.motivo_fine = 'trasferimento'
  persone.push({ id: prossimoIdPersona++, ufficio_id: uffici[1].id, nome: da.nome, ruolo: 'collaboratore', data_inizio: quando, data_fine: null })
}
// Collaboratori entrati negli ultimi mesi (per la scheda "Collaboratori" e la curva dei nuovi)
for (const u of uffici) {
  if (u.id % 2 !== 0) continue
  const mese = mesiDemo[u.id % mesiDemo.length]
  persone.push({ id: prossimoIdPersona++, ufficio_id: u.id, nome: `${NOMI[tra(0, NOMI.length - 1)]} ${COGNOMI[tra(0, COGNOMI.length - 1)]}`, ruolo: 'collaboratore',
    data_inizio: `${mese.slice(0, 8)}${String(tra(1, 20)).padStart(2, '0')}`, data_fine: null })
}

for (const mese of mesiDemo) {
  for (const u of uffici) {
    // Situazione del mese da compilare: 2 uffici mancanti (Parioli, Città Studi), 1 parziale (Trastevere)
    if (mese === meseDaCompilare && (u.id === 3 || u.id === 16)) continue
    const parziale = mese === meseDaCompilare && u.id === 7
    const da = utenti.find((x) => x.ufficio_id === u.id && x.ruolo === 'ufficio')!.email
    // Prati e Brera inseriscono il mese da compilare l'8 del mese dopo: dopo la scadenza (il 5), quindi in ritardo
    const giorno = mese === meseDaCompilare && (u.nome === 'Prati' || u.nome === 'Brera') ? '08' : `0${tra(1, 4)}`
    const ts = new Date(`${aggiungiMesi(mese, 1).slice(0, 8)}${giorno}T${tra(10, 18)}:${tra(10, 59)}:00`).toISOString()
    persone.filter((p) => p.ufficio_id === u.id && inServizio(p, mese)).forEach((p, n) => {
      // i nuovi collaboratori crescono nei primi mesi (per la curva dei nuovi); qualcuno resta indietro
      const servizio = mesiDiServizio(p.data_inizio, mese) + 1
      const crescita = p.ruolo === 'collaboratore' && servizio <= 12 ? Math.min(1, 0.25 + 0.15 * servizio) * (p.id % 7 === 0 ? 0.35 : 1) : 1
      const peso = (p.ruolo === 'collaboratore' ? 1 : p.ruolo === 'responsabile' ? 0.7 : 0.35) * crescita
      for (const [voce, [min, max]] of Object.entries(TIPICI)) {
        if (parziale && n > 1) continue
        valori_mensili.push({ persona_id: p.id, ufficio_id: u.id, mese, voce, valore: Math.round(tra(min, max) * peso), aggiornato_da: da, aggiornato_il: ts })
      }
      if (p.ruolo === 'coordinatrice' && !(parziale && n > 1)) {
        valori_mensili.push({ persona_id: p.id, ufficio_id: u.id, mese, voce: 'appuntamenti_vendita_fix', valore: tra(6, 30), aggiornato_da: da, aggiornato_il: ts })
      }
    })
  }
}
// Totali di gruppo "dell'anno prima" per gli ultimi 3 mesi, come se li avesse scritti l'amministratore
for (const mese of mesiDemo.slice(-3)) {
  const delMese = valori_mensili.filter((v) => v.mese === mese)
  for (const voce of Object.keys(TIPICI)) {
    const somma = delMese.filter((v) => v.voce === voce).reduce((t, v) => t + v.valore, 0)
    confronto_anno_prima.push({ mese: aggiungiMesi(mese, -12), voce, valore: Math.round(somma * (0.75 + caso() * 0.4)) })
  }
  confronto_anno_prima.push({ mese: aggiungiMesi(mese, -12), voce: 'staff', valore: persone.filter((p) => inServizio(p, mese)).length - tra(0, 6) })
}

// Storico dal file Excel annuale: per i mesi dell'anno prima di quelli della demo, solo il totale di ogni ufficio
const totali_mensili_storico: any[] = []
for (let mese = `${meseDaCompilare.slice(0, 4)}-01-01`; mese < mesiDemo[0]; mese = aggiungiMesi(mese, 1)) {
  for (const u of uffici) {
    const staff = tra(3, 7)
    totali_mensili_storico.push({ ufficio_id: u.id, mese, voce: 'staff', valore: staff })
    for (const [voce, [min, max]] of Object.entries(TIPICI)) {
      if (caso() < 0.15) continue                      // qualche cella vuota, come nell'Excel
      totali_mensili_storico.push({ ufficio_id: u.id, mese, voce, valore: Math.round(tra(min, max) * staff * 0.6) })
    }
  }
}

// Scadenza di esempio per il mese da compilare: fra una settimana alle 10, con il blocco (come la riunione di fine mese),
// così la demo mostra sempre "Da compilare entro il …" (utile anche per il video tutorial, docs/GUIDA_VIDEO_RAPPORTINO_MENSILE.md)
const fraUnaSettimana = new Date(Date.now() + 7 * 86400000); fraUnaSettimana.setHours(10, 0, 0, 0)
const scadenze_mensili: any[] = [{ mese: meseDaCompilare, scadenza: fraUnaSettimana.toISOString(), blocca: true }]
// il mese prima è già chiuso con il blocco: gli uffici vedono il report del gruppo (018)
scadenze_mensili.push({ mese: aggiungiMesi(meseDaCompilare, -1), scadenza: new Date(Date.now() - 2 * 86400000).toISOString(), blocca: true })

const tabelle: Record<string, any[]> = { citta, aree, uffici, utenti, uffici_affiliato, metriche, rilevazioni, note_settimana: note, persone, voci_mensili, valori_mensili, confronto_anno_prima, punti_mensili, scadenze_mensili, totali_mensili_storico, valori_riservati }

// ---------------------------------------------------------------- sessione e "regole di accesso"
const CHIAVE = 'rapportini.demo.utente'
let utenteCorrente: string | null = (() => { try { return sessionStorage.getItem(CHIAVE) } catch { return null } })()
const ascoltatori = new Set<(e: string, s: any) => void>()
const sessione = () => (utenteCorrente ? { user: { email: utenteCorrente } } : null)
const notifica = () => ascoltatori.forEach((f) => f('CAMBIO', sessione()))
const io = () => utenti.find((u) => u.email === utenteCorrente && u.attivo)

function ufficiLeggibili(): Set<number> {
  const me = io()
  if (!me) return new Set()
  return new Set(uffici.filter((u) =>
    me.ruolo === 'admin_generale' || (me.ruolo === 'admin_citta' && u.citta_id === me.citta_id)
    || (me.ruolo === 'responsabile' && u.area_id === me.area_id) || u.id === me.ufficio_id
    || (me.ruolo === 'affiliato' && uffici_affiliato.some((x) => x.nome_utente === me.nome_utente && x.ufficio_id === u.id))).map((u) => u.id))
}
function visibile(tabella: string, riga: any): boolean {
  const me = io()
  if (!me) return false
  const gestisce = (c: number) => me.ruolo === 'admin_generale' || (me.ruolo === 'admin_citta' && me.citta_id === c)
  switch (tabella) {
    case 'uffici': return ufficiLeggibili().has(riga.id) || gestisce(riga.citta_id)
    case 'aree': return riga.citta_id === me.citta_id || gestisce(riga.citta_id)
    case 'utenti': return riga.email === me.email || gestisce(riga.citta_id)
    case 'uffici_affiliato': return me.ruolo === 'admin_generale' || riga.nome_utente === me.nome_utente
    case 'rilevazioni': case 'note_settimana': case 'persone': case 'valori_mensili': case 'totali_mensili_storico': return ufficiLeggibili().has(riga.ufficio_id)
    case 'confronto_anno_prima': return me.ruolo === 'admin_generale'
    case 'punti_mensili': return me.ruolo === 'admin_generale' || me.ruolo === 'admin_citta'
    case 'valori_riservati': return gestisce(uffici.find((u) => u.id === riga.ufficio_id)?.citta_id ?? -1)
    default: return true
  }
}

// Come totali_mia_citta (008_totali_citta.sql): solo per un ufficio, solo le somme della sua città
function totaliMiaCitta(inizi: string[], fini: string[]): any[] {
  const me = io()
  const mio = me?.ruolo === 'ufficio' ? uffici.find((u) => u.id === me.ufficio_id) : undefined
  if (!mio) return []
  const ids = new Set(uffici.filter((u) => u.attivo && u.citta_id === mio.citta_id).map((u) => u.id))
  const tipo = new Map(metriche.map((m) => [m.codice, m.tipo]))
  const perPeriodo = inizi.map((da, i) => totaliPerUfficio(rilevazioni.filter((r) => ids.has(r.ufficio_id) && r.settimana >= da && r.settimana <= fini[i]), metriche as any))
  const righe: any[] = []
  perPeriodo.forEach((perUfficio, i) => {
    const conDati = [...perUfficio.values()].filter((t) => [...t.values()].some((x) => x.risultato !== null)).length
    for (const codice of new Set([...perUfficio.values()].flatMap((t) => [...t.keys()]))) {
      const valori = [...perUfficio].map(([u, t]) => [u, t.get(codice)] as const).filter(([, x]) => x)
      const somma = (k: 'obiettivo' | 'risultato') => valori.reduce<number | null>((s, [, x]) => (x![k] === null ? s : (s ?? 0) + x![k]!), null)
      let variazione: number | null = null, confrontati: number | null = null
      if (tipo.get(codice) === 'zona') {
        confrontati = 0
        for (const [u, x] of valori) {
          const prima = perPeriodo[i - 1]?.get(u)?.get(codice)?.risultato
          if (x!.risultato !== null && prima != null) { variazione = (variazione ?? 0) + x!.risultato - prima; confrontati++ }
        }
      }
      righe.push({ periodo: i + 1, metrica: codice, obiettivo: somma('obiettivo'), risultato: somma('risultato'),
        uffici_con_dato: valori.filter(([, x]) => x!.risultato !== null).length, uffici_con_dati: conDati, variazione, confrontati, uffici_citta: ids.size })
    }
  })
  return righe
}

// Come totali_mensili_mia_citta (010_totali_mensili_citta.sql): solo per un ufficio, solo le somme della sua città
function totaliMensiliMiaCitta(mesi: string[]): any[] {
  const me = io()
  const mio = me?.ruolo === 'ufficio' ? uffici.find((u) => u.id === me.ufficio_id) : undefined
  if (!mio) return []
  const ids = uffici.filter((u) => u.attivo && u.citta_id === mio.citta_id).map((u) => u.id)
  const colonne = [STAFF, ...vociDelRapportino(voci_mensili as any).map((v) => v.codice)]
  const perUfficio = ids.map((id) => mesi.map((m) => totaleConStorico(persone.filter((p) => p.ufficio_id === id), valori_mensili.filter((v) => v.ufficio_id === id),
    m, voci_mensili as any, totali_mensili_storico.filter((s) => s.ufficio_id === id)).totale))
  return mesi.flatMap((_, i) => {
    const r = riepilogoMensile(perUfficio.map((u) => u.slice(0, i + 1)), colonne)
    return colonne.map((voce) => {
      const v = r.variazioni.get(voce)!
      return { posizione: i + 1, voce, valore: r.andamento[i].get(voce) ?? null, uffici_con_dato: v.conDato, uffici_con_dati: r.ufficiConDati,
        variazione: v.variazione, confrontati: v.confrontati, uffici_citta: ids.length }
    })
  })
}

// Come report_gruppo_mensile (018): tutto il gruppo, per chiunque, ma solo dopo la scadenza con il blocco
function reportGruppoMensile(mese: string): any[] {
  const s = scadenze_mensili.find((x) => x.mese === mese)
  if (!io() || !s || !s.blocca || Date.now() <= new Date(s.scadenza).getTime()) return []
  return uffici.filter((u) => u.attivo).flatMap((u) => {
    const { totale } = totaleConStorico(persone.filter((p) => p.ufficio_id === u.id), valori_mensili.filter((v) => v.ufficio_id === u.id),
      mese, voci_mensili as any, totali_mensili_storico.filter((x) => x.ufficio_id === u.id))
    return [...totale].map(([voce, valore]) => ({ ufficio_id: u.id, nome: u.nome, citta_id: u.citta_id, blocco_mensile: u.blocco_mensile, ordine_mensile: u.ordine_mensile, voce, valore }))
  })
}

// Posizione con pari merito: 1 + quanti uffici hanno un numero più alto (come rank() nel database)
function righePosizione(perUfficio: Map<number, number | null>[], mio: number, nomeVoce: string, uffici_citta: number, periodo: number) {
  const valori = perUfficio[periodo - 1]
  const mioValore = valori.get(mio)
  if (mioValore == null) return []
  const conDato = [...valori.values()].filter((v): v is number => v != null)
  return [{ periodo, voce: nomeVoce, metrica: nomeVoce, posizione: 1 + conDato.filter((v) => v > mioValore).length, uffici_con_dato: conDato.length, uffici_citta }]
}

// Come posizione_mia_citta (014_posizione_citta.sql): solo per un ufficio, solo la sua riga
function posizioneMiaCitta(inizi: string[], fini: string[]): any[] {
  const me = io()
  const mio = me?.ruolo === 'ufficio' ? uffici.find((u) => u.id === me.ufficio_id) : undefined
  if (!mio) return []
  const ids = new Set(uffici.filter((u) => u.attivo && u.citta_id === mio.citta_id).map((u) => u.id))
  const perPeriodo = inizi.map((da, i) => totaliPerUfficio(rilevazioni.filter((r) => ids.has(r.ufficio_id) && r.settimana >= da && r.settimana <= fini[i]), metriche as any))
  const voci: string[] = [...metriche.map((m) => String(m.codice)), '__quota']
  return voci.flatMap((voce) => {
    const perUfficio = perPeriodo.map((t) => new Map<number, number | null>([...t].map(([u, x]) => [u, voce === '__quota' ? quotaDaTotali(x) : x.get(voce)?.risultato ?? null])))
    return inizi.flatMap((_, i) => righePosizione(perUfficio, mio.id, voce, ids.size, i + 1))
  })
}

// Come posizione_mensile_mia_citta (014_posizione_citta.sql): solo per un ufficio, solo la sua riga
function posizioneMensileMiaCitta(mesi: string[]): any[] {
  const me = io()
  const mio = me?.ruolo === 'ufficio' ? uffici.find((u) => u.id === me.ufficio_id) : undefined
  if (!mio) return []
  const ids = uffici.filter((u) => u.attivo && u.citta_id === mio.citta_id).map((u) => u.id)
  const colonne = [STAFF, ...vociDelRapportino(voci_mensili as any).map((v) => v.codice)]
  const totali = mesi.map((m) => new Map(ids.map((id) => [id, totaleConStorico(persone.filter((p) => p.ufficio_id === id), valori_mensili.filter((v) => v.ufficio_id === id),
    m, voci_mensili as any, totali_mensili_storico.filter((s) => s.ufficio_id === id)).totale])))
  const haNumeri = (t: Map<string, number | null> | undefined) => !!t && [...t].some(([k, v]) => k !== STAFF && v !== null)
  return colonne.flatMap((voce) => {
    const perUfficio = totali.map((t) => new Map<number, number | null>([...t].map(([u, x]) => [u, voce === STAFF && !haNumeri(x) ? null : x.get(voce) ?? null])))
    return mesi.flatMap((_, i) => righePosizione(perUfficio, mio.id, voce, ids.length, i + 1))
  })
}

// ---------------------------------------------------------------- finto client
const attesa = (ms = 120) => new Promise((r) => setTimeout(r, ms))
let prossimoId = 100

class Interrogazione {
  private filtri: ((r: any) => boolean)[] = []
  private ordini: [string, boolean][] = []
  private da = 0
  private a = Infinity
  private singolo: 'no' | 'forse' | 'si' = 'no'
  private operazione: { tipo: 'insert' | 'upsert' | 'update' | 'delete'; righe?: any[]; campi?: any; chiavi?: string[] } | null = null
  constructor(private tabella: string) {}
  select() { return this }
  eq(c: string, v: any) { this.filtri.push((r) => r[c] === v); return this }
  neq(c: string, v: any) { this.filtri.push((r) => r[c] !== v); return this }
  in(c: string, v: any[]) { this.filtri.push((r) => v.includes(r[c])); return this }
  gte(c: string, v: any) { this.filtri.push((r) => r[c] >= v); return this }
  lte(c: string, v: any) { this.filtri.push((r) => r[c] <= v); return this }
  lt(c: string, v: any) { this.filtri.push((r) => r[c] < v); return this }
  not(c: string) { this.filtri.push((r) => r[c] !== null && r[c] !== undefined); return this }
  order(c: string, o?: { ascending?: boolean }) { this.ordini.push([c, o?.ascending !== false]); return this }
  range(da: number, a: number) { this.da = da; this.a = a; return this }
  limit(n: number) { this.a = this.da + n - 1; return this }
  maybeSingle() { this.singolo = 'forse'; return this }
  single() { this.singolo = 'si'; return this }
  insert(righe: any) { this.operazione = { tipo: 'insert', righe: [righe].flat() }; return this }
  upsert(righe: any, o: { onConflict: string }) { this.operazione = { tipo: 'upsert', righe: [righe].flat(), chiavi: o.onConflict.split(',') }; return this }
  update(campi: any) { this.operazione = { tipo: 'update', campi }; return this }
  delete() { this.operazione = { tipo: 'delete' }; return this }

  private esegui(): { data: any; error: any } {
    const t = (tabelle[this.tabella] ??= [])
    const me = io()
    const op = this.operazione
    if (op) {
      if (!me) return { data: null, error: { message: 'permission denied' } }
      // affiliato: scrive solo i dati dei suoi uffici (controllati sotto); gli uffici agli affiliati li assegna solo l'amministratore generale
      if ((me.ruolo === 'affiliato' && !['rilevazioni', 'note_settimana', 'persone', 'valori_mensili'].includes(this.tabella))
        || (this.tabella === 'uffici_affiliato' && me.ruolo !== 'admin_generale')) {
        return { data: null, error: { message: 'new row violates row-level security policy' } }
      }
      const ora = new Date().toISOString()
      if (op.tipo === 'insert' || op.tipo === 'upsert') {
        const inseriti: any[] = []
        for (const r of op.righe!) {
          if (this.tabella === 'valori_mensili') {                    // come il trigger del database
            const persona = persone.find((p) => p.id === r.persona_id)
            r.ufficio_id = persona?.ufficio_id
            const riservata = voci_mensili.find((v) => v.codice === r.voce)?.solo_ruolo
            if (riservata && riservata !== persona?.ruolo) return { data: null, error: { message: `La voce ${r.voce} si compila solo per il ruolo ${riservata}` } }
          }
          if (['persone', 'valori_mensili'].includes(this.tabella) && ['ufficio', 'affiliato'].includes(me.ruolo)) {   // in prova: come la regola del database
            let inProva = false
            try { inProva = localStorage.getItem('rapportini.demo.mensileInProva') === 'si' } catch { /* niente */ }
            if (inProva) return { data: null, error: { message: 'new row violates row-level security policy' } }
          }
          if (this.tabella === 'valori_mensili' && ['ufficio', 'affiliato'].includes(me.ruolo)) {      // mese chiuso: come il trigger del database
            const s = scadenze_mensili.find((x) => x.mese === r.mese)
            if (s && s.blocca && Date.now() > new Date(s.scadenza).getTime()) return { data: null, error: { message: 'Inserimento chiuso: la scadenza per questo mese è passata. Per correzioni contatta l\'amministratore' } }
          }
          if (this.tabella === 'valori_riservati') r.ufficio_id = persone.find((p) => p.id === r.persona_id)?.ufficio_id   // come il trigger (018)
          if (['confronto_anno_prima', 'punti_mensili', 'scadenze_mensili', 'valori_riservati'].includes(this.tabella) && me.ruolo !== 'admin_generale') return { data: null, error: { message: 'new row violates row-level security policy' } }
          if (['rilevazioni', 'note_settimana', 'persone', 'valori_mensili'].includes(this.tabella)) {
            if (!ufficiLeggibili().has(r.ufficio_id) || me.ruolo === 'responsabile' && r.ufficio_id !== me.ufficio_id) {
              return { data: null, error: { message: 'new row violates row-level security policy' } }
            }
          }
          const nuova = { id: prossimoId++, attivo: true, ...r, aggiornato_da: me.email, aggiornato_il: ora }
          if (this.tabella === 'uffici' && t.some((x) => x.nome === r.nome && x.citta_id === r.citta_id)) return { data: null, error: { message: 'duplicate key' } }
          const i = op.chiavi ? t.findIndex((x) => op.chiavi!.every((k) => x[k] === r[k])) : -1
          if (i >= 0) t[i] = { ...t[i], ...nuova }; else t.push(nuova)
          inseriti.push(nuova)
        }
        return { data: this.singolo !== 'no' ? inseriti[0] : inseriti, error: null }
      }
      const colpite = t.filter((r) => visibile(this.tabella, r) && this.filtri.every((f) => f(r)))
      if (op.tipo === 'update') colpite.forEach((r) => Object.assign(r, op.campi))
      else colpite.forEach((r) => t.splice(t.indexOf(r), 1))
      if (op.tipo === 'delete' && this.tabella === 'persone') {     // come "on delete cascade"
        const via = new Set(colpite.map((r) => r.id))
        for (let i = valori_mensili.length - 1; i >= 0; i--) if (via.has(valori_mensili[i].persona_id)) valori_mensili.splice(i, 1)
      }
      return { data: colpite, error: null }
    }
    let righe = t.filter((r) => visibile(this.tabella, r) && this.filtri.every((f) => f(r)))
    if (this.ordini.length) {
      righe = [...righe].sort((x, y) => {
        for (const [c, asc] of this.ordini) { if (x[c] !== y[c]) return (x[c] < y[c] ? -1 : 1) * (asc ? 1 : -1) }
        return 0
      })
    }
    righe = righe.slice(this.da, this.a === Infinity ? undefined : this.a + 1).map((r) => ({ ...r }))
    if (this.singolo === 'forse') return { data: righe[0] ?? null, error: null }
    if (this.singolo === 'si') return righe[0] ? { data: righe[0], error: null } : { data: null, error: { message: 'nessuna riga' } }
    return { data: righe, error: null }
  }

  then(ok: (v: any) => any, ko?: (e: any) => any) {
    return attesa().then(() => this.esegui()).then(ok, ko)
  }
}

export const supabase: any = {
  auth: {
    getSession: async () => ({ data: { session: sessione() } }),
    onAuthStateChange: (f: any) => { ascoltatori.add(f); return { data: { subscription: { unsubscribe: () => ascoltatori.delete(f) } } } },
    signInWithPassword: async ({ email, password }: any) => {
      await attesa(300)
      if (!utenti.some((u) => u.email === email) || password !== 'demo') return { error: { message: 'Invalid login credentials' } }
      utenteCorrente = email
      try { sessionStorage.setItem(CHIAVE, email) } catch { /* niente */ }
      notifica()
      return { error: null }
    },
    signOut: async () => { utenteCorrente = null; try { sessionStorage.removeItem(CHIAVE) } catch { /* niente */ } notifica(); return { error: null } },
    updateUser: async () => { await attesa(300); return { error: null } },
  },
  rpc: async (nome: string, args: any) => {
    await attesa(80)
    if (nome === 'email_di_accesso') return { data: `${String(args.p_nome_utente).trim().toLowerCase()}@demo`, error: null }
    // Rapportino mensile: nella demo è aperto; per vedere la modalità "in prova" scrivere nella console
    // localStorage.setItem('rapportini.demo.mensileInProva', 'si') e ricaricare
    if (nome === 'mensile_aperto') { try { return { data: localStorage.getItem('rapportini.demo.mensileInProva') !== 'si', error: null } } catch { return { data: true, error: null } } }
    if (nome === 'totali_mia_citta') return { data: totaliMiaCitta(args.p_inizi, args.p_fini), error: null }
    if (nome === 'totali_mensili_mia_citta') return { data: totaliMensiliMiaCitta(args.p_mesi), error: null }
    if (nome === 'posizione_mia_citta') return { data: posizioneMiaCitta(args.p_inizi, args.p_fini), error: null }
    if (nome === 'posizione_mensile_mia_citta') return { data: posizioneMensileMiaCitta(args.p_mesi), error: null }
    if (nome === 'report_gruppo_mensile') return { data: reportGruppoMensile(args.p_mese), error: null }
    return { data: null, error: { message: `funzione ${nome} non disponibile nella demo` } }
  },
  functions: {
    invoke: async (_nome: string, { body }: any) => {
      await attesa(400)
      const me = io()
      if (body.azione === 'crea') {
        if (utenti.some((u) => u.nome_utente === body.nome_utente)) return { data: { errore: 'Esiste già un account con questo nome utente.' }, error: null }
        const ufficio = uffici.find((u) => u.id === body.ufficio_id)
        const area = aree.find((a) => a.id === body.area_id)
        const citta_id = ufficio?.citta_id ?? area?.citta_id ?? body.citta_id
        if (me.ruolo === 'admin_citta' && (citta_id !== me.citta_id || !['ufficio', 'responsabile'].includes(body.ruolo))) {
          return { data: { errore: 'Non hai i permessi per questa operazione.' }, error: null }
        }
        utenti.push({ email: `${body.nome_utente}@demo`, nome_utente: body.nome_utente, nome: body.nome || null, ruolo: body.ruolo, citta_id, ufficio_id: body.ufficio_id, area_id: body.area_id, email_promemoria: body.email_promemoria || null, attivo: true })
        return { data: { ok: true }, error: null }
      }
      if (body.azione === 'elimina') {
        const i = utenti.findIndex((u) => u.nome_utente === body.nome_utente)
        if (i >= 0) utenti.splice(i, 1)
        for (let j = uffici_affiliato.length - 1; j >= 0; j--) if (uffici_affiliato[j].nome_utente === body.nome_utente) uffici_affiliato.splice(j, 1)   // come "on delete cascade"
      }
      return { data: { ok: true }, error: null }
    },
  },
  from: (tabella: string) => new Interrogazione(tabella),
}

// Per la console del browser: quale settimana è "da compilare" nella demo
console.info(`[demo] settimana da compilare: ${daCompilare} · oggi ${oggiISO()} · settimana in corso ${lunediDi(oggiISO())}`)
