// Scheda del collaboratore e curva dei nuovi (solo amministratori): i numeri di una persona mese per mese,
// la media dei colleghi con lo stesso ruolo e la "curva di crescita" per mese di servizio.
// Usa solo i numeri inseriti persona per persona: lo storico del file Excel ha solo i totali degli uffici.
import { inServizio, mesiDiServizio, vociDelRapportino, type TotaliMese } from './mensile'
import type { Persona, RuoloPersona, ValoreMensile, VoceMensile } from './tipi'

/** Mesi di servizio considerati nella curva dei nuovi (dal 1° al 12°) */
export const MESI_CURVA = 12
/** Un punto della curva si mostra solo se ci sono almeno tante persone in quel mese di servizio */
export const MINIMO_PERSONE = 3
/** "Da seguire": sotto questa frazione della media degli altri nello stesso mese di servizio */
export const SOGLIA_DA_SEGUIRE = 0.5

/** I numeri di una persona in un mese, voce per voce (null = non inserito) */
export function numeriPersona(valori: ValoreMensile[], personaId: number, mese: string, voci: VoceMensile[]): TotaliMese {
  const numeri: TotaliMese = new Map(vociDelRapportino(voci).map((v) => [v.codice, null]))
  for (const v of valori) {
    if (v.persona_id === personaId && v.mese === mese && v.valore !== null && numeri.has(v.voce)) numeri.set(v.voce, v.valore)
  }
  return numeri
}

/** La persona ha inserito almeno un numero in quel mese? */
export const haNumeri = (t: TotaliMese) => [...t.values()].some((v) => v !== null)

/** Media voce per voce di più mesi o persone: conta solo dove il numero c'è */
export function media(elenco: TotaliMese[], codici: string[]): Map<string, number | null> {
  return new Map(codici.map((c) => {
    const presenti = elenco.map((t) => t.get(c) ?? null).filter((v): v is number => v !== null)
    return [c, presenti.length === 0 ? null : presenti.reduce((s, v) => s + v, 0) / presenti.length]
  }))
}

/**
 * Media dei colleghi con lo stesso ruolo in un mese: tra chi era in servizio e ha inserito numeri.
 * Serve per il confronto nella scheda della persona (la persona stessa è compresa, come in una media di gruppo).
 */
export function mediaRuolo(persone: Persona[], valori: ValoreMensile[], ruolo: RuoloPersona, mese: string, voci: VoceMensile[]): Map<string, number | null> {
  const codici = vociDelRapportino(voci).map((v) => v.codice)
  const numeri = persone.filter((p) => p.ruolo === ruolo && inServizio(p, mese))
    .map((p) => numeriPersona(valori, p.id, mese, voci)).filter(haNumeri)
  return media(numeri, codici)
}

/**
 * La scheda è il seguito di un trasferimento (017)? Cioè la stessa persona (stesso nome) ha un'altra scheda
 * chiusa con "trasferito in un altro ufficio" nel mese in cui questa inizia. Chi arriva così non è un nuovo
 * ingresso nel gruppo: resta fuori dalla curva dei nuovi e dall'elenco dei nuovi entrati.
 */
export function arrivatoDaTrasferimento(p: Persona, persone: Persona[]): boolean {
  const nome = p.nome.trim().toLowerCase()
  return persone.some((q) => q.id !== p.id && q.motivo_fine === 'trasferimento' && q.data_fine?.slice(0, 7) === p.data_inizio.slice(0, 7)
    && q.nome.trim().toLowerCase() === nome)
}

/** Mese di servizio (1 = il mese in cui ha iniziato) di una persona in un mese */
export const meseDiServizio = (p: Persona, mese: string) => mesiDiServizio(p.data_inizio, mese) + 1

export interface PuntoCurva { valore: number | null; persone: number }

/**
 * Curva di crescita: per il 1°, 2°… mese di servizio, la media di una voce tra le persone del ruolo
 * che in quel mese di servizio hanno il numero inserito. Con meno di MINIMO_PERSONE il punto resta vuoto.
 */
export function curvaCrescita(persone: Persona[], valori: ValoreMensile[], mesi: string[], ruolo: RuoloPersona, voce: string, maxMesi = MESI_CURVA): PuntoCurva[] {
  const perMese: number[][] = Array.from({ length: maxMesi }, () => [])
  const indice = new Map(valori.filter((v) => v.voce === voce && v.valore !== null).map((v) => [`${v.persona_id}|${v.mese}`, v.valore!]))
  for (const p of persone.filter((x) => x.ruolo === ruolo && !arrivatoDaTrasferimento(x, persone))) {
    for (const m of mesi) {
      if (!inServizio(p, m)) continue
      const k = meseDiServizio(p, m)
      const v = indice.get(`${p.id}|${m}`)
      if (k <= maxMesi && v !== undefined) perMese[k - 1].push(v)
    }
  }
  return perMese.map((elenco) => ({
    persone: elenco.length,
    valore: elenco.length < MINIMO_PERSONE ? null : elenco.reduce((s, v) => s + v, 0) / elenco.length,
  }))
}

/** I collaboratori entrati negli ultimi maxMesi mesi (rispetto all'ultimo mese) e ancora in servizio, dal più recente */
export function nuoviEntrati(persone: Persona[], ruolo: RuoloPersona, ultimoMese: string, maxMesi = MESI_CURVA): Persona[] {
  return persone
    .filter((p) => p.ruolo === ruolo && inServizio(p, ultimoMese) && meseDiServizio(p, ultimoMese) <= maxMesi && !arrivatoDaTrasferimento(p, persone))
    .sort((a, b) => b.data_inizio.localeCompare(a.data_inizio) || a.nome.localeCompare(b.nome))
}

/** Il valore è "da seguire" rispetto alla media? (sotto la metà; per le voci "meglio se scende" sopra il doppio) */
export function daSeguire(valore: number | null, riferimento: number | null, voce?: VoceMensile): boolean {
  if (valore === null || riferimento === null || riferimento === 0) return false
  return voce?.meglio_se_scende ? valore > riferimento / SOGLIA_DA_SEGUIRE : valore < riferimento * SOGLIA_DA_SEGUIRE
}

/** Confronto con la media: 'sopra' (meglio), 'sotto' (peggio) o null; per le voci "meglio se scende" al contrario */
export function rispettoAllaMedia(valore: number | null, riferimento: number | null, voce?: VoceMensile): 'sopra' | 'sotto' | null {
  if (valore === null || riferimento === null) return null
  const meglio = voce?.meglio_se_scende ? valore <= riferimento : valore >= riferimento
  return meglio ? 'sopra' : 'sotto'
}

/** Es. "3,4" */
export const formattaMedia = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('it-IT', { maximumFractionDigits: 1 }))
