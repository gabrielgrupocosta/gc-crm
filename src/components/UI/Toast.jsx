import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  success: <CheckCircle size={15} strokeWidth={1.5} className="text-positive shrink-0" />,
  error:   <XCircle    size={15} strokeWidth={1.5} className="text-negative shrink-0" />,
  warning: <AlertCircle size={15} strokeWidth={1.5} className="text-warning shrink-0" />,
}

const DURATION = 4000

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    timers.current[id] = setTimeout(() => dismiss(id), DURATION)
    return id
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,  scale: 1     }}
              exit={{    opacity: 0, y: 4,  scale: 0.97  }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="pointer-events-auto flex items-center gap-3 bg-white border border-border rounded-md px-4 py-3 min-w-[260px] max-w-sm shadow-[0_4px_16px_rgba(0,0,0,0.1)]"
            >
              {ICONS[t.type]}
              <span className="flex-1 text-[13px] text-text-primary leading-snug">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-text-subtle hover:text-text-primary transition-colors duration-150"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return ctx.toast
}
