// =====================================================================
// CALENDARIO DEI PROMEMORIA — regole pure (senza database né email),
// usate da scripts/promemoria.mjs e verificate dai test automatici.
//   Settimanale: sabato 10:00 (settimana in corso) e lunedì 9:30, giorno della riunione
//                (settimana appena chiusa), agli uffici che non hanno inserito nulla.
//   Mensile:     3 giorni prima e il giorno prima della scadenza (alle 10:00) agli uffici
//                che non hanno inserito nulla; se la scadenza ha il blocco, anche 30 minuti prima
//                ("ultima chiamata", Davide 26/10/2026); il giorno dopo la scadenza il riepilogo
//                all'amministratore generale. Vale solo per i mesi con una scadenza
//                fissata in Report mensile → Panoramica.
// Tutte le date sono 'AAAA-MM-GG' e le ore sono quelle italiane.
// =====================================================================

/** Ora italiana dei promemoria mensili (GitHub può partire in ritardo: si accettano 3 ore) */
export const ORA_GIORNALIERA = 10
export const FINESTRA_ORE = 3

/**
 * Promemoria settimanali: giorno e orari italiani in cui possono partire ('HH:MM', dalle … fino a prima delle …).
 * Il lunedì la finestra si chiude alle 11:30, così l'email arriva prima delle riunioni
 * (Milano alle 12, Roma alle 13) anche se GitHub parte in ritardo. Il sabato alle 15:
 * gli uffici chiudono verso quell'ora, dopo è inutile (Davide, 26/10/2026).
 */
export const PROMEMORIA_SETTIMANALI = {
  sabato: { giorno: 'Sat', da: '10:00', a: '15:00' },
  lunedi: { giorno: 'Mon', da: '09:30', a: '11:30' },
}

/** Promemoria mensili: giorni rispetto al giorno della scadenza */
export const FASI_MENSILI = { mensile_3giorni: -3, mensile_vigilia: -1, mensile_riepilogo: 1 }

/**
 * Ultima chiamata: mezz'ora prima della scadenza, solo se dopo l'inserimento si blocca. La avvia l'orologio di
 * Supabase (supabase/PROMEMORIA_PUNTUALI.sql, ogni 5 minuti vicino alla scadenza); qui si accetta da 35 minuti
 * prima fino alla scadenza, così anche un avvio con un minuto di ritardo va bene.
 */
export const ULTIMA_CHIAMATA_MINUTI = 30
const ULTIMA_CHIAMATA_DA_MINUTI = 35

export const TIPI_SETTIMANALI = Object.keys(PROMEMORIA_SETTIMANALI)
export const TIPI_MENSILI = [...Object.keys(FASI_MENSILI), 'mensile_ultima_chiamata']

/** Data, giorno della settimana e ora in Italia di un istante */
export function inItalia(istante) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(istante)).reduce((o, x) => ({ ...o, [x.type]: x.value }), {})
  return { data: `${p.year}-${p.month}-${p.day}`, giorno: p.weekday, ora: Number(p.hour), orario: `${p.hour}:${p.minute}` }
}

export const aggiungiGiorni = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function lunediDi(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  return aggiungiGiorni(iso, -((d.getUTCDay() + 6) % 7))
}

export function aggiungiMesi(mese, n) {
  const [a, m] = mese.split('-').map(Number)
  const totale = a * 12 + (m - 1) + n
  return `${Math.floor(totale / 12)}-${String((totale % 12) + 1).padStart(2, '0')}-01`
}

const giornoMese = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })

/** "dal 12 al 18 ottobre", "dal 28 settembre al 4 ottobre", "dall'8 al 14 giugno", "dal 1° al 7 giugno" */
export function dalAl(inizio, fine) {
  const g = Number(inizio.slice(8))
  const dal = g === 1 ? 'dal 1°' : g === 8 || g === 11 ? `dall'${g}` : `dal ${g}`
  return inizio.slice(0, 7) === fine.slice(0, 7) ? `${dal} al ${giornoMese(fine)}` : `${dal} ${giornoMese(inizio).replace(/^\d+ /, '')} al ${giornoMese(fine)}`
}

/** Promemoria settimanale che tocca adesso: 'sabato', 'lunedi' oppure null */
export function tipoSettimanale({ giorno, orario }) {
  const [tipo] = Object.entries(PROMEMORIA_SETTIMANALI)
    .find(([, p]) => p.giorno === giorno && orario >= p.da && orario < p.a) ?? [null]
  return tipo
}

