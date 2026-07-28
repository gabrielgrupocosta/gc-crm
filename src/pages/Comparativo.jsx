import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import {
  db, COLLECTIONS,
  collection, query, where, getDocs,
} from '../services/firebase'
import Skeleton from '../components/UI/Skeleton'
import VarBadge from '../components/UI/VarBadge'
import LojaSelect from '../components/UI/LojaSelect'
import { formatVar } from '../utils/format'

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatBRL(n) {
  if (n == null || isNaN(n)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

function weekLabel(str) {
  if (!str) return '—'
  const [year, wPart] = str.split('-W')
  return `Sem ${parseInt(wPart).toString().padStart(2, '0')}/${year.slice(2)}`
}

function computeVar(atual, pre) {
  if (pre == null || pre === 0 || atual == null) return null
  return ((atual - pre) / pre) * 100
}

// ─── Animation variants ───────────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.15, ease: 'easeOut' } },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricLine({ label, value, variation }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '12px', padding: '8px 0', borderBottom: '1px solid #F3F3F3',
    }}>
      <span style={{ fontSize: '12px', color: '#666666', flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {variation != null && <VarBadge value={variation} />}
        <span style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '13px', color: '#111111', fontWeight: 500 }}>
          {value}
        </span>
      </div>
    </div>
  )
}

function MetricLineLast({ label, value }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '12px', padding: '8px 0',
    }}>
      <span style={{ fontSize: '12px', color: '#666666', flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '13px', color: '#111111', fontWeight: 500 }}>
        {value}
      </span>
    </div>
  )
}

