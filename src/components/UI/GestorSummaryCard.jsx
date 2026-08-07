import { Megaphone, UtensilsCrossed, Clock, Tag, Percent, Zap, ArrowRight } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import PlatformBadge from './PlatformBadge'
import VarBadge from './VarBadge'

// ─── Constants ──────────────────────────────────────────────────────────────

const COR_DESTAQUE = '#FF4B2E'

// Mesma paleta de identidade por plataforma usada em Carteira.jsx (seção
// "Distribuição por Plataforma") — mantém os dois lugares do produto com a
// mesma cor pra cada plataforma.
const PLATAFORMA_COLOR = {
  'iFood':  '#EA1D2C',
  '99Food': '#FFD700',
  'Keeta':  '#00B14F',
}
const PLATAFORMA_TEXT_COLOR = {
  'iFood':  '#EA1D2C',
  '99Food': '#B45309',
  'Keeta':  '#00B14F',
}

// Mesma paleta de contraste usada no GestorPerformanceCard — texto "faint"
// padrão do design system (#BBBBBB) não passa no mínimo de legibilidade
// pra labels que carregam dado.
const TXT_LABEL      = '#767676'
const TXT_EYEBROW    = '#5C5C5C'
const TXT_SECUNDARIO = '#3D3D3D'

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

