import { useEffect } from 'react'
import { motion } from 'framer-motion'
import CoinSpinIntro from './CoinSpinIntro'

// Splash de abertura no celular — mostra a moeda girando por cima de tudo
// (inclusive antes da sessão/dados terminarem de carregar por baixo) sempre
// que o app é aberto numa viewport mobile, com sessão ativa ou não. Some
// sozinha depois da duração da animação (giro 1.3s + pulso 2x0.9s), não
// depende de nenhum estado de auth/dados terminar de carregar.
const DURACAO_MS = 3200

export default function AppIntroSplash({ onFinish }) {
  useEffect(() => {
    const t = setTimeout(onFinish, DURACAO_MS)
    return () => clearTimeout(t)
  }, [onFinish])

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center bg-bg"
      style={{ zIndex: 100 }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
    >
      <CoinSpinIntro size={120} />
    </motion.div>
  )
}
