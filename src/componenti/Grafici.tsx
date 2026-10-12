// Grafici (Chart.js). Colori dalla palette di riferimento:
// serie principale blu, obiettivo grigio tratteggiato, griglia e assi tenui.
import {
  BarElement, CategoryScale, Chart, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
  type ChartOptions,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)
Chart.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
Chart.defaults.color = '#52514e'

export const COLORI = {
  serie: '#2a78d6',
  obiettivo: '#898781',
  griglia: '#e1e0d9',
  asse: '#c3c2b7',
  riferimento: '#e34948',
}

const griglia = { color: COLORI.griglia }
const bordo = { color: COLORI.asse }

interface PropsAndamento {
  etichette: string[]
  risultati: (number | null)[]
  obiettivi?: (number | null)[]
  nomeSerie?: string
  percentuale?: boolean           // valori 0–1 mostrati come %
  rigaRiferimento?: number        // es. obiettivo quota 20%
  altezza?: number
}

/** Andamento nel tempo: risultato (linea blu) e, se c'è, obiettivo (linea grigia tratteggiata) */
export function GraficoAndamento({ etichette, risultati, obiettivi, nomeSerie = 'Risultato', percentuale, rigaRiferimento, altezza = 240 }: PropsAndamento) {
  const formato = (v: number) => percentuale ? `${(v * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 })}%` : v.toLocaleString('it-IT')
  const datasets = [
    {
      label: nomeSerie, data: risultati, borderColor: COLORI.serie, backgroundColor: COLORI.serie,
      borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, spanGaps: true, tension: 0,
    },
  ]
  if (obiettivi && obiettivi.some((v) => v !== null)) {
    datasets.push({
      label: 'Obiettivo', data: obiettivi, borderColor: COLORI.obiettivo, backgroundColor: COLORI.obiettivo,
      borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, spanGaps: true, tension: 0,
      // @ts-expect-error: proprietà valida per le linee di Chart.js
      borderDash: [6, 4],
    })
  }
  if (rigaRiferimento !== undefined) {
    datasets.push({
      label: `Obiettivo ${formato(rigaRiferimento)}`, data: etichette.map(() => rigaRiferimento),
      borderColor: COLORI.riferimento, backgroundColor: COLORI.riferimento,
      borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, spanGaps: true, tension: 0,
      // @ts-expect-error: proprietà valida per le linee di Chart.js
      borderDash: [4, 4],
    })
  }
  const opzioni: ChartOptions<'line'> = {
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: datasets.length > 1, position: 'bottom', labels: { boxWidth: 14, boxHeight: 2 } },
      tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y === null ? '—' : formato(c.parsed.y)}` } },
    },
    scales: {
      x: { grid: { display: false }, border: bordo },
      y: { beginAtZero: true, grid: griglia, border: { display: false }, ticks: { callback: (v) => formato(Number(v)), precision: percentuale ? undefined : 0 } },
    },
  }
  return <div style={{ height: altezza }}><Line data={{ labels: etichette, datasets }} options={opzioni} /></div>
}

interface PropsClassifica {
  voci: { nome: string; valore: number; dettaglio?: string; etichetta?: string }[]
  percentuale?: boolean
  rigaRiferimento?: number
  altezzaRiga?: number
}

/** Classifica a barre orizzontali, dal valore più alto */
export function GraficoClassifica({ voci, percentuale, rigaRiferimento, altezzaRiga = 30 }: PropsClassifica) {
  const formato = (v: number) => percentuale ? `${(v * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 })}%` : v.toLocaleString('it-IT')
  const opzioni: ChartOptions<'bar'> = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
    layout: { padding: { right: 110 } },   // spazio per i valori scritti in fondo alle barre
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => `${formato(c.parsed.x)}${voci[c.dataIndex].dettaglio ? ` · ${voci[c.dataIndex].dettaglio}` : ''}` } },
    },
    scales: {
      x: {
        beginAtZero: true, grid: griglia, border: { display: false },
        suggestedMax: rigaRiferimento !== undefined ? rigaRiferimento * 1.2 : undefined,
        ticks: { callback: (v) => formato(Number(v)), precision: percentuale ? undefined : 0 },
      },
      y: { grid: { display: false }, border: bordo, ticks: { font: { size: 13 } } },
    },
  }
  return (
    <div style={{ height: Math.max(120, voci.length * altezzaRiga + 40) }}>
      <Bar
        data={{
          labels: voci.map((v) => v.nome),
          datasets: [{ data: voci.map((v) => v.valore), backgroundColor: COLORI.serie, borderRadius: 4, borderSkipped: 'start', barPercentage: 0.75, categoryPercentage: 0.9 }],
        }}
        options={opzioni}
        plugins={[valoriSulleBarre(voci.map((v) => v.etichetta ?? formato(v.valore))), ...(rigaRiferimento !== undefined ? [lineaVerticale(rigaRiferimento)] : [])]}
      />
    </div>
  )
}

/** Disegna una linea verticale di riferimento (es. obiettivo quota 20%) */
function lineaVerticale(valore: number) {
  return {
    id: 'lineaRiferimento',
    afterDatasetsDraw(chart: Chart) {
      const { ctx, chartArea, scales } = chart
      const x = scales.x.getPixelForValue(valore)
      ctx.save()
      ctx.strokeStyle = COLORI.riferimento
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(x, chartArea.top)
      ctx.lineTo(x, chartArea.bottom)
      ctx.stroke()
      ctx.restore()
    },
  }
}

/** Scrive il valore in fondo a ogni barra: in proiezione non si può passare col mouse */
function valoriSulleBarre(testi: string[]) {
  return {
    id: 'valoriSulleBarre',
    afterDatasetsDraw(chart: Chart) {
      const { ctx } = chart
      const barre = chart.getDatasetMeta(0).data
      ctx.save()
      ctx.fillStyle = '#1f2430'
      ctx.font = `600 ${Math.max(12, Math.min(16, ((barre[0] as unknown as { height?: number })?.height ?? 14) * 0.7))}px system-ui, -apple-system, sans-serif`
      ctx.textBaseline = 'middle'
      barre.forEach((barra, i) => ctx.fillText(testi[i], barra.x + 8, barra.y))
      ctx.restore()
    },
  }
}
