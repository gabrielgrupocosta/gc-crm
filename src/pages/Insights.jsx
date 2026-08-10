import { motion } from 'framer-motion'
import { Lightbulb } from 'lucide-react'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

export default function Insights() {
  return (
    <motion.div style={{ padding: '28px 20px' }} variants={pageVariants} initial="initial" animate="animate">
      <div className="page-header">
        <h1 className="page-title">Insights</h1>
        <p className="page-subtitle">Análises e destaques sobre os resultados das lojas.</p>
      </div>

      <div
        className="flex flex-col items-center justify-center text-center gap-3"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E8E8',
          borderRadius: '10px',
          padding: '64px 24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <Lightbulb size={28} strokeWidth={1.5} color="#BBBBBB" />
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#666666' }}>
          Conteúdo em definição
        </p>
        <p style={{ fontSize: '13px', color: '#999999', maxWidth: '360px' }}>
          Essa aba ainda não tem análises configuradas. Em breve trará insights automáticos sobre os resultados.
        </p>
      </div>
    </motion.div>
  )
}
