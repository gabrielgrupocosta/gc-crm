import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useAssistenteChat } from '../../contexts/AssistenteChatContext'
import AssistenteChatPanel from '../UI/AssistenteChatPanel'
import assistenteBotIcon from '../../assets/assistente-bot-2.webp'

const panelVariants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.15, ease: 'easeOut' } },
  exit: { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.1 } },
}

const BOTAO_TAMANHO = 88
const MARGEM_TELA = 12
const PANEL_LARGURA = 360
const PANEL_ALTURA = 540
const LIMIAR_ARRASTO = 5 // px de movimento para considerar arrasto em vez de clique

function posicaoInicial() {
  return {
    x: window.innerWidth - MARGEM_TELA - BOTAO_TAMANHO,
    y: window.innerHeight - MARGEM_TELA - BOTAO_TAMANHO,
  }
}

function limitarNaTela(pos) {
  return {
    x: Math.min(Math.max(pos.x, MARGEM_TELA), window.innerWidth - BOTAO_TAMANHO - MARGEM_TELA),
    y: Math.min(Math.max(pos.y, MARGEM_TELA), window.innerHeight - BOTAO_TAMANHO - MARGEM_TELA),
  }
}

// Botão arrastável + popup do Assistente Delivery, disponível em qualquer tela
// do sistema — some só na própria aba /assistente, onde o chat já ocupa a página.
export default function AssistenteFloatingButton() {
  const location = useLocation()
  const { lojas, lojaId, setLojaId, popupAberto, setPopupAberto, limparConversa, mensagens } = useAssistenteChat()

  const [pos, setPos] = useState(posicaoInicial)
  const arrastandoRef = useRef(false)
  const moveuRef = useRef(false)
  const inicioPointerRef = useRef({ x: 0, y: 0 })
  const inicioPosRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    function aoRedimensionar() {
      setPos(p => limitarNaTela(p))
    }
    window.addEventListener('resize', aoRedimensionar)
    return () => window.removeEventListener('resize', aoRedimensionar)
  }, [])

  function handlePointerDown(e) {
    arrastandoRef.current = true
    moveuRef.current = false
    inicioPointerRef.current = { x: e.clientX, y: e.clientY }
    inicioPosRef.current = { ...pos }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e) {
    if (!arrastandoRef.current) return
    const dx = e.clientX - inicioPointerRef.current.x
    const dy = e.clientY - inicioPointerRef.current.y
    if (!moveuRef.current && Math.hypot(dx, dy) > LIMIAR_ARRASTO) moveuRef.current = true
    if (moveuRef.current) {
      setPos(limitarNaTela({ x: inicioPosRef.current.x + dx, y: inicioPosRef.current.y + dy }))
    }
  }

  function handlePointerUp() {
    arrastandoRef.current = false
  }

  function handleClick() {
    if (moveuRef.current) {
      moveuRef.current = false
      return
    }
    setPopupAberto(v => !v)
  }

  if (location.pathname === '/assistente') return null

  // Painel abre pro lado com mais espaço livre em volta do botão, acompanhando
  // a posição atual dele em vez de ficar fixo num canto.
  const painelLargura = Math.min(PANEL_LARGURA, window.innerWidth - 24)
  const painelAltura = Math.min(PANEL_ALTURA, window.innerHeight - 24)
  const espacoAcima = pos.y
  const espacoAbaixo = window.innerHeight - (pos.y + BOTAO_TAMANHO)
  const painelTop = espacoAcima >= painelAltura + 10
    ? pos.y - 10 - painelAltura
    : espacoAbaixo >= painelAltura + 10
      ? pos.y + BOTAO_TAMANHO + 10
      : Math.min(Math.max(pos.y - painelAltura / 2, 8), window.innerHeight - painelAltura - 8)
  const painelLeftPreferido = pos.x + BOTAO_TAMANHO - painelLargura
  const painelLeft = Math.min(Math.max(painelLeftPreferido, 8), window.innerWidth - painelLargura - 8)

  return (
    <>
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        aria-label="Abrir Assistente Delivery"
        className="fixed flex items-center justify-center"
        style={{
          left: `${pos.x}px`, top: `${pos.y}px`, zIndex: 45,
          width: `${BOTAO_TAMANHO}px`, height: `${BOTAO_TAMANHO}px`, borderRadius: '50%',
          backgroundColor: '#FF4B2E', color: '#FFFFFF', border: 'none',
          boxShadow: '0 4px 14px rgba(255,75,46,0.35)',
          cursor: 'grab', touchAction: 'none',
        }}
      >
        {popupAberto
          ? <X size={37} strokeWidth={2} />
          : <img src={assistenteBotIcon} alt="" draggable={false} style={{ width: '84px', height: '84px', borderRadius: '50%', objectFit: 'cover', pointerEvents: 'none' }} />}
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
              top: `${painelTop}px`, left: `${painelLeft}px`, zIndex: 44,
              width: `${painelLargura}px`,
              height: `${painelAltura}px`,
              backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.16)', overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 shrink-0" style={{ padding: '12px 14px', borderBottom: '1px solid #E8E8E8' }}>
              <img
                src={assistenteBotIcon}
                alt=""
                draggable={false}
                className="shrink-0"
                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
              />
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
