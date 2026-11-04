// Tipi per il sito (TypeScript) di scripts/testo-classifiche.mjs
export interface TestiEmail { oggetto: string; testo: string; pulsante: string }
export const TESTO_CLASSIFICHE: TestiEmail
export const SEGNAPOSTO_CLASSIFICHE: { codice: string; spiegazione: string }[]
export const CATEGORIE_EMAIL: string[]
export function elencoClassifiche(categorie: string[]): string
export function componiEmailClassifiche(testi: Partial<TestiEmail> | null | undefined, valori: { mese: string; classifiche: string }): { oggetto: string; paragrafiHtml: string; pulsante: string }
