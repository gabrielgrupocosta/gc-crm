import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  db, COLLECTIONS,
  collection, doc, getDoc, query, where, getDocs,
} from '../services/firebase'
import Skeleton from '../components/UI/Skeleton'
import { getISOWeekStr, getPrevWeekStr, getLastNWeeks, getPeriodoComparativo, fetchByWeeksBatched } from '../utils/semanas'
import VarBadge from '../components/UI/VarBadge'

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATAFORMAS = ['iFood', '99Food', 'Keeta']

// Header colorido por plataforma (mesmo padrão do Onboard.jsx)
const PLATAFORMA_HEADER_BG = {
  'iFood':  '#EA1D2C',
  '99Food': '#FFD700',
  'Keeta':  '#00B14F',
}
const PLATAFORMA_HEADER_TEXT = {
  'iFood':  '#FFFFFF',
  '99Food': '#111111',
  'Keeta':  '#FFFFFF',
}
const PLATAFORMA_BORDER = {
  'iFood':  'rgba(234,29,44,0.3)',
  '99Food': 'rgba(255,215,0,0.3)',
  'Keeta':  'rgba(0,177,79,0.3)',
}

const DIAS_ORDEM = [
  { key: 'segunda', label: 'Seg' },
  { key: 'terca',   label: 'Ter' },
  { key: 'quarta',  label: 'Qua' },
  { key: 'quinta',  label: 'Qui' },
  { key: 'sexta',   label: 'Sex' },
  { key: 'sabado',  label: 'Sáb' },
]

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const MONTH_OPTIONS = (() => {
  const now = new Date()
  const opts = [{ value: '', label: 'Todos os períodos' }]
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${MESES_PT[d.getMonth()]} ${d.getFullYear()}`
    opts.push({ value, label })
  }
  return opts
})()

// ─── Utilities ────────────────────────────────────────────────────────────────

function diffMonths(from, to) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

function tsDate(ts) { return ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null }

function formatBRL(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

// Soma agregada de faturamento (atual vs anterior) — mais robusto que média de
// variações individuais, já que nem todo doc de resultado tem `variacao` salva.
function calcVariacaoPeriodo(atualDocs, anteriorDocs) {
  const somaAtual    = atualDocs.reduce((s, r) => s + (r.faturamento ?? 0), 0)
  const somaAnterior = anteriorDocs.reduce((s, r) => s + (r.faturamento ?? 0), 0)
  const temDados      = atualDocs.length > 0 || anteriorDocs.length > 0
  const variacao       = somaAnterior > 0 ? ((somaAtual - somaAnterior) / somaAnterior) * 100 : null
  return { somaAtual, variacao, temDados }
}

const PERIODO_MODES = [
  { key: 'semanal',   label: 'Semanal',            n: 1 },
  { key: '4semanas',  label: 'Últimas 4 semanas',  n: 4 },
  { key: '3meses',    label: 'Últimos 3 meses',    n: 12 },
]

// ─── Animation variants ───────────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

const listVariants = { animate: { transition: { staggerChildren: 0.04 } } }
const itemVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.15 } },
}

// ─── Sort header ──────────────────────────────────────────────────────────────

function SortHeader({ col, label, current, dir, onSort, align = 'left' }) {
  const isActive = col === current
  const Icon = isActive ? (dir === 'desc' ? ArrowDown : ArrowUp) : null
  return (
    <button
      onClick={() => onSort(col)}
      className={[
        'flex items-center gap-1 section-label hover:text-text-muted transition-colors duration-150 font-medium',
        align === 'right' ? 'ml-auto' : '',
        isActive ? 'text-text-muted' : '',
      ].join(' ')}
    >
      {align === 'right' && Icon && <Icon size={10} strokeWidth={2} />}
      {label}
      {align === 'left' && Icon && <Icon size={10} strokeWidth={2} />}
    </button>
  )
}

// ─── Period toggle (Semanal / Últimas 4 semanas / Últimos 3 meses) ────────────

function PeriodToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {PERIODO_MODES.map(m => {
        const active = value === m.key
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onChange(m.key)}
            style={{
              padding: '5px 12px', fontSize: '12px', fontWeight: 500,
              borderRadius: '6px', whiteSpace: 'nowrap', cursor: 'pointer',
              border: active ? '1px solid #EA1D2C' : '1px solid #E8E8E8',
              backgroundColor: active ? '#EA1D2C' : '#FFFFFF',
              color: active ? '#FFFFFF' : '#666666',
              transition: 'background-color 150ms, border-color 150ms, color 150ms',
            }}
          >
            {m.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Item de lista por plataforma (header colorido + corpo) ───────────────────
// Mesma estrutura visual usada em "Distribuição por Plataforma" e "Crescimento
// da Carteira" — o conteúdo do corpo é passado via children pra cada seção
// mostrar a métrica que faz sentido (contagem de lojas vs valor de vendas).

function PlataformaListItem({ plataforma, children }) {
  return (
    <div style={{ border: `1px solid ${PLATAFORMA_BORDER[plataforma]}`, borderRadius: '6px', overflow: 'hidden' }}>
      <div style={{
        height: '24px', backgroundColor: PLATAFORMA_HEADER_BG[plataforma],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '6px 6px 0 0',
      }}>
        <span style={{
          fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
          color: PLATAFORMA_HEADER_TEXT[plataforma],
        }}>
          {plataforma}
        </span>
      </div>
      <div style={{ backgroundColor: '#FFFFFF', padding: '12px 14px' }}>
        {children}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Carteira() {
  const { user, isAdmin, isSuperAdmin } = useAuth()

  const [loading,  setLoading]  = useState(true)
  const [clientes, setClientes] = useState([])
  const [lojas,    setLojas]    = useState([])
  const [gestores, setGestores] = useState([])
  const [contratos, setContratos] = useState([])

  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[1].value)
  const [sortCol, setSortCol] = useState('ativos')
  const [sortDir, setSortDir] = useState('desc')

  function handleSort(col) {
    if (col === sortCol) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir(col === 'nome' ? 'asc' : 'desc') }
  }

  // ─── Load data ──────────────────────────────────────────────────────────────

  async function loadAll() {
    setLoading(true)
    try {
      // master enxerga tudo (sem filtro); admin_org só a própria organização —
      // sem esse filtro a consulta nem passa pelas regras do Firestore pra
      // quem não é master (mesmo padrão de Clientes.jsx/Lojas.jsx). Gestor
      // continua vendo só as próprias lojas, como já era.
      const orgId   = user?.organizacaoId ?? null
      const escopo  = isSuperAdmin ? [] : [where('organizacaoId', '==', orgId)]

      const [lojasSnap, gestoresSnap] = await Promise.all([
        isAdmin
          ? getDocs(query(collection(db, COLLECTIONS.LOJAS), ...escopo))
          : getDocs(query(collection(db, COLLECTIONS.LOJAS), where('gestorId', '==', user.uid))),
        getDocs(query(collection(db, COLLECTIONS.USERS), where('perfil', '==', 'gestor'))),
      ])

      const lojasData = lojasSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setLojas(lojasData)
      setGestores(gestoresSnap.docs.map(d => ({ id: d.id, ...d.data() })))

      // Admin lê a organização inteira (ou tudo, se master); gestor busca só
      // os clientes das próprias lojas (e tolera falha de permissão sem
      // quebrar o resto da página).
      try {
        if (isAdmin) {
          const clientesSnap = await getDocs(query(collection(db, COLLECTIONS.CLIENTES), ...escopo))
          setClientes(clientesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        } else {
          const clienteIds = [...new Set(lojasData.map(l => l.clienteId).filter(Boolean))]
          const docs = await Promise.all(clienteIds.map(id => getDoc(doc(db, COLLECTIONS.CLIENTES, id))))
          setClientes(docs.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() })))
        }
      } catch (err) {
        console.error('[Carteira] clientes inacessíveis:', err?.code, err?.message)
        setClientes([])
      }

      // Contratos — usados pra somar o valor contratado e estimar o
      // faturamento mensal da carteira (ver seção "Faturamento da Carteira").
      // Dado financeiro/contratual: só master/admin_org têm acesso pelas
      // regras do Firestore (mesma exclusividade de Clientes) — gestor nem
      // tenta ler, a seção some pra ele.
      if (isAdmin) {
        try {
          const contratosSnap = await getDocs(query(collection(db, COLLECTIONS.CONTRATOS), ...escopo))
          setContratos(contratosSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        } catch (err) {
          console.error('[Carteira] contratos inacessíveis:', err?.code, err?.message)
          setContratos([])
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (user) loadAll() }, [user, isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  const lojasAtivas = useMemo(() => lojas.filter(l => l.status?.toLowerCase() === 'ativa' || l.status?.toLowerCase() === 'ativo'), [lojas])

  // ─── Crescimento da Carteira — resultados (24 semanas: janela máxima do modo "3 meses") ─

  const semanaRef = useMemo(() => getPrevWeekStr(getISOWeekStr()), [])

  const [periodMode,        setPeriodMode]        = useState('semanal')
  const [resultados24,      setResultados24]      = useState([])
  const [loadingResultados, setLoadingResultados] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoadingResultados(true)

    async function loadResultados() {
      try {
        const weeks24 = getLastNWeeks(semanaRef, 24)
        let docs
        if (isAdmin) {
          docs = await fetchByWeeksBatched(weeks24, isSuperAdmin ? null : (user.organizacaoId ?? null))
        } else {
          const snap = await getDocs(query(
            collection(db, COLLECTIONS.RESULTADOS),
            where('organizacaoId', '==', user.organizacaoId ?? null),
            where('gestorId', '==', user.uid),
          ))
          const set  = new Set(weeks24)
          docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => set.has(r.semana))
        }
        if (!cancelled) setResultados24(docs)
      } catch (err) {
        console.error('[Carteira] resultados:', err?.code, err?.message)
      } finally {
        if (!cancelled) setLoadingResultados(false)
      }
    }
    loadResultados()
    return () => { cancelled = true }
  }, [user, isAdmin, isSuperAdmin, semanaRef])

  const lojaMap = useMemo(() => Object.fromEntries(lojas.map(l => [l.id, l])), [lojas])

  // Cruza cada resultado com a loja pra descobrir a plataforma (fallback pro
  // campo `plataforma` da loja quando o doc de resultado não tiver o campo
  // próprio — só os lançamentos mais recentes do ControleSemanal já gravam
  // `plataforma` direto no resultado) e o gestor ATUAL da loja (não o gestorId
  // congelado no momento do lançamento).
  const resultadosEnriquecidos = useMemo(() => {
    return resultados24
      .map(r => {
        const loja = lojaMap[r.lojaId]
        if (!loja) return null
        const plataforma = r.plataforma || loja.plataforma
        if (!plataforma) return null
        return { ...r, plataforma, gestorIdAtual: loja.gestorId ?? null }
      })
      .filter(Boolean)
  }, [resultados24, lojaMap])

  const { atualWeeks, anteriorWeeks } = useMemo(() => {
    const modo = PERIODO_MODES.find(m => m.key === periodMode) ?? PERIODO_MODES[0]
    return getPeriodoComparativo(semanaRef, modo.n)
  }, [periodMode, semanaRef])

  const resultadosAtual = useMemo(() => {
    const set = new Set(atualWeeks)
    return resultadosEnriquecidos.filter(r => set.has(r.semana))
  }, [resultadosEnriquecidos, atualWeeks])

  const resultadosAnterior = useMemo(() => {
    const set = new Set(anteriorWeeks)
    return resultadosEnriquecidos.filter(r => set.has(r.semana))
  }, [resultadosEnriquecidos, anteriorWeeks])

  // ── Bloco 1 — por plataforma ────────────────────────────────────────────────

  const crescimentoPorPlataforma = useMemo(() => {
    return PLATAFORMAS.map(p => {
      const atual    = resultadosAtual.filter(r => r.plataforma === p)
      const anterior = resultadosAnterior.filter(r => r.plataforma === p)
      return { plataforma: p, ...calcVariacaoPeriodo(atual, anterior) }
    })
  }, [resultadosAtual, resultadosAnterior])

  // ── Bloco 2 — por gestor × plataforma ───────────────────────────────────────

  const [sortColGP, setSortColGP] = useState('nome')
  const [sortDirGP, setSortDirGP] = useState('asc')

  function handleSortGP(col) {
    if (col === sortColGP) setSortDirGP(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortColGP(col); setSortDirGP(col === 'nome' ? 'asc' : 'desc') }
  }

  const gestorPlataformaRows = useMemo(() => {
    const base = isAdmin ? gestores : gestores.filter(g => g.id === user?.uid)
    return base
      .map(g => {
        const totalLojas = lojasAtivas.filter(l => l.gestorId === g.id).length
        const row = { id: g.id, nome: g.nome ?? '—', totalLojas }
        PLATAFORMAS.forEach(p => {
          const atual    = resultadosAtual.filter(r => r.plataforma === p && r.gestorIdAtual === g.id)
          const anterior = resultadosAnterior.filter(r => r.plataforma === p && r.gestorIdAtual === g.id)
          row[p] = calcVariacaoPeriodo(atual, anterior)
        })
        return row
      })
      .filter(g => g.totalLojas > 0 || PLATAFORMAS.some(p => g[p].temDados))
  }, [isAdmin, gestores, user, lojasAtivas, resultadosAtual, resultadosAnterior])

  const gestorPlataformaRowsOrdenadas = useMemo(() => {
    function valorPara(row) {
      if (sortColGP === 'nome')       return row.nome
      if (sortColGP === 'totalLojas') return row.totalLojas
      return row[sortColGP]?.variacao ?? null
    }
    return [...gestorPlataformaRows].sort((a, b) => {
      if (sortColGP === 'nome') {
        const c = a.nome.localeCompare(b.nome, 'pt-BR')
        return sortDirGP === 'asc' ? c : -c
      }
      const av = valorPara(a); const bv = valorPara(b)
      const an = av == null ? -Infinity : av
      const bn = bv == null ? -Infinity : bv
      return sortDirGP === 'desc' ? bn - an : an - bn
    })
  }, [gestorPlataformaRows, sortColGP, sortDirGP])

  // ─── Visão geral ────────────────────────────────────────────────────────────

  const kpis = useMemo(() => ({
    clientesAtivos:      clientes.filter(c => c.status === 'Ativo').length,
    lojasAtivas:         lojasAtivas.length,
    totalGestores:       gestores.length,
    mediaLojasPorGestor: gestores.length > 0 ? lojasAtivas.length / gestores.length : 0,
  }), [clientes, lojasAtivas, gestores])

  // ─── Métricas de clientes (mesma lógica da antiga aba Métricas de Clientes.jsx) ─

  const hoje = new Date()

  const { refDate, monthStart, monthEnd } = useMemo(() => {
    if (!selectedMonth) return { refDate: hoje, monthStart: null, monthEnd: null }
    const [yr, mo] = selectedMonth.split('-').map(Number)
    const start = new Date(yr, mo - 1, 1)
    const end   = new Date(yr, mo, 0, 23, 59, 59, 999)
    return { refDate: end < hoje ? end : hoje, monthStart: start, monthEnd: end }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth])

  // ─── Faturamento da Carteira (soma dos contratos + faturamento mensal) ─────
  //
  // Contrato mensal: entra 1x no mês (se estiver vigente nele).
  // Contrato semanal: repete a cada 7 dias a partir da dataInicio — conta
  // quantas dessas datas caem dentro do mês de referência. Ex: início em
  // 17/07 → cobranças em 17, 24 e 31/07 (3x); início em 18/07 → 18 e 25/07 (2x).
  function contarOcorrenciasSemanais(dataInicio, dataFim, refMonthStart, refMonthEnd) {
    if (!dataInicio) return 0
    let cursor = new Date(dataInicio)
    cursor.setHours(0, 0, 0, 0)
    while (cursor < refMonthStart) cursor = new Date(cursor.getTime() + 7 * 86400000)
    const limite = dataFim && dataFim < refMonthEnd ? dataFim : refMonthEnd
    let ocorrencias = 0
    while (cursor <= limite) {
      ocorrencias++
      cursor = new Date(cursor.getTime() + 7 * 86400000)
    }
    return ocorrencias
  }

  const lojaIdsCarteira = useMemo(() => new Set(lojas.map(l => l.id)), [lojas])

  const { valorTotalContratos, faturamentoMensalEstimado } = useMemo(() => {
    const refMonthStart = monthStart ?? new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const refMonthEnd   = monthEnd   ?? new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999)

    let valorTotal = 0
    let faturamentoMensal = 0

    contratos.forEach(c => {
      const inicio = tsDate(c.dataInicio)
      const fim    = tsDate(c.dataFim)
      // O contrato precisa se sobrepor ao mês de referência selecionado
      if (!inicio || inicio > refMonthEnd) return
      if (fim && fim < refMonthStart) return

      ;(c.itensLojas ?? []).forEach(item => {
        if (!lojaIdsCarteira.has(item.lojaId)) return
        const valor = item.valor ?? 0
        valorTotal += valor
        if (c.tipoPagamento === 'semanal') {
          const ocorrencias = contarOcorrenciasSemanais(inicio, fim, refMonthStart, refMonthEnd)
          faturamentoMensal += valor * ocorrencias
        } else {
          faturamentoMensal += valor
        }
      })
    })

    return { valorTotalContratos: valorTotal, faturamentoMensalEstimado: faturamentoMensal }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratos, lojaIdsCarteira, monthStart, monthEnd])

  const filteredClientes = useMemo(() => {
    if (!selectedMonth || !monthStart || !monthEnd) return clientes
    return clientes.filter(c => {
      if (!c.dataInicio) return false
      const inicio = tsDate(c.dataInicio)
      if (!inicio || inicio > monthEnd) return false
      if (c.status !== 'Inativo') return true
      const di = tsDate(c.dataInativacao)
      return !di || di >= monthStart
    })
  }, [clientes, selectedMonth, monthStart, monthEnd])

  const tempoMedioContrato = useMemo(() => {
    let total = 0, count = 0
    filteredClientes.forEach(c => {
      if (!c.dataInicio) return
      const inicio = tsDate(c.dataInicio)
      if (!inicio) return
      let fim = refDate
      if (c.status === 'Inativo') {
        const di = tsDate(c.dataInativacao)
        if (di && di < refDate) fim = di
      }
      const meses = diffMonths(inicio, fim)
      if (meses >= 0) { total += meses; count++ }
    })
    return count > 0 ? Math.round(total / count) : null
  }, [filteredClientes, refDate])

  const { taxa, canceladosMesAtual, canceladosMesAnterior } = useMemo(() => {
    const total    = filteredClientes.length
    const inativos = filteredClientes.filter(c => {
      if (c.status !== 'Inativo') return false
      const di = tsDate(c.dataInativacao)
      return !di || di <= refDate
    }).length
    const taxa = total > 0 ? (inativos / total) * 100 : null

    let inicioMes, fimMes, inicioAnt, fimAnt
    if (monthStart && monthEnd) {
      inicioMes = monthStart
      fimMes    = monthEnd
      inicioAnt = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1)
      fimAnt    = new Date(monthStart.getFullYear(), monthStart.getMonth(), 0, 23, 59, 59, 999)
    } else {
      inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      fimMes    = hoje
      inicioAnt = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      fimAnt    = new Date(hoje.getFullYear(), hoje.getMonth(), 0, 23, 59, 59, 999)
    }

    const canceladosMesAtual = clientes.filter(c => {
      const d = tsDate(c.dataInativacao)
      return d && d >= inicioMes && d <= fimMes
    }).length

    const canceladosMesAnterior = clientes.filter(c => {
      const d = tsDate(c.dataInativacao)
      return d && d >= inicioAnt && d <= fimAnt
    }).length

    return { taxa, canceladosMesAtual, canceladosMesAnterior }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredClientes, clientes, refDate, monthStart, monthEnd])

  const varMes = canceladosMesAtual - canceladosMesAnterior

  // Breakdown de clientes por gestor — comparação entre gestores, só faz sentido pro admin
  const breakdownClientes = useMemo(() => {
    if (!isAdmin) return []

    const clienteToGestores = {}
    lojas.forEach(l => {
      if (!l.clienteId || !l.gestorId) return
      if (!clienteToGestores[l.clienteId]) clienteToGestores[l.clienteId] = new Set()
      clienteToGestores[l.clienteId].add(l.gestorId)
    })

    const stats = {}
    filteredClientes.forEach(c => {
      const gids = clienteToGestores[c.id]
      if (!gids) return
      gids.forEach(gid => {
        if (!stats[gid]) stats[gid] = { ativos: 0, cancelados: 0, totalM: 0, contM: 0 }
        const di = tsDate(c.dataInativacao)
        const canceladoNoPeriodo = c.status === 'Inativo' && di && di <= refDate
        if (canceladoNoPeriodo) stats[gid].cancelados++
        else stats[gid].ativos++
        const inicio = tsDate(c.dataInicio)
        if (inicio) {
          let fim = refDate
          if (c.status === 'Inativo' && di && di < refDate) fim = di
          const m = diffMonths(inicio, fim)
          if (m >= 0) { stats[gid].totalM += m; stats[gid].contM++ }
        }
      })
    })

    const base = gestores.map(g => {
      const s = stats[g.id] ?? { ativos: 0, cancelados: 0, totalM: 0, contM: 0 }
      const total = s.ativos + s.cancelados
      return {
        id:         g.id,
        nome:       g.nome ?? '—',
        ativos:     s.ativos,
        cancelados: s.cancelados,
        taxa:       total > 0 ? (s.cancelados / total) * 100 : null,
        tempoMedio: s.contM > 0 ? Math.round(s.totalM / s.contM) : null,
      }
    }).filter(g => g.ativos + g.cancelados > 0)

    return [...base].sort((a, b) => {
      if (sortCol === 'nome') {
        const c = a.nome.localeCompare(b.nome, 'pt-BR')
        return sortDir === 'asc' ? c : -c
      }
      const av = a[sortCol] ?? -Infinity
      const bv = b[sortCol] ?? -Infinity
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [isAdmin, filteredClientes, lojas, gestores, refDate, sortCol, sortDir])

  // ─── Distribuição por gestor (lojas) — comparação entre gestores, só pro admin ──

  const distribuicaoGestores = useMemo(() => {
    if (!isAdmin) return []
    return gestores.map(g => {
      const lojasG = lojasAtivas.filter(l => l.gestorId === g.id)
      const plataformasSet = new Set(lojasG.map(l => l.plataforma).filter(Boolean))
      const plataformas = PLATAFORMAS.filter(p => plataformasSet.has(p))
      const diasCount = {}
      lojasG.forEach(l => {
        if (l.diaRelatorio) diasCount[l.diaRelatorio] = (diasCount[l.diaRelatorio] ?? 0) + 1
      })
      const diasResumo = DIAS_ORDEM
        .filter(d => diasCount[d.key])
        .map(d => `${d.label} ${diasCount[d.key]}`)
        .join(' · ')
      return {
        id:          g.id,
        nome:        g.nome ?? '—',
        lojasAtivas: lojasG.length,
        plataformas: plataformas.join(', ') || '—',
        diasResumo:  diasResumo || '—',
      }
    }).filter(g => g.lojasAtivas > 0)
  }, [isAdmin, lojasAtivas, gestores])

  // ─── Distribuição por plataforma ────────────────────────────────────────────

  const distribuicaoPlataformas = useMemo(() => {
    const total = lojasAtivas.length
    return PLATAFORMAS.map(p => {
      const count = lojasAtivas.filter(l => l.plataforma === p).length
      return { plataforma: p, count, pct: total > 0 ? (count / total) * 100 : 0 }
    })
  }, [lojasAtivas])

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      style={{ padding: '28px 20px' }}
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      <div className="page-header">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Desempenho da Carteira</h1>
      </div>

      {loading ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-4 gap-4">
            <Skeleton.KPI /><Skeleton.KPI /><Skeleton.KPI /><Skeleton.KPI />
          </div>
          <Skeleton.Table rows={5} cols={4} />
        </div>
      ) : (
        <div className="flex flex-col gap-8">

          {/* ── Visão Geral ─────────────────────────────────────────────── */}
          <section>
            <p className="section-label mb-3">Visão Geral</p>
            <div className="grid grid-cols-4 gap-4">
              <div className="card-kpi">
                <p className="section-label mb-3">Clientes ativos</p>
                <p className="kpi-value">{kpis.clientesAtivos}</p>
              </div>
              <div className="card-kpi">
                <p className="section-label mb-3">Lojas ativas</p>
                <p className="kpi-value">{kpis.lojasAtivas}</p>
              </div>
              <div className="card-kpi">
                <p className="section-label mb-3">Gestores</p>
                <p className="kpi-value">{kpis.totalGestores}</p>
              </div>
              <div className="card-kpi">
                <p className="section-label mb-3">Média de lojas / gestor</p>
                <p className="kpi-value">{kpis.mediaLojasPorGestor.toFixed(1)}</p>
              </div>
            </div>
          </section>

          {/* ── Faturamento da Carteira ──────────────────────────────────── */}
          {isAdmin && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="section-label">Faturamento da Carteira</p>
                <span className="text-[12px] text-text-subtle">
                  Referente a {MONTH_OPTIONS.find(o => o.value === selectedMonth)?.label ?? 'este mês'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="card-kpi">
                  <p className="section-label mb-3">Valor total em contratos</p>
                  <p className="kpi-value">{formatBRL(valorTotalContratos)}</p>
                  <p className="text-[12px] text-text-subtle mt-1.5">Soma dos valores por loja nos contratos vigentes no período</p>
                </div>
                <div className="card-kpi">
                  <p className="section-label mb-3">Faturamento mensal estimado</p>
                  <p className="kpi-value">{formatBRL(faturamentoMensalEstimado)}</p>
                  <p className="text-[12px] text-text-subtle mt-1.5">Contratos semanais contam pelas cobranças previstas no mês</p>
                </div>
              </div>
            </section>
          )}

          {/* ── Métricas de Clientes ────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="section-label">Métricas de Clientes</p>
              <div className="flex items-center gap-2">
                <span className="section-label">Período</span>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="select w-52"
                >
                  {MONTH_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="card-kpi">
                <p className="section-label mb-3">Tempo médio de contrato</p>
                <p className="kpi-value">
                  {tempoMedioContrato != null ? `${tempoMedioContrato} meses` : '—'}
                </p>
              </div>
              <div className="card-kpi">
                <p className="section-label mb-3">Taxa de cancelamento</p>
                <p className="kpi-value">
                  {taxa != null ? `${taxa.toFixed(1)}%` : '—'}
                </p>
                {canceladosMesAnterior > 0 && (
                  <p className={`text-[12px] mt-1.5 ${varMes > 0 ? 'text-negative' : varMes < 0 ? 'text-positive' : 'text-text-subtle'}`}>
                    {varMes > 0 ? `+${varMes}` : varMes} vs mês anterior
                  </p>
                )}
              </div>
              <div className="card-kpi">
                <p className="section-label mb-3">Cancelamentos este mês</p>
                <p className="kpi-value">{canceladosMesAtual}</p>
                {canceladosMesAnterior > 0 && (
                  <p className="text-[12px] text-text-subtle mt-1.5">
                    {canceladosMesAnterior} no mês anterior
                  </p>
                )}
              </div>
            </div>

            {isAdmin && (
              <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
                <div className="px-4 pt-4 pb-3 border-b border-border">
                  <p className="section-label">Breakdown por gestor</p>
                </div>
                {breakdownClientes.length === 0 ? (
                  <p className="text-[13px] text-text-subtle text-center py-10">
                    Nenhum dado disponível.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_80px_80px_100px_120px] gap-3 items-center px-4 h-10 bg-[#F9F9F9] border-b border-border">
                      <SortHeader col="nome"       label="Gestor"        current={sortCol} dir={sortDir} onSort={handleSort} />
                      <SortHeader col="ativos"     label="Ativos"        current={sortCol} dir={sortDir} onSort={handleSort} align="right" />
                      <SortHeader col="cancelados" label="Cancelados"    current={sortCol} dir={sortDir} onSort={handleSort} align="right" />
                      <SortHeader col="taxa"       label="Cancelamento%" current={sortCol} dir={sortDir} onSort={handleSort} align="right" />
                      <SortHeader col="tempoMedio" label="Tempo médio"   current={sortCol} dir={sortDir} onSort={handleSort} align="right" />
                    </div>
                    <motion.div variants={listVariants} initial="initial" animate="animate">
                      {breakdownClientes.map(g => (
                        <motion.div
                          key={g.id}
                          variants={itemVariants}
                          className="grid grid-cols-[1fr_80px_80px_100px_120px] gap-3 items-center px-4 h-12 border-b border-border last:border-0 hover:bg-black/[0.02] transition-colors duration-150"
                        >
                          <span className="text-[14px] text-text-primary font-medium truncate pr-4">{g.nome}</span>
                          <span className="font-mono text-[13px] text-positive text-right">{g.ativos}</span>
                          <span className="font-mono text-[13px] text-text-muted text-right">{g.cancelados}</span>
                          <span className={`font-mono text-[13px] text-right ${g.taxa != null && g.taxa > 0 ? 'text-negative' : 'text-text-muted'}`}>
                            {g.taxa != null ? `${g.taxa.toFixed(1)}%` : '—'}
                          </span>
                          <span className="font-mono text-[13px] text-text-muted text-right">
                            {g.tempoMedio != null ? `${g.tempoMedio}m` : '—'}
                          </span>
                        </motion.div>
                      ))}
                    </motion.div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* ── Distribuição por Plataforma + Crescimento da Carteira ───────── */}
          <section>
            <div className="grid grid-cols-2 gap-4">

              {/* Coluna esquerda — Distribuição por Plataforma */}
              <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '10px', padding: '20px' }}>
                <p style={{ fontSize: '16px', fontWeight: 700, color: '#111111', marginBottom: '14px' }}>
                  Distribuição por Plataforma
                </p>
                <div className="flex flex-col gap-2">
                  {distribuicaoPlataformas.map(p => (
                    <PlataformaListItem key={p.plataforma} plataforma={p.plataforma}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p style={{ fontSize: '20px', fontWeight: 700, color: '#111111', margin: 0, lineHeight: 1 }}>{p.count}</p>
                          <p style={{ fontSize: '11px', color: '#999999', margin: '3px 0 0' }}>lojas ativas</p>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#666666', backgroundColor: '#F5F5F5', border: '1px solid #E8E8E8', borderRadius: '4px', padding: '2px 7px' }}>
                          {p.pct.toFixed(1)}%
                        </span>
                      </div>
                    </PlataformaListItem>
                  ))}
                </div>
              </div>

              {/* Coluna direita — Crescimento da Carteira */}
              <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '10px', padding: '20px' }}>
                <div className="flex items-center justify-between mb-3.5">
                  <p style={{ fontSize: '16px', fontWeight: 700, color: '#111111', margin: 0 }}>
                    Crescimento da Carteira
                  </p>
                  <PeriodToggle value={periodMode} onChange={setPeriodMode} />
                </div>

                {loadingResultados ? (
                  <div className="flex flex-col gap-2">
                    <Skeleton.KPI /><Skeleton.KPI /><Skeleton.KPI />
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {crescimentoPorPlataforma.map(p => (
                      <PlataformaListItem key={p.plataforma} plataforma={p.plataforma}>
                        <div className="flex items-center justify-between">
                          <p style={{ fontSize: '18px', fontWeight: 700, color: '#111111', margin: 0 }}>
                            {p.temDados ? formatBRL(p.somaAtual) : '—'}
                          </p>
                          {p.temDados ? <VarBadge value={p.variacao} /> : (
                            <span className="text-[12px] text-text-subtle">—</span>
                          )}
                        </div>
                      </PlataformaListItem>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </section>

          {/* ── Por Gestor e Plataforma ──────────────────────────────────── */}
          <section>
            <p className="section-label mb-3">Por Gestor e Plataforma</p>
            {loadingResultados ? (
              <Skeleton.Table rows={4} cols={5} />
            ) : (
              <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
                {gestorPlataformaRowsOrdenadas.length === 0 ? (
                  <p className="text-[13px] text-text-subtle text-center py-10">
                    Nenhum dado disponível.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_90px_90px_90px_110px] gap-3 items-center px-4 h-10 bg-[#F9F9F9] border-b border-border">
                      <SortHeader col="nome"       label="Gestor"         current={sortColGP} dir={sortDirGP} onSort={handleSortGP} />
                      <SortHeader col="iFood"      label="iFood"         current={sortColGP} dir={sortDirGP} onSort={handleSortGP} align="right" />
                      <SortHeader col="99Food"     label="99Food"        current={sortColGP} dir={sortDirGP} onSort={handleSortGP} align="right" />
                      <SortHeader col="Keeta"      label="Keeta"         current={sortColGP} dir={sortDirGP} onSort={handleSortGP} align="right" />
                      <SortHeader col="totalLojas" label="Total de lojas" current={sortColGP} dir={sortDirGP} onSort={handleSortGP} align="right" />
                    </div>
                    <motion.div variants={listVariants} initial="initial" animate="animate">
                      {gestorPlataformaRowsOrdenadas.map(g => (
                        <motion.div
                          key={g.id}
                          variants={itemVariants}
                          className="grid grid-cols-[1fr_90px_90px_90px_110px] gap-3 items-center px-4 h-12 border-b border-border last:border-0 hover:bg-black/[0.02] transition-colors duration-150"
                        >
                          <span className="text-[14px] text-text-primary font-medium truncate pr-4">{g.nome}</span>
                          {PLATAFORMAS.map(p => (
                            <div key={p} className="flex justify-end">
                              {g[p].temDados ? <VarBadge value={g[p].variacao} /> : (
                                <span className="text-[12px] text-text-subtle">—</span>
                              )}
                            </div>
                          ))}
                          <span className="font-mono text-[13px] text-text-muted text-right">{g.totalLojas}</span>
                        </motion.div>
                      ))}
                    </motion.div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* ── Distribuição por Gestor ─────────────────────────────────── */}
          {isAdmin && (
            <section>
              <p className="section-label mb-3">Distribuição por Gestor</p>
              <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
                {distribuicaoGestores.length === 0 ? (
                  <p className="text-[13px] text-text-subtle text-center py-10">
                    Nenhuma loja ativa.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_110px_180px_1fr] gap-3 items-center px-4 h-10 bg-[#F9F9F9] border-b border-border">
                      <span className="section-label">Gestor</span>
                      <span className="section-label text-right">Lojas ativas</span>
                      <span className="section-label">Plataformas</span>
                      <span className="section-label">Dias de relatório</span>
                    </div>
                    <motion.div variants={listVariants} initial="initial" animate="animate">
                      {distribuicaoGestores.map(g => (
                        <motion.div
                          key={g.id}
                          variants={itemVariants}
                          className="grid grid-cols-[1fr_110px_180px_1fr] gap-3 items-center px-4 h-12 border-b border-border last:border-0 hover:bg-black/[0.02] transition-colors duration-150"
                        >
                          <span className="text-[14px] text-text-primary font-medium truncate">{g.nome}</span>
                          <span className="font-mono text-[13px] text-text-muted text-right">{g.lojasAtivas}</span>
                          <span className="text-[12px] text-text-muted truncate">{g.plataformas}</span>
                          <span className="text-[12px] text-text-muted truncate">{g.diasResumo}</span>
                        </motion.div>
                      ))}
                    </motion.div>
                  </>
                )}
              </div>
            </section>
          )}

        </div>
      )}
    </motion.div>
  )
}
