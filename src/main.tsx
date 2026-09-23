import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/shell/App'
import { useTown } from './app/store'
import './app/styles/tokens.css'
import './app/styles/app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.DEV) Object.assign(window, { __town: useTown })
