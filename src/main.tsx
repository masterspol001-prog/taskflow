import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyInitialTheme } from './theme'
import './styles/index.css'

// Apply the saved theme before first paint to avoid a flash.
applyInitialTheme()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
