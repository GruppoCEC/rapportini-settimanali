// Test del testo dell'email di avviso delle classifiche (scripts/testo-classifiche.mjs)
import { describe, expect, it } from 'vitest'
import { componiEmailClassifiche, elencoClassifiche, TESTO_CLASSIFICHE } from '../scripts/testo-classifiche.mjs'

describe('Email di avviso delle classifiche', () => {
  it('elenca le classifiche caricate nell\'ordine del sito', () => {
    expect(elencoClassifiche(['miglior_coordinatore', 'uffici'])).toBe('classifica uffici e miglior coordinatore')
    expect(elencoClassifiche(['collaboratori'])).toBe('classifica collaboratori')
    expect(elencoClassifiche(['uffici', 'collaboratori', 'miglior_collaboratore'])).toBe('classifica uffici, classifica collaboratori e miglior collaboratore')
  })

  it('senza testo scritto usa quello di partenza, con mese e classifiche al loro posto', () => {
    const e = componiEmailClassifiche(null, { mese: 'ottobre 2026', classifiche: 'classifica uffici' })
    expect(e.oggetto).toBe('Classifiche di ottobre 2026')
    expect(e.paragrafiHtml).toBe('<p>Buongiorno,</p>\n<p>sono disponibili le classifiche di ottobre 2026: classifica uffici.</p>\n<p>Potete consultarle e stamparle dal sito, nel menu Classifiche.</p>')
    expect(e.pulsante).toBe(TESTO_CLASSIFICHE.pulsante)
  })

  it('il testo scritto dall\'amministratore: paragrafi, a capo e caratteri speciali', () => {
    const e = componiEmailClassifiche({ oggetto: '  🏆 Classifiche  {mese} ', testo: 'Ciao a tutti,\nbravi!\n\n\nEcco {classifiche} <b>&</b>', pulsante: 'Vai a {mese}' },
      { mese: 'ottobre 2026', classifiche: 'classifica uffici' })
    expect(e.oggetto).toBe('🏆 Classifiche ottobre 2026')
    expect(e.paragrafiHtml).toBe('<p>Ciao a tutti,<br>bravi!</p>\n<p>Ecco classifica uffici &lt;b&gt;&amp;&lt;/b&gt;</p>')
    expect(e.pulsante).toBe('Vai a ottobre 2026')
  })

  it('una casella lasciata vuota torna al testo di partenza', () => {
    const e = componiEmailClassifiche({ oggetto: '', testo: '   ', pulsante: '' }, { mese: 'ottobre 2026', classifiche: 'x' })
    expect(e.oggetto).toBe('Classifiche di ottobre 2026')
    expect(e.pulsante).toBe('Apri le classifiche')
  })
})
