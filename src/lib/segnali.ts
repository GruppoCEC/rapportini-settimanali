// Segnali della settimana (solo amministrazione, decisione di Davide del 21/10/2026): invece di guardare
// tutti gli uffici, la piattaforma indica quelli in cui qualcosa cambia davvero. Ogni ufficio si confronta
// con se stesso (le sue 12 settimane prima), non con gli altri: per un ufficio piccolo 2 incarichi sono
// normali, per uno grande no.
// Si usano solo le settimane scritte dall'ufficio: quelle completate dal rapportino mensile (da_mensile,
// 011_settimane_dal_mensile.sql) sono divise in parti uguali e farebbero scattare segnali falsi.
import { aggiungiSettimane } from './settimane'
import type { Metrica, Rilevazione, Ufficio } from './tipi'

/** Settimane di confronto: la media e l'oscillazione normale si calcolano su queste */
export const SETTIMANE_BASE = 12
/** Il calo (o la crescita) deve durare almeno tante settimane di fila, compresa quella presentata */
export const SETTIMANE_DI_FILA = 4
/** Servono almeno tante settimane scritte dall'ufficio tra quelle di confronto */
export const MINIMO_BASE = 8
/** Sotto questa media settimanale la voce è troppo piccola per un segnale, in giù o in su (es. 0 o 2 vendite in una settimana sono normali) */
export const MEDIA_MINIMA = 2
/** "Fuori dal solito": oltre tante volte l'oscillazione normale dell'ufficio */
export const DEVIAZIONI = 2
/** Il calo di fila conta se le ultime settimane sono in media almeno il 20% sotto (o sopra) la media */
export const SCARTO_DI_FILA = 0.2

export type TipoSegnale = 'calo' | 'basso' | 'crescita' | 'alto'

export interface Segnale {
  ufficio: Ufficio
  metrica: Metrica
  tipo: TipoSegnale
  positivo: boolean
  peso: number               // quanto è forte (per mettere in ordine): scarto relativo dalla media
  testo: string              // "Appuntamenti sotto la sua media da 4 settimane"
  dettaglio: string          // "media 9 · ultime 4 settimane: 6, 5, 7, 4"
}

const arrotonda = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 1 })

/**
 * Segnali della settimana `settimana` (lunedì) per gli uffici e le attività indicati.
 * `rilevazioni` deve contenere almeno le SETTIMANE_BASE + SETTIMANE_DI_FILA settimane fino a `settimana`.
 */
export function calcolaSegnali(rilevazioni: Rilevazione[], uffici: Ufficio[], attivita: Metrica[], settimana: string): Segnale[] {
  const n = SETTIMANE_BASE + SETTIMANE_DI_FILA
  const settimane = Array.from({ length: n }, (_, i) => aggiungiSettimane(settimana, i - n + 1))
  const indice = new Map<string, number>()
  for (const r of rilevazioni) {
    if (r.risultato !== null && !r.da_mensile) indice.set(`${r.ufficio_id}|${r.metrica}|${r.settimana}`, r.risultato)
  }
  const out: Segnale[] = []
  for (const u of uffici) {
    for (const m of attivita) {
      const serie = settimane.map((s) => indice.get(`${u.id}|${m.codice}|${s}`) ?? null)
      const base = serie.slice(0, SETTIMANE_BASE).filter((v): v is number => v !== null)
      const ultime = serie.slice(SETTIMANE_BASE)
      if (base.length < MINIMO_BASE) continue
      const media = base.reduce((s, v) => s + v, 0) / base.length
      if (media < MEDIA_MINIMA) continue
      const oscillazione = Math.sqrt(base.reduce((s, v) => s + (v - media) ** 2, 0) / base.length)
      const segnale = (tipo: TipoSegnale, peso: number, testo: string, dettaglio: string) =>
        out.push({ ufficio: u, metrica: m, tipo, positivo: tipo === 'crescita' || tipo === 'alto', peso, testo, dettaglio })

      // 1. Di fila: tutte le ultime settimane scritte e tutte sotto (o sopra) la media, con uno scarto vero
      const piene = ultime.every((v) => v !== null) ? (ultime as number[]) : null
      const mediaUltime = piene ? piene.reduce((s, v) => s + v, 0) / piene.length : null
      const dettaglioFila = piene ? `media ${arrotonda(media)} · ultime ${SETTIMANE_DI_FILA} settimane: ${piene.join(', ')}` : ''
      let diFila = false
      if (piene && mediaUltime !== null && piene.every((v) => v < media) && mediaUltime <= media * (1 - SCARTO_DI_FILA)) {
        segnale('calo', 1 - mediaUltime / media, `${m.nome} sotto la sua media da ${SETTIMANE_DI_FILA} settimane`, dettaglioFila)
        diFila = true
      } else if (piene && mediaUltime !== null && piene.every((v) => v > media) && mediaUltime >= media * (1 + SCARTO_DI_FILA)) {
        segnale('crescita', mediaUltime / media - 1, `${m.nome} sopra la sua media da ${SETTIMANE_DI_FILA} settimane`, dettaglioFila)
        diFila = true
      }
      if (diFila) continue

      // 2. Fuori dal solito: la settimana presentata è oltre l'oscillazione normale dell'ufficio
      const v = ultime[ultime.length - 1]
      if (v === null || oscillazione === 0) continue
      const scarto = (v - media) / oscillazione
      const solito = `di solito tra ${Math.max(0, Math.round(media - DEVIAZIONI * oscillazione))} e ${Math.round(media + DEVIAZIONI * oscillazione)}`
      if (scarto <= -DEVIAZIONI) {
        segnale('basso', -scarto / 10, `${m.nome} molto sotto il solito questa settimana`, `${v} contro una media di ${arrotonda(media)} (${solito})`)
      } else if (scarto >= DEVIAZIONI) {
        segnale('alto', scarto / 10, `${m.nome} molto sopra il solito questa settimana`, `${v} contro una media di ${arrotonda(media)} (${solito})`)
      }
    }
  }
  return out
}

/** I segnali raggruppati per ufficio: prima gli uffici con più segnali (e più forti), dentro ogni ufficio i più forti */
export function perUfficio(segnali: Segnale[]): { ufficio: Ufficio; segnali: Segnale[] }[] {
  const gruppi = new Map<number, { ufficio: Ufficio; segnali: Segnale[] }>()
  for (const s of segnali) {
    const g = gruppi.get(s.ufficio.id) ?? { ufficio: s.ufficio, segnali: [] }
    g.segnali.push(s)
    gruppi.set(s.ufficio.id, g)
  }
  const forza = (g: { segnali: Segnale[] }) => g.segnali.reduce((t, s) => t + s.peso, 0)
  return [...gruppi.values()]
    .map((g) => ({ ...g, segnali: g.segnali.sort((a, b) => b.peso - a.peso) }))
    .sort((a, b) => b.segnali.length - a.segnali.length || forza(b) - forza(a) || a.ufficio.nome.localeCompare(b.ufficio.nome))
}

/** Prima settimana da caricare per calcolare i segnali della settimana indicata */
export const inizioSegnali = (settimana: string) => aggiungiSettimane(settimana, -(SETTIMANE_BASE + SETTIMANE_DI_FILA - 1))
