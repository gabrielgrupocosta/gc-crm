import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { CheckCircle2, Circle, ArrowRight, Trophy, AlertTriangle, AlertCircle, Store, Users, Inbox } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  db, COLLECTIONS, collection, query, where, getDocs, getDoc,
  addDoc, setDoc, updateDoc, doc, serverTimestamp, orderBy, limit,
} from '../services/firebase'
import Skeleton from '../components/UI/Skeleton'
import Modal from '../components/UI/Modal'
import PlatformBadge from '../components/UI/PlatformBadge'
import LojaSelect from '../components/UI/LojaSelect'
import GestorPerformanceCard from '../components/UI/GestorPerformanceCard'
import {
  getISOWeekStr, getLast8Weeks, weekLabel, MONTH_NAMES,
  getLast26WeekOptions, getDashboardWeekOptions, getLast12MonthOptions,
  getWeeksInMonth, getWeeksInRange, getPrevMonthStr, getPrevWeekStr, weekToMonth,
  formatWeekPeriod, formatWeekPeriodFull, fetchByWeeksBatched,
} from '../utils/semanas'

// ─── Utilities ────────────────────────────────────────────────────────────────

const RANKING_SORT_LABELS = {
  variacao_desc:    'Top 10 — Maior crescimento',
  variacao_asc:     'Top 10 — Maior queda',
  faturamento_desc: 'Top 10 — Maior faturamento',
}

