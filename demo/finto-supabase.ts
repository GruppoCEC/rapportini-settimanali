// =====================================================================
// VERSIONE DIMOSTRATIVA — finto database in memoria, con dati inventati.
// Sostituisce src/lib/supabase.ts solo quando si avvia "npm run demo".
// Imita in modo semplificato le regole di accesso del database vero.
// I dati si azzerano ricaricando la pagina.
// =====================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */
import { aggiungiSettimane, lunediDi, oggiISO, settimanaPredefinita } from '../src/lib/settimane'

export const configurato = true

// ---------------------------------------------------------------- dati inventati
let seme = 7
const caso = () => { seme = (seme * 16807) % 2147483647; return (seme - 1) / 2147483646 }
const tra = (min: number, max: number) => Math.round(min + caso() * (max - min))

const citta = [{ id: 1, nome: 'Roma' }, { id: 2, nome: 'Milano' }]
const aree = [
  { id: 1, nome: 'Roma Nord', citta_id: 1 }, { id: 2, nome: 'Roma Centro', citta_id: 1 }, { id: 3, nome: 'Roma Sud', citta_id: 1 },
  { id: 4, nome: 'Milano Centro', citta_id: 2 }, { id: 5, nome: 'Milano Est', citta_id: 2 },
]
const nomiUffici: [string, number, number][] = [
  ['Somalia', 1, 1], ['Trieste', 1, 1], ['Parioli', 1, 1], ['Flaminio', 1, 1],
  ['Prati', 1, 2], ['Monti', 1, 2], ['Trastevere', 1, 2], ['San Giovanni', 1, 2],
  ['EUR', 1, 3], ['Garbatella', 1, 3], ['Ostiense', 1, 3],
  ['Brera', 2, 4], ['Navigli', 2, 4], ['Porta Romana', 2, 4], ['Isola', 2, 5], ['Città Studi', 2, 5], ['Lambrate', 2, 5],
]
const uffici = nomiUffici.map(([nome, citta_id, area_id], i) => ({ id: i + 1, nome, citta_id, area_id, attivo: true }))
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')

const utenti: any[] = [
  { nome_utente: 'davide', nome: 'Davide', ruolo: 'admin_generale', citta_id: 1, ufficio_id: null, area_id: null, email_promemoria: 'rapportini.gruppo@gmail.com' },
  { nome_utente: 'admin-milano', nome: 'Admin Milano (Brera)', ruolo: 'admin_citta', citta_id: 2, ufficio_id: 12, area_id: null, email_promemoria: 'brera@gmail.com' },
  { nome_utente: 'resp-roma-nord', nome: 'Responsabile Roma Nord', ruolo: 'responsabile', citta_id: 1, ufficio_id: null, area_id: 1, email_promemoria: null },
  ...uffici.map((u) => ({
    nome_utente: slug(u.nome), nome: `Ufficio ${u.nome}`, ruolo: 'ufficio', citta_id: u.citta_id, ufficio_id: u.id, area_id: null,
    email_promemoria: u.id % 5 === 0 ? null : `${slug(u.nome)}@gmail.com`,
  })),
].map((u) => ({ ...u, email: `${u.nome_utente}@demo`, attivo: true, auth_id: null }))

const metriche = [
  ['app_vendita', 'App.ti Vendita', 'attivita', 1], ['proposte', 'Proposte', 'attivita', 2], ['incarichi', 'Incarichi', 'attivita', 3],
  ['valutazioni', 'Valutazioni', 'attivita', 4], ['vendite', 'Vendite', 'attivita', 5], ['ribassi', 'Ribassi', 'attivita', 6],
  ['im3', 'IM3', 'attivita', 7], ['piu90', '+90', 'attivita', 8],
  ['portafoglio', 'Portafoglio', 'zona', 10], ['incarichi_zona', 'Incarichi in zona', 'zona', 11], ['contatti_zona', 'Contatti zona', 'zona', 12],
  ['telefoni_mancanti', 'Telefoni mancanti', 'zona', 13], ['affittati', 'Affittati', 'zona', 14], ['vuoti', 'Vuoti', 'zona', 15],
].map(([codice, nome, tipo, ordine]) => ({ codice, nome, tipo, ordine, attiva: true }))

