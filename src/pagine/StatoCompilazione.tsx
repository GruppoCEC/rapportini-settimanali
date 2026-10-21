// Stato compilazione: chi ha inserito i dati della settimana e chi no.
import { useState } from 'react'
import { nomeDaEmail } from '../lib/account'
import { statoCompilazione, type StatoCompilazione as Stato } from '../lib/aggregazioni'
import { AREE_ATTIVE, PROMEMORIA_ATTIVI, type Contesto, nomeArea, ufficiVisibili } from '../lib/contesto'
import { caricaNote, caricaRilevazioni } from '../lib/dati'
import { isAmministratore } from '../lib/permessi'
import { settimanaPredefinita } from '../lib/settimane'
import { supabase } from '../lib/supabase'
import type { Utente } from '../lib/tipi'
import { useDati } from '../lib/useDati'
import { BadgeStato, Caricamento } from '../componenti/Celle'
import SceltaSettimana from '../componenti/SceltaSettimana'
import { conta as contaAnimato, Icona, useProgresso } from '../componenti/Interfaccia'
import { etichettaSettimana } from '../lib/settimane'

const ORDINE: Record<Stato, number> = { mancante: 0, parziale: 1, completo: 2 }

export default function StatoCompilazione({ ctx }: { ctx: Contesto }) {
  const [settimana, setSettimana] = useState(settimanaPredefinita())
  const [copiato, setCopiato] = useState(false)
  const uffici = ufficiVisibili(ctx)
  const ids = uffici.map((u) => u.id)
  const admin = isAmministratore(ctx.utente)
  const attivita = ctx.metriche.filter((m) => m.tipo === 'attivita')

  const { dati, errore, caricamento } = useDati(() => caricaRilevazioni(settimana, settimana, ids), [settimana, ids.join(',')])
  // Le email per i promemoria sono visibili solo agli amministratori
  const colleghi = useDati(async () => {
    if (!admin) return [] as Utente[]
    const { data, error } = await supabase.from('utenti').select('*').eq('attivo', true).not('ufficio_id', 'is', null)
    if (error) throw new Error(error.message)
    return data as Utente[]
  }, [admin, ctx.cittaId])
  // Richieste di aiuto della settimana (casella "Mi serve aiuto su…" della nota): solo per gli amministratori
  const note = useDati(() => (admin ? caricaNote([settimana], ids) : Promise.resolve([])), [admin, settimana, ids.join(',')])

  const t = useProgresso(`${settimana}-${caricamento}`)
  const nomeCitta = ctx.citta.find((c) => c.id === ctx.cittaId)?.nome ?? ''
  const intestazione = (
    <div className="intestazione">
      <div className="intestazione-titoli">
        <span className="kicker">Stato compilazione · {nomeCitta}</span>
        <h1 className="titolo-pagina">{etichettaSettimana(settimana)}</h1>
      </div>
      <SceltaSettimana settimana={settimana} onCambia={setSettimana} />
    </div>
  )

  if (caricamento || errore || !dati) return <div className="pagina pagina-ampia">{intestazione}<Caricamento errore={errore} /></div>

  const righe = uffici.map((u) => {
    const proprie = dati.filter((r) => r.ufficio_id === u.id)
    const ultima = proprie.filter((r) => r.aggiornato_il).sort((x, y) => y.aggiornato_il!.localeCompare(x.aggiornato_il!))[0]
    return {
      ufficio: u,
      stato: statoCompilazione(proprie, ctx.metriche),
      compilate: attivita.filter((m) => proprie.some((r) => r.metrica === m.codice && r.risultato !== null)).length,
      ultima,
      email: (colleghi.dati ?? []).filter((c) => c.ufficio_id === u.id).flatMap((c) => (c.email_promemoria ?? '').split(',').map((e) => e.trim()).filter(Boolean)),
    }
  }).sort((x, y) => ORDINE[x.stato] - ORDINE[y.stato] || x.ufficio.nome.localeCompare(y.ufficio.nome))

  const conta = (s: Stato) => righe.filter((r) => r.stato === s).length
  const emailMancanti = righe.filter((r) => r.stato === 'mancante').flatMap((r) => r.email)

  async function copiaEmail() {
    await navigator.clipboard.writeText(emailMancanti.join(', '))
    setCopiato(true)
    setTimeout(() => setCopiato(false), 2500)
  }

  const richiesteAiuto = (note.dati ?? []).filter((x) => x.aiuto.trim() !== '')
    .map((x) => ({ ufficio: uffici.find((u) => u.id === x.ufficio_id), testo: x.aiuto.trim() }))
    .sort((x, y) => (x.ufficio?.nome ?? '').localeCompare(y.ufficio?.nome ?? ''))

  const n = righe.length || 1
  const RIQUADRI = [
    { stato: 'completo' as Stato, nome: 'Completi', classe: 'verde', sotto: 'tutte le attività inserite', colore: 'var(--ok)' },
    { stato: 'parziale' as Stato, nome: 'Parziali', classe: 'giallo', sotto: 'mancano alcune attività', colore: 'var(--quasi)' },
    { stato: 'mancante' as Stato, nome: 'Mancanti', classe: 'rosso', sotto: 'nessun dato inserito', colore: 'var(--ko)' },
  ]

  return (
    <div className="pagina pagina-ampia entra">
      {intestazione}

      <div className="pagina" style={{ gap: 22 }}>
        <div className="stato-griglia">
          {RIQUADRI.map((q) => (
            <div key={q.stato} className={`stato-box ${q.classe}`}>
              <span className="etichetta-maiuscola">{q.nome}</span>
              <strong>{contaAnimato(conta(q.stato), t)}</strong>
              <span className="piccolo">{q.sotto}</span>
            </div>
          ))}
        </div>
        <div className="barra-segmentata" aria-hidden="true">
          {RIQUADRI.map((q) => <div key={q.stato} style={{ width: `${conta(q.stato) / n * 100 * t}%`, background: q.colore }} />)}
        </div>
      </div>

      {richiesteAiuto.length > 0 && (
        <section className="scheda entra">
          <h2 className="titolo-icona"><span className="icona-quadrata icona-arancio"><Icona nome="hand-waving" /></span>
            Richieste di aiuto ({richiesteAiuto.length})</h2>
          <p className="piccolo">Quello che gli uffici hanno scritto in "Mi serve aiuto su…" nella nota di questa settimana.</p>
          <ul className="richieste-aiuto">
            {richiesteAiuto.map((r, i) => (
              <li key={i}><strong>{r.ufficio?.nome ?? 'Ufficio'}</strong><p>{r.testo}</p></li>
            ))}
          </ul>
        </section>
      )}

      <section className="scheda">
        <div className="scheda-titolo">
          <h2>Uffici ({uffici.length})</h2>
          {admin && emailMancanti.length > 0 && (
            <button className="btn btn-secondario" onClick={copiaEmail}>
              <Icona nome={copiato ? 'check' : 'copy'} />{copiato ? 'Copiate' : `Copia email dei mancanti (${emailMancanti.length})`}
            </button>
          )}
        </div>
        <div className="tabella-scorrevole">
          <table className="tabella" style={{ minWidth: 760 }}>
            <thead><tr><th>Ufficio</th>{AREE_ATTIVE && <th>Area</th>}<th>Stato</th><th className="destra">Attività</th><th>Ultimo salvataggio</th>{admin && <th>Email promemoria</th>}</tr></thead>
            <tbody>
              {righe.map((r, i) => (
                <tr key={r.ufficio.id} className="riga-fade" style={{ animationDelay: `${i * 25}ms` }}>
                  <th scope="row">{r.ufficio.nome}</th>
                  {AREE_ATTIVE && <td>{nomeArea(ctx, r.ufficio.area_id)}</td>}
                  <td><BadgeStato stato={r.stato} /></td>
                  <td className="destra">{r.compilate} / {attivita.length}</td>
                  <td className="piccolo">{r.ultima
                    ? `${new Date(r.ultima.aggiornato_il!).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}${r.ultima.aggiornato_da ? ` · ${nomeDaEmail(r.ultima.aggiornato_da)}` : ''}`
                    : '—'}</td>
                  {admin && <td className="piccolo">{r.email.join(', ') || <span className="email-mancante">nessuna: non riceve promemoria</span>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="piccolo">"Completo" = tutte le {attivita.length} attività hanno un risultato (anche 0).{PROMEMORIA_ATTIVI ? ' I promemoria automatici del sabato (ore 10) e del lunedì (ore 9:30) vanno agli uffici "Mancanti".' : ''}</p>
      </section>
    </div>
  )
}
