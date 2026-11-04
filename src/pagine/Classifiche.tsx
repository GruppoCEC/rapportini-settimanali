// Classifiche del mese in PDF (richiesta di Davide del 04/11/2026, 021_classifiche.sql).
// Dopo la riunione di fine mese l'amministratore generale carica un PDF per ogni classifica (uffici,
// collaboratori, miglior collaboratore, miglior coordinatrice, miglior coordinatore) e le pubblica:
// da quel momento tutti gli account del sito le aprono e le stampano da qui. Pubblicando può far
// partire un'email di avviso con il collegamento diretto a questa pagina (scripts/promemoria.mjs).
// Prima della pubblicazione le vede solo lui, per controllarle.
import { useRef, useState } from 'react'
import type { Contesto } from '../lib/contesto'
import { caricaClassifiche, CONTENITORE_CLASSIFICHE, indirizzoClassifica, scaricaClassifica } from '../lib/dati'
import { aggiungiMesi, meseInCorso, mesePredefinito, titoloMese } from '../lib/mensile'
import { supabase } from '../lib/supabase'
import { CATEGORIE_CLASSIFICHE, type CategoriaClassifica, type ClassificaFile } from '../lib/tipi'
import { useDati } from '../lib/useDati'
import { AnteprimaPdf } from '../componenti/AnteprimaPdf'
import { Caricamento } from '../componenti/Celle'
import { EmailClassifiche } from '../componenti/EmailClassifiche'
import { Icona, useConferma, useToast } from '../componenti/Interfaccia'

/** PDF più grandi di così il database li rifiuta (021: file_size_limit) */
const MASSIMO_MB = 20
/** Mesi tra cui l'amministratore generale sceglie dove caricare */
const MESI_SCELTA = 12

const quando = (iso: string) => new Date(iso).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
const dimensione = (byte: number | null) => (byte == null ? '' : byte < 1024 * 1024 ? `${Math.max(1, Math.round(byte / 1024))} KB` : `${(byte / 1024 / 1024).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`)

