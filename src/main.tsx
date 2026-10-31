import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyInitialTheme, ErrorBoundary } from './theme'
import { installBootGuard } from './lib/bootGuard'
import './styles/index.css'

installBootGuard()

// Apply the saved theme before first paint to avoid a flash.
applyInitialTheme()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        if (reg.waiting) {
          window.dispatchEvent(new CustomEvent('tf-sw-update'))
        }
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing
          if (!worker) return
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('tf-sw-update'))
            }
          })
        })
      }).catch(() => {})
    })
    window.addEventListener('tf-sw-update', () => {
      const ok = window.confirm('A new TaskFlow version is ready. Reload now?')
      if (!ok) return
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.waiting?.postMessage('SKIP_WAITING')
        window.location.reload()
      })
    })
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {})
  }
}
