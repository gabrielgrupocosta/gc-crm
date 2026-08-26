import { useMemo, useState } from 'react'
import { motion, Reorder } from 'framer-motion'
import { Search, SlidersHorizontal } from 'lucide-react'
import ConversaCard, { COLUNAS, STATUS_LABELS } from './ConversaCard'
import ConversaDetalhe from './ConversaDetalhe'
import { useConversas } from './useConversas'

const FILTROS = [
  { value: 'todas', label: 'Todos os status' },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
]

const ORDEM_STORAGE_KEY = 'whatsapp_ordem_categorias'

function lerOrdemSalva() {
  try {
    const bruto = localStorage.getItem(ORDEM_STORAGE_KEY)
    const valores = bruto ? JSON.parse(bruto) : null
    return Array.isArray(valores) ? valores : null
  } catch {
    return null
  }
}

function ordenarColunas(valoresSalvos) {
  if (!valoresSalvos) return COLUNAS
  const porValue = new Map(COLUNAS.map(coluna => [coluna.value, coluna]))
  const ordenadas = valoresSalvos.map(value => porValue.get(value)).filter(Boolean)
  const faltando = COLUNAS.filter(coluna => !valoresSalvos.includes(coluna.value))
  return [...ordenadas, ...faltando]
}

export default function WhatsappPanel() {
  const { conversas, loading, mudarColuna, mudarStatus, marcarLida, excluirMensagem, excluirConversa } = useConversas()
  const [filtro, setFiltro] = useState('todas')
  const [busca, setBusca] = useState('')
  const [categoriaAtiva, setCategoriaAtiva] = useState('todas')
  const [idSelecionado, setIdSelecionado] = useState(null)
  const [colunaEmHover, setColunaEmHover] = useState(null)
  const [categoriasVisiveis, setCategoriasVisiveis] = useState(() => Object.fromEntries(COLUNAS.map(coluna => [coluna.value, true])))
  const [filtroAberto, setFiltroAberto] = useState(false)
  const [categoriaSobMouse, setCategoriaSobMouse] = useState(null)
  const [ordemColunas, setOrdemColunas] = useState(() => ordenarColunas(lerOrdemSalva()))

  function alternarCategoriaVisivel(value) {
    setCategoriasVisiveis(atual => ({ ...atual, [value]: !atual[value] }))
  }

  function handleReorderColunas(novaOrdem) {
    setOrdemColunas(novaOrdem)
    try {
      localStorage.setItem(ORDEM_STORAGE_KEY, JSON.stringify(novaOrdem.map(coluna => coluna.value)))
    } catch {
      // localStorage indisponível (modo privado, quota) — ordem só vale para esta sessão
    }
  }

  function resolverAlerta(id) {
    return mudarColuna(id, 'importantes')
  }

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

  const visiveisEmTodas = useMemo(
    () => filtradas.filter(conversa => categoriasVisiveis[conversa.coluna] !== false),
    [filtradas, categoriasVisiveis],
  )

  const listadas = categoriaAtiva === 'todas'
    ? visiveisEmTodas
    : filtradas.filter(conversa => conversa.coluna === categoriaAtiva)

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
        <p style={{ color: '#6B7178', fontSize: '13px', marginTop: 4 }}>Organize contatos e acompanhe cada conversa.</p>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden" style={{ marginTop: 18 }}>
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-border bg-white">
            <p style={{ color: '#9A9DA4', fontSize: '12px' }}>Carregando conversas...</p>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-white md:flex-row">
            {!idSelecionado && (
              <div className="flex flex-shrink-0 items-center gap-2 overflow-x-auto md:hidden" style={{ padding: '10px 12px', borderBottom: '1px solid #E4E5E9', backgroundColor: '#F0F1F4' }}>
                <button
                  type="button"
                  onClick={() => setCategoriaAtiva('todas')}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-full"
                  style={{
                    padding: '6px 12px', fontSize: '12px', fontWeight: 700,
                    color: categoriaAtiva === 'todas' ? '#FFFFFF' : '#1B1E24',
                    backgroundColor: categoriaAtiva === 'todas' ? '#E8503A' : '#FFFFFF',
                    border: `1px solid ${categoriaAtiva === 'todas' ? '#E8503A' : '#E4E5E9'}`,
                  }}
                >
                  Todas
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: 18, height: 16, padding: '0 5px', borderRadius: 999,
                      color: categoriaAtiva === 'todas' ? '#FFFFFF' : '#6B7178',
                      backgroundColor: categoriaAtiva === 'todas' ? 'rgba(255,255,255,0.25)' : '#E4E5E9',
                      fontSize: '10px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {visiveisEmTodas.length}
                  </span>
                </button>
                {ordemColunas.map(coluna => {
                  const ativa = categoriaAtiva === coluna.value
                  return (
                    <button
                      key={coluna.value}
                      type="button"
                      onClick={() => setCategoriaAtiva(coluna.value)}
                      className="flex flex-shrink-0 items-center gap-1.5 rounded-full"
                      style={{
                        padding: '6px 12px', fontSize: '12px', fontWeight: 600,
                        color: ativa ? '#FFFFFF' : '#1B1E24',
                        backgroundColor: ativa ? coluna.cor : '#FFFFFF',
                        border: `1px solid ${ativa ? coluna.cor : '#E4E5E9'}`,
                      }}
                    >
                      <span style={{ width: 6, height: 6, flexShrink: 0, borderRadius: '50%', backgroundColor: ativa ? '#FFFFFF' : coluna.cor }} />
                      {coluna.label}
                      <span
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          minWidth: 18, height: 16, padding: '0 5px', borderRadius: 999,
                          color: ativa ? '#FFFFFF' : '#6B7178',
                          backgroundColor: ativa ? 'rgba(255,255,255,0.25)' : '#E4E5E9',
                          fontSize: '10px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {contagemPorColuna[coluna.value] ?? 0}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            <nav className="relative hidden min-h-0 flex-shrink-0 flex-col overflow-y-auto md:flex" style={{ width: 156, padding: '10px 8px', borderRight: '1px solid #E4E5E9', backgroundColor: '#F0F1F4' }}>
              <div className="flex items-center gap-1" style={{ marginBottom: 4, paddingLeft: 2 }}>
                <button
                  type="button"
                  onClick={() => setCategoriaAtiva('todas')}
                  className="flex min-w-0 flex-1 items-center justify-between rounded-md text-left"
                  style={{
                    padding: '8px 10px', fontSize: '12px', fontWeight: 700,
                    color: categoriaAtiva === 'todas' ? '#E8503A' : '#1B1E24',
                    backgroundColor: categoriaAtiva === 'todas' ? '#E8503A14' : 'transparent',
                  }}
                >
                  <span>Todas</span>
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: 20, height: 18, padding: '0 5px', borderRadius: 999,
                      color: categoriaAtiva === 'todas' ? '#E8503A' : '#6B7178',
                      backgroundColor: categoriaAtiva === 'todas' ? '#E8503A1F' : '#E4E5E9',
                      fontSize: '10px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                      boxShadow: categoriaAtiva === 'todas' ? 'inset 0 0 0 1px #E8503A33' : 'none',
                    }}
                  >
                    {visiveisEmTodas.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroAberto(aberto => !aberto)}
                  aria-label="Escolher categorias exibidas em Todas"
                  aria-expanded={filtroAberto}
                  className="flex flex-shrink-0 items-center justify-center rounded-md"
                  style={{ width: 26, height: 26, color: filtroAberto ? '#E8503A' : '#9A9DA4', backgroundColor: filtroAberto ? '#E8503A14' : 'transparent' }}
                >
                  <SlidersHorizontal size={13} strokeWidth={1.75} />
                </button>
              </div>

              {filtroAberto && (
                <>
                  <button
                    type="button"
                    aria-label="Fechar filtro de categorias"
                    onClick={() => setFiltroAberto(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 20, cursor: 'default' }}
                  />
                  <div
                    className="absolute"
                    style={{
                      top: 38, left: 10, zIndex: 21, width: 190, padding: 10, borderRadius: 10,
                      border: '1px solid #E4E5E9', backgroundColor: '#FFFFFF', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  >
                    <p style={{ color: '#9A9DA4', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                      Exibir em &quot;Todas&quot;
                    </p>
                    {ordemColunas.map(coluna => (
                      <label key={coluna.value} className="flex cursor-pointer items-center gap-2" style={{ padding: '4px 2px' }}>
                        <input
                          type="checkbox"
                          checked={categoriasVisiveis[coluna.value] !== false}
                          onChange={() => alternarCategoriaVisivel(coluna.value)}
                          style={{ accentColor: coluna.cor, width: 13, height: 13 }}
                        />
                        <span style={{ width: 7, height: 7, flexShrink: 0, borderRadius: '50%', backgroundColor: coluna.cor }} />
                        <span style={{ color: '#1B1E24', fontSize: '12px', fontWeight: 500 }}>{coluna.label}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}

              <Reorder.Group as="div" axis="y" values={ordemColunas} onReorder={handleReorderColunas}>
                {ordemColunas.map((coluna, index) => {
                  const destacado = categoriaAtiva === coluna.value || categoriaSobMouse === coluna.value || colunaEmHover === coluna.value
                  const recuo = 4 + (index % 3) * 5
                  return (
                    <Reorder.Item
                      key={coluna.value}
                      value={coluna}
                      as="div"
                      whileDrag={{ scale: 1.03, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 1 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      style={{ position: 'relative' }}
                    >
                      <button
                        type="button"
                        onClick={() => setCategoriaAtiva(coluna.value)}
                        onMouseEnter={() => setCategoriaSobMouse(coluna.value)}
                        onMouseLeave={() => setCategoriaSobMouse(atual => (atual === coluna.value ? null : atual))}
                        onDragOver={event => {
                          event.preventDefault()
                          if (colunaEmHover !== coluna.value) setColunaEmHover(coluna.value)
                        }}
                        onDragLeave={() => {
                          setColunaEmHover(atual => (atual === coluna.value ? null : atual))
                        }}
                        onDrop={event => {
                          event.preventDefault()
                          soltarNaColuna(event, coluna.value)
                          setColunaEmHover(null)
                        }}
                        className="flex w-full items-center gap-2 text-left"
                        style={{
                          padding: '8px 10px', marginBottom: 3, fontSize: '12px', fontWeight: 500,
                          marginLeft: destacado ? 0 : recuo,
                          width: destacado ? '100%' : `calc(100% - ${recuo}px)`,
                          borderRadius: '0 8px 8px 0',
                          color: destacado ? coluna.cor : '#1B1E24',
                          backgroundColor: destacado ? `${coluna.cor}14` : 'transparent',
                          border: colunaEmHover === coluna.value ? `1px dashed ${coluna.cor}` : '1px solid transparent',
                          cursor: 'grab',
                          transition: 'margin-left 0.15s ease-out, width 0.15s ease-out, background-color 0.15s ease-out, color 0.15s ease-out',
                        }}
                      >
                        <span style={{ width: 7, height: 7, flexShrink: 0, borderRadius: '50%', backgroundColor: coluna.cor }} />
                        <span className="min-w-0 flex-1 truncate">{coluna.label}</span>
                        <span
                          style={{
                            flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            minWidth: 20, height: 18, padding: '0 5px', borderRadius: 999,
                            color: destacado ? coluna.cor : '#6B7178',
                            backgroundColor: destacado ? `${coluna.cor}1F` : '#E4E5E9',
                            fontSize: '10px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                            boxShadow: destacado ? `inset 0 0 0 1px ${coluna.cor}33` : 'none',
                          }}
                        >
                          {contagemPorColuna[coluna.value] ?? 0}
                        </span>
                      </button>
                    </Reorder.Item>
                  )
                })}
              </Reorder.Group>
            </nav>

            <div
              className={`min-h-0 w-full flex-1 flex-col md:w-[320px] md:flex-none ${idSelecionado ? 'hidden md:flex' : 'flex'}`}
              style={{ borderRight: '1px solid #E4E5E9' }}
            >
              <div className="flex flex-col gap-2" style={{ padding: 12, borderBottom: '1px solid #E4E5E9' }}>
                <div className="relative">
                  <Search size={14} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2" color="#9A9DA4" />
                  <input value={busca} onChange={event => setBusca(event.target.value)} className="input w-full font-sans" style={{ height: 36, paddingLeft: 32 }} placeholder="Buscar conversa" aria-label="Buscar conversas" />
                </div>
                <select value={filtro} onChange={event => setFiltro(event.target.value)} className="select w-full font-sans" aria-label="Filtrar por status" style={{ height: 34 }}>
                  {FILTROS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: 8 }}>
                {listadas.map(conversa => (
                  <div key={conversa.id} style={{ marginBottom: 6 }}>
                    <ConversaCard conversa={conversa} selecionada={conversa.id === idSelecionado} onSelect={() => selecionar(conversa)} onResolverAlerta={() => resolverAlerta(conversa.id)} />
                  </div>
                ))}
                {listadas.length === 0 && (
                  <p className="text-center" style={{ color: '#9A9DA4', fontSize: '11px', padding: '22px 8px' }}>Nenhuma conversa</p>
                )}
              </div>
            </div>

            <div className={`min-h-0 w-full flex-1 ${idSelecionado ? '' : 'hidden md:block'}`}>
              <ConversaDetalhe
                conversa={selecionada}
                onClose={() => setIdSelecionado(null)}
                mudarColuna={mudarColuna}
                mudarStatus={mudarStatus}
                excluirMensagem={excluirMensagem}
                excluirConversa={excluirConversa}
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
