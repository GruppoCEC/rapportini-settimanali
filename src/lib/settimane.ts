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

export function nomeMese(mese: string): string {
  const [a, m] = mese.split('-').map(Number)
  return `${MESI[m - 1]} ${a}`
}

/** Es. "5 – 11 ottobre 2026" oppure "28 settembre – 4 ottobre 2026" */
export function intervalloSettimana(lunedi: string): string {
  const inizio = daISO(lunedi)
  const fine = daISO(aggiungiGiorni(lunedi, 6))
  const gi = inizio.getUTCDate(), gf = fine.getUTCDate()
  const mi = MESI[inizio.getUTCMonth()], mf = MESI[fine.getUTCMonth()]
  const ai = inizio.getUTCFullYear(), af = fine.getUTCFullYear()
  if (ai !== af) return `${gi} ${mi} ${ai} – ${gf} ${mf} ${af}`
  if (mi !== mf) return `${gi} ${mi} – ${gf} ${mf} ${af}`
  return `${gi} – ${gf} ${mf} ${af}`
}

/** Es. "2ª settimana di ottobre 2026" */
export function etichettaSettimana(lunedi: string): string {
  return `${settimanaNelMese(lunedi)}ª settimana di ${nomeMese(meseDellaSettimana(lunedi))}`
}
