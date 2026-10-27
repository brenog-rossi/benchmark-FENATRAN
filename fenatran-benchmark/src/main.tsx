import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app/App'
import { followReducedMotion } from './design/motion'
import './design/fonts.css'
import './design/tokens.css'
import './design/typography.css'
import './components/ui/ui.css'
import './app/shell.css'
import './features/onboarding/onboarding.css'
import './features/home/home.css'
import './features/evaluation/evaluation.css'
import './features/media/media.css'
import './features/export/export.css'

registerSW({ immediate: true })
followReducedMotion()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
