import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, X } from 'lucide-react'
import { useAssistenteChat } from '../../contexts/AssistenteChatContext'
import AssistenteChatPanel from '../UI/AssistenteChatPanel'

const panelVariants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.15, ease: 'easeOut' } },
  exit: { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.1 } },
}

// Botão fixo + popup do Assistente Delivery, disponível em qualquer tela do
// sistema — some só na própria aba /assistente, onde o chat já ocupa a página.
export default function AssistenteFloatingButton() {
  const location = useLocation()
  const { lojas, lojaId, setLojaId, popupAberto, setPopupAberto, limparConversa, mensagens } = useAssistenteChat()

  if (location.pathname === '/assistente') return null

  return (
    <>
      <button
        onClick={() => setPopupAberto(v => !v)}
        aria-label="Abrir Assistente Delivery"
        className="fixed flex items-center justify-center transition-transform duration-150"
        style={{
          bottom: '20px', right: '20px', zIndex: 45,
          width: '52px', height: '52px', borderRadius: '50%',
          backgroundColor: '#FF4B2E', color: '#FFFFFF', border: 'none',
          boxShadow: '0 4px 14px rgba(255,75,46,0.35)',
          cursor: 'pointer',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {popupAberto ? <X size={22} strokeWidth={2} /> : <Bot size={22} strokeWidth={2} />}
      </button>

      <AnimatePresence>
        {popupAberto && (
          <motion.div
            variants={panelVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed flex flex-col"
            style={{
              bottom: '82px', right: '20px', zIndex: 44,
              width: 'min(360px, calc(100vw - 24px))',
              height: 'min(540px, calc(100vh - 110px))',
              backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.16)', overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 shrink-0" style={{ padding: '12px 14px', borderBottom: '1px solid #E8E8E8' }}>
              <div
                className="flex items-center justify-center shrink-0"
                style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#FFF1ED', color: '#FF4B2E' }}
              >
                <Bot size={16} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-text-primary truncate">Assistente Delivery</p>
                <p className="text-[11px] text-text-subtle flex items-center gap-1">
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A', display: 'inline-block' }} />
                  Online
                </p>
              </div>
              <button
                onClick={() => setPopupAberto(false)}
                aria-label="Fechar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999999', display: 'flex', padding: '4px' }}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            {/* Seletor de loja + limpar conversa */}
            <div className="flex items-center gap-2 shrink-0" style={{ padding: '8px 12px', borderBottom: '1px solid #E8E8E8', backgroundColor: '#FAFAFA' }}>
              <select
                value={lojaId}
                onChange={e => setLojaId(e.target.value)}
                className="select flex-1"
                style={{ height: '30px', fontSize: '12px' }}
              >
                <option value="">Sem loja selecionada</option>
                {lojas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
              {mensagens.length > 0 && (
                <button
                  onClick={limparConversa}
                  className="text-[11px] text-text-subtle hover:text-text-primary transition-colors duration-150 shrink-0"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0">
              <AssistenteChatPanel compact />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
