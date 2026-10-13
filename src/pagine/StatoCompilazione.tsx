// Stato compilazione: chi ha inserito i dati della settimana e chi no.
import { useState } from 'react'
import { nomeDaEmail } from '../lib/account'
import { statoCompilazione, type StatoCompilazione as Stato } from '../lib/aggregazioni'
import { AREE_ATTIVE, type Contesto, nomeArea, ufficiVisibili } from '../lib/contesto'
import { caricaRilevazioni } from '../lib/dati'
import { isAmministratore } from '../lib/permessi'
import { settimanaPredefinita } from '../lib/settimane'
import { supabase } from '../lib/supabase'
import type { Utente } from '../lib/tipi'
import { useDati } from '../lib/useDati'
import { BadgeStato, Caricamento } from '../componenti/Celle'
import SceltaSettimana from '../componenti/SceltaSettimana'

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

  if (caricamento || errore || !dati) return <div className="pagina"><Caricamento errore={errore} /></div>

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

  return (
    <div className="pagina pagina-media">
      <div className="scheda">
        <SceltaSettimana settimana={settimana} onCambia={setSettimana} />
      </div>

      <div className="riquadri">
        <div className="riquadro"><span className="riquadro-titolo">Completi</span><strong className="riquadro-valore semaforo-verde">{conta('completo')}</strong><span className="piccolo">tutte le attività inserite</span></div>
        <div className="riquadro"><span className="riquadro-titolo">Parziali</span><strong className="riquadro-valore semaforo-giallo">{conta('parziale')}</strong><span className="piccolo">mancano alcune attività</span></div>
        <div className="riquadro"><span className="riquadro-titolo">Mancanti</span><strong className="riquadro-valore semaforo-rosso">{conta('mancante')}</strong><span className="piccolo">nessun dato inserito</span></div>
      </div>

      <div className="scheda">
        <div className="titolo-con-azioni">
          <h2>Uffici ({uffici.length})</h2>
          {admin && emailMancanti.length > 0 && (
            <button className="secondario" onClick={copiaEmail}>{copiato ? '✓ Copiate' : `Copia email dei mancanti (${emailMancanti.length})`}</button>
          )}
        </div>
        <div className="tabella-scorrevole">
          <table className="tabella-riepilogo tabella-stato">
            <thead><tr><th>Ufficio</th>{AREE_ATTIVE && <th>Area</th>}<th>Stato</th><th>Attività</th><th>Ultimo salvataggio</th>{admin && <th>Email promemoria</th>}</tr></thead>
            <tbody>
              {righe.map((r) => (
                <tr key={r.ufficio.id}>
                  <th scope="row">{r.ufficio.nome}</th>
                  {AREE_ATTIVE && <td>{nomeArea(ctx, r.ufficio.area_id)}</td>}
                  <td><BadgeStato stato={r.stato} /></td>
                  <td className="numero">{r.compilate} / {attivita.length}</td>
                  <td className="piccolo">{r.ultima
                    ? `${new Date(r.ultima.aggiornato_il!).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}${r.ultima.aggiornato_da ? ` · ${nomeDaEmail(r.ultima.aggiornato_da)}` : ''}`
                    : '—'}</td>
                  {admin && <td className="piccolo">{r.email.join(', ') || <em className="semaforo-rosso">nessuna: non riceve promemoria</em>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="piccolo">"Completo" = tutte le {attivita.length} attività hanno un risultato (anche 0). I promemoria automatici del venerdì e della domenica vanno agli uffici "Mancanti".</p>
      </div>
    </div>
  )
}
