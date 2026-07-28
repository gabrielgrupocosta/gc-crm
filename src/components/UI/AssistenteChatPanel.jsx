import { useState, useEffect, useRef } from 'react'
import { Send } from 'lucide-react'
import { useAssistenteChat } from '../../contexts/AssistenteChatContext'

function formatHora(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Bolha de "digitando…" — três pontinhos pulsando, no lugar do texto "Pensando…".
function DigitandoBubble() {
  return (
    <div
      className="self-start flex items-center gap-1"
      style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '12px', padding: '10px 14px' }}
    >
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#BBBBBB',
            animation: 'assistente-typing 1.1s infinite ease-in-out',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes assistente-typing {
          0%, 60%, 100% { opacity: 0.35; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
    </div>
  )
}

// Painel de chat reutilizado tanto na aba dedicada (/assistente) quanto no
// popup flutuante — mesma conversa nos dois lugares (estado vem do Context).
export default function AssistenteChatPanel({ compact = false }) {
  const { mensagens, enviando, enviarMensagem, confirmarLoja } = useAssistenteChat()
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, enviando])

  async function handleEnviar(e) {
    e.preventDefault()
    const texto = input.trim()
    if (!texto || enviando) return
    setInput('')
    await enviarMensagem(texto)
  }

  return (
    <div
      className="flex flex-col"
      style={{ backgroundColor: '#F7F7F8', border: '1px solid #E8E8E8', borderRadius: compact ? '0' : '10px', overflow: 'hidden', height: '100%' }}
    >
      <div className="flex-1 overflow-y-auto flex flex-col gap-1" style={{ padding: compact ? '12px' : '16px' }}>
        {mensagens.length === 0 && (
          <p className="text-[12.5px] text-text-subtle text-center py-10 px-4">
            Pergunte sobre taxas, promoções, cardápio, avaliações ou peça um diagnóstico de vendas baixas.
          </p>
        )}
        {mensagens.map((m, i) => {
          const mesmaPessoaAnterior = i > 0 && mensagens[i - 1].role === m.role
          return (
            <div
              key={i}
              className={`max-w-[82%] flex flex-col ${m.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
              style={{ marginTop: mesmaPessoaAnterior ? '2px' : '10px' }}
            >
              <div
                className="text-[13px] leading-relaxed whitespace-pre-wrap"
                style={{
                  padding: '9px 12px',
                  borderRadius: '12px',
                  backgroundColor: m.role === 'user' ? '#FF4B2E' : '#FFFFFF',
                  color: m.role === 'user' ? '#FFFFFF' : '#111111',
                  border: m.role === 'user' ? 'none' : '1px solid #E8E8E8',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                {m.content}
              </div>

              {m.opcoesLoja?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5 max-w-full">
                  {m.opcoesLoja.map(opcao => (
                    <button
                      key={opcao.id}
                      type="button"
                      disabled={enviando}
                      onClick={() => confirmarLoja(opcao)}
                      className="text-[12px] font-medium transition-colors duration-150"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '999px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E8E8E8',
                        color: '#111111',
                        cursor: enviando ? 'default' : 'pointer',
                        opacity: enviando ? 0.5 : 1,
                      }}
                      onMouseEnter={e => { if (!enviando) e.currentTarget.style.borderColor = '#FF4B2E' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8E8E8' }}
                    >
                      {opcao.nome}
                    </button>
                  ))}
                </div>
              )}

              <span className="text-[10px] text-text-faint mt-0.5 px-1">{formatHora(m.ts)}</span>
            </div>
          )
        })}
        {enviando && <div style={{ marginTop: '10px' }}><DigitandoBubble /></div>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleEnviar} className="flex items-center gap-2" style={{ padding: '10px 12px', borderTop: '1px solid #E8E8E8', backgroundColor: '#FFFFFF' }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Digite sua pergunta…"
          className="input flex-1"
          disabled={enviando}
        />
        <button
          type="submit"
          disabled={enviando || !input.trim()}
          className="flex items-center justify-center shrink-0 transition-opacity duration-150"
          style={{
            width: '36px', height: '36px', borderRadius: '50%',
            backgroundColor: '#FF4B2E', color: '#FFFFFF', border: 'none',
            opacity: (enviando || !input.trim()) ? 0.5 : 1,
            cursor: (enviando || !input.trim()) ? 'default' : 'pointer',
          }}
        >
          <Send size={14} strokeWidth={2.25} />
        </button>
      </form>
    </div>
  )
}
