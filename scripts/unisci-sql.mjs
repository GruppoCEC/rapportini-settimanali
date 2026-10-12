// Unisce tutte le migrazioni in un unico file da incollare nell'editor SQL di Supabase.
// Uso: npm run sql:unico
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const cartella = join(import.meta.dirname, '..', 'supabase', 'migrations')
const file = readdirSync(cartella).filter((f) => f.endsWith('.sql')).sort()
const intestazione = `-- FILE GENERATO AUTOMATICAMENTE da scripts/unisci-sql.mjs — non modificarlo a mano.
-- Contiene, in ordine: ${file.join(', ')}
-- Da incollare UNA SOLA VOLTA in Supabase → SQL Editor → New query → Run.\n\n`
const contenuto = file.map((f) => `-- ▼▼▼ ${f} ▼▼▼\n${readFileSync(join(cartella, f), 'utf8')}`).join('\n\n')
writeFileSync(join(cartella, '..', 'TUTTO_IN_UNO.sql'), intestazione + contenuto)
console.log(`Creato supabase/TUTTO_IN_UNO.sql (${file.length} file uniti)`)
