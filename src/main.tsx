import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/shell/App'
import { useTown } from './app/store'
import { town } from './app/town'
import './app/styles/tokens.css'
import './app/styles/base.css'
import './app/styles/controls.css'
import './app/styles/components.css'
import './app/styles/forms.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.DEV) Object.assign(window, { __store: useTown, __town: town })
