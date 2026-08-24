import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { MessageSquare, Send, Trash2, X } from 'lucide-react'
import Modal from '../../components/UI/Modal'
import { COLUNAS, COLUNA_CORES, STATUS_LABELS } from './ConversaCard'

const ENDPOINT = 'https://whatsapp-api-production-4c64.up.railway.app/enviar'

function formatarHorario(valor) {
  if (!valor) return ''
  const data = typeof valor.toDate === 'function' ? valor.toDate() : new Date(valor)
  if (Number.isNaN(data.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(data)
}

export default function ConversaDetalhe({ conversa, onClose, mudarColuna, mudarStatus, excluirMensagem }) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [indiceParaExcluir, setIndiceParaExcluir] = useState(null)
  const fimRef = useRef(null)
  const reduzirMovimento = useReducedMotion()

  function confirmarExclusao() {
    if (indiceParaExcluir === null) return
    excluirMensagem(conversa.id, indiceParaExcluir).catch(() => {})
    setIndiceParaExcluir(null)
  }

  useEffect(() => {
    if (!conversa) return undefined
    function handleEscape(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [conversa, onClose])

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: reduzirMovimento ? 'auto' : 'smooth' })
  }, [conversa?.id, conversa?.mensagens?.length, reduzirMovimento])

  async function enviar() {
    const message = texto.trim()
    if (!message || enviando || !conversa) return
    setEnviando(true)
    setErro('')
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: conversa.phone, message }),
      })
      if (!response.ok) throw new Error(`Falha no envio (${response.status})`)
      setTexto('')
    } catch (err) {
      console.error('[ConversaDetalhe] enviar mensagem:', err?.message)
      setErro('Não foi possível enviar a mensagem. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      enviar()
    }
  }

  const corColuna = COLUNA_CORES[conversa?.coluna] ?? COLUNA_CORES.arquivado

  if (!conversa) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center font-sans" style={{ backgroundColor: '#FAFAFA' }}>
        <MessageSquare size={32} strokeWidth={1.5} color="#CCCCCC" />
        <p style={{ color: '#999999', fontSize: '13px', marginTop: 10 }}>Selecione uma conversa para visualizar as mensagens.</p>
      </div>
    )
  }

  return (
    <motion.div
      key={conversa.id}
      className="flex h-full min-h-0 flex-col font-sans"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2" style={{ minHeight: 76, padding: '12px 18px', borderBottom: '1px solid #E8E8E8' }}>
        <div className="min-w-0 flex-1">
          <h2 id="conversa-detalhe-titulo" style={{ color: '#111111', fontSize: '15px', fontWeight: 600 }}>{conversa.nome || conversa.phone}</h2>
          <p style={{ color: '#999999', fontSize: '12px', marginTop: 2 }}>+{conversa.phone}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar conversa" className="flex h-8 w-8 items-center justify-center rounded-md" style={{ color: '#666666', backgroundColor: '#F5F5F5' }}>
          <X size={17} strokeWidth={1.75} />
        </button>

        <div className="grid w-full grid-cols-2 gap-2">
          <label>
            <span style={{ display: 'block', color: '#999999', fontSize: '10px', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coluna</span>
            <select
              value={conversa.coluna}
              onChange={event => mudarColuna(conversa.id, event.target.value).catch(() => {})}
              className="select w-full font-sans"
              aria-label="Coluna da conversa"
              style={{ height: 34, color: corColuna, borderColor: corColuna }}
            >
              {COLUNAS.map(coluna => <option key={coluna.value} value={coluna.value}>{coluna.label}</option>)}
            </select>
          </label>
          <label>
            <span style={{ display: 'block', color: '#999999', fontSize: '10px', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</span>
            <select
              value={conversa.status}
              onChange={event => mudarStatus(conversa.id, event.target.value).catch(() => {})}
              className="select w-full font-sans"
              aria-label="Status da conversa"
              style={{ height: 34 }}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: '20px 18px', backgroundColor: '#FAFAFA' }}>
        {(conversa.mensagens ?? []).length === 0 ? (
          <p className="text-center" style={{ color: '#999999', fontSize: '12px', marginTop: 30 }}>Nenhuma mensagem nesta conversa.</p>
        ) : conversa.mensagens.map((mensagem, index) => {
          const recebida = mensagem.de === 'contato'
          return (
            <motion.div
              key={`${formatarHorario(mensagem.timestamp)}-${index}`}
              initial={{ opacity: 0, transform: reduzirMovimento ? 'translateY(0)' : 'translateY(4px)' }}
              animate={{ opacity: 1, transform: 'translateY(0)' }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={`group flex items-center gap-1.5 ${recebida ? 'justify-start' : 'justify-end'}`}
              style={{ marginBottom: 10 }}
            >
              {!recebida && (
                <button
                  type="button"
                  onClick={() => setIndiceParaExcluir(index)}
                  aria-label="Excluir mensagem"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: '#999999', flexShrink: 0 }}
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                </button>
              )}
              <div style={{ maxWidth: '76%', padding: '9px 11px 6px', borderRadius: recebida ? '4px 12px 12px 12px' : '12px 4px 12px 12px', backgroundColor: recebida ? '#F0F0F0' : '#FFE4DD' }}>
                <p style={{ color: '#111111', fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{mensagem.texto}</p>
                <p style={{ color: '#999999', fontSize: '9px', textAlign: 'right', marginTop: 3 }}>{formatarHorario(mensagem.timestamp)}</p>
              </div>
              {recebida && (
                <button
                  type="button"
                  onClick={() => setIndiceParaExcluir(index)}
                  aria-label="Excluir mensagem"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: '#999999', flexShrink: 0 }}
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                </button>
              )}
            </motion.div>
          )
        })}
        <div ref={fimRef} />
      </div>

      <footer style={{ padding: '12px 14px', borderTop: '1px solid #E8E8E8', backgroundColor: '#FFFFFF' }}>
        {erro && <p role="alert" style={{ color: '#FF4B2E', fontSize: '11px', marginBottom: 7 }}>{erro}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={texto}
            onChange={event => setTexto(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Digite uma mensagem..."
            aria-label="Mensagem"
            className="input resize-none font-sans"
            style={{ flex: 1, minHeight: 42, maxHeight: 100, paddingTop: 10, paddingBottom: 10 }}
          />
          <button type="button" onClick={enviar} disabled={!texto.trim() || enviando} className="btn-primary flex items-center gap-2" style={{ height: 42 }}>
            <Send size={15} strokeWidth={1.75} />
            {enviando ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </footer>

      <Modal
        isOpen={indiceParaExcluir !== null}
        onClose={() => setIndiceParaExcluir(null)}
        title="Excluir mensagem"
        footer={(
          <>
            <button type="button" onClick={() => setIndiceParaExcluir(null)} className="btn-secondary" style={{ height: 36 }}>
              Cancelar
            </button>
            <button type="button" onClick={confirmarExclusao} className="btn-primary" style={{ height: 36 }}>
              Excluir
            </button>
          </>
        )}
      >
        <p style={{ color: '#666666', fontSize: '13px' }}>Esta mensagem será removida permanentemente da conversa.</p>
      </Modal>
    </motion.div>
  )
}
