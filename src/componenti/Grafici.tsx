// Grafici di andamento disegnati in SVG: linea blu del risultato con area sotto,
// obiettivo arancio tratteggiato, linea di riferimento per la quota (20%).
// Tre formati: normale (con assi e valori al passaggio del mouse), compatto (riunione,
// con il valore scritto su ogni punto) e "spark" (minimo, senza scritte).
import { useId, useState } from 'react'

interface Props {
  etichette: string[]
  risultati: (number | null)[]
  obiettivi?: (number | null)[]
  nomeSerie?: string
  percentuale?: boolean           // valori 0–1 mostrati come %
  rigaRiferimento?: number        // es. obiettivo quota 20%
  compatto?: boolean
  spark?: boolean
  t?: number                      // avanzamento dell'animazione (0–1)
  nomeLinea?: string              // nome della linea tratteggiata nel suggerimento (predefinito "Obiettivo")
  prefisso?: string               // prima dell'etichetta nel suggerimento (predefinito "Settimana del")
}

function massimoTondo(m: number): number {
  if (m <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(m)))
  const f = m / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p
}

const pct1 = (v: number) => `${(v * 100).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

export function GraficoAndamento({ etichette, risultati, obiettivi, nomeSerie = 'Risultato', percentuale, rigaRiferimento, compatto, spark, t = 1, nomeLinea = 'Obiettivo', prefisso = 'Settimana del' }: Props) {
  const id = useId().replace(/:/g, '')
  const [evidenziato, setEvidenziato] = useState<number | null>(null)
  const piccolo = compatto || spark
  const W = spark ? 170 : compatto ? 260 : 860
  const H = spark ? 46 : compatto ? 150 : 260
  const sx = spark ? 5 : compatto ? 14 : 46, dx = spark ? 5 : 14
  const su = spark ? 6 : compatto ? 24 : 16, giu = spark ? 6 : compatto ? 22 : 30

  const ob = obiettivi && obiettivi.some((v) => v !== null) ? obiettivi : undefined
  const valori = [...risultati, ...(ob ?? [])].filter((v): v is number => v !== null)
  const max = massimoTondo(Math.max(percentuale ? 0.05 : 1, ...valori, rigaRiferimento ? rigaRiferimento * 1.3 : 0) * 1.08)
  const n = etichette.length
  const passo = (W - sx - dx) / Math.max(1, n - 1)
  const x = (i: number) => sx + i * passo
  const y = (v: number) => su + (1 - v / max) * (H - su - giu)
  // con numeri piccoli (es. medie tra 0 e 3) un decimale, altrimenti l'asse ripeterebbe lo stesso numero
  const formato = (v: number) => percentuale ? `${Math.round(v * 100)}%` : v.toLocaleString('it-IT', { maximumFractionDigits: max <= 5 ? 1 : 0 })

  const percorso = (serie: (number | null)[]) => {
    let d = '', penna = false
    serie.forEach((v, i) => {
      if (v === null) { penna = false; return }
      d += `${penna ? ' L' : ' M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`
      penna = true
    })
    return d.trim()
  }
  const dR = percorso(risultati)
  const dO = ob ? percorso(ob) : ''
  const dA = dR && risultati.every((v) => v !== null) ? `${dR} L${x(n - 1).toFixed(1)} ${H - giu} L${x(0).toFixed(1)} ${H - giu} Z` : ''
  const hi = piccolo ? null : evidenziato

  return (
    <div className="grafico">
      <svg viewBox={`0 0 ${W} ${H}`} onMouseLeave={() => setEvidenziato(null)} role="img"
        aria-label={`${nomeSerie}: ${risultati.map((v, i) => `${etichette[i]} ${v === null ? 'nessun dato' : percentuale ? pct1(v) : v}`).join(', ')}`}>
        <defs><clipPath id={id}><rect x={0} y={0} width={Math.max(0.1, W * t)} height={H} /></clipPath></defs>

        {!piccolo && [0, 0.25, 0.5, 0.75, 1].map((k) => (
          <g key={k}>
            <line x1={sx} x2={W - dx} y1={y(max * k)} y2={y(max * k)} stroke={k === 0 ? '#BAB6B6' : 'rgba(32,30,29,.14)'} strokeWidth={1} strokeDasharray={k === 0 ? undefined : '2 5'} />
            <text x={sx - 10} y={y(max * k) + 4} textAnchor="end" fontSize={11} fill="#7D7979">{formato(max * k)}</text>
          </g>
        ))}
        {!piccolo && etichette.map((l, i) => (
          <text key={l + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={i === hi ? 'var(--testo)' : '#7D7979'} fontWeight={i === hi ? 600 : 400}>{l}</text>
        ))}
        {compatto && !spark && etichette.map((l, i) => (
          <text key={l + i} x={x(i)} y={H - 5} textAnchor="middle" fontSize={10} fill="#7D7979">{l}</text>
        ))}

        {rigaRiferimento !== undefined && (
          <>
            <line x1={sx} x2={W - dx} y1={y(rigaRiferimento)} y2={y(rigaRiferimento)} stroke="var(--secondario)" strokeWidth={1.5} strokeDasharray="5 4" />
            {!piccolo && <text x={W - dx} y={y(rigaRiferimento) - 7} textAnchor="end" fontSize={11} fill="var(--secondario-700)">obiettivo {formato(rigaRiferimento)}</text>}
          </>
        )}
        {hi !== null && <line x1={x(hi)} x2={x(hi)} y1={su} y2={H - giu} stroke="#BAB6B6" strokeWidth={1} />}

        <g clipPath={`url(#${id})`}>
          {dA && <path d={dA} fill="var(--primario)" opacity={0.2} />}
          {dO && <path d={dO} fill="none" stroke="var(--secondario-500)" strokeWidth={piccolo ? 1.25 : 1.75} strokeDasharray="4 4" />}
          <path d={dR} fill="none" stroke="var(--primario)" strokeWidth={piccolo ? 2 : 2.5} strokeLinejoin="round" strokeLinecap="round" />
          {!piccolo && risultati.map((v, i) => v !== null && (
            <circle key={i} cx={x(i)} cy={y(v)} r={i === hi ? 5.5 : 3.2} fill={i === hi ? 'var(--primario)' : 'var(--sfondo)'} stroke="var(--primario)" strokeWidth={2} />
          ))}
          {compatto && !spark && risultati.map((v, i) => v !== null && (
            <g key={i}>
              <circle cx={x(i)} cy={y(v)} r={2.8} fill="var(--primario)" />
              <text x={x(i)} y={y(v) - 8} textAnchor="middle" fontSize={percentuale ? 10 : 12} fontWeight={700} fill="var(--primario-900)">
                {percentuale ? (v * 100).toFixed(1).replace('.', ',') + '%' : v}
              </text>
            </g>
          ))}
        </g>

        {!piccolo && etichette.map((l, i) => (
          <rect key={'h' + l + i} x={x(i) - passo / 2} y={0} width={passo} height={H} fill="transparent" style={{ cursor: 'crosshair' }} onMouseEnter={() => setEvidenziato(i)} />
        ))}
      </svg>
      {hi !== null && (() => {
        const sinistra = x(hi) / W * 100
        const v = risultati[hi]
        return (
          <div className="grafico-suggerimento" style={{ left: `${sinistra}%`, transform: `translateX(${sinistra > 70 ? 'calc(-100% - 12px)' : '12px'})` }}>
            <div className="etichetta-maiuscola">{prefisso} {etichette[hi]}</div>
            <div style={{ fontWeight: 600 }}>{nomeSerie}: {v === null ? '—' : percentuale ? pct1(v) : v.toLocaleString('it-IT')}</div>
            {ob && ob[hi] !== null && <div style={{ color: 'var(--testo-tenue)' }}>{nomeLinea}: {ob[hi]!.toLocaleString('it-IT', { maximumFractionDigits: 1 })}</div>}
          </div>
        )
      })()}
    </div>
  )
}

/** Legenda risultato / obiettivo sopra i grafici */
export function LegendaGrafico({ obiettivo = true, nomi = ['risultato', 'obiettivo'] }: { obiettivo?: boolean; nomi?: [string, string] }) {
  return (
    <div className="grafico-legenda">
      <span><span className="segno-ris" />{nomi[0]}</span>
      {obiettivo && <span><span className="segno-ob" />{nomi[1]}</span>}
    </div>
  )
}
