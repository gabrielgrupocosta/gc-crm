import { useState } from 'react'
import { motion } from 'framer-motion'
import LogoMark from './LogoMark'

// Animação de entrada estilo "moeda girando" — rotateY (com perspective no
// container pai) em vez de rotate 2D, então o logo fica de perfil na metade
// do giro, como uma moeda física. Ao terminar de girar, pulsa com brilho.
// Compartilhada entre Login.jsx (pós-login) e AppIntroSplash.jsx (abertura
// do app no celular).
export default function CoinSpinIntro({ size = 140 }) {
  const [giroConcluido, setGiroConcluido] = useState(false)

  return (
    <div style={{ perspective: '800px', position: 'relative' }}>
      <motion.div
        initial={{ scale: 0.4, opacity: 0, rotateY: 0 }}
        animate={{ scale: 1, opacity: 1, rotateY: 1080 }}
        transition={{
          scale:   { duration: 0.5, ease: 'easeOut' },
          opacity: { duration: 0.5, ease: 'easeOut' },
          rotateY: { duration: 1.3, ease: 'easeInOut' },
        }}
        onAnimationComplete={() => setGiroConcluido(true)}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <motion.div
          animate={giroConcluido ? {
            scale: [1, 1.15, 1],
            filter: [
              'drop-shadow(0 0 10px #FF4B2E)',
              'drop-shadow(0 0 34px #FF4B2E)',
              'drop-shadow(0 0 10px #FF4B2E)',
            ],
          } : {}}
          transition={{ duration: 1.15, ease: 'easeInOut', repeat: giroConcluido ? 2 : 0 }}
        >
          <LogoMark size={size} />
        </motion.div>
      </motion.div>
    </div>
  )
}
