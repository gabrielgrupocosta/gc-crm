import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, MessageSquare, Send, Trash2, X } from 'lucide-react'
import Modal from '../../components/UI/Modal'
import { COLUNAS, COLUNA_CORES, STATUS_CORES, STATUS_LABELS } from './ConversaCard'

const ENDPOINT = 'https://whatsapp-api-production-4c64.up.railway.app/enviar'

const CORES_REMETENTE = ['#3E6FA6', '#3F8F68', '#C4881F', '#6E5AA3', '#B25478', '#3F8F94']

function corRemetente(nome) {
  if (!nome) return CORES_REMETENTE[0]
  const soma = [...nome].reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return CORES_REMETENTE[soma % CORES_REMETENTE.length]
}

function iniciais(texto) {
  const limpo = (texto || '').trim()
  if (!limpo) return '#'
  const partes = limpo.split(/\s+/)
  const primeira = partes[0]?.[0] ?? ''
  const segunda = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primeira + segunda).toUpperCase()
}

function formatarHorario(valor) {
  if (!valor) return ''
  const data = typeof valor.toDate === 'function' ? valor.toDate() : new Date(valor)
  if (Number.isNaN(data.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(data)
}

export default function ConversaDetalhe({ conversa, onClose, mudarColuna, mudarStatus, excluirMensagem, excluirConversa }) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [indiceParaExcluir, setIndiceParaExcluir] = useState(null)
  const [confirmarExclusaoConversa, setConfirmarExclusaoConversa] = useState(false)
  const [excluindoConversa, setExcluindoConversa] = useState(false)
  const fimRef = useRef(null)
  const reduzirMovimento = useReducedMotion()

  function confirmarExclusao() {
    if (indiceParaExcluir === null) return
    excluirMensagem(conversa.id, indiceParaExcluir).catch(() => {})
    setIndiceParaExcluir(null)
  }

  async function confirmarExclusaoDaConversa() {
    setExcluindoConversa(true)
    try {
      await excluirConversa(conversa.id)
      setConfirmarExclusaoConversa(false)
      onClose()
    } catch {
      setExcluindoConversa(false)
    }
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
  const corStatus = STATUS_CORES[conversa?.status] ?? STATUS_CORES.aguardando

  if (!conversa) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center font-sans" style={{ backgroundColor: '#FAFAFA' }}>
        <MessageSquare size={32} strokeWidth={1.5} color="#C7C9CE" />
        <p style={{ color: '#9A9DA4', fontSize: '13px', marginTop: 10 }}>Selecione uma conversa para visualizar as mensagens.</p>
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
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2" style={{ minHeight: 76, padding: '12px 18px', borderBottom: '1px solid #E4E5E9' }}>
        <button type="button" onClick={onClose} aria-label="Voltar para a lista de conversas" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md md:hidden" style={{ color: '#6B7178', backgroundColor: '#F0F1F4' }}>
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>
        <span
          aria-hidden="true"
          className="flex flex-shrink-0 items-center justify-center"
          style={{
            width: 38, height: 38, borderRadius: conversa.isGroup ? 10 : '50%',
            backgroundColor: `${corColuna}17`, color: corColuna, fontSize: '13px', fontWeight: 800,
          }}
        >
          {conversa.isGroup ? '👥' : iniciais(conversa.nome || conversa.phone)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="conversa-detalhe-titulo" style={{ color: '#1B1E24', fontSize: '15px', fontWeight: 700 }}>{conversa.nome || conversa.phone}</h2>
          <p style={{ color: '#9A9DA4', fontSize: '12px', marginTop: 2 }}>{conversa.isGroup ? '👥 Grupo' : `+${conversa.phone}`}</p>
        </div>
        <button type="button" onClick={() => setConfirmarExclusaoConversa(true)} aria-label="Excluir conversa" className="flex h-8 w-8 items-center justify-center rounded-md" style={{ color: '#6B7178', backgroundColor: '#F0F1F4' }}>
          <Trash2 size={16} strokeWidth={1.75} />
        </button>
        <button type="button" onClick={onClose} aria-label="Fechar conversa" className="flex h-8 w-8 items-center justify-center rounded-md" style={{ color: '#6B7178', backgroundColor: '#F0F1F4' }}>
          <X size={17} strokeWidth={1.75} />
        </button>

        <div className="grid w-full grid-cols-2 gap-2">
          <label>
            <span style={{ display: 'block', color: '#9A9DA4', fontSize: '10px', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coluna</span>
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
            <span style={{ display: 'block', color: '#9A9DA4', fontSize: '10px', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</span>
            <select
              value={conversa.status}
              onChange={event => mudarStatus(conversa.id, event.target.value).catch(() => {})}
              className="select w-full font-sans"
              aria-label="Status da conversa"
              style={{ height: 34, color: corStatus, borderColor: corStatus }}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: '20px 18px', backgroundColor: '#FAFAFA' }}>
        {(conversa.mensagens ?? []).length === 0 ? (
          <p className="text-center" style={{ color: '#9A9DA4', fontSize: '12px', marginTop: 30 }}>Nenhuma mensagem nesta conversa.</p>
        ) : conversa.mensagens.map((mensagem, index) => {
          const recebida = mensagem.de === 'contato'
          const mostrarRemetente = recebida && conversa.isGroup && mensagem.remetente
          return (
            <motion.div
              key={`${formatarHorario(mensagem.timestamp)}-${index}`}
              initial={{ opacity: 0, transform: reduzirMovimento ? 'translateY(0)' : 'translateY(4px)' }}
              animate={{ opacity: 1, transform: 'translateY(0)' }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={`group flex items-end gap-1.5 ${recebida ? 'justify-start' : 'justify-end'}`}
              style={{ marginBottom: 10 }}
            >
              {!recebida && (
                <button
                  type="button"
                  onClick={() => setIndiceParaExcluir(index)}
                  aria-label="Excluir mensagem"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: '#9A9DA4', flexShrink: 0 }}
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                </button>
              )}
              <div style={{ maxWidth: '76%' }}>
                {mostrarRemetente && (
                  <p style={{ color: corRemetente(mensagem.remetente), fontSize: '11px', fontWeight: 700, marginBottom: 2, paddingLeft: 2 }}>
                    {mensagem.remetente}
                  </p>
                )}
                <div style={{ padding: '9px 11px 6px', borderRadius: recebida ? '4px 12px 12px 12px' : '12px 4px 12px 12px', backgroundColor: recebida ? '#EFF0F3' : '#FDECE8' }}>
                  <p style={{ color: '#1B1E24', fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{mensagem.texto}</p>
                  <p style={{ color: '#9A9DA4', fontSize: '9px', textAlign: 'right', marginTop: 3 }}>{formatarHorario(mensagem.timestamp)}</p>
                </div>
              </div>
              {recebida && (
                <button
                  type="button"
                  onClick={() => setIndiceParaExcluir(index)}
                  aria-label="Excluir mensagem"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: '#9A9DA4', flexShrink: 0 }}
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                </button>
              )}
            </motion.div>
          )
        })}
        <div ref={fimRef} />
      </div>

      <footer style={{ padding: '12px 14px', borderTop: '1px solid #E4E5E9', backgroundColor: '#FFFFFF' }}>
        {erro && <p role="alert" style={{ color: '#BE3B30', fontSize: '11px', marginBottom: 7 }}>{erro}</p>}
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
        <p style={{ color: '#6B7178', fontSize: '13px' }}>Esta mensagem será removida permanentemente da conversa.</p>
      </Modal>

      <Modal
        isOpen={confirmarExclusaoConversa}
        onClose={() => setConfirmarExclusaoConversa(false)}
        title="Excluir conversa"
        footer={(
          <>
            <button type="button" onClick={() => setConfirmarExclusaoConversa(false)} className="btn-secondary" style={{ height: 36 }}>
              Cancelar
            </button>
            <button type="button" onClick={confirmarExclusaoDaConversa} disabled={excluindoConversa} className="btn-primary" style={{ height: 36 }}>
              {excluindoConversa ? 'Excluindo...' : 'Excluir'}
            </button>
          </>
        )}
      >
        <p style={{ color: '#6B7178', fontSize: '13px' }}>Esta conversa será removida permanentemente, incluindo todas as mensagens.</p>
      </Modal>
    </motion.div>
  )
}