// Obiettivo tipico [min, max] e "bravura" dell'ufficio
const OBIETTIVI: Record<string, [number, number] | null> = {
  app_vendita: [8, 12], proposte: [1, 2], incarichi: [1, 2], valutazioni: [4, 8], vendite: [1, 1], ribassi: [1, 1], im3: null, piu90: null,
}
const rilevazioni: any[] = []
const note: any[] = []
const daCompilare = settimanaPredefinita()
const settimane = Array.from({ length: 14 }, (_, i) => aggiungiSettimane(daCompilare, i - 13))

for (const u of uffici) {
  const bravura = 0.55 + caso() * 0.8
  const zona = { portafoglio: tra(2, 9), incarichi_zona: tra(28, 50), contatti_zona: tra(4000, 7000), telefoni_mancanti: tra(400, 600), affittati: tra(800, 1100), vuoti: tra(250, 350) }
  for (const s of settimane) {
    // Situazione della settimana da compilare: 2 uffici mancanti, 1 parziale
    if (s === daCompilare && (u.id === 3 || u.id === 10 || u.id === 16)) continue
    const parziale = s === daCompilare && (u.id === 7 || u.id === 14)
    const ts = new Date(`${aggiungiSettimane(s, 1)}T0${tra(7, 9)}:${tra(10, 59)}:00`).toISOString()
    const da = utenti.find((x) => x.ufficio_id === u.id && x.ruolo === 'ufficio')!.email
    for (const [codice, ob] of Object.entries(OBIETTIVI)) {
      if (parziale && ['im3', 'piu90', 'ribassi'].includes(codice)) continue
      const obiettivo = ob ? tra(ob[0], ob[1]) : null
      const risultato = ob ? Math.max(0, Math.round(obiettivo! * bravura * (0.4 + caso() * 1.2))) : codice === 'im3' ? tra(250, 420) : tra(0, 30)
      rilevazioni.push({ ufficio_id: u.id, settimana: s, metrica: codice, obiettivo, risultato, aggiornato_da: da, aggiornato_il: ts })
    }
    zona.portafoglio = Math.max(0, zona.portafoglio + tra(-1, 1))
    zona.incarichi_zona = Math.max(10, zona.incarichi_zona + tra(-2, 2))
    zona.telefoni_mancanti = Math.max(0, zona.telefoni_mancanti - tra(0, 6))
    for (const [codice, valore] of Object.entries(zona)) {
      rilevazioni.push({ ufficio_id: u.id, settimana: s, metrica: codice, obiettivo: null, risultato: valore, aggiornato_da: da, aggiornato_il: ts })
    }
  }
  if (u.id % 3 === 1) {
    note.push({ ufficio_id: u.id, settimana: daCompilare, testo: ['Acquisito incarico in esclusiva in via Chisimaio, trilocale con terrazzo.', 'Due proposte in trattativa, firma prevista la prossima settimana.', 'Settimana rallentata da due colleghi in ferie.', 'Avviata campagna volantinaggio sulla zona nord.'][u.id % 4], aggiornato_da: null, aggiornato_il: new Date().toISOString() })
  }
}

const tabelle: Record<string, any[]> = { citta, aree, uffici, utenti, metriche, rilevazioni, note_settimana: note }

// ---------------------------------------------------------------- sessione e "regole di accesso"
const CHIAVE = 'rapportini.demo.utente'
let utenteCorrente: string | null = (() => { try { return sessionStorage.getItem(CHIAVE) } catch { return null } })()
const ascoltatori = new Set<(e: string, s: any) => void>()
const sessione = () => (utenteCorrente ? { user: { email: utenteCorrente } } : null)
const notifica = () => ascoltatori.forEach((f) => f('CAMBIO', sessione()))
const io = () => utenti.find((u) => u.email === utenteCorrente && u.attivo)

