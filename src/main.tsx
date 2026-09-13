import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initNetlifyHudHide } from './lib/netlifyHud'
import { initTheme } from './lib/theme'

initTheme()
initNetlifyHudHide()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
