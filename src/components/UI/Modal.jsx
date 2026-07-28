import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

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

export default function Modal({ isOpen, onClose, title, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!isOpen) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:px-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onMouseDown={onClose}
        >
          <motion.div
            className={`relative w-full h-full sm:h-auto sm:max-h-[90vh] ${width} bg-white border-0 sm:border sm:border-border rounded-none sm:rounded-xl flex flex-col`}
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
            variants={modalVariants}
            onMouseDown={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-7 pt-5 sm:pt-7 pb-5 sm:pb-6 bg-white sticky top-0 z-10 rounded-t-xl shrink-0">
              <h2 className="text-[16px] font-semibold text-text-primary leading-tight">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="flex items-center justify-center w-9 h-9 sm:w-7 sm:h-7 rounded text-text-subtle hover:text-text-primary hover:bg-[#F3F3F3] transition-colors duration-150"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 sm:px-7 pb-5 sm:pb-7 overflow-y-auto flex-1 sm:flex-initial">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-2 px-5 sm:px-7 py-5 sm:py-6 border-t border-border bg-white sticky bottom-0 z-10 rounded-b-xl shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