function KPICard({ label, value, sub, valueColor }) {
  return (
    <div style={{
      backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8',
      borderRadius: '10px', padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <p style={{
        fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em',
        color: '#999999', marginBottom: '10px',
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '18px',
        fontWeight: 500, color: valueColor ?? '#111111', lineHeight: 1.2,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: '11px', color: '#999999', marginTop: '4px' }}>{sub}</p>
      )}
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const fat      = payload[0].value
  const variacao = payload[0].payload?.variacao
  return (
    <div style={{
      backgroundColor: '#FFFFFF', border: '1px solid #DDDDDD',
      borderRadius: '6px', padding: '8px 12px',
    }}>
      <p style={{ fontSize: '11px', color: '#999999', marginBottom: '3px' }}>{label}</p>
      <p style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '12px', color: '#111111' }}>
        {formatBRL(fat)}
      </p>
      {variacao != null && (
        <p style={{
          fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '11px', marginTop: '2px',
          color: variacao >= 0 ? '#16A34A' : '#DC2626',
        }}>
          {formatVar(variacao)}
        </p>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Comparativo() {
  const { user, isAdmin, isSuperAdmin } = useAuth()

  const [lojas,           setLojas]           = useState([])
  const [loadingLojas,    setLoadingLojas]    = useState(true)
  const [selectedLojaId,    setSelectedLojaId]    = useState('')
  const [selectedClienteId, setSelectedClienteId] = useState('')
  const [selectedLoja,   setSelectedLoja]   = useState(null)
  const [resultados,     setResultados]     = useState([])
  const [loadingRes,     setLoadingRes]     = useState(false)

  // ── Load lojas ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoadingLojas(true)
    const escopoOrg = isSuperAdmin ? [] : [where('organizacaoId', '==', user.organizacaoId ?? null)]
    const qLojas = isAdmin
      ? getDocs(query(collection(db, COLLECTIONS.LOJAS), ...escopoOrg))
      : getDocs(query(collection(db, COLLECTIONS.LOJAS), ...escopoOrg, where('gestorId', '==', user.uid)))
    qLojas.then(snap => {
      if (cancelled) return
      setLojas(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(l => l.status?.toLowerCase() !== 'cancelada')
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      )
    }).finally(() => { if (!cancelled) setLoadingLojas(false) })
    return () => { cancelled = true }
  }, [user, isAdmin, isSuperAdmin])

  // Opções de cliente pro seletor — só os que têm mais de uma loja (cliente
  // com loja única já está coberto pelo seletor de loja individual).
  const clientesComMultiplasLojas = useMemo(() => {
    const porCliente = {}
    lojas.forEach(l => {
      if (l.clienteId) (porCliente[l.clienteId] ??= { id: l.clienteId, nome: l.clienteNome ?? '—', count: 0 }).count++
    })
    return Object.values(porCliente)
      .filter(c => c.count > 1)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [lojas])

  // IDs de loja alvo — ou a loja única selecionada, ou todas as lojas do cliente
  const lojaIdsAlvo = useMemo(() => {
    if (selectedClienteId) return lojas.filter(l => l.clienteId === selectedClienteId).map(l => l.id)
    return selectedLojaId ? [selectedLojaId] : []
  }, [selectedClienteId, lojas, selectedLojaId])

  function handleSelecionarLoja(lojaId) {
    setSelectedLojaId(lojaId)
    setSelectedClienteId('')
  }

  function handleSelecionarCliente(clienteId) {
    setSelectedClienteId(clienteId)
    setSelectedLojaId('')
  }

  // ── Load resultados quando a loja/cliente selecionado muda ──────────────────

  useEffect(() => {
    if (lojaIdsAlvo.length === 0) {
      setResultados([])
      setSelectedLoja(null)
      return
    }
    setSelectedLoja(selectedLojaId ? (lojas.find(l => l.id === selectedLojaId) ?? null) : null)

    let cancelled = false
    setLoadingRes(true)
    ;(async () => {
      try {
        const escopoOrg = isSuperAdmin ? [] : [where('organizacaoId', '==', user.organizacaoId ?? null)]
        const todos = []
        for (let i = 0; i < lojaIdsAlvo.length; i += 30) {
          const snap = await getDocs(query(
            collection(db, COLLECTIONS.RESULTADOS),
            ...escopoOrg,
            where('lojaId', 'in', lojaIdsAlvo.slice(i, i + 30)),
          ))
          snap.docs.forEach(d => todos.push({ id: d.id, ...d.data() }))
        }
        if (!cancelled) setResultados(todos)
      } finally {
        if (!cancelled) setLoadingRes(false)
      }
    })()
    return () => { cancelled = true }
  }, [lojaIdsAlvo, selectedLojaId, lojas, isSuperAdmin, user])

  // Pré-Gestão: da loja única, ou somada entre todas as lojas do cliente
  const pg = useMemo(() => {
    if (selectedClienteId) {
      const lojasDoCliente = lojas.filter(l => lojaIdsAlvo.includes(l.id))
      return lojasDoCliente.reduce((acc, l) => {
        const p = l.preGestao ?? {}
        acc.faturamento7dias  = (acc.faturamento7dias  ?? 0) + (p.faturamento7dias  ?? 0)
        acc.faturamento30dias = (acc.faturamento30dias ?? 0) + (p.faturamento30dias ?? 0)
        acc.valorVendas       = (acc.valorVendas       ?? 0) + (p.valorVendas       ?? 0)
        acc.totalFaturamento  = (acc.totalFaturamento  ?? 0) + (p.totalFaturamento ?? p.repasseTotal ?? 0)
        return acc
      }, {})
    }
    return selectedLoja?.preGestao ?? {}
  }, [selectedClienteId, lojas, lojaIdsAlvo, selectedLoja])

  // ── Computations ─────────────────────────────────────────────────────────────

  const { fat7atual, fat30atual, kpis, chartData } = useMemo(() => {
    if (!resultados.length) {
      return { fat7atual: null, fat30atual: null, kpis: null, chartData: [] }
    }

    // Aggregate faturamento por semana + variação como média ponderada por
    // faturamento (necessário quando várias lojas do mesmo cliente contribuem
    // pra mesma semana — sobrescrever com o último valor lido dava número errado).
    const byWeek = {}
    resultados.forEach(r => {
      if (!byWeek[r.semana]) byWeek[r.semana] = { fat: 0, variacao: null, varSoma: 0, varPeso: 0 }
      const fat = r.faturamento ?? 0
      byWeek[r.semana].fat += fat
      if (r.variacao != null && fat > 0) {
        byWeek[r.semana].varSoma += r.variacao * fat
        byWeek[r.semana].varPeso += fat
      }
    })
    Object.values(byWeek).forEach(d => {
      d.variacao = d.varPeso > 0 ? d.varSoma / d.varPeso : null
    })
    const weekEntries = Object.entries(byWeek).sort(([a], [b]) => a.localeCompare(b))
    const weekKeys    = weekEntries.map(([k]) => k)

    // Últimas 1 semana e 4 semanas
    const lastWeek   = weekKeys[weekKeys.length - 1]
    const fat7atual  = byWeek[lastWeek]?.fat ?? 0
    const fat30atual = weekKeys.slice(-4).reduce((s, w) => s + (byWeek[w]?.fat ?? 0), 0)

    // KPIs históricos
    const totalAcumulado = weekEntries.reduce((s, [, d]) => s + d.fat, 0)
    const mediaSemanal   = weekEntries.length ? totalAcumulado / weekEntries.length : 0

    const melhorSemana = weekEntries.reduce(
      (best, cur) => cur[1].fat > (best?.[1]?.fat ?? -Infinity) ? cur : best, null
    )
    const piorSemana = weekEntries.reduce(
      (worst, cur) => cur[1].fat < (worst?.[1]?.fat ?? Infinity) ? cur : worst, null
    )

    const comVar      = weekEntries.filter(([, d]) => d.variacao != null)
    const crescimento = comVar.filter(([, d]) => d.variacao > 0).length
    const queda       = comVar.filter(([, d]) => d.variacao < 0).length
    const mediaVar    = comVar.length
      ? comVar.reduce((s, [, d]) => s + d.variacao, 0) / comVar.length
      : null
    const maiorVar    = comVar.reduce(
      (best, cur) => cur[1].variacao > (best?.[1]?.variacao ?? -Infinity) ? cur : best, null
    )

    // Chart data
    const chartData = weekEntries.map(([semana, d]) => ({
      semana:      weekLabel(semana),
      faturamento: d.fat,
      variacao:    d.variacao,
    }))

    return {
      fat7atual, fat30atual,
      kpis: {
        totalAcumulado, mediaSemanal, melhorSemana, piorSemana,
        crescimento, queda, mediaVar, maiorVar,
        totalSemanas: weekEntries.length,
      },
      chartData,
    }
  }, [resultados])

  const var7  = computeVar(fat7atual,  pg.faturamento7dias)
  const var30 = computeVar(fat30atual, pg.faturamento30dias)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <motion.div
      style={{ padding: '28px 20px' }}
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Comparativo de Desempenho
        </h1>
        {loadingLojas ? (
          <div style={{ height: '30px', backgroundColor: '#FFFFFF', borderRadius: '5px' }} className="animate-skeleton w-full sm:w-[240px]" />
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <LojaSelect
              lojas={lojas}
              value={selectedLojaId}
              onChange={handleSelecionarLoja}
              placeholder="Buscar loja..."
              className="w-full sm:w-[220px]"
            />
            {clientesComMultiplasLojas.length > 0 && (
              <select
                value={selectedClienteId}
                onChange={e => handleSelecionarCliente(e.target.value)}
                className="select w-full sm:w-[180px]"
              >
                <option value="">Ou selecione um cliente...</option>
                {clientesComMultiplasLojas.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Estado vazio */}
      {lojaIdsAlvo.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '320px',
          backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <TrendingUp size={28} strokeWidth={1} style={{ color: '#DDDDDD', marginBottom: '14px' }} />
          <p style={{ fontSize: '13px', color: '#999999', fontWeight: 500 }}>
            Selecione uma loja ou um cliente com várias lojas para gerar o comparativo
          </p>
          <p style={{ fontSize: '12px', color: '#BBBBBB', marginTop: '6px' }}>
            Dados pré-gestão e histórico de resultados serão exibidos aqui
          </p>
        </div>
      )}

      {/* Conteúdo — loja/cliente selecionado */}
      {lojaIdsAlvo.length > 0 && (
        loadingRes ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '12px' }}>
              <Skeleton.KPI /><Skeleton.KPI />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: '10px' }}>
              {[0,1,2,3,4,5,6,7].map(i => <Skeleton.KPI key={i} />)}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Seção 1 — Pré-Gestão vs Atual */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut', delay: 0 }}
            >
              <p className="section-label" style={{ marginBottom: '10px' }}>
                Comparativo Pré-Gestão vs Atual
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '12px' }}>

                {/* Card Pré-Gestão */}
                <div style={{
                  backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8',
                  borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F3F3' }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: '#111111' }}>Pré-Gestão</p>
                    <p style={{ fontSize: '11px', color: '#999999', marginTop: '2px' }}>
                      Dados do início do contrato
                    </p>
                  </div>
                  <div style={{ padding: '4px 16px 8px' }}>
                    <MetricLine label="Faturamento 7 dias"  value={formatBRL(pg.faturamento7dias)}  />
                    <MetricLine label="Faturamento 30 dias" value={formatBRL(pg.faturamento30dias)} />
                    <MetricLine label="Valor das Vendas"    value={formatBRL(pg.valorVendas)}       />
                    <MetricLineLast
                      label="Total Faturamento"
                      value={formatBRL(pg.totalFaturamento ?? pg.repasseTotal)}
                    />
                  </div>
                </div>

                {/* Card Sob Gestão */}
                <div style={{
                  backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8',
                  borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F3F3' }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: '#111111' }}>Sob Gestão</p>
                    <p style={{ fontSize: '11px', color: '#999999', marginTop: '2px' }}>
                      Baseado nos últimos resultados
                    </p>
                  </div>
                  <div style={{ padding: '4px 16px 8px' }}>
                    {!kpis ? (
                      <p style={{ fontSize: '12px', color: '#999999', textAlign: 'center', padding: '20px 0' }}>
                        Sem resultados lançados ainda.
                      </p>
                    ) : (
                      <>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: '12px', padding: '8px 0', borderBottom: '1px solid #F3F3F3',
                        }}>
                          <span style={{ fontSize: '12px', color: '#666666', flexShrink: 0 }}>
                            Faturamento última semana
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <VarBadge value={var7} />
                            <span style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '13px', color: '#111111', fontWeight: 500 }}>
                              {formatBRL(fat7atual)}
                            </span>
                          </div>
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: '12px', padding: '8px 0', borderBottom: '1px solid #F3F3F3',
                        }}>
                          <span style={{ fontSize: '12px', color: '#666666', flexShrink: 0 }}>
                            Faturamento últimas 4 semanas
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <VarBadge value={var30} />
                            <span style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '13px', color: '#111111', fontWeight: 500 }}>
                              {formatBRL(fat30atual)}
                            </span>
                          </div>
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: '12px', padding: '8px 0',
                        }}>
                          <span style={{ fontSize: '12px', color: '#999999', flexShrink: 0 }}>
                            {kpis.totalSemanas} semana{kpis.totalSemanas !== 1 ? 's' : ''} com resultado
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Seção 2 — KPIs Históricos */}
            {kpis && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut', delay: 0.08 }}
              >
                <p className="section-label" style={{ marginBottom: '10px' }}>KPIs Históricos</p>
                <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: '10px' }}>
                  <KPICard
                    label="Total acumulado"
                    value={formatBRL(kpis.totalAcumulado)}
                  />
                  <KPICard
                    label="Melhor semana"
                    value={formatBRL(kpis.melhorSemana?.[1]?.fat)}
                    sub={kpis.melhorSemana ? weekLabel(kpis.melhorSemana[0]) : '—'}
                  />
                  <KPICard
                    label="Pior semana"
                    value={formatBRL(kpis.piorSemana?.[1]?.fat)}
                    sub={kpis.piorSemana ? weekLabel(kpis.piorSemana[0]) : '—'}
                  />
                  <KPICard
                    label="Média semanal"
                    value={formatBRL(kpis.mediaSemanal)}
                  />
                  <KPICard
                    label="Maior alta registrada"
                    value={kpis.maiorVar ? formatVar(kpis.maiorVar[1].variacao) : '—'}
                    sub={kpis.maiorVar ? weekLabel(kpis.maiorVar[0]) : undefined}
                    valueColor={kpis.maiorVar ? '#16A34A' : undefined}
                  />
                  <KPICard
                    label="Crescimento vs queda"
                    value={`${kpis.crescimento} ↑ · ${kpis.queda} ↓`}
                    sub={`de ${kpis.totalSemanas} semanas`}
                  />
                  <KPICard
                    label="Variação média"
                    value={formatVar(kpis.mediaVar)}
                    valueColor={
                      kpis.mediaVar != null
                        ? kpis.mediaVar >= 0 ? '#16A34A' : '#DC2626'
                        : undefined
                    }
                  />
                  <KPICard
                    label="Semanas lançadas"
                    value={kpis.totalSemanas}
                  />
                </div>
              </motion.div>
            )}

            {/* Seção 3 — Gráfico de evolução */}
            {chartData.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut', delay: 0.16 }}
                style={{
                  backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8',
                  borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #F3F3F3' }}>
                  <p className="section-label">Evolução do Faturamento</p>
                </div>
                <div style={{ padding: '16px 16px 12px', height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} stroke="#F3F3F3" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="semana"
                        tick={{ fill: '#999999', fontSize: 10 }}
                        axisLine={false} tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fill: '#999999', fontSize: 10 }}
                        axisLine={false} tickLine={false}
                        tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                        width={36}
                      />
                      <Tooltip content={<ChartTooltip />} />
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
              </motion.div>
            )}

            {/* Estado vazio — sem resultados */}
            {!kpis && (
              <div style={{
                backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8',
                borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', padding: '48px 0',
              }}>
                <p style={{ fontSize: '12px', color: '#999999' }}>
                  Nenhum resultado lançado {selectedClienteId ? 'para este cliente' : 'para esta loja'} ainda.
                </p>
              </div>
            )}

          </div>
        )
      )}
    </motion.div>
  )
}
