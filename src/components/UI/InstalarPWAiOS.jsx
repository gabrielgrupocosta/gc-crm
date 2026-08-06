import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Share, X } from 'lucide-react'

function ehIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

function ehPWAInstalada() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

// iOS Safari não tem API de prompt automático de instalação (beforeinstallprompt
// só existe em Chrome/Android) — a única forma de "notificar" é orientar o passo
// a passo manual. Mostra uma vez por dia enquanto o app não for instalado.
export default function InstalarPWAiOS() {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    if (!ehIOS() || ehPWAInstalada()) return
    const hoje = new Date()
    const chave = `ihubfood-instalar-pwa-ios-${hoje.getFullYear()}-${hoje.getMonth() + 1}-${hoje.getDate()}`
    if (localStorage.getItem(chave)) return
    localStorage.setItem(chave, '1')
    setVisivel(true)
  }, [])

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
            <Share size={16} strokeWidth={1.75} color="#E5322D" />
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: '13px', fontWeight: 500, color: '#111111', marginBottom: '3px' }}>
              Instale o iHubFood
            </p>
            <p style={{ fontSize: '12px', color: '#666666', lineHeight: 1.45 }}>
              Toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong> para receber notificações no iPhone.
            </p>
          </div>
          <button
            onClick={() => setVisivel(false)}
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
