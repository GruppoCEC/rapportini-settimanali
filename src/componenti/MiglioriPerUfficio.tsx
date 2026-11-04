// Classifiche → Miglior collaboratore di ogni ufficio (solo amministratore generale, richiesta di Davide del
// 04/11/2026). Per ogni ufficio si sceglie il miglior collaboratore del mese tra i suoi collaboratori in
// servizio; accanto a ciascuno c'è il punteggio della gara del mese, e "Proponi dal punteggio" riempie gli
// uffici ancora vuoti con chi ha il punteggio più alto. Dopo la pubblicazione ogni ufficio vede il suo.
import { useState } from 'react'
import { caricaPersone, caricaPunti, caricaValoriMensili, caricaValoriRiservati } from '../lib/dati'
import { formattaPunti, inServizio, ordinaUfficiReport, punteggio, RUOLO_GARA, titoloMese } from '../lib/mensile'
import { supabase } from '../lib/supabase'
import type { Citta, MigliorCollaboratore, Persona, Ufficio } from '../lib/tipi'
import { useDati } from '../lib/useDati'
import { Icona, useToast } from './Interfaccia'

interface Candidato { persona: Persona; punti: number | null }

export function MiglioriPerUfficio({ mese, uffici, citta, scelti, onSalvato }: {
  mese: string; uffici: Ufficio[]; citta: Citta[]; scelti: MigliorCollaboratore[]; onSalvato: () => void
}) {
  const attivi = uffici.filter((u) => u.attivo)
  const ids = attivi.map((u) => u.id)
  const { dati, errore } = useDati(async () => {
    const [persone, valori, riservati, punti] = await Promise.all([
      caricaPersone(ids), caricaValoriMensili(mese, ids), caricaValoriRiservati([mese], ids), caricaPunti()])
    return { persone, valori: [...valori, ...riservati], punti }
  }, [mese, ids.join(',')])
  const [attesa, setAttesa] = useState<number | 'tutti' | null>(null)
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [toast, mostraToast] = useToast()

  if (!dati) return <section className="scheda"><p className={errore ? 'errore' : 'piccolo'}>{errore ? `Personale non caricato: ${errore}` : 'Caricamento del personale…'}</p></section>

  const scelta = new Map(scelti.filter((s) => s.mese === mese).map((s) => [s.ufficio_id, s.persona_id]))
  /** I collaboratori in servizio nel mese, dal punteggio più alto (come la gara: chi lascia l'ufficio nel mese non c'è) */
  const candidati = (u: Ufficio): Candidato[] => dati.persone
    .filter((p) => p.ufficio_id === u.id && ((p.ruolo === RUOLO_GARA && inServizio(p, mese)) || p.id === scelta.get(u.id)))
    .map((p) => ({ persona: p, punti: punteggio(dati.valori.filter((v) => v.persona_id === p.id), dati.punti) }))
    .sort((a, b) => (b.punti ?? -1) - (a.punti ?? -1) || a.persona.nome.localeCompare(b.persona.nome))
  /** La proposta: il punteggio più alto del mese, se c'è (a pari punti nessuna proposta: decide l'amministratore) */
  const proposta = (u: Ufficio): Candidato | null => {
    const [primo, secondo] = candidati(u).filter((c) => c.punti !== null && c.punti > 0)
    return primo && (!secondo || secondo.punti! < primo.punti!) ? primo : null
  }
  const daProporre = attivi.filter((u) => !scelta.has(u.id) && proposta(u))

  async function scegli(u: Ufficio, personaId: number | null) {
    setAttesa(u.id); setMessaggio(null)
    const { error } = personaId === null
      ? await supabase.from('classifiche_migliori').delete().eq('mese', mese).eq('ufficio_id', u.id)
      : await supabase.from('classifiche_migliori').upsert({ mese, ufficio_id: u.id, persona_id: personaId }, { onConflict: 'mese,ufficio_id' })
    setAttesa(null)
    if (error) return setMessaggio(`${u.nome}: non salvato (${error.message})`)
    onSalvato()
  }

  async function proponiTutti() {
    setAttesa('tutti'); setMessaggio(null)
    const righe = daProporre.map((u) => ({ mese, ufficio_id: u.id, persona_id: proposta(u)!.persona.id }))
    const { error } = await supabase.from('classifiche_migliori').upsert(righe, { onConflict: 'mese,ufficio_id' })
    setAttesa(null)
    if (error) return setMessaggio(`Proposta non salvata: ${error.message}`)
    mostraToast(`Scelto dal punteggio in ${righe.length} ${righe.length === 1 ? 'ufficio' : 'uffici'}.`)
    onSalvato()
  }

  const perCitta = citta.map((c) => ({ citta: c, uffici: ordinaUfficiReport(attivi.filter((u) => u.citta_id === c.id)) })).filter((x) => x.uffici.length > 0)

  return (
    <section className="scheda migliori-uffici entra entra-2">
      <div className="scheda-titolo">
        <div className="titolo-classifiche">
          <h2>Miglior collaboratore di ogni ufficio</h2>
          <p className="piccolo">{titoloMese(mese)}: scelto in <strong>{scelta.size} uffici su {attivi.length}</strong>. Dopo la pubblicazione ogni ufficio vede il suo
            nella scheda <em>Miglior collaboratore</em>. Accanto ai nomi il punteggio della gara del mese; ogni scelta si salva da sola.</p>
        </div>
        {dati.punti.size > 0 && (
          <button className="btn btn-secondario" disabled={attesa !== null || daProporre.length === 0} onClick={proponiTutti}
            title="Negli uffici senza scelta mette il collaboratore con il punteggio più alto del mese">
            <Icona nome="magic-wand" />Proponi dal punteggio{daProporre.length ? ` (${daProporre.length})` : ''}
          </button>
        )}
      </div>
      {messaggio && <p className="messaggio-stato errore" role="alert"><Icona nome="warning-circle" />{messaggio}</p>}
      {perCitta.map(({ citta: c, uffici: lista }) => (
        <div key={c.id} className="migliori-citta">
          {perCitta.length > 1 && <h3>{c.nome}</h3>}
          <div className="migliori-griglia">
            {lista.map((u) => {
              const elenco = candidati(u)
              const p = proposta(u)
              const scelto = scelta.get(u.id)
              return (
                <label key={u.id} className={`migliore-riga ${scelto ? 'scelto' : ''}`}>
                  <span className="migliore-ufficio">{u.nome}</span>
                  <select value={scelto ?? ''} disabled={attesa !== null || elenco.length === 0} onChange={(e) => scegli(u, e.target.value ? Number(e.target.value) : null)}>
                    <option value="">{elenco.length === 0 ? 'nessun collaboratore nel mese' : '— da scegliere —'}</option>
                    {elenco.map((x) => <option key={x.persona.id} value={x.persona.id}>{x.persona.nome}{x.punti !== null ? ` · ${formattaPunti(x.punti)} pt` : ''}</option>)}
                  </select>
                  {attesa === u.id && <Icona nome="circle-notch" className="gira" />}
                  {!scelto && p && <span className="piccolo migliore-proposta">punteggio più alto: {p.persona.nome}</span>}
                </label>
              )
            })}
          </div>
        </div>
      ))}
      {toast}
    </section>
  )
}
