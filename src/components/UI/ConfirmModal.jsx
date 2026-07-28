import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit:    { opacity: 0, transition: { duration: 0.1 } },
}

const modalVariants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1,    transition: { duration: 0.15, ease: 'easeOut' } },
  exit:    { opacity: 0, scale: 0.96, transition: { duration: 0.1 } },
}

export default function ConfirmModal({ isOpen, title, message, confirmLabel = 'Excluir', onConfirm, onCancel }) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    if (loading) return
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onMouseDown={onCancel}
        >
          <motion.div
            className="relative w-full max-w-sm bg-white border border-border rounded-xl flex flex-col"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
            variants={modalVariants}
            onMouseDown={e => e.stopPropagation()}
          >
            <div style={{ padding: '24px 24px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#FFF5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={16} strokeWidth={1.5} color="#DC2626" />
                </div>
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#111111', margin: '0 0 6px' }}>{title}</h2>
                  <p style={{ fontSize: '13px', color: '#666666', margin: 0, lineHeight: 1.5 }}>{message}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2" style={{ padding: '14px 24px', borderTop: '1px solid #E8E8E8' }}>
              <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="btn-primary"
                style={{ backgroundColor: '#DC2626' }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#B91C1C' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#DC2626' }}
              >
                {loading ? 'Excluindo…' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
