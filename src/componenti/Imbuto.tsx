// Imbuto della vendita: le fasi come barre centrate, con il passaggio tra una fase e l'altra
// (src/lib/imbuto.ts). Con un riferimento (la città o il totale dei propri uffici) il passaggio
// è verde se è almeno come il riferimento, arancio se è sotto.
import { confrontaPassaggio, MINIMO_CASI, type Imbuto } from '../lib/imbuto'
import { Icona } from './Interfaccia'

export function GraficoImbuto({ imbuto, titolo, riferimento, nomeRiferimento, t = 1 }: {
  imbuto: Imbuto
  titolo?: string
  riferimento?: Imbuto | null          // es. tutta la città
  nomeRiferimento?: string             // es. "Roma"
  t?: number                           // avanzamento dell'animazione (0–1)
}) {
  const max = Math.max(1, ...imbuto.fasi.map((f) => f.valore ?? 0))
  return (
    <div className="imbuto">
      {titolo && <h3>{titolo}</h3>}
      {imbuto.fasi.map((f, i) => {
        const p = imbuto.passaggi[i]
        const confronto = riferimento ? confrontaPassaggio(p ?? null, riferimento.passaggi[i] ?? null) : null
        const rif = riferimento?.passaggi[i]
        return (
          <div key={f.codice} className="imbuto-blocco">
            <div className="imbuto-fase">
              <span className="imbuto-nome">{f.nome}</span>
              <div className="imbuto-pista">
                <div className="imbuto-barra" style={{ width: `${f.valore === null ? 0 : Math.max(3, f.valore / max * 100) * t}%` }} />
              </div>
              <strong className="imbuto-valore">{f.valore === null ? '—' : Math.round(f.valore * t).toLocaleString('it-IT')}</strong>
            </div>
            {i < imbuto.fasi.length - 1 && (
              p ? (
                <div className={`imbuto-passaggio ${confronto ?? ''}`}>
                  <Icona nome="arrow-down" />
                  <strong>{p.numero}</strong>
                  <span>{p.testo}</span>
                  {rif && rif.rapporto !== null && <span className="imbuto-rif">· {nomeRiferimento}: {rif.valore}</span>}
                </div>
              ) : <div className="imbuto-passaggio vuoto" aria-hidden="true" />
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Tabella dei passaggi ufficio per ufficio, colorati rispetto al riferimento (la città o il gruppo di uffici) */
export function TabellaImbuto({ righe, riferimento, nomeRiferimento, compatta }: {
  righe: { nome: string; imbuto: Imbuto }[]
  riferimento: Imbuto
  nomeRiferimento: string
  compatta?: boolean
}) {
  const colonne = riferimento.passaggi.map((p, i) => ({ p, i })).filter((x) => x.p !== null)
  const fasi = riferimento.fasi
  const ultima = fasi.length - 1
  return (
    <table className={`tabella tabella-imbuto ${compatta ? 'compatta' : ''}`}>
      <thead>
        <tr>
          <th>Ufficio</th>
          {colonne.map(({ i }) => <th key={i} className="destra">{fasi[i].nome} → {fasi[i + 1].nome}</th>)}
          <th className="destra">{fasi[ultima].nome}</th>
        </tr>
      </thead>
      <tbody>
        <tr className="riga-riferimento">
          <th scope="row">{nomeRiferimento}</th>
          {colonne.map(({ p, i }) => <td key={i} className="destra">{p!.valore}</td>)}
          <td className="destra">{fasi[ultima].valore?.toLocaleString('it-IT') ?? '—'}</td>
        </tr>
        {righe.map((r) => (
          <tr key={r.nome}>
            <th scope="row">{r.nome}</th>
            {colonne.map(({ i }) => {
              const p = r.imbuto.passaggi[i]
              const c = confrontaPassaggio(p, riferimento.passaggi[i])
              return <td key={i} className={`destra ${c === 'sopra' ? 't-verde' : c === 'sotto' ? 'imbuto-sotto' : 'imbuto-nessuno'}`}>{p?.valore ?? '—'}</td>
            })}
            <td className="destra">{r.imbuto.fasi[ultima].valore?.toLocaleString('it-IT') ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Spiegazione da mettere sotto l'imbuto */
export function NotaImbuto({ periodo }: { periodo: string }) {
  return (
    <p className="piccolo">
      {periodo}. Le fasi sono contate nello stesso periodo: un'accettazione di oggi può diventare vendita più avanti,
      per questo si guardano più settimane o mesi insieme. Un passaggio si calcola solo con almeno {MINIMO_CASI} casi nella fase di partenza.
    </p>
  )
}
