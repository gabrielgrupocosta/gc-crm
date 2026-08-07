import { useState, useEffect } from 'react'
import {
  ChevronDown, ChevronUp, Megaphone, UtensilsCrossed, Clock, Tag, Percent, Zap,
} from 'lucide-react'
import { BarChart, Bar, LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import PlatformBadge from './PlatformBadge'
import { calcularTempoDeGestao } from '../../utils/gestaoTempo'

// ─── Constants ──────────────────────────────────────────────────────────────

const COR_DESTAQUE = '#FF4B2E'

// Paleta de texto desta seção — deliberadamente mais escura que o padrão
// "faint" do design system (#BBBBBB), porque aqui os labels carregam dado
// (não são placeholder/decoração): #999999 é o piso pra qualquer texto que
// precisa ser lido, não só notado.
const TXT_LABEL      = '#767676' // labels de campo (Faturamento, Pedidos, datas)
const TXT_EYEBROW    = '#5C5C5C' // labels de seção uppercase (headers das subseções)
const TXT_SECUNDARIO = '#3D3D3D' // valores secundários (pedidos, ticket, nota)

const ICONE_POR_CATEGORIA = {
  'promoção':               Megaphone,
  'promocao':                Megaphone,
  'ajuste de cardápio':      UtensilsCrossed,
  'ajuste de cardapio':      UtensilsCrossed,
  'configuração de horário': Clock,
  'configuracao de horario': Clock,
  'cupom':                   Tag,
  'preço':                   Percent,
  'preco':                   Percent,
}

function formatBRL(n) {
  if (n == null || isNaN(n)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function formatDate(d) {
  if (!d) return '—'
  const date = d?.toDate ? d.toDate() : new Date(d)
  return date.toLocaleDateString('pt-BR')
}

// ─── VariacaoBadge ──────────────────────────────────────────────────────────

function VariacaoBadge({ atual, anterior, size = 'sm' }) {
  if (atual == null || anterior == null) {
    return <span className="text-[11px] font-semibold" style={{ color: TXT_LABEL }}>— sem comparação</span>
  }
  const diff = atual - anterior
  const pct = anterior !== 0 ? (diff / Math.abs(anterior)) * 100 : 0
  const positivo = diff > 0
  const negativo = diff < 0
  const cor = positivo ? '#00A67D' : negativo ? '#DC2626' : '#767676'
  const seta = positivo ? '▲' : negativo ? '▼' : '—'

  return (
    <span
      className="font-mono font-extrabold"
      style={{ color: cor, fontSize: size === 'lg' ? '20px' : '12px', fontVariantNumeric: 'tabular-nums' }}
    >
      {seta} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

// ─── WeekColumn ─────────────────────────────────────────────────────────────

function WeekColumn({ week, weekAnterior, faturamentoInicial, indice }) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-lg flex-1 min-w-0"
      style={{
        padding: '14px 16px',
        border: '1px solid #E5E5E5',
        backgroundColor: '#FFFFFF',
      }}
    >
      <p
        className="font-extrabold uppercase"
        style={{ fontSize: '10px', letterSpacing: '0.07em', color: '#8A8A8A' }}
      >
        {week.weekLabel ?? `Sem ${indice + 1}`}
      </p>

      <div className="w-full flex items-stretch justify-center gap-3" style={{ padding: '2px 0' }}>
        <div className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
          <span className="font-semibold" style={{ fontSize: '10px', color: TXT_LABEL, textAlign: 'center' }}>Cresc. na semana</span>
          <VariacaoBadge atual={week.revenue} anterior={weekAnterior?.revenue} />
        </div>
        <div style={{ width: '1px', alignSelf: 'stretch', backgroundColor: '#E5E5E5' }} />
        <div className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
          <span className="font-semibold" style={{ fontSize: '10px', color: TXT_LABEL, textAlign: 'center' }}>Desde o início</span>
          <VariacaoBadge atual={week.revenue} anterior={faturamentoInicial} />
        </div>
      </div>

      <div className="w-full flex flex-col gap-1.5 mt-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold" style={{ fontSize: '11px', color: TXT_LABEL }}>Faturamento</span>
          <span
            className="font-mono truncate"
            style={{ fontSize: '13px', fontWeight: 800, color: '#111111' }}
          >
            {formatBRL(week.revenue)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold" style={{ fontSize: '11px', color: TXT_LABEL }}>Pedidos</span>
          <span className="font-mono font-bold" style={{ fontSize: '12px', color: TXT_SECUNDARIO }}>{week.orders ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold" style={{ fontSize: '11px', color: TXT_LABEL }}>Ticket médio</span>
          <span className="font-mono font-bold" style={{ fontSize: '12px', color: TXT_SECUNDARIO }}>{formatBRL(week.avgTicket)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold" style={{ fontSize: '11px', color: TXT_LABEL }}>Nota</span>
          <span className="font-mono font-bold" style={{ fontSize: '12px', color: TXT_SECUNDARIO }}>{week.rating != null ? week.rating.toFixed(1) : '—'}</span>
        </div>
      </div>
    </div>
  )
}

// ─── ManagerActionsSection ──────────────────────────────────────────────────

function ManagerActionsSection({ managerActions, totalActionsCount, onLoadMoreActions }) {
  const [expanded,            setExpanded]            = useState(true)
  const [visibleActionsCount, setVisibleActionsCount] = useState(5)
  const [loadingMore,         setLoadingMore]         = useState(false)

  const acoesVisiveis = managerActions.slice(0, visibleActionsCount)
  const temMais = visibleActionsCount < (totalActionsCount ?? managerActions.length)

  async function handleCarregarMais() {
    const proximoCount = visibleActionsCount + 5
    // Só busca mais dados do backend se ainda não temos itens suficientes
    // carregados localmente pra cobrir o próximo passo — evita chamadas
    // repetidas quando o array já tem itens de sobra.
    if (proximoCount > managerActions.length && managerActions.length < (totalActionsCount ?? Infinity)) {
      setLoadingMore(true)
      try {
        await onLoadMoreActions?.()
      } finally {
        setLoadingMore(false)
      }
    }
    setVisibleActionsCount(proximoCount)
  }

  return (
    <div style={{ borderTop: '1px solid #E5E5E5', paddingTop: '20px' }}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <p className="font-extrabold uppercase" style={{ fontSize: '11px', letterSpacing: '0.06em', color: TXT_EYEBROW }}>
          Últimas ações do gestor
        </p>
        {expanded ? <ChevronUp size={15} strokeWidth={2.5} style={{ color: '#8A8A8A' }} /> : <ChevronDown size={15} strokeWidth={2.5} style={{ color: '#8A8A8A' }} />}
      </button>

      {expanded && (
        <div className="flex flex-col gap-1 mt-3">
          {acoesVisiveis.length === 0 ? (
            <p style={{ fontSize: '12px', color: TXT_LABEL, padding: '8px 0' }}>Nenhuma ação registrada ainda.</p>
          ) : (
            acoesVisiveis.map((action, i) => {
              const chave = (action.category ?? '').toLowerCase()
              const Icone = ICONE_POR_CATEGORIA[chave] ?? Zap
              const recente = i === 0

              return (
                <div
                  key={action.id}
                  className="flex items-start gap-3 rounded-md transition-colors duration-150"
                  style={{
                    padding: '8px 10px',
                    backgroundColor: recente ? '#FFF3EF' : 'transparent',
                  }}
                >
                  <div
                    className="shrink-0 flex items-center justify-center mt-0.5"
                    style={{
                      width: '24px', height: '24px', borderRadius: '6px',
                      backgroundColor: recente ? '#FFE1D5' : '#EEEEEE',
                    }}
                  >
                    <Icone size={12} strokeWidth={2.5} style={{ color: recente ? COR_DESTAQUE : '#6B6B6B' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ fontSize: '13px', color: '#111111', fontWeight: recente ? 800 : 600 }}>
                        {action.description}
                      </span>
                      {action.category && (
                        <span
                          className="font-bold uppercase"
                          style={{ fontSize: '9px', letterSpacing: '0.04em', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#EEEEEE', color: '#5C5C5C' }}
                        >
                          {action.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-medium" style={{ fontSize: '11px', color: TXT_LABEL }}>{formatDate(action.date)}</span>
                      {action.impact && (
                        <span
                          className="font-bold uppercase"
                          style={{ fontSize: '10px', letterSpacing: '0.03em', color: '#00A67D' }}
                        >
                          {action.impact}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}

          {temMais && (
            <button
              type="button"
              onClick={handleCarregarMais}
              disabled={loadingMore}
              className="self-start font-extrabold transition-opacity duration-150"
              style={{ fontSize: '12px', marginTop: '4px', padding: '6px 10px', borderRadius: '6px', color: COR_DESTAQUE, opacity: loadingMore ? 0.6 : 1 }}
            >
              {loadingMore ? 'Carregando…' : 'Carregar mais'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── BaselineComparisonSection ──────────────────────────────────────────────

function BaselineComparisonSection({ baseline, weeklyPerformance }) {
  const [mode, setMode] = useState('7d')

  const base = baseline?.first7Days
  const atual = mode === '7d' ? baseline?.last7Days : baseline?.last30Days

  const dadosBarras = [
    { name: 'Linha de base', valor: base?.revenue ?? 0, cor: '#D6D6D6' },
    { name: 'Atual',         valor: atual?.revenue ?? 0, cor: COR_DESTAQUE },
  ]

  const dadosEvolucao = (weeklyPerformance ?? []).map(w => ({ name: w.weekLabel, valor: w.revenue ?? 0 }))

  return (
    <div style={{ borderTop: '1px solid #E5E5E5', paddingTop: '20px' }}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <p className="font-extrabold uppercase" style={{ fontSize: '11px', letterSpacing: '0.06em', color: TXT_EYEBROW }}>
          Crescimento vs. linha de base
        </p>
        <div className="inline-flex rounded-md p-0.5" style={{ border: '1px solid #E0E0E0' }}>
          {[['7d', '7 dias'], ['30d', '30 dias']].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className="font-extrabold transition-colors duration-150"
              style={{
                fontSize: '11px', padding: '4px 12px', borderRadius: '4px',
                backgroundColor: mode === key ? COR_DESTAQUE : 'transparent',
                color: mode === key ? '#FFFFFF' : '#6B6B6B',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Destaque: variação de faturamento é a métrica primária desta seção */}
      <div className="flex items-end justify-between flex-wrap gap-3 mb-5" style={{ padding: '14px 16px', borderRadius: '10px', backgroundColor: '#F5F5F5' }}>
        <div>
          <p className="font-semibold" style={{ fontSize: '11px', color: TXT_LABEL, marginBottom: '2px' }}>
            Faturamento — linha de base → {mode === '7d' ? '7 dias' : '30 dias'}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-mono font-semibold" style={{ fontSize: '13px', color: TXT_SECUNDARIO }}>{formatBRL(base?.revenue)}</span>
            <span style={{ color: '#B0B0B0' }}>→</span>
            <span className="font-mono font-extrabold" style={{ fontSize: '20px', color: '#111111' }}>{formatBRL(atual?.revenue)}</span>
          </div>
        </div>
        <VariacaoBadge atual={atual?.revenue} anterior={base?.revenue} size="lg" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-2">
          {[
            { label: 'Pedidos', baseVal: base?.orders, atualVal: atual?.orders, fmt: v => v ?? '—' },
            { label: 'Nota',    baseVal: base?.rating,  atualVal: atual?.rating,  fmt: v => v != null ? v.toFixed(1) : '—' },
          ].map(linha => (
            <div key={linha.label} className="flex items-center justify-between" style={{ padding: '8px 10px', borderRadius: '8px', backgroundColor: '#F5F5F5' }}>
              <div>
                <p className="font-semibold" style={{ fontSize: '11px', color: TXT_LABEL }}>{linha.label}</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="font-mono font-semibold" style={{ fontSize: '11px', color: TXT_SECUNDARIO }}>{linha.fmt(linha.baseVal)}</span>
                  <span style={{ color: '#B0B0B0', fontSize: '11px' }}>→</span>
                  <span className="font-mono font-extrabold" style={{ fontSize: '13px', color: '#111111' }}>{linha.fmt(linha.atualVal)}</span>
                </div>
              </div>
              <VariacaoBadge atual={linha.atualVal} anterior={linha.baseVal} />
            </div>
          ))}

          <div style={{ width: '100%', height: 76, marginTop: '4px' }}>
            <ResponsiveContainer>
              <BarChart data={dadosBarras} barSize={40}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B6B6B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis hide domain={[0, 'dataMax']} />
                <Tooltip formatter={v => formatBRL(v)} />
                <Bar dataKey="valor" radius={[5, 5, 0, 0]}>
                  {dadosBarras.map((d, i) => <Cell key={i} fill={d.cor} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col">
          {dadosEvolucao.length > 1 && (
            <div>
              <p className="font-semibold" style={{ fontSize: '10px', color: TXT_LABEL, marginBottom: '4px' }}>Evolução (semanas exibidas acima)</p>
              <div style={{ width: '100%', height: 130 }}>
                <ResponsiveContainer>
                  <LineChart data={dadosEvolucao}>
                    <YAxis hide domain={['dataMin - 100', 'dataMax + 100']} />
                    <Line type="monotone" dataKey="valor" stroke={COR_DESTAQUE} strokeWidth={2} dot={false} />
                    <Tooltip formatter={v => formatBRL(v)} labelFormatter={() => ''} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── GestorPerformanceCard ──────────────────────────────────────────────────

/**
 * Card de performance do gestor pra um cliente — resumo das últimas 4
 * semanas, histórico de ações e comparação com a linha de base desde o
 * início da gestão.
 *
 * @param {Object} props
 * @param {Object} props.cliente - { id, nome, plataformas: string[], dataInicioGestao?: Timestamp }
 *   `id` é obrigatório: é usado pra resolver o tempo de gestão via
 *   calcularTempoDeGestao(), que consulta contratos/lojas no Firestore
 *   internamente (não depende de `dataInicioGestao` já vir pronto).
 * @param {Array<{ weekLabel: string, revenue: number, orders: number, avgTicket: number, rating: number }>} props.weeklyPerformance
 *   Ordenado da semana mais antiga (índice 0, "Sem 1") pra mais recente (último índice, "Sem 4").
 * @param {Array<{ id: string, date: (Timestamp|Date|string), category: string, description: string, impact?: string }>} props.managerActions
 *   Ordenado da ação mais recente pra mais antiga.
 * @param {number} props.totalActionsCount - total de ações existentes (pra saber quando esconder "Carregar mais")
 * @param {{ first7Days: Object, last7Days: Object, last30Days: Object }} props.baseline
 *   Cada bucket: { revenue: number, orders: number, rating: number }
 * @param {() => Promise<void>} props.onLoadMoreActions - busca +5 ações e atualiza `managerActions` no componente pai
 */
export default function GestorPerformanceCard({
  cliente,
  weeklyPerformance = [],
  managerActions = [],
  totalActionsCount = 0,
  baseline,
  onLoadMoreActions,
}) {
  const [tempoGestao, setTempoGestao] = useState(null)

  useEffect(() => {
    if (!cliente?.id) return
    let cancelado = false
    calcularTempoDeGestao(cliente.id, cliente.organizacaoId).then(resultado => {
      if (!cancelado) setTempoGestao(resultado.label)
    })
    return () => { cancelado = true }
  }, [cliente?.id, cliente?.organizacaoId])

  const tempoGestaoLabel = !cliente?.id
    ? 'Tempo de gestão não disponível'
    : (tempoGestao ?? 'Carregando…')

  return (
    <div className="bg-white rounded-xl p-6 flex flex-col gap-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {/* ── Cabeçalho do cliente — nome é a âncora visual, resto é apoio ── */}
      <div className="flex flex-col gap-2" style={{ paddingBottom: '4px', borderBottom: '1px solid #E5E5E5' }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-0.02em', color: '#111111' }}>{cliente?.nome ?? '—'}</h2>
          <div className="flex items-center gap-1.5">
            {(cliente?.plataformas ?? []).map(p => <PlatformBadge key={p} plataforma={p} />)}
          </div>
        </div>
        <p className="font-bold uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em', color: TXT_EYEBROW, paddingBottom: '14px' }}>
          {tempoGestaoLabel}
        </p>
      </div>

      {/* ── 1. Desempenho das últimas 4 semanas — seção primária ── */}
      <div>
        <p className="font-extrabold uppercase" style={{ fontSize: '11px', letterSpacing: '0.06em', color: TXT_EYEBROW, marginBottom: '12px' }}>
          Desempenho semanal
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Exibida da mais recente pra mais antiga — por enquanto não há
              conceito de "semana atual" em andamento, o primeiro card já é a
              semana anterior fechada. A comparação de cada card ainda usa a
              semana cronologicamente anterior (índice - 1 no array original). */}
          {weeklyPerformance.map((_, i) => weeklyPerformance.length - 1 - i).map(indiceOriginal => (
            <WeekColumn
              key={weeklyPerformance[indiceOriginal].weekLabel ?? indiceOriginal}
              week={weeklyPerformance[indiceOriginal]}
              weekAnterior={weeklyPerformance[indiceOriginal - 1]}
              faturamentoInicial={baseline?.first7Days?.revenue ?? weeklyPerformance[0]?.revenue}
              indice={indiceOriginal}
            />
          ))}
          {weeklyPerformance.length === 0 && (
            <p style={{ fontSize: '12px', color: TXT_LABEL, padding: '16px 0' }}>Sem dados de desempenho semanal ainda.</p>
          )}
        </div>
      </div>

      {/* ── 2. Últimas ações do gestor — apoio ── */}
      <ManagerActionsSection
        managerActions={managerActions}
        totalActionsCount={totalActionsCount}
        onLoadMoreActions={onLoadMoreActions}
      />

      {/* ── 3. Crescimento vs. linha de base — narrativa de longo prazo ── */}
      {baseline && (
        <BaselineComparisonSection baseline={baseline} weeklyPerformance={weeklyPerformance} />
      )}
    </div>
  )
}
