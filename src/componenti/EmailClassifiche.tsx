// Classifiche → Email di avviso (solo amministratore generale, richiesta di Davide del 04/11/2026):
// oggetto, testo e pulsante dell'email che parte con "Pubblica e manda l'avviso", con l'anteprima
// di come arriverà. Il testo si compone con scripts/testo-classifiche.mjs, lo stesso dell'invio vero.
import { useState } from 'react'
import { componiEmailClassifiche, elencoClassifiche, SEGNAPOSTO_CLASSIFICHE, TESTO_CLASSIFICHE, type TestiEmail } from '../../scripts/testo-classifiche.mjs'
import { caricaTestoClassifiche, contaDestinatari } from '../lib/dati'
import { nomeMese } from '../lib/settimane'
import { supabase } from '../lib/supabase'
import { useDati } from '../lib/useDati'
import { Icona, useToast } from './Interfaccia'

export function EmailClassifiche({ mese, categorie }: { mese: string; categorie: string[] }) {
  const { dati, errore, ricarica } = useDati(async () => {
    const [testo, destinatari] = await Promise.all([caricaTestoClassifiche(), contaDestinatari()])
    return { testo, destinatari }
  }, [])
  const [bozza, setBozza] = useState<TestiEmail | null>(null)
  const [attesa, setAttesa] = useState(false)
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [toast, mostraToast] = useToast()

  if (!dati) return <section className="scheda"><p className={errore ? 'errore' : 'piccolo'}>{errore ? `Testo dell'email non caricato: ${errore}` : 'Caricamento…'}</p></section>

  const salvato: TestiEmail = dati.testo ?? TESTO_CLASSIFICHE
  const t = bozza ?? salvato
  const cambiato = t.oggetto !== salvato.oggetto || t.testo !== salvato.testo || t.pulsante !== salvato.pulsante
  const iniziale = t.oggetto === TESTO_CLASSIFICHE.oggetto && t.testo === TESTO_CLASSIFICHE.testo && t.pulsante === TESTO_CLASSIFICHE.pulsante
  // l'anteprima usa il mese scelto in alto e le classifiche caricate (se non ce n'è nessuna, tutte e cinque)
  const email = componiEmailClassifiche(t, { mese: nomeMese(mese), classifiche: elencoClassifiche(categorie.length ? categorie : ['uffici', 'collaboratori', 'miglior_collaboratore', 'miglior_coordinatrice', 'miglior_coordinatore']) })
  const cambia = (campo: keyof TestiEmail, valore: string) => { setBozza({ ...t, [campo]: valore }); setMessaggio(null) }

  async function salva() {
    if (!t.oggetto.trim() || !t.testo.trim() || !t.pulsante.trim()) return setMessaggio('Oggetto, testo e pulsante non possono restare vuoti.')
    setAttesa(true)
    const { error } = await supabase.from('testi_email').upsert({ chiave: 'classifiche', oggetto: t.oggetto.trim(), testo: t.testo.trim(), pulsante: t.pulsante.trim() }, { onConflict: 'chiave' })
    setAttesa(false)
    if (error) return setMessaggio(`Salvataggio non riuscito: ${error.message}`)
    setBozza(null)
    mostraToast('Testo dell\'email salvato.')
    ricarica()
  }

  return (
    <section className="scheda email-classifiche entra entra-2">
      <div>
        <h2>Email di avviso</h2>
        <p className="piccolo">Parte con <strong>Pubblica e manda l'avviso</strong> a <strong>tutti gli indirizzi per i promemoria</strong>
          ({dati.destinatari} {dati.destinatari === 1 ? 'indirizzo' : 'indirizzi'}, uno per indirizzo). Il testo vale per tutti i mesi.</p>
      </div>
      <div className="email-classifiche-corpo">
        <div className="email-modulo">
          <div className="campo">
            <label htmlFor="email-oggetto">Oggetto</label>
            <input id="email-oggetto" value={t.oggetto} onChange={(e) => cambia('oggetto', e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="email-testo">Testo <span className="piccolo">(una riga vuota = nuovo paragrafo)</span></label>
            <textarea id="email-testo" rows={9} value={t.testo} onChange={(e) => cambia('testo', e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="email-pulsante">Scritta del pulsante <span className="piccolo">(porta alla pagina Classifiche del mese)</span></label>
            <input id="email-pulsante" value={t.pulsante} onChange={(e) => cambia('pulsante', e.target.value)} />
          </div>
          <ul className="segnaposto piccolo">
            {SEGNAPOSTO_CLASSIFICHE.map((s) => <li key={s.codice}><code>{s.codice}</code> diventa {s.spiegazione}</li>)}
          </ul>
          <div className="azioni-classifiche">
            <button className="btn btn-primario" disabled={attesa || !cambiato} onClick={salva}><Icona nome="floppy-disk" />{attesa ? 'Salvataggio…' : 'Salva il testo'}</button>
            {cambiato && <button className="btn btn-secondario" disabled={attesa} onClick={() => { setBozza(null); setMessaggio(null) }}>Annulla le modifiche</button>}
            {!iniziale && <button className="btn btn-fantasma" disabled={attesa} onClick={() => { setBozza({ ...TESTO_CLASSIFICHE }); setMessaggio(null) }}><Icona nome="arrow-counter-clockwise" />Testo iniziale</button>}
          </div>
          {messaggio && <p className="messaggio-stato errore" role="alert"><Icona nome="warning-circle" />{messaggio}</p>}
          {cambiato && !messaggio && <p className="piccolo testo-arancio">Modifiche non salvate: l'email parte con il testo salvato.</p>}
        </div>

        <div className="email-anteprima" aria-label="Anteprima dell'email">
          <div className="email-testa">
            <span><span className="piccolo">Da</span> Rapportini Gruppo CEC</span>
            <span><span className="piccolo">Oggetto</span> <strong>{email.oggetto}</strong></span>
          </div>
          {/* il testo è già protetto (scripts/testo-classifiche.mjs trasforma < > & in testo) */}
          <div className="email-corpo" dangerouslySetInnerHTML={{ __html: email.paragrafiHtml }} />
          <span className="email-pulsante" dangerouslySetInnerHTML={{ __html: email.pulsante }} />
        </div>
      </div>
      {toast}
    </section>
  )
}
