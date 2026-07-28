import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { db, COLLECTIONS, collection, query, where, getDocs } from '../services/firebase'
import Skeleton from '../components/UI/Skeleton'
import PlatformBadge from '../components/UI/PlatformBadge'

// ── Utilities ─────────────────────────────────────────────────────────────────

function getISOWeekStr(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function getLast8Weeks() {
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    return getISOWeekStr(d)
  })
}

function getCurrentMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getPrevMonthStr(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getWeeksInMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const last  = new Date(y, m, 0)
  const weeks = new Set()
  const cur   = new Date(first)
  while (cur <= last) {
    weeks.add(getISOWeekStr(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return [...weeks]
}

function formatBRL(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
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

// ── Animation variants ────────────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

const listVariants = { animate: { transition: { staggerChildren: 0.04 } } }
const itemVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.15 } },
}

// ── SortHeader ────────────────────────────────────────────────────────────────

function SortHeader({ col, label, current, dir, onSort, align = 'left' }) {
  const isActive = col === current
  const Icon = isActive ? (dir === 'desc' ? ArrowDown : ArrowUp) : null
  return (
    <button
      onClick={() => onSort(col)}
      className={[
        'flex items-center gap-1 section-label hover:text-text-muted transition-colors duration-150 w-full',
        align === 'right' ? 'justify-end' : 'justify-start',
        isActive ? 'text-text-muted' : '',
      ].join(' ')}
    >
      {align === 'right' && Icon && <Icon size={10} strokeWidth={2} />}
      {label}
      {align === 'left' && Icon && <Icon size={10} strokeWidth={2} />}
    </button>
  )
}

// ── Cards mobile (telas <sm — a tabela de muitas colunas vira card por item) ───

function LojaMobileCard({ item, index }) {
  const posColor = index === 0 ? '#111111' : index === 1 ? '#666666' : '#999999'
  const varColor = item.variacao == null ? '#999999' : item.variacao >= 0 ? '#16A34A' : '#DC2626'
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
      <span className="font-mono text-[13px] shrink-0" style={{ color: posColor }}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[14px] text-text-primary font-medium truncate">{item.nome}</span>
          {item.plataforma && <PlatformBadge plataforma={item.plataforma} />}
        </div>
        <p className="text-[12px] text-text-muted truncate mt-0.5">{item.gestorNome}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono text-[13px] text-text-muted">{formatBRL(item.faturamento)}</p>
        <p className="font-mono text-[13px] font-medium mt-0.5" style={{ color: varColor }}>{formatVar(item.variacao)}</p>
      </div>
    </div>
  )
}

