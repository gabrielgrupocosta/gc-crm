import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import useVersaoApp from '../../hooks/useVersaoApp'

// Barra fixa no topo, acima de tudo (inclusive modais) — avisa que rodou um
// deploy novo e, com um clique, recarrega a página pra pegar a versão atual.
// Não some sozinha: fica até o usuário clicar, pra não deixar ninguém preso
// numa versão antiga sem perceber.
export default function AvisoNovaVersao() {
  const { novaVersaoDisponivel, atualizar } = useVersaoApp()

  return (
    <AnimatePresence>
      {novaVersaoDisponivel && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed top-0 left-0 right-0 z-[300] flex items-center justify-center gap-3"
          style={{
            height: '40px',
            backgroundColor: '#FF4B2E',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            fontFamily: "'Manrope', system-ui, -apple-system, sans-serif",
          }}
        >
          <RefreshCw size={14} strokeWidth={2} color="#FFFFFF" />
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#FFFFFF' }}>
            Nova versão do sistema disponível.
          </span>
          <button
            onClick={atualizar}
            style={{
              height: '26px', padding: '0 12px', fontSize: '12px', fontWeight: 600,
              color: '#FF4B2E', backgroundColor: '#FFFFFF', border: 'none',
              borderRadius: '6px', cursor: 'pointer', transition: 'opacity 150ms',
              fontFamily: "'Manrope', system-ui, -apple-system, sans-serif",
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Atualizar agora
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
