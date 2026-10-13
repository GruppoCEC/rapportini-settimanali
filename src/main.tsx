import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import '@phosphor-icons/web/duotone'
import './stile.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
