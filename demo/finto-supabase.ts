// =====================================================================
// VERSIONE DIMOSTRATIVA — finto database in memoria, con dati inventati.
// Sostituisce src/lib/supabase.ts solo quando si avvia "npm run demo".
// Imita in modo semplificato le regole di accesso del database vero.
// I dati si azzerano ricaricando la pagina.
// =====================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */
import { aggiungiSettimane, lunediDi, oggiISO, settimanaPredefinita } from '../src/lib/settimane'
import { aggiungiMesi, inServizio, mesePredefinito } from '../src/lib/mensile'
import { totaliPerUfficio } from '../src/lib/aggregazioni'

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
  if (u.id % 3 === 1) {
    note.push({ ufficio_id: u.id, settimana: daCompilare, testo: ['Acquisito incarico in esclusiva in via Chisimaio, trilocale con terrazzo.', 'Due proposte in trattativa, firma prevista la prossima settimana.', 'Settimana rallentata da due colleghi in ferie.', 'Avviata campagna volantinaggio sulla zona nord.'][u.id % 4], aggiornato_da: null, aggiornato_il: new Date().toISOString() })
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
// Punti di ESEMPIO per la gara dei collaboratori (quelli veri li decide Davide in Report mensile → Personale)
const punti_mensili: any[] = Object.entries({
  portafoglio_vendita: 1, portafoglio_locazione: 0.5, acquisizioni: 3, appuntamenti_vendita: 1, appuntamenti_locazione: 0.5,
  incarichi_vendita: 5, incarichi_locazione: 2, ribassi: 1, kiron: 2, colloqui: 1, proposte_vendita: 4, proposte_locazione: 2,
  accettazioni_vendita: 6, accettazioni_locazione: 3, vendite_effettuate: 10, richieste_vendita: 0.5, richieste_locazione: 0.5, incarichi_scaduti: -3,
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
  if (u.id % 4 === 0) persone.find((p) => p.ufficio_id === u.id && p.ruolo === 'collaboratore').data_fine =
    `${aggiungiMesi(meseDaCompilare, -1 - (Math.floor(u.id / 4) % 8)).slice(0, 8)}${String(5 + (u.id % 20)).padStart(2, '0')}`
  // e qualche uscita proprio nel mese da compilare (righe rosse)
  if (u.id % 3 === 1) {
    const chi = persone.filter((p) => p.ufficio_id === u.id && p.ruolo !== 'responsabile' && !p.data_fine).pop()
    if (chi) chi.data_fine = `${meseDaCompilare.slice(0, 8)}${String(tra(10, 28)).padStart(2, '0')}`
  }
  if (u.id % 5 === 2) persone.push({ id: prossimoIdPersona++, ufficio_id: u.id, nome: `${NOMI[tra(0, NOMI.length - 1)]} ${COGNOMI[tra(0, COGNOMI.length - 1)]}`, ruolo: 'collaboratore', data_inizio: `${meseDaCompilare.slice(0, 8)}${String(tra(1, 20)).padStart(2, '0')}`, data_fine: null })
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
      const peso = p.ruolo === 'collaboratore' ? 1 : p.ruolo === 'responsabile' ? 0.7 : 0.35
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

// Scadenza di esempio per il mese da compilare: il 5 del mese dopo alle 23:59, senza blocco
const scadenze_mensili: any[] = [{ mese: meseDaCompilare, scadenza: new Date(`${aggiungiMesi(meseDaCompilare, 1).slice(0, 8)}05T23:59:00`).toISOString(), blocca: false }]

const tabelle: Record<string, any[]> = { citta, aree, uffici, utenti, uffici_affiliato, metriche, rilevazioni, note_settimana: note, persone, voci_mensili, valori_mensili, confronto_anno_prima, punti_mensili, scadenze_mensili }

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
    case 'rilevazioni': case 'note_settimana': case 'persone': case 'valori_mensili': return ufficiLeggibili().has(riga.ufficio_id)
    case 'confronto_anno_prima': return me.ruolo === 'admin_generale'
    case 'punti_mensili': return me.ruolo === 'admin_generale' || me.ruolo === 'admin_citta'
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
      // affiliato: sola consultazione; gli uffici agli affiliati li assegna solo l'amministratore generale
      if (me.ruolo === 'affiliato' || (this.tabella === 'uffici_affiliato' && me.ruolo !== 'admin_generale')) {
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
          if (['persone', 'valori_mensili'].includes(this.tabella) && me.ruolo === 'ufficio') {   // in prova: come la regola del database
            let inProva = false
            try { inProva = localStorage.getItem('rapportini.demo.mensileInProva') === 'si' } catch { /* niente */ }
            if (inProva) return { data: null, error: { message: 'new row violates row-level security policy' } }
          }
          if (this.tabella === 'valori_mensili' && me.ruolo === 'ufficio') {      // mese chiuso: come il trigger del database
            const s = scadenze_mensili.find((x) => x.mese === r.mese)
            if (s && s.blocca && Date.now() > new Date(s.scadenza).getTime()) return { data: null, error: { message: 'Inserimento chiuso: la scadenza per questo mese è passata. Per correzioni contatta l\'amministratore' } }
          }
          if (['confronto_anno_prima', 'punti_mensili', 'scadenze_mensili'].includes(this.tabella) && me.ruolo !== 'admin_generale') return { data: null, error: { message: 'new row violates row-level security policy' } }
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