function formatBRL(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

function formatBRLDecimal(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

function formatVar(v) {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`
}

// Tolerante a variações de grafia salvas no Firestore ('Ativa', 'ativa', 'ativo'...)
function lojaAtiva(l) {
  return ['ativa', 'ativo'].includes(l.status?.toLowerCase())
}

// ─── Animation variants ───────────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.15, ease: 'easeOut' } },
}

const listVariants = { animate: { transition: { staggerChildren: 0.04 } } }
const itemVariants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.12 } },
}

const modalVariants = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.12, ease: 'easeOut' } },
  exit:    { opacity: 0, scale: 0.97, transition: { duration: 0.08 } },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPICard({ label, value, valueColor, badge, sub, subColor = '#999999', progress, currency = false }) {
  const barColor = progress == null ? null
    : progress >= 80 ? '#22C55E'
    : progress >= 50 ? '#F59E0B'
    : '#EA1D2C'

  const currencyMatch = currency && typeof value === 'string' ? value.match(/^(R\$\s?)(.*)$/) : null

  return (
    <div className="card-kpi">
      <p className="typography-section-label" style={{ marginBottom: '10px' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
        <p className="typography-kpi-value" style={valueColor ? { color: valueColor } : undefined}>
          {currencyMatch ? (
            <>
              <span style={{ fontSize: '0.75em', fontWeight: 700 }}>{currencyMatch[1]}</span>
              {currencyMatch[2]}
            </>
          ) : (value ?? '—')}
        </p>
        {badge && (
          <span className="font-mono" style={{ fontSize: '13px', fontWeight: 700, color: badge.color, fontVariantNumeric: 'tabular-nums' }}>
            {badge.text}
          </span>
        )}
      </div>
      {sub && <p className="typography-secondary" style={{ marginTop: '7px', color: subColor }}>{sub}</p>}
      {progress != null && (
        <div style={{ width: '100%', height: '6px', backgroundColor: '#F0F0F0', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{ height: '6px', borderRadius: '3px', backgroundColor: barColor }}
          />
        </div>
      )}
    </div>
  )
}

function VariacaoSplitValue({ value }) {
  const color = value == null ? '#111111' : value >= 0 ? '#16A34A' : '#DC2626'
  return (
    <p style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '24px', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
      {formatVar(value)}
    </p>
  )
}

function VariacaoMediaCard({ media7dias, media30dias }) {
  return (
    <div className="card-kpi">
      <p className="typography-section-label" style={{ marginBottom: '10px' }}>Variação Média</p>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#BBBBBB', marginBottom: '4px' }}>
            7 dias
          </p>
          <VariacaoSplitValue value={media7dias} />
        </div>
        <div style={{ width: '1px', backgroundColor: '#F0F0F0', margin: '0 14px' }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#BBBBBB', marginBottom: '4px' }}>
            30 dias
          </p>
          <VariacaoSplitValue value={media30dias} />
        </div>
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '8px', padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <p style={{ fontSize: '12px', color: '#999999', marginBottom: '3px' }}>{label}</p>
      <p className="font-mono" style={{ fontSize: '12px', color: '#111111', fontVariantNumeric: 'tabular-nums' }}>
        {formatter ? formatter(payload[0].value) : payload[0].value}
      </p>
    </div>
  )
}

function SectionCard({ title, subtitle, headerRight, children, style }) {
  return (
    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', ...style }}>
      <div style={{
        padding: '16px 16px 12px', marginBottom: '12px',
        borderBottom: '1px solid #F3F3F3',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
      }}>
        <div>
          <p style={{ fontSize: '16px', fontWeight: 700, color: '#111111', letterSpacing: '-0.01em' }}>{title}</p>
          {subtitle && <p style={{ fontSize: '12px', color: '#999999', fontWeight: 400, marginTop: '2px' }}>{subtitle}</p>}
        </div>
        {headerRight}
      </div>
      {children}
    </div>
  )
}

function RankingList({ items, showGestor, onSelectLoja }) {
  if (!items.length) return (
    <p style={{ fontSize: '12px', color: '#999999', textAlign: 'center', padding: '24px 0' }}>
      Nenhum resultado lançado esta semana.
    </p>
  )
  return (
    <motion.div variants={listVariants} initial="initial" animate="animate">
      {items.map((item, i) => {
        const posColor = i === 0 ? '#111111' : i === 1 ? '#666666' : '#999999'
        const varColor = item.variacao == null ? '#999999' : item.variacao >= 0 ? '#16A34A' : '#DC2626'
        return (
          <motion.div
            key={item.lojaId}
            variants={itemVariants}
            className="table-row-base"
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px', height: '36px', minWidth: '600px' }}
          >
            <span className="font-mono" style={{ fontSize: '11px', fontWeight: 600, width: '20px', flexShrink: 0, color: posColor, fontVariantNumeric: 'tabular-nums' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={() => onSelectLoja?.(item)}
              className="font-sans"
              style={{ flex: 1, fontSize: '13px', color: '#111111', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
            >
              {item.nome}
            </button>
            <PlatformBadge plataforma={item.plataforma} />
            {showGestor && (
              <span className="font-sans" style={{ fontSize: '12px', fontWeight: 500, color: '#777777', width: '120px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
                {item.gestorNome}
              </span>
            )}
            <span className="font-mono" style={{ fontSize: '12px', fontWeight: 500, width: '84px', flexShrink: 0, textAlign: 'right', color: '#666666', fontVariantNumeric: 'tabular-nums' }}>
              {formatBRL(item.faturamento)}
            </span>
            <span className="font-mono" style={{ fontSize: '12px', fontWeight: 600, width: '52px', flexShrink: 0, textAlign: 'right', color: varColor, fontVariantNumeric: 'tabular-nums' }}>
              {formatVar(item.variacao)}
            </span>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

function PerformanceBadge({ value }) {
  if (value == null) {
    return <span className="font-mono" style={{ fontSize: '13px', color: '#94A3B8' }}>—</span>
  }
  const positive = value >= 0
  return (
    <span className="font-mono" style={{
      fontSize: '13px', fontWeight: 700,
      color: positive ? '#079447' : '#D92D20',
      backgroundColor: positive ? '#ECFDF3' : '#FEF3F2',
      border: `1px solid ${positive ? '#ABEFC6' : '#FECDCA'}`,
      borderRadius: '999px', padding: '5px 9px',
      whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
      justifySelf: 'end',
    }}>
      {`${positive ? '+' : '−'}${Math.abs(value).toFixed(1)}%`}
    </span>
  )
}

function RankingRow({ item, index, isLast, onSelectLoja }) {
  const isFirst = index === 0
  const posBg    = isFirst ? '#FFF3CD' : '#F1F5F9'
  const posColor = isFirst ? '#C97800' : '#64748B'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut', delay: index * 0.06 }}
      style={{
        display: 'grid', gridTemplateColumns: '44px 1fr auto auto',
        alignItems: 'center', gap: '10px',
        minHeight: '58px', padding: '10px 14px',
        borderRadius: isFirst ? '8px' : 0,
        backgroundColor: isFirst ? '#FFFBEB' : 'transparent',
        border: isFirst ? '1px solid #F6D77A' : 'none',
        borderBottom: isFirst ? 'none' : (isLast ? 'none' : '1px solid #EEF1F5'),
      }}
    >
      <div style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isFirst ? (
          <span style={{
            width: '32px', height: '32px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#F6B93B', boxShadow: '0 2px 5px rgba(217,140,0,0.35)',
          }}>
            <Trophy size={15} strokeWidth={2.25} color="#FFFFFF" />
          </span>
        ) : (
        <span className="font-mono" style={{
          width: '32px', height: '32px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: posBg, color: posColor,
          fontSize: '12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        )}
      </div>

      <button
        type="button"
        title={item.nome}
        onClick={() => onSelectLoja?.(item)}
        className="font-sans"
        style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
      >
        {item.nome}
      </button>

      <PlatformBadge plataforma={item.plataforma} />
      <PerformanceBadge value={item.variacao} />
    </motion.div>
  )
}

function RankingCard({ icon: Icon, title, periodLabel, items, loading = false, onSelectLoja }) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        alignSelf: 'start',
        backgroundColor: '#FFFFFF',
        border: `1px solid ${hovered ? '#D8DEE8' : '#E5E7EB'}`,
        borderRadius: '12px',
        padding: '20px',
        boxShadow: hovered ? '0 4px 14px rgba(15,23,42,0.09)' : '0 2px 8px rgba(15,23,42,0.06)',
        transition: 'box-shadow 150ms, border-color 150ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
          backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={22} strokeWidth={1.75} style={{ color: '#2563EB' }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p className="font-sans" style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
            {title}
          </p>
          <p className="font-sans" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B', marginTop: '2px' }}>
            {periodLabel ?? '—'}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="animate-skeleton" style={{ height: '58px', borderRadius: '8px', backgroundColor: '#F1F5F9' }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '24px 0' }}>
          <Inbox size={20} strokeWidth={1.5} style={{ color: '#CBD5E1' }} />
          <p className="font-sans" style={{ fontSize: '12px', color: '#94A3B8' }}>
            Nenhum dado disponível para este período
          </p>
        </div>
      ) : (
        <div>
          {items.map((item, i) => (
            <RankingRow key={i} item={item} index={i} isLast={i === items.length - 1} onSelectLoja={onSelectLoja} />
          ))}
        </div>
      )}
    </motion.div>
  )
}

function StatusBadge({ ok }) {
  return ok ? (
    <span style={{
      fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em',
      padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap',
      color: '#16A34A', backgroundColor: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)',
    }}>
      OK
    </span>
  ) : (
    <span style={{
      fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em',
      padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap',
      color: '#DC2626', backgroundColor: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)',
    }}>
      Pendente
    </span>
  )
}

function RelStatusBadge({ status }) {
  const base = {
    fontSize: '10px', fontWeight: 500, textTransform: 'uppercase',
    letterSpacing: '0.04em', padding: '1px 6px', borderRadius: '3px',
    whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px',
  }
  if (status === 'enviado') return (
    <span style={{ ...base, color: '#16A34A', backgroundColor: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }}>
      ENVIADO
    </span>
  )
  if (status === 'no_prazo') return (
    <span style={{ ...base, color: '#CA8A04', backgroundColor: 'rgba(202,138,4,0.1)', border: '1px solid rgba(202,138,4,0.2)' }}>
      NO PRAZO
    </span>
  )
  if (status === 'pendente') return (
    <span style={{ ...base, color: '#DC2626', backgroundColor: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
      PENDENTE
    </span>
  )
  return (
    <span style={{ ...base, color: '#991B1B', backgroundColor: 'rgba(153,27,27,0.08)', border: '1px solid rgba(153,27,27,0.2)' }}>
      <AlertTriangle size={9} strokeWidth={2} />
      ATRASADO
    </span>
  )
}

// Agrupa lojas do mesmo cliente sob um label sutil com o nome dele — automático,
// sem precisar de nenhum grupo cadastrado: sempre que o cliente tem mais de uma
// loja nesta lista, elas ficam juntas com o label; cliente com uma loja só
// entra solto. Usado nas listas expandidas de "Status por Gestor". Sem
// drag-and-drop envolvido aqui, então é seguro reordenar pra deixar as lojas
// do mesmo cliente juntas. Lista plana (sem <div> extra por cliente) pra
// funcionar tanto em containers flex-col quanto no grid de 2 colunas de
// "Status dos relatórios".
function LojaGroupList({ lojas, renderRow }) {
  if (lojas.length === 0) return <p style={{ fontSize: '11px', color: '#999999' }}>Nenhuma</p>

  const porCliente = {}
  lojas.forEach(l => {
    if (l.clienteId) (porCliente[l.clienteId] ??= []).push(l)
  })

  const semAgrupamento = []
  const ordemClientes = []
  lojas.forEach(l => {
    if (l.clienteId && porCliente[l.clienteId].length > 1) {
      if (!ordemClientes.includes(l.clienteId)) ordemClientes.push(l.clienteId)
    } else {
      semAgrupamento.push(l)
    }
  })

  return (
    <>
      {ordemClientes.map(clienteId => {
        const doCliente = porCliente[clienteId]
        return (
          <Fragment key={clienteId}>
            <p style={{ gridColumn: '1 / -1', fontSize: '10px', fontWeight: 600, color: '#999999', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '4px 0 2px' }}>
              {doCliente[0].clienteNome ?? '—'}
            </p>
            {doCliente.map(renderRow)}
          </Fragment>
        )
      })}
      {semAgrupamento.map(renderRow)}
    </>
  )
}

function GestorStatusTable({ rows, expandido, onToggle }) {
  if (!rows.length) return null

  return (
    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: '28px', marginBottom: '16px' }}>
      <div style={{ padding: '16px 16px 12px', marginBottom: '12px', borderBottom: '1px solid #F3F3F3' }}>
        <p style={{ fontSize: '16px', fontWeight: 700, color: '#111111', letterSpacing: '-0.01em' }}>Status por Gestor</p>
        <p style={{ fontSize: '12px', color: '#999999', fontWeight: 400, marginTop: '2px' }}>Acompanhamento de resultados e relatórios</p>
      </div>

      <div className="overflow-x-auto">
      <div style={{ minWidth: '480px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 200px', alignItems: 'center', padding: '0 16px', height: '30px', borderBottom: '1px solid #F3F3F3' }}>
        <span className="typography-table-header">Gestor</span>
        <span className="typography-table-header" style={{ textAlign: 'right', paddingRight: '8px' }}>Resultados</span>
        <span className="typography-table-header" style={{ textAlign: 'right', paddingRight: '8px' }}>Relatórios</span>
      </div>

      {rows.map(g => {
        const expandRes = expandido?.gestorId === g.id && expandido?.col === 'resultados'
        const expandRel = expandido?.gestorId === g.id && expandido?.col === 'relatorios'

        const relEmDia = g.nRelAtrasadas === 0

        return (
          <div key={g.id} style={{ borderBottom: '1px solid #F3F3F3' }} className="last:border-0">
            <div
              className="table-row-base"
              style={{ display: 'grid', gridTemplateColumns: '1fr 150px 200px', alignItems: 'center', padding: '0 16px', height: '44px' }}
            >
              <span className="font-sans" style={{ fontSize: '13px', color: '#111111', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '16px' }}>
                {g.nome}
              </span>
              <button
                onClick={() => onToggle(g.id, 'resultados')}
                style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '1px', paddingRight: '8px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: '#111111', fontVariantNumeric: 'tabular-nums' }}>
                  {g.nResultados}
                </span>
                <span className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: '#BBBBBB', fontVariantNumeric: 'tabular-nums' }}>
                  /{g.total}
                </span>
              </button>
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: '8px' }}>
                <button
                  onClick={() => onToggle(g.id, 'relatorios')}
                  className="font-sans"
                  style={{
                    fontSize: '11px', fontWeight: 600, borderRadius: '20px', padding: '3px 10px',
                    whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid', transition: 'opacity 150ms',
                    backgroundColor: relEmDia ? '#EDFBF3' : '#FFF0F1',
                    color:           relEmDia ? '#00B14F' : '#EA1D2C',
                    borderColor:     relEmDia ? '#B3EDD0' : '#FCCDD0',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  {relEmDia ? 'Detalhes (em dia)' : (
                    <>
                      Detalhes (<span className="font-mono" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{g.nRelAtrasadas}</span> Atrasado{g.nRelAtrasadas !== 1 ? 's' : ''})
                    </>
                  )}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {(expandRes || expandRel) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  {expandRes ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '12px 16px', borderTop: '1px solid #F3F3F3', backgroundColor: '#F9F9F9' }}>
                      <div>
                        <p className="section-label" style={{ marginBottom: '8px' }}>Com resultado</p>
                        <div className="flex flex-col gap-1.5">
                          <LojaGroupList
                            lojas={g.comResultado}
                            renderRow={l => (
                              <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                <span style={{ fontSize: '12px', color: '#666666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nome}</span>
                                <StatusBadge ok />
                              </div>
                            )}
                          />
                        </div>
                      </div>
                      <div>
                        <p className="section-label" style={{ marginBottom: '8px' }}>Sem resultado</p>
                        <div className="flex flex-col gap-1.5">
                          <LojaGroupList
                            lojas={g.semResultado}
                            renderRow={l => (
                              <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                <span style={{ fontSize: '12px', color: '#666666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nome}</span>
                                <StatusBadge ok={false} />
                              </div>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '12px 16px', borderTop: '1px solid #F3F3F3', backgroundColor: '#F9F9F9' }}>
                      <p className="section-label" style={{ marginBottom: '8px' }}>Status dos relatórios</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
                        <LojaGroupList
                          lojas={g.lojasRelSorted}
                          renderRow={l => (
                            <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                              <span style={{ fontSize: '12px', color: '#666666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nome}</span>
                              <RelStatusBadge status={l.relStatus} />
                            </div>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
      </div>
      </div>
    </div>
  )
}

// ─── Gestor status cards ──────────────────────────────────────────────────────

function GestorStatusCard({ title, periodoLabel, items, onClickPending, hideCompleted = false, emptyDoneMessage = null }) {
  const done         = items.filter(i => i.done).length
  const pending      = items.length - done
  const visibleItems = hideCompleted ? items.filter(i => !i.done) : items

  return (
    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F3F3' }}>
        <p style={{ fontSize: '12px', fontWeight: 500, color: '#111111', marginBottom: '2px' }}>{title}</p>
        <p style={{ fontSize: '11px', color: '#999999' }}>{periodoLabel}</p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
          <span style={{ fontSize: '11px', color: '#16A34A' }}>{done} lançado{done !== 1 ? 's' : ''}</span>
          {pending > 0 && (
            <span style={{ fontSize: '11px', color: '#999999' }}>{pending} pendente{pending !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {visibleItems.length === 0 ? (
        emptyDoneMessage ? (
          <p style={{ fontSize: '12px', color: '#16A34A', textAlign: 'center', padding: '24px 0' }}>
            {emptyDoneMessage}
          </p>
        ) : (
          <p style={{ fontSize: '12px', color: '#999999', textAlign: 'center', padding: '24px 0' }}>
            Nenhuma loja ativa.
          </p>
        )
      ) : (
        <motion.div variants={listVariants} initial="initial" animate="animate">
          {visibleItems.map((item, idx) => (
            <motion.div
              key={item.id}
              variants={itemVariants}
              onClick={() => !item.done && onClickPending(item)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '0 16px', height: '36px',
                borderBottom: idx < visibleItems.length - 1 ? '1px solid #F3F3F3' : 'none',
                cursor: item.done ? 'default' : 'pointer',
                transition: 'background-color 150ms ease',
              }}
              whileHover={!item.done ? { backgroundColor: 'rgba(0,0,0,0.03)' } : {}}
            >
              {item.done
                ? <CheckCircle2 size={13} strokeWidth={1.5} style={{ color: '#16A34A', flexShrink: 0 }} />
                : <Circle       size={13} strokeWidth={1.5} style={{ color: '#999999', flexShrink: 0 }} />
              }
              <span style={{
                flex: 1, fontSize: '12px',
                color: item.done ? '#666666' : '#111111',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {item.nome}
              </span>
              {!item.done && (
                <span style={{ fontSize: '10px', color: '#E5322D', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                  lançar
                </span>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}

// ─── Modal: lançamento rápido de resultado ────────────────────────────────────

function ModalLancamentoRapido({ loja, semana, periodoLabel, onClose, onSaved }) {
  const { user } = useAuth()

  // ─ Lojas com mais de uma plataforma exigem escolher qual plataforma será
  // lançada antes de mostrar o formulário — mesmo padrão do LojaModal em
  // ControleSemanal.jsx.
  const plataformasLoja = loja.plataformas?.length ? loja.plataformas : (loja.plataforma ? [loja.plataforma] : [])
  const multiplasPlataformas = plataformasLoja.length > 1
  const [plataformaSelecionada, setPlataformaSelecionada] = useState(
    () => multiplasPlataformas ? null : (plataformasLoja[0] ?? null)
  )

  const [faturamento, setFaturamento] = useState('')
  const [variacao,    setVariacao]    = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  async function handleSave() {
    const fat = parseFloat(String(faturamento).replace(',', '.'))
    if (!faturamento || isNaN(fat)) { setError('Informe o faturamento bruto.'); return }
    setSaving(true)
    setError('')
    try {
      const varStr = String(variacao).replace(',', '.')
      const varNum = variacao !== '' && !isNaN(parseFloat(varStr)) ? parseFloat(varStr) : null
      const payload = {
        lojaId:           loja.id,
        gestorId:         user.uid,
        plataforma:       plataformaSelecionada,
        semana,
        faturamento:      fat,
        variacao:         varNum,
        observacoes:      observacoes.trim() || null,
        relatorioEnviado: false,
        criadoEm:         serverTimestamp(),
      }
      const ref = await addDoc(collection(db, COLLECTIONS.RESULTADOS), payload)
      onSaved({ id: ref.id, ...payload, criadoEm: new Date() })
    } catch (err) {
      console.error('[ModalResultado] save:', err?.code, err?.message)
      setError('Erro ao salvar. Tente novamente.')
      setSaving(false)
    }
  }

  const precisaEscolherPlataforma = multiplasPlataformas && !plataformaSelecionada

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Lançar Resultado"
      footer={precisaEscolherPlataforma ? (
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
      ) : (
        <>
          <button onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
          <button onClick={handleSave} className="btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      )}
    >
      <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #E8E8E8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <p style={{ fontSize: '13px', color: '#111111', fontWeight: 500 }}>{loja.nome}</p>
          {multiplasPlataformas && plataformaSelecionada && (
            <>
              <PlatformBadge plataforma={plataformaSelecionada} />
              <button
                type="button"
                onClick={() => setPlataformaSelecionada(null)}
                style={{ fontSize: '11px', color: '#999999', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                Trocar
              </button>
            </>
          )}
        </div>
        <p style={{ fontSize: '11px', color: '#999999', marginTop: '2px' }}>{periodoLabel}</p>
      </div>

      {precisaEscolherPlataforma ? (
        <div>
          <p style={{ fontSize: '13px', color: '#666666', marginBottom: '14px' }}>
            Esta loja tem múltiplas plataformas. Selecione qual plataforma deseja lançar:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {plataformasLoja.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPlataformaSelecionada(p)}
                style={{ background: 'transparent', border: '1px solid #E8E8E8', borderRadius: '8px', padding: '10px 14px', cursor: 'pointer', transition: 'border-color 150ms, background-color 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#DDDDDD'; e.currentTarget.style.backgroundColor = '#F9F9F9' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8E8E8'; e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <PlatformBadge plataforma={p} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label className="field-label">Faturamento bruto (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={faturamento}
              onChange={e => setFaturamento(e.target.value)}
              className="input w-full mt-1"
              placeholder="0,00"
              autoFocus
            />
          </div>
          <div>
            <label className="field-label">Variação % vs semana anterior</label>
            <input
              type="number"
              step="0.1"
              value={variacao}
              onChange={e => setVariacao(e.target.value)}
              className="input w-full mt-1"
              placeholder="ex: 8.3 ou -5.1"
            />
          </div>
          <div>
            <label className="field-label">Observações</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              className="input w-full mt-1 h-20 resize-none py-2"
              placeholder="Opcional…"
            />
          </div>
          {error && <p style={{ fontSize: '12px', color: '#DC2626' }}>{error}</p>}
        </div>
      )}
    </Modal>
  )
}

// ─── Modal: status de relatório ───────────────────────────────────────────────

function ModalRelatorio({ loja, semana, periodoLabel, lojaStatus, onClose, onSaved }) {
  const { user } = useAuth()
  const [enviado, setEnviado] = useState(lojaStatus?.enviado ?? false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const gestorId = user.uid
      const docRef   = doc(db, 'relatorios_semanais', `${gestorId}_${semana}`)
      const now      = enviado ? new Date().toISOString() : null

      try {
        await updateDoc(docRef, {
          [`lojas.${loja.id}.enviado`]:   enviado,
          [`lojas.${loja.id}.dataEnvio`]: now,
        })
      } catch (err) {
        if (err.code === 'not-found') {
          await setDoc(docRef, {
            gestorId,
            organizacaoId: user.organizacaoId ?? null,
            semana,
            lojas: { [loja.id]: { enviado, dataEnvio: now } },
          })
        } else throw err
      }

      onSaved(loja.id, { enviado, dataEnvio: now })
    } catch (err) {
      console.error('[ModalRelatorio] save:', err?.code, err?.message)
      setError('Erro ao salvar. Tente novamente.')
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Status do Relatório"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
          <button onClick={handleSave} className="btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #E8E8E8' }}>
        <p style={{ fontSize: '13px', color: '#111111', fontWeight: 500 }}>{loja.nome}</p>
        <p style={{ fontSize: '11px', color: '#999999', marginTop: '2px' }}>{periodoLabel}</p>
      </div>
      <div className="flex items-center justify-between">
        <label className="field-label">Relatório enviado ao cliente?</label>
        <button
          onClick={() => setEnviado(v => !v)}
          className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-150 shrink-0"
          style={{ backgroundColor: enviado ? '#16A34A' : '#E8E8E8' }}
        >
          <span
            className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform duration-150"
            style={{ transform: enviado ? 'translateX(18px)' : 'translateX(2px)' }}
          />
        </button>
      </div>
      {error && <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '12px' }}>{error}</p>}
    </Modal>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, isAdmin, isSuperAdmin } = useAuth()
  const navigate = useNavigate()

  const currentWeek = useMemo(() => getISOWeekStr(), [])
  const last8Weeks  = useMemo(() => getLast8Weeks(), [])
  const prevWeek    = useMemo(() => last8Weeks[1], [last8Weeks])

  const [loading,                  setLoading]                  = useState(true)
  const [lojas,                    setLojas]                    = useState([])
  const [gestores,                 setGestores]                 = useState([])
  const [resultadosSemanaAnterior, setResultadosSemanaAnterior] = useState([])
  const [resultadosHistorico,      setResultadosHistorico]      = useState([])
  const [relatoriosSemanais,       setRelatoriosSemanais]       = useState({})
  const [relatoriosSemanaisAdmin,  setRelatoriosSemanaisAdmin]  = useState({})

  // ── Card de performance do gestor (aberto ao clicar no nome da loja no ranking) ──
  const [performanceCliente,  setPerformanceCliente]  = useState(null) // { id, nome, plataformas }
  const [performanceData,     setPerformanceData]     = useState(null) // { weeklyPerformance, managerActions, totalActionsCount, baseline }
  const [loadingPerformance,  setLoadingPerformance]  = useState(false)
  const [filtroGestor,             setFiltroGestor]             = useState('')
  const [rankingSort,              setRankingSort]              = useState('variacao_desc')
  const [gestoresMap,              setGestoresMap]              = useState({})

  const [modalResultado, setModalResultado] = useState(null)
  const [modalRelatorio, setModalRelatorio] = useState(null)

  const weekOptions12 = useMemo(() => getDashboardWeekOptions(), [])
  const [selectedWeek, setSelectedWeek] = useState(() => weekOptions12[0]?.value ?? prevWeek)
  const selectedWeekMeta = useMemo(
    () => weekOptions12.find(o => o.value === selectedWeek) ?? weekOptions12[0],
    [weekOptions12, selectedWeek]
  )

  const [resultadosSemanaSelecionada, setResultadosSemanaSelecionada] = useState([])

  useEffect(() => {
    if (!user || !selectedWeek) return
    if (selectedWeek === prevWeek) {
      setResultadosSemanaSelecionada(resultadosSemanaAnterior)
      return
    }
    let cancelled = false
    async function loadSelectedWeek() {
      try {
        const snap = await getDocs(query(collection(db, COLLECTIONS.RESULTADOS), where('semana', '==', selectedWeek)))
        if (!cancelled) setResultadosSemanaSelecionada(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error('[Dashboard] semana selecionada:', err?.code, err?.message)
      }
    }
    loadSelectedWeek()
    return () => { cancelled = true }
  }, [user, selectedWeek, prevWeek, resultadosSemanaAnterior])

  const semanaAnteriorASelecionada = useMemo(() => getPrevWeekStr(selectedWeek), [selectedWeek])
  const [resultadosSemanaAnteriorASelecionada, setResultadosSemanaAnteriorASelecionada] = useState([])

  useEffect(() => {
    if (!user || !semanaAnteriorASelecionada) return
    if (semanaAnteriorASelecionada === prevWeek) {
      setResultadosSemanaAnteriorASelecionada(resultadosSemanaAnterior)
      return
    }
    let cancelled = false
    async function loadPrevOfSelected() {
      try {
        const snap = await getDocs(query(collection(db, COLLECTIONS.RESULTADOS), where('semana', '==', semanaAnteriorASelecionada)))
        if (!cancelled) setResultadosSemanaAnteriorASelecionada(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error('[Dashboard] semana anterior à selecionada:', err?.code, err?.message)
      }
    }
    loadPrevOfSelected()
    return () => { cancelled = true }
  }, [user, semanaAnteriorASelecionada, prevWeek, resultadosSemanaAnterior])

  const WEEK_OPTIONS  = useMemo(() => getLast26WeekOptions(),  [])
  const MONTH_OPTIONS = useMemo(() => getLast12MonthOptions(), [])

  const [cMode,       setCMode]       = useState('semana')
  const [cSemana,     setCSemana]     = useState(() => getLast8Weeks()[1])
  const [cMes,        setCMes]        = useState(() => getLast12MonthOptions()[0].value)
  const [cDe,         setCDe]         = useState('')
  const [cAte,        setCAte]        = useState('')
  const [cResultados, setCResultados] = useState([])
  const [cPrevRes,    setCPrevRes]    = useState([])
  const [cEvolRes,    setCEvolRes]    = useState([])
  const [loadingC,    setLoadingC]    = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        // Regra de leitura dessas coleções é só mesmaOrg() (sem exigir gestorId) —
        // então basta filtrar por organizacaoId pra admin_org e gestor lerem tudo
        // da própria org; master (isSuperAdmin) não precisa do filtro.
        const orgId = user.organizacaoId ?? null
        const escopoOrg = isSuperAdmin ? [] : [where('organizacaoId', '==', orgId)]

        const [lojasSnap, resultadosSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.LOJAS), ...escopoOrg)),
          getDocs(query(collection(db, COLLECTIONS.RESULTADOS), ...escopoOrg, where('semana', '==', last8Weeks[1]))),
        ])

        if (cancelled) return

        setLojas(lojasSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setResultadosSemanaAnterior(resultadosSnap.docs.map(d => ({ id: d.id, ...d.data() })))

        getDocs(query(collection(db, COLLECTIONS.RESULTADOS), ...escopoOrg, where('semana', 'in', last8Weeks)))
          .then(snap => {
            if (!cancelled) setResultadosHistorico(snap.docs.map(d => ({ id: d.id, ...d.data() })))
          })
          .catch(err => console.error('[Dashboard] historico:', err?.code, err?.message))

        getDocs(query(collection(db, COLLECTIONS.USERS), ...escopoOrg, where('role', '==', 'gestor')))
          .then(snap => {
            if (!cancelled) {
              const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
              setGestores(all.filter(g => g.status === 'ativo'))
              const map = {}
              all.forEach(g => { map[g.id] = g })
              setGestoresMap(map)
            }
          })
          .catch(err => console.error('[Dashboard] gestores:', err?.code, err?.message))

        if (!isAdmin) {
          getDoc(doc(db, 'relatorios_semanais', `${user.uid}_${currentWeek}`))
          .then(snap => {
            if (!cancelled) setRelatoriosSemanais(snap.exists() ? (snap.data().lojas || {}) : {})
          })
          .catch(err => console.error('[Dashboard] relatorios:', err?.code, err?.message))
        } else {
          getDocs(query(collection(db, 'relatorios_semanais'), ...escopoOrg, where('semana', '==', currentWeek)))
          .then(snap => {
            if (!cancelled) {
              const flatMap = {}
              snap.docs.forEach(d => {
                Object.entries(d.data().lojas || {}).forEach(([lojaId, status]) => {
                  flatMap[lojaId] = status
                })
              })
              setRelatoriosSemanaisAdmin(flatMap)
            }
          })
          .catch(err => console.error('[Dashboard] relatorios admin:', err?.code, err?.message))
        }

      } catch (err) {
        console.error('[Dashboard] erro ao carregar:', err?.code, err?.message, err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user, isAdmin, isSuperAdmin, currentWeek, last8Weeks])

  // ─── Consolidado fetch ───────────────────────────────────────────────────────

  const fetchConsolidado = useCallback(async () => {
    if (!user) return

    let weeksAtual = [], weeksPrev = [], weeksEvol = []

    if (cMode === 'semana' && cSemana) {
      weeksAtual = [cSemana]
      weeksPrev  = [getPrevWeekStr(cSemana)]

    } else if (cMode === 'mes' && cMes) {
      weeksAtual = getWeeksInMonth(cMes)
      weeksPrev  = getWeeksInMonth(getPrevMonthStr(cMes))
      weeksEvol  = [...new Set(
        Array.from({ length: 6 }, (_, i) => {
          const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        }).flatMap(m => getWeeksInMonth(m))
      )]

    } else if (cMode === 'custom' && cDe && cAte) {
      weeksAtual = getWeeksInRange(cDe, cAte)
      if (!weeksAtual.length) return
      const from  = new Date(cDe + 'T00:00:00')
      const to    = new Date(cAte + 'T00:00:00')
      const days  = Math.round((to - from) / 86400000)
      const pTo   = new Date(from.getTime() - 86400000)
      const pFrom = new Date(pTo.getTime()  - days * 86400000)
      const pad   = n => String(n).padStart(2, '0')
      weeksPrev = getWeeksInRange(
        `${pFrom.getFullYear()}-${pad(pFrom.getMonth() + 1)}-${pad(pFrom.getDate())}`,
        `${pTo.getFullYear()}-${pad(pTo.getMonth() + 1)}-${pad(pTo.getDate())}`,
      )
      weeksEvol = weeksAtual

    } else {
      return
    }

    const allWeeks = [...new Set([...weeksAtual, ...weeksPrev, ...weeksEvol])]
    if (!allWeeks.length) return

    setLoadingC(true)
    try {
      let allDocs
      if (isAdmin) {
        allDocs = await fetchByWeeksBatched(allWeeks, isSuperAdmin ? null : (user.organizacaoId ?? null))
      } else {
        const snap = await getDocs(query(
          collection(db, COLLECTIONS.RESULTADOS),
          where('organizacaoId', '==', user.organizacaoId ?? null),
          where('gestorId', '==', user.uid),
        ))
        const set = new Set(allWeeks)
        allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => set.has(r.semana))
      }
      const atualSet = new Set(weeksAtual)
      const prevSet  = new Set(weeksPrev)
      const evolSet  = new Set(weeksEvol)
      setCResultados(allDocs.filter(r => atualSet.has(r.semana)))
      setCPrevRes(allDocs.filter(r => prevSet.has(r.semana)))
      setCEvolRes(allDocs.filter(r => evolSet.has(r.semana)))
    } catch (err) {
      console.error('[consolidado] erro:', err?.code, err?.message)
    } finally {
      setLoadingC(false)
    }
  }, [user, isAdmin, isSuperAdmin, cMode, cSemana, cMes, cDe, cAte])

  useEffect(() => { fetchConsolidado() }, [fetchConsolidado])

  // ─── Derived state ──────────────────────────────────────────────────────────

  const lojasVisiveis = useMemo(() => {
    if (!isAdmin) return lojas.filter(l => l.gestorId === user?.uid)
    if (filtroGestor) return lojas.filter(l => l.gestorId === filtroGestor)
    return lojas
  }, [lojas, isAdmin, filtroGestor, user])

  const lojasAtivas = useMemo(() =>
    lojasVisiveis.filter(lojaAtiva),
    [lojasVisiveis]
  )

  const lojasAtivasGlobal = useMemo(() =>
    lojas.filter(lojaAtiva),
    [lojas]
  )

  const resultadosSemanaSelecionadaFiltrados = useMemo(() =>
    isAdmin && filtroGestor
      ? resultadosSemanaSelecionada.filter(r => r.gestorId === filtroGestor)
      : resultadosSemanaSelecionada,
    [resultadosSemanaSelecionada, isAdmin, filtroGestor]
  )

  const resultadosSemanaAnteriorASelecionadaFiltrados = useMemo(() =>
    isAdmin && filtroGestor
      ? resultadosSemanaAnteriorASelecionada.filter(r => r.gestorId === filtroGestor)
      : resultadosSemanaAnteriorASelecionada,
    [resultadosSemanaAnteriorASelecionada, isAdmin, filtroGestor]
  )

  const kpis = useMemo(() => {
    const ativasIds  = new Set(lojasAtivasGlobal.map(l => l.id))
    const resSemana  = resultadosSemanaSelecionadaFiltrados.filter(r => ativasIds.has(r.lojaId))
    const resSemanaAnterior = resultadosSemanaAnteriorASelecionadaFiltrados.filter(r => ativasIds.has(r.lojaId))
    const mediaVar   = resSemana.length
      ? resSemana.reduce((s, r) => s + (r.variacao ?? 0), 0) / resSemana.length
      : null
    const faturamentoCarteira = resSemana.reduce((s, r) => s + (r.faturamento ?? 0), 0)
    const faturamentoCarteiraAnterior = resSemanaAnterior.reduce((s, r) => s + (r.faturamento ?? 0), 0)
    const faturamentoVariacao = faturamentoCarteiraAnterior > 0
      ? ((faturamentoCarteira - faturamentoCarteiraAnterior) / faturamentoCarteiraAnterior) * 100
      : null
    return { mediaVar, faturamentoCarteira, faturamentoVariacao }
  }, [lojasAtivasGlobal, resultadosSemanaSelecionadaFiltrados, resultadosSemanaAnteriorASelecionadaFiltrados])

  // "Relatórios em Dia" — considera só lojas cujo diaRelatorio já chegou ou passou
  // dentro da semana atual (mesma régua de dia usada em `lojasAtrasadas`/`checklistRelatorios`),
  // e mede quantas dessas já têm o relatório da semana atual marcado como enviado.
  const relatoriosEmDia = useMemo(() => {
    const DIA_OFFSET   = { segunda: 0, terca: 1, quarta: 2, quinta: 3, sexta: 4, sabado: 5 }
    const todayOffset  = (new Date().getDay() + 6) % 7
    const relMap       = isAdmin ? relatoriosSemanaisAdmin : relatoriosSemanais

    const elegiveis = lojasAtivas.filter(l => {
      if (!l.diaRelatorio) return false
      const off = DIA_OFFSET[l.diaRelatorio]
      if (off == null) return false
      return off <= todayOffset
    })
    const emDia = elegiveis.filter(l => relMap[l.id]?.enviado === true)

    return {
      pct: elegiveis.length ? Math.round((emDia.length / elegiveis.length) * 100) : 100,
      emDiaCount: emDia.length,
      elegiveisCount: elegiveis.length,
    }
  }, [lojasAtivas, isAdmin, relatoriosSemanaisAdmin, relatoriosSemanais])

  // Média ponderada pelo faturamento das últimas 4 semanas completas (últimas 30 dias) —
  // last8Weeks[0] é a semana atual (ainda em andamento), então as 4 semanas fechadas
  // mais recentes são os índices 1 a 4.
  const media30dias = useMemo(() => {
    const ativasIds = new Set(lojasAtivasGlobal.map(l => l.id))
    const semanas4   = new Set(last8Weeks.slice(1, 5))
    const base = isAdmin && filtroGestor
      ? resultadosHistorico.filter(r => r.gestorId === filtroGestor)
      : resultadosHistorico

    let varFat = 0, fatTotal = 0
    base.forEach(r => {
      if (!ativasIds.has(r.lojaId) || !semanas4.has(r.semana)) return
      const fat = r.faturamento ?? 0
      if (r.variacao != null && fat > 0) {
        varFat   += r.variacao * fat
        fatTotal += fat
      }
    })
    return fatTotal > 0 ? varFat / fatTotal : null
  }, [resultadosHistorico, lojasAtivasGlobal, last8Weeks, isAdmin, filtroGestor])

  const ranking = useMemo(() => {
    const lojaMap   = Object.fromEntries(lojas.map(l => [l.id, l]))
    const ativasIds = new Set(lojasAtivas.map(l => l.id))
    const base      = isAdmin && filtroGestor
      ? resultadosSemanaSelecionada.filter(r => r.gestorId === filtroGestor)
      : resultadosSemanaSelecionada
    return base
      .filter(r => ativasIds.has(r.lojaId))
      .map(r => {
        const loja = lojaMap[r.lojaId]
        return {
          lojaId:      r.lojaId,
          nome:        loja?.nome ?? '—',
          plataforma:  loja?.plataforma ?? '',
          gestorNome:  gestoresMap[loja?.gestorId]?.nome ?? '—',
          clienteId:   loja?.clienteId ?? null,
          clienteNome: loja?.clienteNome ?? null,
          variacao:    r.variacao,
          faturamento: r.faturamento,
        }
      })
      .sort((a, b) => {
        if (rankingSort === 'faturamento_desc') {
          return (b.faturamento ?? -Infinity) - (a.faturamento ?? -Infinity)
        }
        return rankingSort === 'variacao_asc'
          ? (a.variacao ?? Infinity)  - (b.variacao ?? Infinity)
          : (b.variacao ?? -Infinity) - (a.variacao ?? -Infinity)
      })
      .slice(0, 10)
  }, [lojas, lojasAtivas, resultadosSemanaSelecionada, isAdmin, filtroGestor, rankingSort, gestoresMap])

  const resultadosSemanaAnteriorFiltrados = useMemo(() =>
    isAdmin && filtroGestor
      ? resultadosSemanaAnterior.filter(r => r.gestorId === filtroGestor)
      : resultadosSemanaAnterior,
    [resultadosSemanaAnterior, isAdmin, filtroGestor]
  )

  const lojasSemRelatorio = useMemo(() => {
    const comResultado = new Set(resultadosSemanaAnteriorFiltrados.map(r => r.lojaId))
    return lojasAtivas.filter(l => !comResultado.has(l.id))
  }, [lojasAtivas, resultadosSemanaAnteriorFiltrados])

  const lojasAtrasadas = useMemo(() => {
    const DIA_OFFSET = { segunda: 0, terca: 1, quarta: 2, quinta: 3, sexta: 4, sabado: 5 }
    const todayOffset = (new Date().getDay() + 6) % 7
    const relMap = isAdmin ? relatoriosSemanaisAdmin : relatoriosSemanais
    return lojasAtivas.filter(l => {
      if (relMap[l.id]?.enviado) return false
      if (!l.diaRelatorio) return false
      const diaOffset = DIA_OFFSET[l.diaRelatorio]
      if (diaOffset == null) return false
      return diaOffset < todayOffset
    })
  }, [lojasAtivas, isAdmin, relatoriosSemanaisAdmin, relatoriosSemanais])

  const checklistSemanaAnterior = useMemo(() => {
    if (isAdmin) return []
    const comResultado = new Set(resultadosSemanaAnterior.map(r => r.lojaId))
    return lojasAtivas
      .map(l => ({ id: l.id, nome: l.nome, done: comResultado.has(l.id) }))
      .sort((a, b) => Number(a.done) - Number(b.done))
  }, [lojasAtivas, resultadosSemanaAnterior, isAdmin])

  const checklistRelatorios = useMemo(() => {
    if (isAdmin) return []
    const DIA_OFFSET = { segunda: 0, terca: 1, quarta: 2, quinta: 3, sexta: 4, sabado: 5 }
    const todayOffset = (new Date().getDay() + 6) % 7
    return lojasAtivas
      .filter(l => {
        if (!l.diaRelatorio) return false
        const diaOffset = DIA_OFFSET[l.diaRelatorio]
        if (diaOffset == null) return false
        return diaOffset <= todayOffset // hoje (pendente) ou já passou (atrasado)
      })
      .map(l => ({
        id:         l.id,
        nome:       l.nome,
        done:       relatoriosSemanais[l.id]?.enviado === true,
        lojaStatus: relatoriosSemanais[l.id] ?? null,
      }))
      .sort((a, b) => Number(a.done) - Number(b.done))
  }, [lojasAtivas, relatoriosSemanais, isAdmin])

  const topLojas = useMemo(() => {
    const ativasIds = new Set(lojasAtivasGlobal.map(l => l.id))
    const lojaMap   = Object.fromEntries(lojas.map(l => [l.id, l]))
    return resultadosSemanaSelecionada
      .filter(r => ativasIds.has(r.lojaId) && r.variacao != null)
      .map(r => ({
        lojaId:      r.lojaId,
        nome:        lojaMap[r.lojaId]?.nome ?? '—',
        plataforma:  lojaMap[r.lojaId]?.plataforma ?? null,
        clienteId:   lojaMap[r.lojaId]?.clienteId ?? null,
        clienteNome: lojaMap[r.lojaId]?.clienteNome ?? null,
        variacao:    r.variacao,
      }))
      .sort((a, b) => b.variacao - a.variacao)
      .slice(0, 3)
  }, [resultadosSemanaSelecionada, lojas, lojasAtivasGlobal])

  const abrirPerformanceCard = useCallback(async (item) => {
    if (!item?.lojaId) return
    setPerformanceCliente({
      id:            item.clienteId ?? null,
      nome:          item.clienteNome ?? item.nome,
      plataformas:   item.plataforma ? [item.plataforma] : [],
      organizacaoId: isSuperAdmin ? null : (user?.organizacaoId ?? null),
    })
    setPerformanceData(null)
    setLoadingPerformance(true)
    try {
      const escopoOrg = isSuperAdmin ? [] : [where('organizacaoId', '==', user.organizacaoId ?? null)]
      const [resultadosSnap, acoesSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.RESULTADOS), ...escopoOrg, where('lojaId', '==', item.lojaId), orderBy('semana', 'desc'))),
        getDocs(query(collection(db, COLLECTIONS.ACOES), ...escopoOrg, where('lojaId', '==', item.lojaId), orderBy('timestamp', 'desc'), limit(20))),
      ])

      const maisRecentesPrimeiro = resultadosSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const cronologico          = [...maisRecentesPrimeiro].reverse()

      const weeklyPerformance = cronologico.slice(-4).map(r => ({
        weekLabel: weekLabel(r.semana),
        revenue:   r.faturamento ?? null,
        orders:    r.totalVendas ?? null,
        avgTicket: r.ticketMedio ?? null,
        rating:    r.nota ?? null,
      }))

      const primeira      = cronologico[0]
      const ultima4Semanas = cronologico.slice(-4)
      const media = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null
      const mediaOuNull = arr => { const vals = arr.filter(v => v != null); return vals.length ? media(vals) : null }

      const baseline = primeira ? {
        first7Days: { revenue: primeira.faturamento ?? null, orders: primeira.totalVendas ?? null, rating: primeira.nota ?? null },
        last7Days:  maisRecentesPrimeiro[0] ? { revenue: maisRecentesPrimeiro[0].faturamento ?? null, orders: maisRecentesPrimeiro[0].totalVendas ?? null, rating: maisRecentesPrimeiro[0].nota ?? null } : null,
        last30Days: ultima4Semanas.length ? {
          revenue: media(ultima4Semanas.map(r => r.faturamento ?? 0)),
          orders:  media(ultima4Semanas.map(r => r.totalVendas ?? 0)) != null ? Math.round(media(ultima4Semanas.map(r => r.totalVendas ?? 0))) : null,
          rating:  mediaOuNull(ultima4Semanas.map(r => r.nota)),
        } : null,
      } : null

      const managerActions = acoesSnap.docs.map(d => {
        const a = d.data()
        return {
          id:          d.id,
          date:        a.timestamp ?? null,
          category:    a.plataforma ?? null,
          description: a.descricao ?? '',
          impact:      a.status === 'concluida' ? 'Concluída' : null,
        }
      })

      setPerformanceData({
        weeklyPerformance,
        managerActions,
        totalActionsCount: managerActions.length,
        baseline,
      })
    } catch (err) {
      console.error('[Dashboard] erro ao carregar performance da loja:', err?.code, err?.message)
      setPerformanceData({ weeklyPerformance: [], managerActions: [], totalActionsCount: 0, baseline: null })
    } finally {
      setLoadingPerformance(false)
    }
  }, [user, isSuperAdmin])

  const fecharPerformanceCard = useCallback(() => {
    setPerformanceCliente(null)
    setPerformanceData(null)
  }, [])

  const topGestores = useMemo(() => {
    const varW = {}, fatW = {}
    resultadosSemanaSelecionada.forEach(r => {
      const fat = r.faturamento ?? 0
      if (r.variacao != null && fat > 0 && gestoresMap[r.gestorId]) {
        varW[r.gestorId] = (varW[r.gestorId] ?? 0) + r.variacao * fat
        fatW[r.gestorId] = (fatW[r.gestorId] ?? 0) + fat
      }
    })
    return Object.keys(fatW)
      .map(gid => ({
        gestorId: gid,
        nome:     gestoresMap[gid]?.nome ?? '—',
        variacao: fatW[gid] > 0 ? varW[gid] / fatW[gid] : null,
      }))
      .filter(g => g.variacao != null)
      .sort((a, b) => b.variacao - a.variacao)
      .slice(0, 3)
  }, [resultadosSemanaSelecionada, gestoresMap])

  const statusPorGestor = useMemo(() => {
    if (!isAdmin || !gestores.length) return []
    const resultadoSet = new Set(resultadosSemanaAnterior.map(r => r.lojaId))
    const DIA_OFFSET   = { segunda: 0, terca: 1, quarta: 2, quinta: 3, sexta: 4, sabado: 5 }
    const todayOffset  = (new Date().getDay() + 6) % 7

    return gestores
      .map(g => {
        const lojasG = lojas.filter(l => l.gestorId === g.id && lojaAtiva(l))
        if (!lojasG.length) return null

        const comResultado = lojasG.filter(l =>  resultadoSet.has(l.id))
        const semResultado = lojasG.filter(l => !resultadoSet.has(l.id))

        const lojasComRelStatus = lojasG.map(l => {
          const st = relatoriosSemanaisAdmin[l.id] || {}
          let relStatus
          if (st.enviado) {
            relStatus = 'enviado'
          } else if (!l.diaRelatorio) {
            relStatus = 'pendente'
          } else {
            const off = DIA_OFFSET[l.diaRelatorio] ?? null
            if (off == null)          relStatus = 'pendente'
            else if (off < todayOffset) relStatus = 'atrasado'
            else if (off === todayOffset) relStatus = 'pendente'
            else                      relStatus = 'no_prazo'
          }
          return { ...l, relStatus }
        })

        const relEnviadas  = lojasComRelStatus.filter(l => l.relStatus === 'enviado')
        const relAtrasadas = lojasComRelStatus.filter(l => l.relStatus === 'atrasado')
        const relPendentes = lojasComRelStatus.filter(l => l.relStatus === 'pendente')
        const relNoPrazo   = lojasComRelStatus.filter(l => l.relStatus === 'no_prazo')

        return {
          id: g.id, nome: g.nome ?? '—',
          total: lojasG.length,
          comResultado, semResultado,
          nResultados:   comResultado.length,
          lojasRelSorted: [...relAtrasadas, ...relPendentes, ...relNoPrazo, ...relEnviadas],
          nRelEnviadas:  relEnviadas.length,
          nRelAtrasadas: relAtrasadas.length,
          nRelPendentes: relPendentes.length,
          nRelNoPrazo:   relNoPrazo.length,
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [isAdmin, gestores, lojas, resultadosSemanaAnterior, relatoriosSemanaisAdmin])

  const [expandido, setExpandido] = useState(null)

  function toggleExpand(gestorId, col) {
    setExpandido(prev =>
      prev?.gestorId === gestorId && prev?.col === col ? null : { gestorId, col }
    )
  }

  const [selectedLoja, setSelectedLoja] = useState('')

  const lojaLineData = useMemo(() => {
    if (!selectedLoja) return []
    const byWeek = {}
    resultadosHistorico
      .filter(r => r.lojaId === selectedLoja)
      .forEach(r => { byWeek[r.semana] = r.faturamento ?? 0 })
    return [...last8Weeks].reverse().map(w => ({
      semana:      weekLabel(w),
      faturamento: byWeek[w] ?? 0,
    }))
  }, [selectedLoja, resultadosHistorico, last8Weeks])

  const lojaSelecionadaNome = useMemo(() =>
    lojasVisiveis.find(l => l.id === selectedLoja)?.nome ?? '',
    [lojasVisiveis, selectedLoja]
  )

  // ── Derivados do consolidado ────────────────────────────────────────────────

  const cLojaMap = useMemo(() =>
    Object.fromEntries(lojasVisiveis.map(l => [l.id, l])),
    [lojasVisiveis]
  )

  const cStats = useMemo(() => {
    const visSet = new Set(lojasVisiveis.map(l => l.id))
    const atual  = cResultados.filter(r => visSet.has(r.lojaId))
    const prev   = cPrevRes.filter(r => visSet.has(r.lojaId))
    const totalAtual    = atual.reduce((s, r) => s + (r.faturamento ?? 0), 0)
    const totalPrev     = prev.reduce((s, r) => s + (r.faturamento ?? 0), 0)
    const crescimento   = totalPrev > 0 ? ((totalAtual - totalPrev) / totalPrev) * 100 : null
    return { totalAtual, crescimento }
  }, [cResultados, cPrevRes, lojasVisiveis])

  const cEvolData = useMemo(() => {
    const visSet = new Set(lojasVisiveis.map(l => l.id))

    if (cMode === 'semana') {
      const byWeek = {}
      resultadosHistorico
        .filter(r => visSet.has(r.lojaId))
        .forEach(r => { byWeek[r.semana] = (byWeek[r.semana] ?? 0) + (r.faturamento ?? 0) })
      return [...getLast8Weeks()].reverse().map(w => ({
        label: weekLabel(w), faturamento: byWeek[w] ?? 0,
      }))
    }

    if (cMode === 'mes') {
      const byMonth = {}
      cEvolRes
        .filter(r => visSet.has(r.lojaId))
        .forEach(r => {
          const mk = weekToMonth(r.semana)
          byMonth[mk] = (byMonth[mk] ?? 0) + (r.faturamento ?? 0)
        })
      return Array.from({ length: 6 }, (_, i) => {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i))
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return { label: `${MONTH_NAMES[d.getMonth()]}/${d.getFullYear()}`, faturamento: byMonth[mk] ?? 0 }
      })
    }

    if (cMode === 'custom' && cDe && cAte) {
      const byWeek = {}
      cEvolRes
        .filter(r => visSet.has(r.lojaId))
        .forEach(r => { byWeek[r.semana] = (byWeek[r.semana] ?? 0) + (r.faturamento ?? 0) })
      return getWeeksInRange(cDe, cAte).sort().map(w => ({
        label: weekLabel(w), faturamento: byWeek[w] ?? 0,
      }))
    }

    return []
  }, [cMode, cResultados, cEvolRes, resultadosHistorico, lojasVisiveis, cDe, cAte])

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleResultadoSaved(newDoc) {
    setResultadosSemanaAnterior(prev => [...prev, newDoc])
    setModalResultado(null)
  }

  function handleRelatorioSaved(lojaId, statusObj) {
    setRelatoriosSemanais(prev => ({ ...prev, [lojaId]: statusObj }))
    setModalRelatorio(null)
  }

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: '28px 20px' }}>
        <div style={{ height: '16px', width: '80px', backgroundColor: '#FFFFFF', borderRadius: '4px', marginBottom: '20px' }} className="animate-skeleton" />
        <div className="grid grid-cols-1 sm:grid-cols-4" style={{ gap: '12px', marginBottom: '16px' }}>
          {[0, 1, 2, 3].map(i => <Skeleton.KPI key={i} />)}
        </div>
        <Skeleton.Table rows={8} cols={3} />
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <motion.div
      style={{ padding: '28px 20px' }}
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="typography-page-title" style={{ marginBottom: 0 }}>Dashboard</h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={selectedWeek}
            onChange={e => setSelectedWeek(e.target.value)}
            className="select font-sans w-full sm:w-[220px] h-11 sm:h-[30px]"
            style={{ fontSize: '13px', fontWeight: 500, color: '#333333' }}
          >
            {weekOptions12.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {isAdmin && gestores.length > 0 && (
            <select
              value={filtroGestor}
              onChange={e => setFiltroGestor(e.target.value)}
              className="select font-sans w-full sm:w-[200px] h-11 sm:h-[30px]"
              style={{ fontSize: '13px', fontWeight: 500, color: '#333333' }}
            >
              <option value="">Todos os gestores</option>
              {gestores.map(g => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Pendências — relatórios atrasados e lojas sem resultado, em um único card */}
      <AnimatePresence>
        {(lojasAtrasadas.length > 0 || (isAdmin && lojasSemRelatorio.length > 0)) && (
          <motion.div
            variants={listVariants}
            initial="initial"
            animate="animate"
            exit={{ opacity: 0 }}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E8E8E8',
              borderRadius: '10px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              marginBottom: '16px',
              overflow: 'hidden',
            }}
          >
            {lojasAtrasadas.length > 0 && (
              <motion.div
                variants={itemVariants}
                style={{
                  display: 'flex', alignItems: 'center', gap: '11px',
                  padding: '11px 16px 11px 14px',
                  borderLeft: '3px solid #DC2626',
                  borderBottom: isAdmin && lojasSemRelatorio.length > 0 ? '1px solid #F3F3F3' : 'none',
                }}
              >
                <span style={{ flexShrink: 0, width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#DC2626' }}>
                  <AlertTriangle size={13} color="#FFFFFF" strokeWidth={2.25} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="font-sans" style={{ fontSize: '13px', fontWeight: 400, color: '#111111', lineHeight: 1.35 }}>
                    <span style={{ fontWeight: 700 }}>{lojasAtrasadas.length}</span>
                    {' '}{lojasAtrasadas.length === 1 ? 'relatório atrasado' : 'relatórios atrasados'}
                  </p>
                  <p className="font-sans" style={{ fontSize: '11.5px', fontWeight: 400, color: '#999999', lineHeight: 1.4, marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lojasAtrasadas.map(l => l.nome).join(', ')}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/controle')}
                  className="font-sans"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 500, color: '#999999', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'color 150ms' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
                  onMouseLeave={e => e.currentTarget.style.color = '#999999'}
                >
                  Ver detalhes
                  <ArrowRight size={12} strokeWidth={2} />
                </button>
              </motion.div>
            )}

            {isAdmin && lojasSemRelatorio.length > 0 && (
              <motion.div
                variants={itemVariants}
                style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 16px 11px 14px', borderLeft: '3px solid #CA8A04' }}
              >
                <span style={{ flexShrink: 0, width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#CA8A04' }}>
                  <AlertCircle size={13} color="#FFFFFF" strokeWidth={2.25} />
                </span>
                <p className="font-sans" style={{ flex: 1, fontSize: '13px', fontWeight: 400, color: '#111111', lineHeight: 1.35 }}>
                  <span style={{ fontWeight: 700 }}>{lojasSemRelatorio.length}</span>
                  {' '}{lojasSemRelatorio.length === 1 ? 'loja sem resultado' : 'lojas sem resultado'} na semana anterior
                </p>
                <button
                  onClick={() => navigate('/controle')}
                  className="font-sans"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 500, color: '#999999', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'color 150ms' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#CA8A04'}
                  onMouseLeave={e => e.currentTarget.style.color = '#999999'}
                >
                  Ver detalhes
                  <ArrowRight size={12} strokeWidth={2} />
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Lojas + Top Gestores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 items-start" style={{ gap: '16px', marginBottom: '16px' }}>
        <RankingCard icon={Store} title="Top Lojas"    items={topLojas}    periodLabel={selectedWeekMeta?.fullLabel} onSelectLoja={abrirPerformanceCard} />
        <RankingCard icon={Users} title="Top Gestores" items={topGestores} periodLabel={selectedWeekMeta?.fullLabel} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: '12px', marginBottom: '16px' }}>
        <KPICard
          label="Faturamento da Carteira"
          value={formatBRLDecimal(kpis.faturamentoCarteira)}
          currency
          badge={kpis.faturamentoVariacao != null ? {
            text: `${kpis.faturamentoVariacao >= 0 ? '▲' : '▼'} ${kpis.faturamentoVariacao >= 0 ? '+' : '−'}${Math.abs(kpis.faturamentoVariacao).toFixed(1).replace('.', ',')}%`,
            color: kpis.faturamentoVariacao >= 0 ? '#16A34A' : '#DC2626',
          } : null}
          sub="vs semana anterior"
          subColor="#BBBBBB"
        />
        <VariacaoMediaCard media7dias={kpis.mediaVar} media30dias={media30dias} />
        <KPICard
          label="Relatórios em Dia"
          value={`${relatoriosEmDia.pct}%`}
          sub={`${relatoriosEmDia.emDiaCount} de ${relatoriosEmDia.elegiveisCount} lojas elegíveis`}
          progress={relatoriosEmDia.pct}
        />
      </div>

      {/* Ranking + painel direito */}
      <div className={`grid grid-cols-1 gap-4 mb-4 ${!isAdmin ? 'sm:grid-cols-[2fr_3fr]' : ''}`}>
        <SectionCard
          title="Ranking da Semana"
          subtitle={
            <>
              {selectedWeek ? formatWeekPeriodFull(selectedWeek) : ''}
              {' · '}
              <span style={{ fontSize: '12px', color: '#999999' }}>
                {RANKING_SORT_LABELS[rankingSort]}
              </span>
            </>
          }
          headerRight={
            <select
              value={rankingSort}
              onChange={e => setRankingSort(e.target.value)}
              className="select font-sans"
              style={{
                width: 'auto', height: 'auto', flexShrink: 0,
                fontSize: '11px', fontWeight: 500, color: '#666666',
                backgroundColor: '#F5F5F5', borderRadius: '20px',
                padding: '5px 28px 5px 12px',
              }}
            >
              <option value="variacao_desc">Maior variação</option>
              <option value="variacao_asc">Menor variação</option>
              <option value="faturamento_desc">Maior faturamento</option>
            </select>
          }
        >
          <div className="overflow-x-auto">
            <RankingList items={ranking} showGestor={isAdmin} onSelectLoja={abrirPerformanceCard} />
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid #F3F3F3', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => navigate('/ranking')}
              className="font-sans"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '13px', fontWeight: 500, color: '#666666',
                backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8',
                borderRadius: '6px', padding: '8px 16px', cursor: 'pointer',
                transition: 'background-color 150ms, border-color 150ms, color 150ms',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = '#F9F9F9'
                e.currentTarget.style.borderColor = '#DDDDDD'
                e.currentTarget.style.color = '#111111'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = '#FFFFFF'
                e.currentTarget.style.borderColor = '#E8E8E8'
                e.currentTarget.style.color = '#666666'
              }}
            >
              Ver ranking completo
              <ArrowRight size={14} strokeWidth={1.75} />
            </button>
          </div>
        </SectionCard>

        {/* Gestor: dois cards de status empilhados */}
        {!isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <GestorStatusCard
              title="Resultados — Semana Anterior"
              periodoLabel={formatWeekPeriod(prevWeek)}
              items={checklistSemanaAnterior}
              hideCompleted
              emptyDoneMessage={lojasAtivas.length > 0 ? 'Tudo lançado ✓' : null}
              onClickPending={item => {
                const loja = lojasAtivas.find(l => l.id === item.id) ?? item
                setModalResultado(loja)
              }}
            />
            <GestorStatusCard
              title="Relatórios — Semana Atual"
              periodoLabel={formatWeekPeriod(currentWeek)}
              items={checklistRelatorios}
              hideCompleted
              emptyDoneMessage={lojasAtivas.length > 0 ? 'Tudo em dia ✓' : null}
              onClickPending={item => {
                const loja = lojasAtivas.find(l => l.id === item.id) ?? item
                setModalRelatorio({ loja, lojaStatus: item.lojaStatus })
              }}
            />
          </div>
        )}
      </div>

      {/* Status da semana por gestor (admin) */}
      {isAdmin && (
        <GestorStatusTable
          rows={statusPorGestor}
          expandido={expandido}
          onToggle={toggleExpand}
        />
      )}

      {/* ── Faturamento Consolidado ──────────────────────────────────────── */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: '28px' }}>

        <div style={{ padding: '16px 16px 12px', marginBottom: '12px', borderBottom: '1px solid #F3F3F3', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <p style={{ fontSize: '16px', fontWeight: 700, color: '#111111', letterSpacing: '-0.01em' }}>Faturamento Consolidado</p>
            <p style={{ fontSize: '12px', color: '#999999', fontWeight: 400, marginTop: '2px' }}>
              {cMode === 'semana' ? (WEEK_OPTIONS.find(o => o.value === cSemana)?.label ?? '—')
                : cMode === 'mes' ? (MONTH_OPTIONS.find(o => o.value === cMes)?.label ?? '—')
                : (cDe && cAte) ? `${cDe.split('-').reverse().join('/')} a ${cAte.split('-').reverse().join('/')}` : 'Selecione o período'}
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[['semana','Por semana'],['mes','Por mês'],['custom','Período']].map(([m, lbl]) => (
                <button
                  key={m}
                  onClick={() => setCMode(m)}
                  style={{
                    padding: '3px 10px',
                    fontSize: '12px',
                    borderRadius: '5px',
                    transition: 'all 150ms',
                    border: cMode === m ? '1px solid #E5322D' : '1px solid #E8E8E8',
                    color: cMode === m ? '#E5322D' : '#666666',
                    backgroundColor: cMode === m ? 'rgba(229,50,45,0.05)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {cMode === 'semana' && (
              <select value={cSemana} onChange={e => setCSemana(e.target.value)} className="select" style={{ width: '168px', height: '28px', fontSize: '12px' }}>
                {WEEK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            {cMode === 'mes' && (
              <select value={cMes} onChange={e => setCMes(e.target.value)} className="select" style={{ width: '136px', height: '28px', fontSize: '12px' }}>
                {MONTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            {cMode === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="date" value={cDe}  onChange={e => setCDe(e.target.value)}  className="input" style={{ width: '136px', height: '28px', fontSize: '12px' }} />
                <span style={{ fontSize: '11px', color: '#999999' }}>até</span>
                <input type="date" value={cAte} onChange={e => setCAte(e.target.value)} className="input" style={{ width: '136px', height: '28px', fontSize: '12px' }} />
              </div>
            )}
          </div>
        </div>

        {loadingC ? (
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '12px', padding: '16px' }}>
            <Skeleton.KPI /><Skeleton.KPI />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '12px', padding: '16px' }}>
            <div className="card-kpi">
              <p className="section-label" style={{ marginBottom: '10px' }}>Faturamento total</p>
              <p className="kpi-value">{formatBRL(cStats.totalAtual)}</p>
            </div>
            <div className="card-kpi">
              <p className="section-label" style={{ marginBottom: '10px' }}>Crescimento vs anterior</p>
              <p className="kpi-value" style={{
                color: cStats.crescimento == null ? '#111111'
                  : cStats.crescimento >= 0 ? '#16A34A' : '#DC2626',
              }}>
                {cStats.crescimento == null ? '—'
                  : `${cStats.crescimento >= 0 ? '+' : '−'}${Math.abs(cStats.crescimento).toFixed(1)}%`}
              </p>
            </div>
          </div>
        )}

        {!loadingC && cEvolData.some(d => d.faturamento > 0) && (
          <div style={{ borderTop: '1px solid #F3F3F3', padding: '16px 16px 12px' }}>
            <p style={{ fontSize: '16px', fontWeight: 700, color: '#111111', letterSpacing: '-0.01em' }}>Evolução da Carteira</p>
            <p style={{ fontSize: '12px', color: '#999999', fontWeight: 400, marginTop: '2px', marginBottom: '12px' }}>
              {cMode === 'mes' ? 'Últimos 6 meses' : 'Últimas 8 semanas'}
            </p>
            <div style={{ height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cEvolData} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="#F3F3F3" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: '#BBBBBB', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#BBBBBB', fontSize: 11, fontFamily: "'Segoe UI', system-ui, sans-serif" }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={32} />
                  <Tooltip content={<ChartTooltip formatter={formatBRL} />} />
                  <Line type="monotone" dataKey="faturamento" stroke="#E5322D" strokeWidth={1.5}
                    dot={{ fill: '#E5322D', r: 2.5, strokeWidth: 0 }}
                    activeDot={{ r: 3.5, fill: '#E5322D', strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {!loadingC && cEvolData.every(d => d.faturamento === 0) && (
          <p style={{ fontSize: '12px', color: '#999999', textAlign: 'center', padding: '24px 0', borderTop: '1px solid #F3F3F3' }}>
            Nenhum dado no período selecionado.
          </p>
        )}
      </div>

      {/* Ver por loja */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: '28px' }}>
        <div style={{ padding: '16px 16px 12px', marginBottom: '12px', borderBottom: '1px solid #F3F3F3', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          <p style={{ fontSize: '16px', fontWeight: 700, color: '#111111', letterSpacing: '-0.01em', marginRight: 'auto' }}>Análise por Loja</p>
          <LojaSelect
            lojas={lojasVisiveis.filter(lojaAtiva)}
            value={selectedLoja}
            onChange={setSelectedLoja}
            gestorMap={gestoresMap}
            style={{ width: '220px' }}
          />
        </div>
        {selectedLoja && lojaLineData.some(d => d.faturamento > 0) ? (
          <div style={{ height: '240px', padding: '16px 16px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lojaLineData} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="#F3F3F3" strokeDasharray="3 3" />
                <XAxis dataKey="semana" tick={{ fill: '#BBBBBB', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#BBBBBB', fontSize: 11, fontFamily: "'Segoe UI', system-ui, sans-serif" }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={32} />
                <Tooltip content={<ChartTooltip formatter={formatBRL} />} />
                <Line type="monotone" dataKey="faturamento" stroke="#E5322D" strokeWidth={1.5}
                  dot={{ fill: '#E5322D', r: 2.5, strokeWidth: 0 }}
                  activeDot={{ r: 3.5, fill: '#E5322D', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p style={{ fontSize: '12px', color: '#999999', textAlign: 'center', padding: '24px 0' }}>
            {selectedLoja ? 'Sem dados históricos para esta loja.' : 'Selecione uma loja para ver a evolução.'}
          </p>
        )}
      </div>

      {/* Faturamento total da loja selecionada — últimas 8 semanas */}
      {selectedLoja && (
        <SectionCard
          title="Faturamento Total"
          subtitle={`${lojaSelecionadaNome ? lojaSelecionadaNome + ' — ' : ''}Acumulado das últimas 8 semanas`}
          headerRight={null}
          style={{ marginTop: '28px' }}
        >
          {lojaLineData.every(d => d.faturamento === 0) ? (
            <p style={{ fontSize: '12px', color: '#999999', textAlign: 'center', padding: '24px 0' }}>
              Sem histórico disponível.
            </p>
          ) : (
            <>
              <div style={{ padding: '0 16px 8px' }}>
                <p className="font-mono" style={{ fontSize: '28px', fontWeight: 800, color: '#111111', lineHeight: 1 }}>
                  {formatBRL(lojaLineData.reduce((s, d) => s + d.faturamento, 0))}
                </p>
              </div>
              <div style={{ height: '140px', padding: '0 16px 8px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lojaLineData} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="#F3F3F3" strokeDasharray="3 3" />
                    <XAxis dataKey="semana" tick={{ fill: '#999999', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: '#999999', fontSize: 10 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                      width={32}
                    />
                    <Tooltip content={<ChartTooltip formatter={formatBRL} />} />
                    <Line
                      type="monotone"
                      dataKey="faturamento"
                      stroke="#E5322D"
                      strokeWidth={1.5}
                      dot={{ fill: '#E5322D', r: 2.5, strokeWidth: 0 }}
                      activeDot={{ r: 3.5, fill: '#E5322D', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </SectionCard>
      )}

      {/* Modais */}
      {modalResultado && (
        <ModalLancamentoRapido
          loja={modalResultado}
          semana={prevWeek}
          periodoLabel={formatWeekPeriod(prevWeek)}
          onClose={() => setModalResultado(null)}
          onSaved={handleResultadoSaved}
        />
      )}
      {modalRelatorio && (
        <ModalRelatorio
          loja={modalRelatorio.loja}
          semana={currentWeek}
          periodoLabel={formatWeekPeriod(currentWeek)}
          lojaStatus={modalRelatorio.lojaStatus}
          onClose={() => setModalRelatorio(null)}
          onSaved={handleRelatorioSaved}
        />
      )}

      <Modal isOpen={!!performanceCliente} onClose={fecharPerformanceCard} title="Performance da loja" width="max-w-3xl">
        {loadingPerformance || !performanceData ? (
          <div className="flex flex-col gap-3 py-4">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <GestorPerformanceCard
            cliente={performanceCliente}
            weeklyPerformance={performanceData.weeklyPerformance}
            managerActions={performanceData.managerActions}
            totalActionsCount={performanceData.totalActionsCount}
            baseline={performanceData.baseline}
          />
        )}
      </Modal>
    </motion.div>
  )
}
