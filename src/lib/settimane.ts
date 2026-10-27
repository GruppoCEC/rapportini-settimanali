// Calcoli sulle settimane. Una settimana va dal lunedì alla domenica ed è
// identificata dalla data del lunedì in formato 'AAAA-MM-GG'.
// Regola del mese: la settimana appartiene al mese in cui cade il suo giovedì
// (la stessa regola è nel database: mese_della_settimana / settimana_nel_mese).

const GIORNO_MS = 24 * 60 * 60 * 1000

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

/** 'AAAA-MM-GG' → Date (mezzanotte UTC, così niente sorprese con l'ora legale) */
function daISO(iso: string): Date {
  const [a, m, g] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, g))
}

function aISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** La data di oggi secondo l'orologio del computer/telefono */
export function oggiISO(adesso: Date = new Date()): string {
  return aISO(new Date(Date.UTC(adesso.getFullYear(), adesso.getMonth(), adesso.getDate())))
}

export function aggiungiGiorni(iso: string, giorni: number): string {
  return aISO(new Date(daISO(iso).getTime() + giorni * GIORNO_MS))
}

export function aggiungiSettimane(lunedi: string, settimane: number): string {
  return aggiungiGiorni(lunedi, settimane * 7)
}

/** Il lunedì della settimana che contiene questa data */
export function lunediDi(iso: string): string {
  const giorno = daISO(iso).getUTCDay()           // 0 = domenica … 6 = sabato
  return aggiungiGiorni(iso, -((giorno + 6) % 7))
}

/** Mese della settimana nel formato 'AAAA-MM' */
export function meseDellaSettimana(lunedi: string): string {
  return aggiungiGiorni(lunedi, 3).slice(0, 7)
}

/** 1ª, 2ª, … 5ª settimana del mese */
export function settimanaNelMese(lunedi: string): number {
  return Math.floor((daISO(aggiungiGiorni(lunedi, 3)).getUTCDate() - 1) / 7) + 1
}

/** Tutti i lunedì delle settimane che appartengono al mese 'AAAA-MM' */
export function settimaneDelMese(mese: string): string[] {
  let lunedi = lunediDi(`${mese}-01`)
  if (meseDellaSettimana(lunedi) !== mese) lunedi = aggiungiSettimane(lunedi, 1)
  const elenco: string[] = []
  while (meseDellaSettimana(lunedi) === mese) {
    elenco.push(lunedi)
    lunedi = aggiungiSettimane(lunedi, 1)
  }
  return elenco
}

/**
 * Settimana proposta all'apertura: quella in corso, ma il lunedì (giorno
 * della riunione) quella appena chiusa, che è quella da completare.
 */
export function settimanaPredefinita(oggi: string = oggiISO()): string {
  const lunedi = lunediDi(oggi)
  return oggi === lunedi ? aggiungiSettimane(lunedi, -1) : lunedi
}

/**
 * Quante settimane dopo quella da compilare si possono aprire in Inserisci settimana, per scrivere in anticipo
 * gli obiettivi (Davide, 27/10/2026: "almeno 4", così si preparano quelli di tutto il mese dopo).
 */
export const SETTIMANE_IN_ANTICIPO = 4

/** L'ultima settimana che si può aprire in Inserisci settimana */
export function ultimaSettimanaInseribile(oggi: string = oggiISO()): string {
  return aggiungiSettimane(settimanaPredefinita(oggi), SETTIMANE_IN_ANTICIPO)
}

/** Settimana non ancora iniziata: si scrivono solo gli obiettivi (niente risultati, dati di zona e note) */
export function settimanaFutura(lunedi: string, oggi: string = oggiISO()): boolean {
  return lunedi > lunediDi(oggi)
}

/** Ultima settimana già conclusa (quella prima della settimana in corso): base per cruscotto e riunione */
export function ultimaSettimanaConclusa(oggi: string = oggiISO()): string {
  return aggiungiSettimane(lunediDi(oggi), -1)
}

export function nomeMese(mese: string): string {
  const [a, m] = mese.split('-').map(Number)
  return `${MESI[m - 1]} ${a}`
}

/** Nome breve del mese 'AAAA-MM' per gli assi dei grafici, es. "ott" */
export function nomeMeseBreve(mese: string): string {
  return MESI[Number(mese.slice(5, 7)) - 1].slice(0, 3)
}

/** Mese 'AAAA-MM' spostato di n mesi (anche negativi) */
export function aggiungiMesi(mese: string, n: number): string {
  const [a, m] = mese.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7)
}

/** Es. "5 – 11 ottobre 2026" oppure "28 settembre – 4 ottobre 2026" */
export function intervalloSettimana(lunedi: string): string {
  return intervalloDate(lunedi, aggiungiGiorni(lunedi, 6))
}

/** Più settimane di fila, dal lunedì della prima alla domenica dell'ultima: "21 settembre – 18 ottobre 2026" */
export function intervalloSettimane(primoLunedi: string, ultimoLunedi: string): string {
  return intervalloDate(primoLunedi, aggiungiGiorni(ultimoLunedi, 6))
}

/** Es. "21 settembre" */
export function giornoEMese(iso: string): string {
  const d = daISO(iso)
  return `${d.getUTCDate()} ${MESI[d.getUTCMonth()]}`
}

/** "5 – 11 ottobre 2026", "28 settembre – 4 ottobre 2026", "29 dicembre 2025 – 4 gennaio 2026" */
function intervalloDate(da: string, a: string): string {
  const inizio = daISO(da)
  const fine = daISO(a)
  const gi = inizio.getUTCDate(), gf = fine.getUTCDate()
  const mi = MESI[inizio.getUTCMonth()], mf = MESI[fine.getUTCMonth()]
  const ai = inizio.getUTCFullYear(), af = fine.getUTCFullYear()
  if (ai !== af) return `${gi} ${mi} ${ai} – ${gf} ${mf} ${af}`
  if (mi !== mf) return `${gi} ${mi} – ${gf} ${mf} ${af}`
  return `${gi} – ${gf} ${mf} ${af}`
}

/** Es. "Settimana 5 – 11 ottobre 2026" (senza numerazione: negli Excel la 1ª settimana
 *  partiva dal giorno 1 del mese, qui le settimane sono sempre intere lunedì–domenica) */
export function etichettaSettimana(lunedi: string): string {
  return `Settimana ${intervalloSettimana(lunedi)}`
}

/** Per le settimane a cavallo di due mesi: in quale mese contano nei totali (null se non a cavallo) */
export function notaMeseSettimana(lunedi: string): string | null {
  if (lunedi.slice(0, 7) === aggiungiGiorni(lunedi, 6).slice(0, 7)) return null
  return `a cavallo di due mesi: conta nei totali di ${nomeMese(meseDellaSettimana(lunedi))}`
}
