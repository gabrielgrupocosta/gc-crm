import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import ConversaCard, { COLUNAS, STATUS_LABELS } from './ConversaCard'
import ConversaDetalhe from './ConversaDetalhe'
import { useConversas } from './useConversas'

const FILTROS = [
  { value: 'todas', label: 'Todos os status' },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
]

export default function WhatsappPanel() {
  const { conversas, loading, mudarColuna, mudarStatus, marcarLida, excluirMensagem } = useConversas()
  const [filtro, setFiltro] = useState('todas')
  const [busca, setBusca] = useState('')
  const [categoriaAtiva, setCategoriaAtiva] = useState('todas')
  const [idSelecionado, setIdSelecionado] = useState(null)
  const [colunaEmHover, setColunaEmHover] = useState(null)

  function soltarNaColuna(event, coluna) {
    event.preventDefault()
    setColunaEmHover(null)
    const id = event.dataTransfer.getData('text/plain')
    const conversa = conversas.find(item => item.id === id)
    if (id && conversa && conversa.coluna !== coluna) mudarColuna(id, coluna).catch(() => {})
  }

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return conversas.filter(conversa => {
      const atendeStatus = filtro === 'todas' || conversa.status === filtro
      const atendeBusca = !termo
        || (conversa.nome ?? '').toLocaleLowerCase('pt-BR').includes(termo)
        || (conversa.ultimaMensagem ?? '').toLocaleLowerCase('pt-BR').includes(termo)
      return atendeStatus && atendeBusca
    })
  }, [busca, conversas, filtro])

  const contagemPorColuna = useMemo(() => Object.fromEntries(
    COLUNAS.map(coluna => [coluna.value, filtradas.filter(conversa => conversa.coluna === coluna.value).length]),
  ), [filtradas])

  const listadas = useMemo(
    () => categoriaAtiva === 'todas' ? filtradas : filtradas.filter(conversa => conversa.coluna === categoriaAtiva),
    [categoriaAtiva, filtradas],
  )

  const selecionada = conversas.find(conversa => conversa.id === idSelecionado) ?? null

  function selecionar(conversa) {
    setIdSelecionado(conversa.id)
    if (conversa.lida === false) marcarLida(conversa.id).catch(() => {})
  }

  return (
    <motion.div
      initial={{ opacity: 0, transform: 'translateY(4px)' }}
      animate={{ opacity: 1, transform: 'translateY(0)' }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex h-full min-h-0 flex-col font-sans"
      style={{ padding: '24px 20px', backgroundColor: '#FAFAFA' }}
    >
      <div className="page-header">
        <h1 className="page-title">WhatsApp</h1>
        <p style={{ color: '#666666', fontSize: '13px', marginTop: 4 }}>Organize contatos e acompanhe cada conversa.</p>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden" style={{ marginTop: 18 }}>
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-border bg-white">
            <p style={{ color: '#999999', fontSize: '12px' }}>Carregando conversas...</p>
          </div>
        ) : (
          <div className="flex h-full min-h-0 overflow-hidden rounded-lg border border-border bg-white">
            <nav className="flex min-h-0 flex-shrink-0 flex-col overflow-y-auto" style={{ width: 152, padding: 10, borderRight: '1px solid #E8E8E8', backgroundColor: '#FAFAFA' }}>
              <button
                type="button"
                onClick={() => setCategoriaAtiva('todas')}
                className="flex w-full items-center justify-between rounded-md text-left"
                style={{
                  padding: '8px 10px', marginBottom: 2, fontSize: '12px', fontWeight: 600,
                  color: categoriaAtiva === 'todas' ? '#FF4B2E' : '#111111',
                  backgroundColor: categoriaAtiva === 'todas' ? 'rgba(255,75,46,0.1)' : 'transparent',
                }}
              >
                <span>Todas</span>
                <span style={{ color: '#999999', fontSize: '11px', fontWeight: 500 }}>{filtradas.length}</span>
              </button>

              {COLUNAS.map(coluna => (
                <button
                  key={coluna.value}
                  type="button"
                  onClick={() => setCategoriaAtiva(coluna.value)}
                  onDragOver={event => { event.preventDefault(); if (colunaEmHover !== coluna.value) setColunaEmHover(coluna.value) }}
                  onDragLeave={() => setColunaEmHover(atual => (atual === coluna.value ? null : atual))}
                  onDrop={event => soltarNaColuna(event, coluna.value)}
                  className="flex w-full items-center gap-2 rounded-md text-left"
                  style={{
                    padding: '8px 10px', marginBottom: 2, fontSize: '12px', fontWeight: 500,
                    color: categoriaAtiva === coluna.value || colunaEmHover === coluna.value ? coluna.cor : '#333333',
                    backgroundColor: categoriaAtiva === coluna.value || colunaEmHover === coluna.value ? `${coluna.cor}14` : 'transparent',
                    border: colunaEmHover === coluna.value ? `1px dashed ${coluna.cor}` : '1px solid transparent',
                  }}
                >
                  <span style={{ width: 7, height: 7, flexShrink: 0, borderRadius: '50%', backgroundColor: coluna.cor }} />
                  <span className="min-w-0 flex-1 truncate">{coluna.label}</span>
                  <span style={{ flexShrink: 0, color: '#999999', fontSize: '11px', fontWeight: 500 }}>{contagemPorColuna[coluna.value] ?? 0}</span>
                </button>
              ))}
            </nav>

            <div className="flex min-h-0 flex-shrink-0 flex-col" style={{ width: 320, borderRight: '1px solid #E8E8E8' }}>
              <div className="flex flex-col gap-2" style={{ padding: 12, borderBottom: '1px solid #E8E8E8' }}>
                <div className="relative">
                  <Search size={14} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2" color="#999999" />
                  <input value={busca} onChange={event => setBusca(event.target.value)} className="input w-full font-sans" style={{ height: 36, paddingLeft: 32 }} placeholder="Buscar conversa" aria-label="Buscar conversas" />
                </div>
                <select value={filtro} onChange={event => setFiltro(event.target.value)} className="select w-full font-sans" aria-label="Filtrar por status" style={{ height: 34 }}>
                  {FILTROS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: 8 }}>
                {listadas.map(conversa => (
                  <div key={conversa.id} style={{ marginBottom: 6 }}>
                    <ConversaCard conversa={conversa} selecionada={conversa.id === idSelecionado} onSelect={() => selecionar(conversa)} />
                  </div>
                ))}
                {listadas.length === 0 && (
                  <p className="text-center" style={{ color: '#AAAAAA', fontSize: '11px', padding: '22px 8px' }}>Nenhuma conversa</p>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1">
              <ConversaDetalhe
                conversa={selecionada}
                onClose={() => setIdSelecionado(null)}
                mudarColuna={mudarColuna}
                mudarStatus={mudarStatus}
                excluirMensagem={excluirMensagem}
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
