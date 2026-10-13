// Testata blu del sito: marchio, città, riquadri informativi, utente e menu a schede.
import { statoCompilazione } from '../lib/aggregazioni'
import { PROMEMORIA_ATTIVI, ufficiVisibili, type Contesto } from '../lib/contesto'
import { caricaRilevazioni } from '../lib/dati'
import { lunediDi, oggiISO, settimanaPredefinita, intervalloSettimana } from '../lib/settimane'
import { NOMI_RUOLO } from '../lib/tipi'
import { useDati } from '../lib/useDati'
import { BadgeStato } from './Celle'
import { Icona, Logo } from './Interfaccia'

export interface VoceMenu { id: string; etichetta: string; icona: string }

interface Props {
  ctx: Contesto
  menu: VoceMenu[]
  attiva: string
  onVai: (p: string) => void
  onCitta: (id: number) => void
  onEsci: () => void
  aggiornamento: number            // cambia dopo un salvataggio, per ricontare chi ha compilato
}

const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

/** Prossimo invio automatico: venerdì alle 16 o domenica alle 10 (ora italiana) */
export function prossimoPromemoria(adesso: Date = new Date()): string {
  for (let i = 0; i < 8; i++) {
    const d = new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate() + i)
    const ora = d.getDay() === 5 ? 16 : d.getDay() === 0 ? 10 : null
    if (ora === null) continue
    const momento = new Date(d.getFullYear(), d.getMonth(), d.getDate(), ora)
    if (momento > adesso) return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`
  }
  return '—'
}

function iniziali(testo: string): string {
  return testo.replace(/^(Ufficio|Amministrazione) /i, '').slice(0, 2).toUpperCase()
}

export default function Testata({ ctx, menu, attiva, onVai, onCitta, onEsci, aggiornamento }: Props) {
  const { utente } = ctx
  const uffici = ufficiVisibili(ctx)
  const ids = uffici.map((u) => u.id)
  const settimana = settimanaPredefinita()
  const daCompletare = settimana !== lunediDi(oggiISO())
  const compilazione = useDati(() => caricaRilevazioni(settimana, settimana, ids), [settimana, ids.join(','), aggiornamento])
  const ufficio = utente.ruolo === 'ufficio' ? uffici.find((u) => u.id === utente.ufficio_id) : undefined
  const nomeCitta = ctx.citta.find((c) => c.id === ctx.cittaId)?.nome ?? ''

  const stati = compilazione.dati
    ? uffici.map((u) => statoCompilazione(compilazione.dati!.filter((r) => r.ufficio_id === u.id), ctx.metriche))
    : null
  const compilati = stati?.filter((s) => s !== 'mancante').length ?? 0
  const nome = utente.nome || utente.nome_utente

  return (
    <div className="testata-fascia">
      <header className="testata">
        <div className="testata-riga">
          <div className="marchio">
            <Logo />
            <div className="marchio-testi">
              <span className="marchio-nome">Rapportini Settimanali</span>
              <span className="marchio-sotto">Gruppo CEC · Roma e Milano</span>
            </div>
          </div>
          {utente.ruolo === 'admin_generale' ? (
            <div className="citta-pillole" role="group" aria-label="Città">
              {ctx.citta.map((c) => (
                <button key={c.id} className={c.id === ctx.cittaId ? 'attivo' : ''} aria-pressed={c.id === ctx.cittaId} onClick={() => onCitta(c.id)}>{c.nome}</button>
              ))}
            </div>
          ) : (
            <span className="citta-fissa">{nomeCitta}</span>
          )}

          <div className="riquadri-testata">
            <div className="info-testata">
              <Icona nome="calendar-blank" />
              <div className="info-testata-testi">
                <span className="info-testata-etichetta">{daCompletare ? 'Settimana da completare' : 'Settimana in corso'}</span>
                <strong className="info-testata-valore">{intervalloSettimana(settimana)}</strong>
              </div>
            </div>
            {ufficio ? (
              <div className="info-testata">
                <Icona nome="list-checks" />
                <div className="info-testata-testi">
                  <span className="info-testata-etichetta">La tua settimana</span>
                  {stati ? <BadgeStato stato={stati[uffici.indexOf(ufficio)]} /> : <strong className="info-testata-valore">…</strong>}
                </div>
              </div>
            ) : uffici.length > 0 && (
              <div className="info-testata">
                <Icona nome="list-checks" />
                <div className="info-testata-testi">
                  <span className="info-testata-etichetta">Uffici che hanno compilato</span>
                  <strong className="info-testata-valore">{stati ? `${compilati} su ${uffici.length}` : '…'}</strong>
                  <span className="barretta"><span style={{ width: `${stati ? compilati / uffici.length * 100 : 0}%` }} /></span>
                </div>
              </div>
            )}
            {PROMEMORIA_ATTIVI && (
              <div className="info-testata">
                <Icona nome="bell-ringing" />
                <div className="info-testata-testi">
                  <span className="info-testata-etichetta">Prossimo promemoria</span>
                  <strong className="info-testata-valore">{prossimoPromemoria()}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="utente">
            <button className="utente-pulsante" title="Il mio account" onClick={() => onVai('account')}>
              <span className="iniziali">{iniziali(nome)}</span>
              <span className="utente-testi"><strong>{nome}</strong><span>{NOMI_RUOLO[utente.ruolo]}</span></span>
            </button>
            <button className="esci" aria-label="Esci" title="Esci" onClick={onEsci}><Icona nome="sign-out" /></button>
          </div>
        </div>

        <nav className="menu" aria-label="Sezioni">
          {menu.map((v) => (
            <button key={v.id} className={attiva === v.id ? 'attivo' : ''} aria-current={attiva === v.id ? 'page' : undefined} onClick={() => onVai(v.id)}>
              <Icona nome={v.icona} />{v.etichetta}
            </button>
          ))}
        </nav>
      </header>
    </div>
  )
}