function ufficiLeggibili(): Set<number> {
  const me = io()
  if (!me) return new Set()
  return new Set(uffici.filter((u) =>
    me.ruolo === 'admin_generale' || (me.ruolo === 'admin_citta' && u.citta_id === me.citta_id)
    || (me.ruolo === 'responsabile' && u.area_id === me.area_id) || u.id === me.ufficio_id).map((u) => u.id))
}
function visibile(tabella: string, riga: any): boolean {
  const me = io()
  if (!me) return false
  const gestisce = (c: number) => me.ruolo === 'admin_generale' || (me.ruolo === 'admin_citta' && me.citta_id === c)
  switch (tabella) {
    case 'uffici': return ufficiLeggibili().has(riga.id) || gestisce(riga.citta_id)
    case 'aree': return riga.citta_id === me.citta_id || gestisce(riga.citta_id)
    case 'utenti': return riga.email === me.email || gestisce(riga.citta_id)
    case 'rilevazioni': case 'note_settimana': return ufficiLeggibili().has(riga.ufficio_id)
    default: return true
  }
}

// ---------------------------------------------------------------- finto client
const attesa = (ms = 120) => new Promise((r) => setTimeout(r, ms))
let prossimoId = 100

class Interrogazione {
  private filtri: ((r: any) => boolean)[] = []
  private ordini: [string, boolean][] = []
  private da = 0
  private a = Infinity
  private singolo: 'no' | 'forse' | 'si' = 'no'
  private operazione: { tipo: 'insert' | 'upsert' | 'update' | 'delete'; righe?: any[]; campi?: any; chiavi?: string[] } | null = null
  constructor(private tabella: string) {}
  select() { return this }
  eq(c: string, v: any) { this.filtri.push((r) => r[c] === v); return this }
  neq(c: string, v: any) { this.filtri.push((r) => r[c] !== v); return this }
  in(c: string, v: any[]) { this.filtri.push((r) => v.includes(r[c])); return this }
  gte(c: string, v: any) { this.filtri.push((r) => r[c] >= v); return this }
  lte(c: string, v: any) { this.filtri.push((r) => r[c] <= v); return this }
  lt(c: string, v: any) { this.filtri.push((r) => r[c] < v); return this }
  not(c: string) { this.filtri.push((r) => r[c] !== null && r[c] !== undefined); return this }
  order(c: string, o?: { ascending?: boolean }) { this.ordini.push([c, o?.ascending !== false]); return this }
  range(da: number, a: number) { this.da = da; this.a = a; return this }
  limit(n: number) { this.a = this.da + n - 1; return this }
  maybeSingle() { this.singolo = 'forse'; return this }
  single() { this.singolo = 'si'; return this }
  insert(righe: any) { this.operazione = { tipo: 'insert', righe: [righe].flat() }; return this }
  upsert(righe: any, o: { onConflict: string }) { this.operazione = { tipo: 'upsert', righe: [righe].flat(), chiavi: o.onConflict.split(',') }; return this }
  update(campi: any) { this.operazione = { tipo: 'update', campi }; return this }
  delete() { this.operazione = { tipo: 'delete' }; return this }

  private esegui(): { data: any; error: any } {
    const t = (tabelle[this.tabella] ??= [])
    const me = io()
    const op = this.operazione
    if (op) {
      if (!me) return { data: null, error: { message: 'permission denied' } }
      const ora = new Date().toISOString()
      if (op.tipo === 'insert' || op.tipo === 'upsert') {
        const inseriti: any[] = []
        for (const r of op.righe!) {
          if (this.tabella === 'rilevazioni' || this.tabella === 'note_settimana') {
            if (!ufficiLeggibili().has(r.ufficio_id) || me.ruolo === 'responsabile' && r.ufficio_id !== me.ufficio_id) {
              return { data: null, error: { message: 'new row violates row-level security policy' } }
            }
          }
          const nuova = { id: prossimoId++, attivo: true, ...r, aggiornato_da: me.email, aggiornato_il: ora }
          if (this.tabella === 'uffici' && t.some((x) => x.nome === r.nome && x.citta_id === r.citta_id)) return { data: null, error: { message: 'duplicate key' } }
          const i = op.chiavi ? t.findIndex((x) => op.chiavi!.every((k) => x[k] === r[k])) : -1
          if (i >= 0) t[i] = { ...t[i], ...nuova }; else t.push(nuova)
          inseriti.push(nuova)
        }
        return { data: this.singolo !== 'no' ? inseriti[0] : inseriti, error: null }
      }
      const colpite = t.filter((r) => visibile(this.tabella, r) && this.filtri.every((f) => f(r)))
      if (op.tipo === 'update') colpite.forEach((r) => Object.assign(r, op.campi))
      else colpite.forEach((r) => t.splice(t.indexOf(r), 1))
      return { data: colpite, error: null }
    }
    let righe = t.filter((r) => visibile(this.tabella, r) && this.filtri.every((f) => f(r)))
    if (this.ordini.length) {
      righe = [...righe].sort((x, y) => {
        for (const [c, asc] of this.ordini) { if (x[c] !== y[c]) return (x[c] < y[c] ? -1 : 1) * (asc ? 1 : -1) }
        return 0
      })
    }
    righe = righe.slice(this.da, this.a === Infinity ? undefined : this.a + 1).map((r) => ({ ...r }))
    if (this.singolo === 'forse') return { data: righe[0] ?? null, error: null }
    if (this.singolo === 'si') return righe[0] ? { data: righe[0], error: null } : { data: null, error: { message: 'nessuna riga' } }
    return { data: righe, error: null }
  }

