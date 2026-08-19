import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X } from 'lucide-react'

function ehPWAInstalada() {
  return window.matchMedia('(display-mode: standalone)').matches
}

// Chrome/Android (e outros navegadores baseados em Chromium) disparam o
// evento beforeinstallprompt quando o app cumpre os critérios de PWA
// instalável (manifest + service worker + https). Guardamos o evento e
// disparamos o prompt nativo do próprio navegador ao clicar em "Instalar".
export default function InstalarPWAAndroid() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dispensado, setDispensado] = useState(false)

  useEffect(() => {
    if (ehPWAInstalada()) return

    function aoDisponibilizarPrompt(evento) {
      evento.preventDefault()
      setDeferredPrompt(evento)
    }
    function aoInstalar() {
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', aoDisponibilizarPrompt)
    window.addEventListener('appinstalled', aoInstalar)
    return () => {
      window.removeEventListener('beforeinstallprompt', aoDisponibilizarPrompt)
      window.removeEventListener('appinstalled', aoInstalar)
    }
  }, [])

  async function handleInstalar() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  const visivel = !!deferredPrompt && !dispensado

  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.97 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed bottom-5 left-5 z-[100] flex items-start gap-3 max-w-sm"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E8E8E8',
            borderRadius: '10px',
            padding: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          <div
            className="shrink-0 flex items-center justify-center"
            style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FFF5F5' }}
          >
            <Download size={16} strokeWidth={1.75} color="#FF4B2E" />
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: '13px', fontWeight: 500, color: '#111111', marginBottom: '3px' }}>
              Instale o iHubFood
            </p>
            <p style={{ fontSize: '12px', color: '#666666', lineHeight: 1.45, marginBottom: '12px' }}>
              Instale o app pra receber notificações e acessar mais rápido, direto da tela inicial.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleInstalar}
                className="btn-primary"
                style={{ height: '28px', padding: '0 12px', fontSize: '12px' }}
              >
                Instalar
              </button>
              <button
                onClick={() => setDispensado(true)}
                className="btn-secondary"
                style={{ height: '28px', padding: '0 12px', fontSize: '12px' }}
              >
                Agora não
              </button>
            </div>
          </div>
          <button
            onClick={() => setDispensado(true)}
            aria-label="Fechar"
            className="shrink-0"
            style={{ color: '#999999', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
