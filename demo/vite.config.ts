// Configurazione della versione dimostrativa ("npm run demo"):
// identica al sito vero, ma il database è sostituito da demo/finto-supabase.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const radice = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig({
  root: radice,
  plugins: [react()],
  define: { 'import.meta.env.VITE_DEMO': JSON.stringify('true') },
  resolve: {
    alias: [{ find: /^\.{1,2}\/(.*\/)?supabase$/, replacement: fileURLToPath(new URL('./finto-supabase.ts', import.meta.url)) }],
  },
  server: { port: 5199, open: !process.env.NON_APRIRE },
})