const PERIODO_LABELS = {
  '1semana':  '1 semana',
  '4semanas': '4 semanas',
  '3meses':   'Últimos 3 meses',
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

function formatPct(v) {
  if (v == null) return '—'
  return `${Math.round(v)}%`
}

// ─── VariacaoTag ────────────────────────────────────────────────────────────

function VariacaoTag({ value }) {
  if (value == null) {
    return <span className="text-[11px] font-semibold" style={{ color: TXT_LABEL }}>—</span>
  }
  const positivo = value > 0
  const negativo = value < 0
  const cor  = positivo ? '#00A67D' : negativo ? '#DC2626' : '#767676'
  const seta = positivo ? '▲' : negativo ? '▼' : '—'

  return (
    <span className="font-mono font-extrabold" style={{ color: cor, fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
      {seta} {Math.abs(value).toFixed(1)}%
    </span>
  )
}

// ─── PeriodoSelector ────────────────────────────────────────────────────────

function PeriodoSelector({ periodo, onChange }) {
  return (
    <div className="inline-flex rounded-md p-0.5" style={{ border: '1px solid #E0E0E0' }}>
      {Object.entries(PERIODO_LABELS).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className="font-extrabold transition-colors duration-150"
          style={{
            fontSize: '11px', padding: '4px 12px', borderRadius: '4px', whiteSpace: 'nowrap',
            backgroundColor: periodo === key ? COR_DESTAQUE : 'transparent',
            color: periodo === key ? '#FFFFFF' : '#6B6B6B',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── KpiSection ─────────────────────────────────────────────────────────────

function DistribuicaoTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '6px', padding: '6px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <p style={{ fontSize: '11px', fontWeight: 600, color: '#111111' }}>{p.plataforma}</p>
      <p className="font-mono" style={{ fontSize: '11px', color: '#666666' }}>{p.count} loja{p.count !== 1 ? 's' : ''} · {p.pct.toFixed(0)}%</p>
    </div>
  )
}

function KpiSection({ kpis, loading, periodo, onPeriodoChange }) {
  const { platformBreakdown = [], platformGrowth = [], faturamentoTotal = 0 } = kpis ?? {}
  const totalLojas = platformBreakdown.reduce((s, p) => s + p.count, 0)
  const fatiasComDado = platformBreakdown.filter(p => p.count > 0)

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <p className="font-extrabold uppercase" style={{ fontSize: '11px', letterSpacing: '0.06em', color: TXT_EYEBROW }}>
          Desempenho da carteira
        </p>
        <PeriodoSelector periodo={periodo} onChange={onPeriodoChange} />
      </div>

      {/* Faturamento total — métrica primária */}
      <div className="mb-4" style={{ padding: '14px 16px', borderRadius: '10px', backgroundColor: '#F5F5F5', opacity: loading ? 0.5 : 1, transition: 'opacity 150ms' }}>
        <p className="font-semibold" style={{ fontSize: '11px', color: TXT_LABEL, marginBottom: '2px' }}>
          Faturamento da carteira — {PERIODO_LABELS[periodo]}
        </p>
        <span className="font-mono font-extrabold" style={{ fontSize: '26px', color: '#111111' }}>
          {formatBRL(faturamentoTotal)}
        </span>
      </div>

      <div className="flex flex-col gap-3" style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 150ms' }}>
        {/* Crescimento por plataforma */}
        <div style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid #E5E5E5' }}>
          <p className="font-semibold" style={{ fontSize: '11px', color: TXT_LABEL, marginBottom: '4px' }}>Crescimento por plataforma</p>
          {platformGrowth.length === 0 ? (
            <p style={{ fontSize: '12px', color: TXT_LABEL, padding: '8px 0' }}>Sem dados no período.</p>
          ) : (
            <div className="flex flex-col">
              {platformGrowth.map((p, i) => (
                <div
                  key={p.plataforma}
                  className="flex items-center justify-between"
                  style={{ padding: '10px 0', borderTop: i > 0 ? '1px solid #F0F0F0' : 'none' }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: PLATAFORMA_COLOR[p.plataforma] ?? '#CCCCCC', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>{p.plataforma}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold" style={{ fontSize: '14px', color: '#111111' }}>
                      {formatBRL(p.faturamentoAtual)}
                    </span>
                    {p.growthPct != null ? <VarBadge value={p.growthPct} /> : (
                      <span style={{ fontSize: '11px', color: '#BBBBBB' }}>—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Proporção de lojas por plataforma — donut, mesmo padrão visual de
            "Distribuição por Plataforma" em Carteira.jsx */}
        <div style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid #E5E5E5' }}>
          <p className="font-semibold" style={{ fontSize: '11px', color: TXT_LABEL, marginBottom: '10px' }}>Lojas por plataforma</p>
          {platformBreakdown.length === 0 ? (
            <p style={{ fontSize: '12px', color: TXT_LABEL, padding: '8px 0' }}>Sem lojas atribuídas.</p>
          ) : (
            <div className="flex items-center gap-5">
              <div style={{ width: '104px', height: '104px', position: 'relative', flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fatiasComDado}
                      dataKey="count"
                      nameKey="plataforma"
                      cx="50%" cy="50%"
                      innerRadius={33} outerRadius={50}
                      paddingAngle={fatiasComDado.length > 1 ? 3 : 0}
                      stroke="none"
                    >
                      {fatiasComDado.map(p => (
                        <Cell key={p.plataforma} fill={PLATAFORMA_COLOR[p.plataforma] ?? '#CCCCCC'} />
                      ))}
                    </Pie>
                    <Tooltip content={<DistribuicaoTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span className="font-mono" style={{ fontSize: '18px', fontWeight: 800, color: '#111111', lineHeight: 1 }}>{totalLojas}</span>
                  <span style={{ fontSize: '8.5px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '3px' }}>lojas</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-2.5 min-w-0">
                {platformBreakdown.map(p => (
                  <div key={p.plataforma} className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: PLATAFORMA_COLOR[p.plataforma] ?? '#CCCCCC', flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', fontWeight: 500, color: '#111111' }} className="truncate">{p.plataforma}</span>
                        <span className="font-mono" style={{ fontSize: '10px', color: '#999999' }}>({p.count})</span>
                      </div>
                      <span className="font-mono font-extrabold" style={{ fontSize: '13px', color: PLATAFORMA_TEXT_COLOR[p.plataforma] ?? '#666666', flexShrink: 0 }}>
                        {formatPct(p.pct)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ManagerActionsSection ──────────────────────────────────────────────────

function ManagerActionsSection({ managerActions, loading, hasMoreActions, loadingMoreActions, onLoadMoreActions, onVerTodasActions }) {
  const atingiuLimite = managerActions.length >= 15

  return (
    <div style={{ borderTop: '1px solid #E5E5E5', paddingTop: '20px' }}>
      <p className="font-extrabold uppercase" style={{ fontSize: '11px', letterSpacing: '0.06em', color: TXT_EYEBROW, marginBottom: '12px' }}>
        Últimas ações do gestor
      </p>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map(i => <div key={i} style={{ height: '40px', borderRadius: '8px', backgroundColor: '#F0F0F0' }} />)}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {managerActions.length === 0 ? (
            <p style={{ fontSize: '12px', color: TXT_LABEL, padding: '8px 0' }}>Nenhuma ação registrada ainda.</p>
          ) : (
            managerActions.map((action, i) => {
              const chave = (action.category ?? '').toLowerCase()
              const Icone = ICONE_POR_CATEGORIA[chave] ?? Zap
              const recente = i === 0

              return (
                <div
                  key={action.id}
                  className="flex items-start gap-3 rounded-md"
                  style={{ padding: '8px 10px', backgroundColor: recente ? '#FFF3EF' : 'transparent' }}
                >
                  <div
                    className="shrink-0 flex items-center justify-center mt-0.5"
                    style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: recente ? '#FFE1D5' : '#EEEEEE' }}
                  >
                    <Icone size={12} strokeWidth={2.5} style={{ color: recente ? COR_DESTAQUE : '#6B6B6B' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ fontSize: '13px', color: '#111111', fontWeight: recente ? 800 : 600 }}>{action.description}</span>
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
                        <span className="font-bold uppercase" style={{ fontSize: '10px', letterSpacing: '0.03em', color: '#00A67D' }}>{action.impact}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}

          {atingiuLimite ? (
            <button
              type="button"
              onClick={onVerTodasActions}
              className="self-start font-extrabold transition-opacity duration-150 flex items-center gap-1"
              style={{ fontSize: '12px', marginTop: '4px', padding: '6px 10px', borderRadius: '6px', color: COR_DESTAQUE }}
            >
              Ver todas as ações
              <ArrowRight size={13} strokeWidth={2.5} />
            </button>
          ) : hasMoreActions && (
            <button
              type="button"
              onClick={onLoadMoreActions}
              disabled={loadingMoreActions}
              className="self-start font-extrabold transition-opacity duration-150"
              style={{ fontSize: '12px', marginTop: '4px', padding: '6px 10px', borderRadius: '6px', color: COR_DESTAQUE, opacity: loadingMoreActions ? 0.6 : 1 }}
            >
              {loadingMoreActions ? 'Carregando…' : 'Carregar mais'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── TopLojasSection ────────────────────────────────────────────────────────

function TopLojasSection({ topLojas, loading }) {
  return (
    <div style={{ borderTop: '1px solid #E5E5E5', paddingTop: '20px' }}>
      <p className="font-extrabold uppercase" style={{ fontSize: '11px', letterSpacing: '0.06em', color: TXT_EYEBROW, marginBottom: '12px' }}>
        Lojas que mais cresceram
      </p>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map(i => <div key={i} style={{ height: '40px', borderRadius: '8px', backgroundColor: '#F0F0F0' }} />)}
        </div>
      ) : topLojas.length === 0 ? (
        <p style={{ fontSize: '12px', color: TXT_LABEL, padding: '8px 0' }}>Sem dados suficientes no período.</p>
      ) : (
        <div className="flex flex-col">
          {/* Cabeçalho das colunas — só faz sentido a partir de 2+ linhas */}
          <div className="flex items-center justify-between" style={{ padding: '0 10px 6px' }}>
            <span className="font-semibold uppercase" style={{ fontSize: '10px', letterSpacing: '0.04em', color: '#999999' }}>Loja</span>
            <div className="flex items-center gap-6">
              <span className="font-semibold uppercase" style={{ fontSize: '10px', letterSpacing: '0.04em', color: '#999999', width: '64px', textAlign: 'right' }}>Semana</span>
              <span className="font-semibold uppercase" style={{ fontSize: '10px', letterSpacing: '0.04em', color: '#999999', width: '90px', textAlign: 'right' }}>Linha de base</span>
            </div>
          </div>
          {topLojas.map((loja, i) => (
            <div
              key={loja.lojaId}
              className="flex items-center justify-between"
              style={{ padding: '9px 10px', borderTop: i === 0 ? 'none' : '1px solid #F0F0F0' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono font-bold" style={{ fontSize: '11px', color: '#999999', width: '16px', flexShrink: 0 }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {loja.nome}
                </span>
                <PlatformBadge plataforma={loja.plataforma} />
              </div>
              <div className="flex items-center gap-6 shrink-0">
                <div style={{ width: '64px', textAlign: 'right' }}><VariacaoTag value={loja.growthSemana} /></div>
                <div style={{ width: '90px', textAlign: 'right' }}><VariacaoTag value={loja.growthBaseline} /></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── GestorSummaryCard ──────────────────────────────────────────────────────

/**
 * Card resumo de um gestor — desempenho da carteira por plataforma, últimas
 * ações e as lojas com maior crescimento. Aberto ao clicar no nome do gestor
 * no ranking (Top Gestores ou tabela de ranking) do Dashboard.
 *
 * @param {Object} props
 * @param {{ id: string, nome: string }} props.gestor
 * @param {{ platformBreakdown: Array, platformGrowth: Array, faturamentoTotal: number, topLojas: Array }} props.kpis
 * @param {boolean} props.loadingKpis
 * @param {'1semana'|'4semanas'|'3meses'} props.periodo
 * @param {(periodo: string) => void} props.onPeriodoChange
 * @param {Array<{ id, date, category, description, impact }>} props.managerActions
 * @param {boolean} props.loadingActions
 * @param {boolean} props.hasMoreActions
 * @param {boolean} props.loadingMoreActions
 * @param {() => void} props.onLoadMoreActions
 * @param {() => void} props.onVerTodasActions - navega pra /atividades?tab=acoes&gestor=<id>
 */
export default function GestorSummaryCard({
  gestor,
  kpis,
  loadingKpis,
  periodo,
  onPeriodoChange,
  managerActions = [],
  loadingActions,
  hasMoreActions,
  loadingMoreActions,
  onLoadMoreActions,
  onVerTodasActions,
}) {
  return (
    <div className="bg-white rounded-xl p-6 flex flex-col gap-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {/* ── Cabeçalho ── */}
      <div style={{ paddingBottom: '4px', borderBottom: '1px solid #E5E5E5' }}>
        <h2 style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-0.02em', color: '#111111', paddingBottom: '14px' }}>
          {gestor?.nome ?? '—'}
        </h2>
      </div>

      <KpiSection kpis={kpis} loading={loadingKpis} periodo={periodo} onPeriodoChange={onPeriodoChange} />

      <TopLojasSection topLojas={kpis?.topLojas ?? []} loading={loadingKpis} />

      <ManagerActionsSection
        managerActions={managerActions}
        loading={loadingActions}
        hasMoreActions={hasMoreActions}
        loadingMoreActions={loadingMoreActions}
        onLoadMoreActions={onLoadMoreActions}
        onVerTodasActions={onVerTodasActions}
      />
    </div>
  )
}
