// Testo dell'email di avviso delle classifiche (021). Lo usano sia il sito (Classifiche → Email di avviso:
// modifica e anteprima) sia scripts/promemoria.mjs (invio), così l'anteprima è identica all'email vera.
// L'amministratore generale può cambiare oggetto, testo e pulsante dal sito (tabella testi_email);
// se non li ha cambiati vale il testo qui sotto.

/** Il testo di partenza (Davide può cambiarlo dal sito, e tornare a questo con "Testo iniziale") */
export const TESTO_CLASSIFICHE = {
  oggetto: 'Classifiche di {mese}',
  testo: 'Buongiorno,\n\nsono disponibili le classifiche di {mese}: {classifiche}.\n\nPotete consultarle e stamparle dal sito, nel menu Classifiche.',
  pulsante: 'Apri le classifiche',
}

/** Le parole tra graffe che si sostituiscono da sole */
export const SEGNAPOSTO_CLASSIFICHE = [
  { codice: '{mese}', spiegazione: 'il mese, es. "ottobre 2026"' },
  { codice: '{classifiche}', spiegazione: 'le classifiche caricate, es. "classifica uffici, classifica collaboratori e miglior collaboratore"' },
]

const NOMI = {
  uffici: 'classifica uffici', collaboratori: 'classifica collaboratori', miglior_collaboratore: 'miglior collaboratore',
  miglior_coordinatrice: 'miglior coordinatrice', miglior_coordinatore: 'miglior coordinatore',
}
export const CATEGORIE_EMAIL = Object.keys(NOMI)

/** "classifica uffici, classifica collaboratori e miglior collaboratore" (nell'ordine del sito) */
export function elencoClassifiche(categorie) {
  const nomi = CATEGORIE_EMAIL.filter((c) => categorie.includes(c)).map((c) => NOMI[c])
  return nomi.length <= 1 ? (nomi[0] ?? '') : `${nomi.slice(0, -1).join(', ')} e ${nomi.at(-1)}`
}

const sostituisci = (t, valori) => t.replaceAll('{mese}', valori.mese).replaceAll('{classifiche}', valori.classifiche)
const html = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * L'email pronta: oggetto, paragrafi e pulsante già in HTML (una riga vuota = nuovo paragrafo, a capo = a capo) e testo del pulsante.
 * testi: { oggetto, testo, pulsante } scritti dall'amministratore (vuoti = quelli di partenza);
 * valori: { mese: 'ottobre 2026', classifiche: elencoClassifiche(...) }
 */
export function componiEmailClassifiche(testi, valori) {
  const t = {
    oggetto: testi?.oggetto?.trim() || TESTO_CLASSIFICHE.oggetto,
    testo: testi?.testo?.trim() || TESTO_CLASSIFICHE.testo,
    pulsante: testi?.pulsante?.trim() || TESTO_CLASSIFICHE.pulsante,
  }
  const paragrafi = sostituisci(t.testo, valori).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${html(p).replace(/\n/g, '<br>')}</p>`)
  return { oggetto: sostituisci(t.oggetto, valori).replace(/\s+/g, ' '), paragrafiHtml: paragrafi.join('\n'), pulsante: html(sostituisci(t.pulsante, valori)) }
}