/** Settimana (il suo lunedì) di cui si chiedono i dati: il sabato quella in corso, il lunedì quella appena chiusa */
export function settimanaDelPromemoria(tipo, oggi) {
  return tipo === 'lunedi' ? aggiungiGiorni(lunediDi(oggi), -7) : lunediDi(oggi)
}

/** È l'ora dei promemoria mensili (ogni giorno alle 10)? */
export const oraMensile = ({ ora }) => ora >= ORA_GIORNALIERA && ora < ORA_GIORNALIERA + FINESTRA_ORE

/**
 * Promemoria mensili che toccano oggi.
 * scadenze: righe di scadenze_mensili ({ mese, scadenza, blocca }).
 * Ritorna [{ tipo, mese, scadenza }] dove scadenza ha anche giorno e orario italiani.
 */
export function promemoriaMensiliDiOggi(oggi, scadenze) {
  const esito = []
  for (const s of scadenze) {
    const { data: giorno, orario } = inItalia(s.scadenza)
    for (const [tipo, scarto] of Object.entries(FASI_MENSILI)) {
      if (aggiungiGiorni(giorno, scarto) === oggi) esito.push({ tipo, mese: s.mese, scadenza: { ...s, giorno, orario } })
    }
  }
  return esito
}

/**
 * Ultima chiamata che tocca adesso (istante in millisecondi): per ogni scadenza con il blocco,
 * da 35 minuti prima fino alla scadenza. Ritorna [{ tipo, mese, scadenza }] come promemoriaMensiliDiOggi.
 */
export function ultimaChiamataAdesso(adesso, scadenze) {
  return scadenze.filter((s) => {
    const limite = new Date(s.scadenza).getTime()
    return s.blocca && adesso >= limite - ULTIMA_CHIAMATA_DA_MINUTI * 60000 && adesso < limite
  }).map((s) => {
    const { data: giorno, orario } = inItalia(s.scadenza)
    return { tipo: 'mensile_ultima_chiamata', mese: s.mese, scadenza: { ...s, giorno, orario } }
  })
}

/**
 * Chiave per non inviare due volte lo stesso promemoria (tabella promemoria_inviati).
 * Per il mensile la data è il giorno della scadenza: se l'amministratore la sposta,
 * i promemoria ripartono per la nuova data.
 */
export function chiaveMensile(tipo, mese, giornoScadenza) {
  return { tipo: `${tipo}:${mese.slice(0, 7)}`, settimana: giornoScadenza }
}

// ---------------------------------------------------------------- Rapportino mensile

export function ultimoGiornoDelMese(mese) {
  return aggiungiGiorni(aggiungiMesi(mese, 1), -1)
}

/** Stessa regola del sito (src/lib/mensile.ts): chi lascia l'ufficio nel mese non conta in quel mese */
export function inServizio(p, mese) {
  const fine = ultimoGiornoDelMese(mese)
  return p.data_inizio <= fine && (!p.data_fine || p.data_fine > fine)
}

/**
 * Stato del rapportino mensile di un ufficio, come nel sito (statoMensile in src/lib/mensile.ts):
 * mancante = nessun numero; completo = ogni persona in servizio ha tutte le caselle; parziale = il resto.
 * Gli indicatori di un solo ruolo (es. App. vendita fix) non sono obbligatori.
 */
export function statoMensile(persone, valori, voci, mese) {
  const presenti = persone.filter((p) => inServizio(p, mese))
  const ids = new Set(presenti.map((p) => p.id))
  const pieni = new Set(valori.filter((v) => v.valore !== null && ids.has(v.persona_id)).map((v) => `${v.persona_id}|${v.voce}`))
  if (pieni.size === 0) return 'mancante'
  const colonne = voci.filter((v) => !v.solo_ruolo && !v.riservata)   // le voci riservate (018) le scrive l'amministrazione
  const completo = presenti.length > 0 && presenti.every((p) => colonne.every((v) => pieni.has(`${p.id}|${v.codice}`)))
  return completo ? 'completo' : 'parziale'
}

/** Ultimo inserimento arrivato dopo la scadenza (null se tutto in tempo) */
export function ultimoRitardo(valori, scadenza) {
  const limite = new Date(scadenza).getTime()
  const tardi = valori.filter((v) => v.aggiornato_il && new Date(v.aggiornato_il).getTime() > limite).map((v) => v.aggiornato_il)
  return tardi.length ? tardi.sort().at(-1) : null
}