export default function Classifiche({ ctx, meseLink }: { ctx: Contesto; meseLink: string | null }) {
  const generale = ctx.utente.ruolo === 'admin_generale'
  const { dati, errore, ricarica } = useDati(caricaClassifiche, [])
  const [scelto, setScelto] = useState<string | null>(meseLink)
  const [attesa, setAttesa] = useState<string | null>(null)      // categoria (o 'pubblica') in lavorazione
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [dialogo, chiedi] = useConferma()
  const [toast, mostraToast] = useToast()

  if (!dati) return <Caricamento errore={errore} />

  const pubblicati = dati.mesi.filter((m) => m.pubblicato_il).map((m) => m.mese)
  // l'amministratore generale sceglie tra gli ultimi mesi (e quelli già preparati); gli altri vedono i mesi pubblicati
  const mesi = generale
    ? [...new Set([...Array.from({ length: MESI_SCELTA }, (_, i) => aggiungiMesi(meseInCorso(), -i)), ...dati.mesi.map((m) => m.mese), ...dati.file.map((f) => f.mese)])].sort().reverse()
    : pubblicati
  // l'amministratore generale parte dal mese appena concluso (quello della riunione), gli altri dall'ultimo pubblicato
  const predefinito = generale ? mesePredefinito() : pubblicati[0]
  const mese = scelto && mesi.includes(scelto) ? scelto : predefinito

  if (!mese) {
    return (
      <section className="scheda entra">
        <span className="kicker">Classifiche del mese</span>
        <h1 className="titolo-pagina">Classifiche</h1>
        <p>Non ci sono ancora classifiche pubblicate. Quando l'amministrazione le pubblica dopo la riunione di fine mese, le trovate qui e vi arriva un'email.</p>
      </section>
    )
  }

  const stato = dati.mesi.find((m) => m.mese === mese) ?? null
  const fileDi = (c: CategoriaClassifica) => dati.file.find((f) => f.mese === mese && f.categoria === c)
  const caricati = CATEGORIE_CLASSIFICHE.filter((c) => fileDi(c.codice))
  const categorie = generale ? CATEGORIE_CLASSIFICHE : caricati

  async function carica(categoria: CategoriaClassifica, file: File) {
    setMessaggio(null)
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return setMessaggio('Si possono caricare solo file PDF.')
    if (file.size > MASSIMO_MB * 1024 * 1024) return setMessaggio(`Il file è troppo grande (${dimensione(file.size)}): al massimo ${MASSIMO_MB} MB.`)
    setAttesa(categoria)
    try {
      // un nome nuovo a ogni caricamento: chi aveva già aperto il PDF vecchio non lo ritrova per sbaglio
      const percorso = `${mese.slice(0, 7)}/${categoria}-${Date.now()}.pdf`
      const su = await supabase.storage.from(CONTENITORE_CLASSIFICHE).upload(percorso, file, { contentType: 'application/pdf', upsert: false })
      if (su.error) throw new Error(su.error.message)
      const vecchio = fileDi(categoria)
      const { error } = await supabase.from('classifiche_file')
        .upsert({ mese, categoria, percorso, nome_file: file.name, dimensione: file.size }, { onConflict: 'mese,categoria' })
      if (error) { await supabase.storage.from(CONTENITORE_CLASSIFICHE).remove([percorso]); throw new Error(error.message) }
      if (vecchio && vecchio.percorso !== percorso) await supabase.storage.from(CONTENITORE_CLASSIFICHE).remove([vecchio.percorso])
      mostraToast(`${nomeCategoria(categoria)}: PDF caricato.`)
      ricarica()
    } catch (e) {
      setMessaggio(`Caricamento non riuscito: ${(e as Error).message}`)
    } finally {
      setAttesa(null)
    }
  }

  async function togli(f: ClassificaFile) {
    if (!(await chiedi({ titolo: `Togliere ${nomeCategoria(f.categoria).toLowerCase()}?`, testo: `Il PDF "${f.nome_file}" di ${titoloMese(mese).toLowerCase()} viene cancellato.`, conferma: 'Togli il PDF', pericolo: true }))) return
    setAttesa(f.categoria)
    const { error } = await supabase.from('classifiche_file').delete().eq('mese', f.mese).eq('categoria', f.categoria)
    if (!error) await supabase.storage.from(CONTENITORE_CLASSIFICHE).remove([f.percorso])
    setAttesa(null)
    if (error) return setMessaggio(`Non è stato possibile togliere il PDF: ${error.message}`)
    ricarica()
  }

  async function pubblica(avvisa: boolean) {
    const nomi = caricati.map((c) => c.nome.toLowerCase()).join(', ')
    const ok = await chiedi(avvisa
      ? { titolo: `Pubblicare le classifiche di ${titoloMese(mese).toLowerCase()}?`, testo: `Tutti gli account del sito vedranno ${nomi}. A tutti quelli con un'email per i promemoria arriva un avviso con il collegamento diretto, entro pochi minuti.`, conferma: 'Pubblica e manda l\'avviso' }
      : { titolo: `Pubblicare senza avviso?`, testo: `Tutti gli account del sito vedranno ${nomi}, ma non arriva nessuna email.`, conferma: 'Pubblica' })
    if (!ok) return
    setAttesa('pubblica')
    const { error } = await supabase.rpc('pubblica_classifiche', { p_mese: mese, p_avvisa: avvisa })
    setAttesa(null)
    if (error) return setMessaggio(`Pubblicazione non riuscita: ${error.message}`)
    mostraToast(avvisa ? 'Classifiche pubblicate: l\'avviso parte tra pochi minuti.' : 'Classifiche pubblicate.')
    ricarica()
  }

  async function ritira() {
    if (!(await chiedi({ titolo: 'Togliere dalla pubblicazione?', testo: 'Gli uffici non vedranno più queste classifiche finché non le pubblichi di nuovo. I PDF restano caricati.', conferma: 'Togli dalla pubblicazione', pericolo: true }))) return
    setAttesa('pubblica')
    const { error } = await supabase.from('classifiche_mesi').update({ pubblicato_il: null }).eq('mese', mese)
    setAttesa(null)
    if (error) return setMessaggio(`Non è stato possibile: ${error.message}`)
    ricarica()
  }

  return (
    <>
      <section className="scheda entra">
        <div className="scheda-titolo">
          <div className="titolo-classifiche">
            <span className="kicker">Classifiche del mese</span>
            <h1 className="titolo-pagina">Classifiche di {titoloMese(mese).toLowerCase()}</h1>
          </div>
          {mesi.length > 1 && (
            <select value={mese} onChange={(e) => { setScelto(e.target.value); setMessaggio(null) }} aria-label="Mese">
              {mesi.map((m) => <option key={m} value={m}>{titoloMese(m)}{generale && pubblicati.includes(m) ? ' · pubblicate' : ''}</option>)}
            </select>
          )}
        </div>

        {generale && (
          <div className={`stato-classifiche ${stato?.pubblicato_il ? 'pubblicate' : ''}`}>
            {stato?.pubblicato_il ? (
              <>
                <p><Icona nome="check-circle" /><span><strong>Pubblicate</strong> {quando(stato.pubblicato_il)}: le vedono tutti gli account del sito.
                  {' '}{stato.avviso_inviato_il ? <>Email di avviso inviata {quando(stato.avviso_inviato_il)}.</>
                    : stato.avviso_richiesto_il ? <>Email di avviso <strong>in partenza</strong> (arriva entro pochi minuti).</>
                      : <>Nessuna email di avviso.</>}</span></p>
                <div className="azioni-classifiche">
                  {!stato.avviso_richiesto_il && <button className="btn btn-primario" disabled={attesa !== null} onClick={() => pubblica(true)}><Icona nome="envelope-simple" />Manda l'avviso</button>}
                  <button className="btn btn-secondario btn-pericolo" disabled={attesa !== null} onClick={ritira}><Icona nome="eye-slash" />Togli dalla pubblicazione</button>
                </div>
              </>
            ) : (
              <>
                <p><Icona nome="eye-slash" /><span><strong>Non ancora pubblicate</strong>: le vedi solo tu. Carica i PDF, aprili per controllarli, poi pubblica.</span></p>
                <div className="azioni-classifiche">
                  <button className="btn btn-primario" disabled={attesa !== null || caricati.length === 0} onClick={() => pubblica(true)}><Icona nome="paper-plane-tilt" />Pubblica e manda l'avviso</button>
                  <button className="btn btn-secondario" disabled={attesa !== null || caricati.length === 0} onClick={() => pubblica(false)}>Pubblica senza avviso</button>
                </div>
              </>
            )}
          </div>
        )}
        {messaggio && <p className="messaggio-stato errore" role="alert"><Icona nome="warning-circle" />{messaggio}</p>}
      </section>

      <div className="griglia-classifiche entra entra-1">
        {categorie.map((c) => (
          <SchedaClassifica key={c.codice} nome={c.nome} icona={c.icona} file={fileDi(c.codice)} generale={generale} occupato={attesa === c.codice} bloccato={attesa !== null}
            onCarica={(f) => carica(c.codice, f)} onTogli={togli} onErrore={setMessaggio} />
        ))}
      </div>
      {generale && <EmailClassifiche mese={mese} categorie={caricati.map((c) => c.codice)} />}
      {!generale && caricati.length > 0 && (
        <p className="piccolo non-stampa">Con <strong>Stampa</strong> si apre la finestra di stampa del PDF; con <strong>Apri</strong> il PDF si apre in una nuova scheda, da dove si può anche scaricare.</p>
      )}
      {dialogo}
      {toast}
    </>
  )
}

const nomeCategoria = (c: CategoriaClassifica) => CATEGORIE_CLASSIFICHE.find((x) => x.codice === c)!.nome

function SchedaClassifica({ nome, icona, file, generale, occupato, bloccato, onCarica, onTogli, onErrore }: {
  nome: string; icona: string; file: ClassificaFile | undefined; generale: boolean; occupato: boolean; bloccato: boolean
  onCarica: (f: File) => void; onTogli: (f: ClassificaFile) => void; onErrore: (testo: string) => void
}) {
  const scelta = useRef<HTMLInputElement>(null)
  const [stampa, setStampa] = useState(false)

  async function apri(f: ClassificaFile) {
    // la scheda si apre subito (al clic), altrimenti il browser la blocca come "finestra a comparsa"
    const finestra = window.open('', '_blank')
    try {
      const url = await indirizzoClassifica(f.percorso)
      if (finestra) finestra.location.href = url; else window.location.href = url
    } catch (e) {
      finestra?.close()
      onErrore(`Non è stato possibile aprire il PDF: ${(e as Error).message}`)
    }
  }

  async function stampaPdf(f: ClassificaFile) {
    setStampa(true)
    try {
      const url = URL.createObjectURL(await scaricaClassifica(f.percorso))
      // il PDF si carica in una cornice invisibile e si apre la finestra di stampa del browser
      const cornice = document.createElement('iframe')
      cornice.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0'
      cornice.src = url
      cornice.onload = () => {
        setTimeout(() => {
          try { cornice.contentWindow?.focus(); cornice.contentWindow?.print() } catch { window.open(url, '_blank') }
          setStampa(false)
        }, 300)
        setTimeout(() => { cornice.remove(); URL.revokeObjectURL(url) }, 60_000)
      }
      document.body.appendChild(cornice)
    } catch (e) {
      setStampa(false)
      onErrore(`Non è stato possibile stampare il PDF: ${(e as Error).message}`)
    }
  }

  return (
    <article className={`scheda scheda-classifica ${file ? '' : 'vuota'}`}>
      {file && <AnteprimaPdf chiave={file.percorso} titolo={nome} carica={() => scaricaClassifica(file.percorso)} onClick={() => apri(file)} />}
      <div className="classifica-testa">
        <span className="classifica-icona"><Icona nome={icona} /></span>
        <h2>{nome}</h2>
      </div>
      {file ? (
        <p className="piccolo classifica-file"><Icona nome="file-pdf" />{file.nome_file}{file.dimensione ? ` · ${dimensione(file.dimensione)}` : ''}{generale && ` · caricato ${quando(file.caricato_il)}`}</p>
      ) : (
        <p className="piccolo">Nessun PDF caricato.</p>
      )}
      {file && (
        <div className="classifica-azioni">
          <button className="btn btn-primario" disabled={stampa} onClick={() => stampaPdf(file)}><Icona nome="printer" />{stampa ? 'Preparo…' : 'Stampa'}</button>
          <button className="btn btn-secondario" onClick={() => apri(file)}><Icona nome="arrow-square-out" />Apri</button>
        </div>
      )}
      {generale && (
        <div className={`classifica-gestione ${file ? '' : 'sola'}`}>
          <input ref={scelta} type="file" accept="application/pdf,.pdf" hidden
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onCarica(f) }} />
          <button className={`btn ${file ? 'btn-fantasma' : 'btn-secondario'}`} disabled={bloccato} onClick={() => scelta.current?.click()}>
            <Icona nome={occupato ? 'circle-notch' : 'upload-simple'} className={occupato ? 'gira' : ''} />{occupato ? 'Caricamento…' : file ? 'Sostituisci' : 'Carica il PDF'}
          </button>
          {file && <button className="btn btn-fantasma btn-pericolo" disabled={bloccato} onClick={() => onTogli(file)}><Icona nome="trash" />Togli</button>}
        </div>
      )}
    </article>
  )
}
