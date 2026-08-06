import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Registra o Service Worker assim que o app carrega — independente de
// notificações — pois o Chrome só considera o app instalável (e dispara
// beforeinstallprompt) se já houver um SW ativo controlando a página.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js').catch((err) => {
    console.error('[main] erro ao registrar service worker:', err)
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