  then(ok: (v: any) => any, ko?: (e: any) => any) {
    return attesa().then(() => this.esegui()).then(ok, ko)
  }
}

export const supabase: any = {
  auth: {
    getSession: async () => ({ data: { session: sessione() } }),
    onAuthStateChange: (f: any) => { ascoltatori.add(f); return { data: { subscription: { unsubscribe: () => ascoltatori.delete(f) } } } },
    signInWithPassword: async ({ email, password }: any) => {
      await attesa(300)
      if (!utenti.some((u) => u.email === email) || password !== 'demo') return { error: { message: 'Invalid login credentials' } }
      utenteCorrente = email
      try { sessionStorage.setItem(CHIAVE, email) } catch { /* niente */ }
      notifica()
      return { error: null }
    },
    signOut: async () => { utenteCorrente = null; try { sessionStorage.removeItem(CHIAVE) } catch { /* niente */ } notifica(); return { error: null } },
    updateUser: async () => { await attesa(300); return { error: null } },
  },
  rpc: async (nome: string, args: any) => {
    await attesa(80)
    if (nome === 'email_di_accesso') return { data: `${String(args.p_nome_utente).trim().toLowerCase()}@demo`, error: null }
    return { data: null, error: { message: `funzione ${nome} non disponibile nella demo` } }
  },
  functions: {
    invoke: async (_nome: string, { body }: any) => {
      await attesa(400)
      const me = io()
      if (body.azione === 'crea') {
        if (utenti.some((u) => u.nome_utente === body.nome_utente)) return { data: { errore: 'Esiste già un account con questo nome utente.' }, error: null }
        const ufficio = uffici.find((u) => u.id === body.ufficio_id)
        const area = aree.find((a) => a.id === body.area_id)
        const citta_id = ufficio?.citta_id ?? area?.citta_id ?? body.citta_id
        if (me.ruolo === 'admin_citta' && (citta_id !== me.citta_id || !['ufficio', 'responsabile'].includes(body.ruolo))) {
          return { data: { errore: 'Non hai i permessi per questa operazione.' }, error: null }
        }
        utenti.push({ email: `${body.nome_utente}@demo`, nome_utente: body.nome_utente, nome: body.nome || null, ruolo: body.ruolo, citta_id, ufficio_id: body.ufficio_id, area_id: body.area_id, email_promemoria: body.email_promemoria || null, attivo: true })
        return { data: { ok: true }, error: null }
      }
      if (body.azione === 'elimina') {
        const i = utenti.findIndex((u) => u.nome_utente === body.nome_utente)
        if (i >= 0) utenti.splice(i, 1)
      }
      return { data: { ok: true }, error: null }
    },
  },
  from: (tabella: string) => new Interrogazione(tabella),
}

// Per la console del browser: quale settimana è "da compilare" nella demo
console.info(`[demo] settimana da compilare: ${daCompilare} · oggi ${oggiISO()} · settimana in corso ${lunediDi(oggiISO())}`)