function GestorMobileCard({ item, index }) {
  const posColor = index === 0 ? '#111111' : index === 1 ? '#666666' : '#999999'
  const varColor = item.variacao == null ? '#999999' : item.variacao >= 0 ? '#16A34A' : '#DC2626'
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
      <span className="font-mono text-[13px] shrink-0" style={{ color: posColor }}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-[14px] text-text-primary font-medium truncate block">{item.nome}</span>
        <p className="text-[12px] text-text-muted truncate mt-0.5">
          {item.lojaCount} loja{item.lojaCount !== 1 ? 's' : ''} · {item.relEnviados} de {item.lojaCount} relatórios
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono text-[13px] text-text-muted">{formatBRL(item.faturamento)}</p>
        <p className="font-mono text-[13px] font-medium mt-0.5" style={{ color: varColor }}>{formatVar(item.variacao)}</p>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Ranking() {
  const { user, isSuperAdmin } = useAuth()

  const [tab,    setTab]    = useState('lojas')
  const [period, setPeriod] = useState('semana_ant')
  const [clienteFiltro, setClienteFiltro] = useState('')
  const [loading, setLoading] = useState(true)

  // Per-tab sort state
  const [lojaSortCol,   setLojaSortCol]   = useState('variacao')
  const [lojaSortDir,   setLojaSortDir]   = useState('desc')
  const [gestorSortCol, setGestorSortCol] = useState('variacao')
  const [gestorSortDir, setGestorSortDir] = useState('desc')

  const [lojas,        setLojas]        = useState([])
  const [gestoresMap,  setGestoresMap]  = useState({})
  const [resultados,   setResultados]   = useState([])
  const [currentWeeks, setCurrentWeeks] = useState([])
  const [prevWeeks,    setPrevWeeks]    = useState([])

  // ── Sort handlers ─────────────────────────────────────────────────────────

  function handleLojaSort(col) {
    if (col === lojaSortCol) {
      setLojaSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setLojaSortCol(col)
      setLojaSortDir(col === 'nome' || col === 'gestor' ? 'asc' : 'desc')
    }
  }

  function handleGestorSort(col) {
    if (col === gestorSortCol) {
      setGestorSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setGestorSortCol(col)
      setGestorSortDir(col === 'nome' ? 'asc' : 'desc')
    }
  }

  // ── Data fetch ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const all8 = getLast8Weeks()
    let cWeeks, pWeeks
    if (period === 'semana_ant') {
      cWeeks = [all8[1]]; pWeeks = [all8[2]]
    } else if (period === 'semana') {
      cWeeks = [all8[0]]; pWeeks = [all8[1]]
    } else if (period === '4semanas') {
      cWeeks = all8.slice(0, 4); pWeeks = all8.slice(4, 8)
    } else {
      const curr = getCurrentMonthStr()
      cWeeks = getWeeksInMonth(curr)
      pWeeks = getWeeksInMonth(getPrevMonthStr(curr))
    }

    async function load() {
      setLoading(true)
      try {
        const allWeeks = [...new Set([...cWeeks, ...pWeeks])]
        // Leitura de lojas/users/resultados exige mesmaOrg() nas regras — sem
        // esse filtro o Firestore rejeita a query inteira pra admin_org/gestor.
        const orgId = user.organizacaoId ?? null
        const escopoOrg = isSuperAdmin ? [] : [where('organizacaoId', '==', orgId)]

        const [lojasSnap, gestoresSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.LOJAS), ...escopoOrg)),
          getDocs(query(collection(db, COLLECTIONS.USERS), ...escopoOrg, where('perfil', '==', 'gestor'))),
        ])

        if (cancelled) return

        let allRes = []
        for (let i = 0; i < allWeeks.length; i += 30) {
          const snap = await getDocs(query(
            collection(db, COLLECTIONS.RESULTADOS),
            ...escopoOrg,
            where('semana', 'in', allWeeks.slice(i, i + 30)),
          ))
          snap.docs.forEach(d => allRes.push({ id: d.id, ...d.data() }))
        }

        if (cancelled) return

        setLojas(lojasSnap.docs.map(d => ({ id: d.id, ...d.data() })))

        const gMap = {}
        gestoresSnap.docs.forEach(d => { gMap[d.id] = { id: d.id, ...d.data() } })
        setGestoresMap(gMap)
        setResultados(allRes)
        setCurrentWeeks(cWeeks)
        setPrevWeeks(pWeeks)
      } catch (err) {
        console.error('[Ranking] erro:', err?.code, err?.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user, isSuperAdmin, period])

  // ── Base lojas ranking (unsorted) ─────────────────────────────────────────

  // Opções do filtro por cliente — derivadas direto das lojas (clienteId/
  // clienteNome já vêm denormalizados em cada loja, sem precisar buscar a
  // coleção de clientes à parte).
  const clientesOptions = useMemo(() => {
    const map = {}
    lojas.forEach(l => {
      if (l.clienteId && !map[l.clienteId]) map[l.clienteId] = { id: l.clienteId, nome: l.clienteNome ?? '—' }
    })
    return Object.values(map).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [lojas])

  const lojasBase = useMemo(() => {
    if (!currentWeeks.length) return []
    const currentSet = new Set(currentWeeks)
    const prevSet    = new Set(prevWeeks)
    const currentRes = resultados.filter(r => currentSet.has(r.semana))
    const prevRes    = resultados.filter(r => prevSet.has(r.semana))

    const byLojaFat     = {}
    const byLojaPrevFat = {}
    const byLojaVar     = {}

    currentRes.forEach(r => {
      byLojaFat[r.lojaId] = (byLojaFat[r.lojaId] ?? 0) + (r.faturamento ?? 0)
      if (r.variacao != null) byLojaVar[r.lojaId] = r.variacao
    })
    prevRes.forEach(r => {
      byLojaPrevFat[r.lojaId] = (byLojaPrevFat[r.lojaId] ?? 0) + (r.faturamento ?? 0)
    })

    const isSingleWeek = period === 'semana' || period === 'semana_ant'

    return lojas
      .filter(lojaAtiva)
      .filter(l => !clienteFiltro || l.clienteId === clienteFiltro)
      .map(l => {
        const fat     = byLojaFat[l.id] ?? 0
        const prevFat = byLojaPrevFat[l.id] ?? 0
        const variacao = isSingleWeek
          ? (byLojaVar[l.id] ?? null)
          : prevFat > 0 ? ((fat - prevFat) / prevFat) * 100 : null
        return {
          lojaId:      l.id,
          nome:        l.nome,
          clienteId:   l.clienteId ?? null,
          clienteNome: l.clienteNome ?? null,
          plataforma:  l.plataforma ?? null,
          gestorNome:  gestoresMap[l.gestorId]?.nome ?? '—',
          faturamento: fat,
          variacao,
        }
      })
      .filter(l => l.faturamento > 0)
  }, [lojas, resultados, currentWeeks, prevWeeks, gestoresMap, period, clienteFiltro])

  // ── Sorted lojas ranking ──────────────────────────────────────────────────

  const lojasRanking = useMemo(() => {
    return [...lojasBase].sort((a, b) => {
      if (lojaSortCol === 'nome') {
        const cmp = a.nome.localeCompare(b.nome, 'pt-BR')
        return lojaSortDir === 'asc' ? cmp : -cmp
      }
      if (lojaSortCol === 'gestor') {
        const cmp = (a.gestorNome ?? '').localeCompare(b.gestorNome ?? '', 'pt-BR')
        return lojaSortDir === 'asc' ? cmp : -cmp
      }
      if (lojaSortCol === 'faturamento') {
        return lojaSortDir === 'desc' ? b.faturamento - a.faturamento : a.faturamento - b.faturamento
      }
      return lojaSortDir === 'desc'
        ? (b.variacao ?? -Infinity) - (a.variacao ?? -Infinity)
        : (a.variacao ?? Infinity)  - (b.variacao ?? Infinity)
    })
  }, [lojasBase, lojaSortCol, lojaSortDir])

  // ── Base gestores ranking (unsorted) ─────────────────────────────────────

  const gestoresBase = useMemo(() => {
    if (!currentWeeks.length) return []
    const currentSet = new Set(currentWeeks)
    const prevSet    = new Set(prevWeeks)
    const currentRes = resultados.filter(r => currentSet.has(r.semana))
    const prevRes    = resultados.filter(r => prevSet.has(r.semana))

    const lojasByGestor = {}
    lojas.filter(lojaAtiva).forEach(l => {
      lojasByGestor[l.gestorId] = (lojasByGestor[l.gestorId] ?? 0) + 1
    })

    const byGestorFat      = {}
    const byGestorPrevFat  = {}
    const byGestorVarW     = {}
    const byGestorFatW     = {}
    const byGestorRelEnv   = {}

    currentRes.forEach(r => {
      const fat = r.faturamento ?? 0
      byGestorFat[r.gestorId] = (byGestorFat[r.gestorId] ?? 0) + fat
      if (r.variacao != null && fat > 0) {
        byGestorVarW[r.gestorId] = (byGestorVarW[r.gestorId] ?? 0) + r.variacao * fat
        byGestorFatW[r.gestorId] = (byGestorFatW[r.gestorId] ?? 0) + fat
      }
      if (r.relatorioEnviado === true) {
        byGestorRelEnv[r.gestorId] = (byGestorRelEnv[r.gestorId] ?? 0) + 1
      }
    })
    prevRes.forEach(r => {
      byGestorPrevFat[r.gestorId] = (byGestorPrevFat[r.gestorId] ?? 0) + (r.faturamento ?? 0)
    })

    const isSingleWeek = period === 'semana' || period === 'semana_ant'

    return Object.values(gestoresMap)
      .map(g => {
        const fat     = byGestorFat[g.id] ?? 0
        const prevFat = byGestorPrevFat[g.id] ?? 0
        let variacao  = null
        if (isSingleWeek) {
          const w = byGestorFatW[g.id] ?? 0
          variacao = w > 0 ? (byGestorVarW[g.id] ?? 0) / w : null
        } else {
          variacao = prevFat > 0 ? ((fat - prevFat) / prevFat) * 100 : null
        }
        return {
          gestorId:    g.id,
          nome:        g.nome ?? '—',
          lojaCount:   lojasByGestor[g.id] ?? 0,
          relEnviados: byGestorRelEnv[g.id] ?? 0,
          faturamento: fat,
          variacao,
        }
      })
      .filter(g => g.faturamento > 0)
  }, [lojas, resultados, currentWeeks, prevWeeks, gestoresMap, period])

  // ── Sorted gestores ranking ───────────────────────────────────────────────

  const gestoresRanking = useMemo(() => {
    return [...gestoresBase].sort((a, b) => {
      if (gestorSortCol === 'nome') {
        const cmp = a.nome.localeCompare(b.nome, 'pt-BR')
        return gestorSortDir === 'asc' ? cmp : -cmp
      }
      if (gestorSortCol === 'faturamento') {
        return gestorSortDir === 'desc' ? b.faturamento - a.faturamento : a.faturamento - b.faturamento
      }
      return gestorSortDir === 'desc'
        ? (b.variacao ?? -Infinity) - (a.variacao ?? -Infinity)
        : (a.variacao ?? Infinity)  - (b.variacao ?? Infinity)
    })
  }, [gestoresBase, gestorSortCol, gestorSortDir])

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: '28px 20px' }}>
        <div className="h-7 w-24 bg-surface animate-skeleton rounded mb-6" />
        <Skeleton.Table rows={10} cols={5} />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isLojasTab    = tab === 'lojas'
  const activeRanking = isLojasTab ? lojasRanking : gestoresRanking

  return (
    <motion.div
      style={{ padding: '28px 20px' }}
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      <div className="page-header flex items-center justify-between">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Ranking</h1>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Tab selector */}
        <div className="flex gap-1 mr-auto">
          {[['lojas', 'Lojas'], ['gestores', 'Gestores']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={[
                'px-4 py-1.5 text-[13px] rounded border transition-colors duration-150',
                tab === v
                  ? 'border-accent text-accent bg-accent-soft'
                  : 'border-border-hover text-text-muted hover:text-text-primary hover:border-[#DDDDDD]',
              ].join(' ')}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Period filter */}
        <div className="flex gap-1">
          {[
            ['semana_ant', 'Semana passada'],
            ['semana',     'Semana atual'],
            ['4semanas',   'Últimas 4 semanas'],
            ['mes',        'Último mês'],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setPeriod(v)}
              className={[
                'px-3 py-1 text-[12px] rounded border transition-colors duration-150',
                period === v
                  ? 'border-accent text-accent bg-accent-soft'
                  : 'border-border-hover text-text-muted hover:text-text-primary hover:border-[#DDDDDD]',
              ].join(' ')}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Filtro por cliente */}
        <select
          value={clienteFiltro}
          onChange={e => setClienteFiltro(e.target.value)}
          className="select"
          style={{ width: '180px' }}
        >
          <option value="">Todos os clientes</option>
          {clientesOptions.map(c => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </div>

      {/* Table — telas sm+; abaixo disso vira lista de cards (ver bloco seguinte) */}
      <div className="hidden sm:block bg-surface border border-border rounded-lg shadow-card overflow-hidden">

        {/* ── Lojas header ──────────────────────────────────────────────── */}
        {isLojasTab ? (
          <div className="grid grid-cols-[40px_1fr_160px_150px_120px] items-center px-4 h-10 bg-[#F9F9F9] border-b border-border">
            <span className="section-label">#</span>
            <SortHeader col="nome"        label="Loja"        current={lojaSortCol} dir={lojaSortDir} onSort={handleLojaSort} />
            <SortHeader col="gestor"      label="Gestor"      current={lojaSortCol} dir={lojaSortDir} onSort={handleLojaSort} />
            <SortHeader col="faturamento" label="Faturamento" current={lojaSortCol} dir={lojaSortDir} onSort={handleLojaSort} align="right" />
            <SortHeader col="variacao"    label="Variação %"  current={lojaSortCol} dir={lojaSortDir} onSort={handleLojaSort} align="right" />
          </div>
        ) : (
        /* ── Gestores header ────────────────────────────────────────────── */
          <div className="grid grid-cols-[40px_1fr_60px_150px_140px_120px] items-center px-4 h-10 bg-[#F9F9F9] border-b border-border">
            <span className="section-label">#</span>
            <SortHeader col="nome"        label="Gestor"      current={gestorSortCol} dir={gestorSortDir} onSort={handleGestorSort} />
            <span className="section-label text-right">Lojas</span>
            <span className="section-label text-right">Relatórios</span>
            <SortHeader col="faturamento" label="Faturamento" current={gestorSortCol} dir={gestorSortDir} onSort={handleGestorSort} align="right" />
            <SortHeader col="variacao"    label="Variação méd." current={gestorSortCol} dir={gestorSortDir} onSort={handleGestorSort} align="right" />
          </div>
        )}

        {/* Body */}
        {activeRanking.length === 0 ? (
          <p className="text-[13px] text-text-subtle text-center py-10">
            Nenhum resultado no período selecionado.
          </p>
        ) : (
          <motion.div
            key={`${tab}-${period}`}
            variants={listVariants}
            initial="initial"
            animate="animate"
          >
            {activeRanking.map((item, i) => {
              const posColor = i === 0 ? '#111111' : i === 1 ? '#666666' : '#999999'
              const varColor = item.variacao == null ? '#999999'
                : item.variacao >= 0 ? '#16A34A' : '#DC2626'

              return isLojasTab ? (
                <motion.div
                  key={item.lojaId}
                  variants={itemVariants}
                  className="grid grid-cols-[40px_1fr_160px_150px_120px] items-center px-4 h-12 border-b border-border last:border-0 hover:bg-black/[0.02] transition-colors duration-150"
                >
                  <span className="font-mono text-[13px]" style={{ color: posColor }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex items-center min-w-0 pr-4" style={{ gap: '8px' }}>
                    <span className="text-[14px] text-text-primary font-medium truncate min-w-0">
                      {item.nome}
                    </span>
                    {item.plataforma && <PlatformBadge plataforma={item.plataforma} />}
                  </span>
                  <span className="text-[13px] text-text-muted truncate pr-4 min-w-0">
                    {item.gestorNome}
                  </span>
                  <span className="font-mono text-[13px] text-text-muted text-right pr-2">
                    {formatBRL(item.faturamento)}
                  </span>
                  <span className="font-mono text-[13px] text-right font-medium" style={{ color: varColor }}>
                    {formatVar(item.variacao)}
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key={item.gestorId}
                  variants={itemVariants}
                  className="grid grid-cols-[40px_1fr_60px_150px_140px_120px] items-center px-4 h-12 border-b border-border last:border-0 hover:bg-black/[0.02] transition-colors duration-150"
                >
                  <span className="font-mono text-[13px]" style={{ color: posColor }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[14px] text-text-primary font-medium truncate pr-4 min-w-0">
                    {item.nome}
                  </span>
                  <span className="font-mono text-[13px] text-text-muted text-right">
                    {item.lojaCount}
                  </span>
                  <span className="font-mono text-[13px] text-text-muted text-right pr-2">
                    {item.relEnviados} de {item.lojaCount}
                  </span>
                  <span className="font-mono text-[13px] text-text-muted text-right pr-2">
                    {formatBRL(item.faturamento)}
                  </span>
                  <span className="font-mono text-[13px] text-right font-medium" style={{ color: varColor }}>
                    {formatVar(item.variacao)}
                  </span>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>

      {/* Lista de cards — só abaixo de sm, substitui a tabela de muitas colunas */}
      <div className="sm:hidden bg-surface border border-border rounded-lg shadow-card overflow-hidden">
        {activeRanking.length === 0 ? (
          <p className="text-[13px] text-text-subtle text-center py-10">
            Nenhum resultado no período selecionado.
          </p>
        ) : (
          <motion.div key={`${tab}-${period}-mobile`} variants={listVariants} initial="initial" animate="animate">
            {activeRanking.map((item, i) => (
              isLojasTab
                ? <LojaMobileCard key={item.lojaId} item={item} index={i} />
                : <GestorMobileCard key={item.gestorId} item={item} index={i} />
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
