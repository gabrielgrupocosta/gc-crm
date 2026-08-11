import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useModoTeste } from '../contexts/ModoTesteContext'
import {
  db, COLLECTIONS, collection, query, where, getDocs,
} from '../services/firebase'
import Skeleton from '../components/UI/Skeleton'
import {
  getISOWeekStr, getPrevWeekStr, getPeriodoComparativo, fetchByWeeksBatched,
} from '../utils/semanas'

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatBRL(n) {
  if (n == null || isNaN(n)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function formatPct(v, casas = 1) {
  if (v == null || isNaN(v)) return '—'
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(casas)}%`
}

function formatMeses(v) {
  if (v == null || isNaN(v)) return '—'
  return `${v.toFixed(1)} meses`
}

function tsDate(ts) { return ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null }

function lojaAtiva(l) {
  return ['ativa', 'ativo'].includes(l.status?.toLowerCase())
}

// Loja pode estar atribuída a um gestor OU direto a um supervisor (sem
// gestor no meio) — ver Lojas.jsx, campo `supervisorId`. Sem esse fallback,
// toda loja de supervisor ficava de fora das quebras "por gestor" e dos
// nichos cujas lojas são todas de supervisor sumiam da tela inteiros.
function responsavelDaLoja(loja) {
  return loja?.gestorId || loja?.supervisorId || null
}

// Soma agregada (não média de variações individuais) — mais robusto quando
// nem todo doc de resultado tem `variacao` já calculada. Mesmo padrão usado
// em Carteira.jsx.
//
// Compara o mesmo número de semanas dos dois lados. Se o período "anterior"
// só tem histórico pra N semanas (menos que as pedidas, ex: org recente),
// usa só as N semanas mais recentes do período atual também — senão somar
// 4 semanas de atual contra só 2 de anterior infla a variação artificialmente.
function crescimentoAgregado(atualDocs, anteriorDocs) {
  const semanasAnterior = new Set(anteriorDocs.map(r => r.semana))
  if (semanasAnterior.size === 0) return null

  const semanasAtualUsadas = new Set(
    [...new Set(atualDocs.map(r => r.semana))].sort().reverse().slice(0, semanasAnterior.size)
  )

  const somaAtual    = atualDocs.filter(r => semanasAtualUsadas.has(r.semana)).reduce((s, r) => s + (r.faturamento ?? 0), 0)
  const somaAnterior = anteriorDocs.reduce((s, r) => s + (r.faturamento ?? 0), 0)
  if (somaAnterior <= 0) return null
  return ((somaAtual - somaAnterior) / somaAnterior) * 100
}

function media(arr) {
  const vals = arr.filter(v => v != null && !isNaN(v))
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
}

const PERIODO_LABELS = {
  '1semana':  '1 semana',
  '4semanas': '4 semanas',
  '3meses':   'Últimos 3 meses',
}
const N_SEMANAS_POR_PERIODO = { '1semana': 1, '4semanas': 4, '3meses': 13 }

const FILTRO_LABELS = { todos: 'Todos', abaixo: 'Abaixo da média', acima: 'Acima da média' }

// ─── Animation variants ─────────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}
const listVariants = { animate: { transition: { staggerChildren: 0.03 } } }
const itemVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.15 } },
}

// ─── Selectors ───────────────────────────────────────────────────────────────

function PeriodoSelector({ periodo, onChange }) {
  return (
    <div className="inline-flex rounded-md p-0.5" style={{ border: '1px solid #E0E0E0' }}>
      {Object.entries(PERIODO_LABELS).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className="font-bold transition-colors duration-150"
          style={{
            fontSize: '12px', padding: '6px 14px', borderRadius: '5px', whiteSpace: 'nowrap',
            backgroundColor: periodo === key ? '#FF4B2E' : 'transparent',
            color: periodo === key ? '#FFFFFF' : '#666666',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function FiltroSelector({ filtro, onChange }) {
  return (
    <div className="inline-flex rounded-md p-0.5" style={{ border: '1px solid #E0E0E0' }}>
      {Object.entries(FILTRO_LABELS).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className="font-bold transition-colors duration-150"
          style={{
            fontSize: '12px', padding: '6px 14px', borderRadius: '5px', whiteSpace: 'nowrap',
            backgroundColor: filtro === key ? '#111111' : 'transparent',
            color: filtro === key ? '#FFFFFF' : '#666666',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── GestorMetricRow ────────────────────────────────────────────────────────

// `boaSeAlta`: se true, valor acima da média é "bom" (verde) — usado em
// crescimento e tempo de contrato. Se false (cancelamento), valor acima da
// média é "ruim" (vermelho), mesmo estando "acima".
function GestorMetricRow({ nome, valor, mediaEmpresa, formatValor, boaSeAlta, isLast }) {
  const acima = valor != null && mediaEmpresa != null ? valor > mediaEmpresa : null
  const bom   = acima == null ? null : (boaSeAlta ? acima : !acima)
  const cor   = bom == null ? '#999999' : bom ? '#00A67D' : '#DC2626'

  return (
    <div
      className="flex items-center justify-between table-row-base"
      style={{ padding: '10px 4px', borderBottom: isLast ? 'none' : undefined }}
    >
      <span style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>{nome}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono font-extrabold" style={{ fontSize: '14px', color: '#111111' }}>
          {formatValor(valor)}
        </span>
        {acima != null && (
          <span className="flex items-center gap-0.5 font-mono font-bold" style={{ fontSize: '11px', color: cor }}>
            {acima ? <ArrowUp size={11} strokeWidth={2.5} /> : <ArrowDown size={11} strokeWidth={2.5} />}
            vs média
          </span>
        )}
      </div>
    </div>
  )
}

// ─── MetricaGestorSection ───────────────────────────────────────────────────

function MetricaGestorSection({ titulo, descricao, mediaEmpresa, mediaLabel, formatValor, linhas, filtro, boaSeAlta }) {
  const filtradas = useMemo(() => {
    return linhas
      .filter(l => {
        if (filtro === 'todos' || l.valor == null || mediaEmpresa == null) return true
        return filtro === 'abaixo' ? l.valor < mediaEmpresa : l.valor > mediaEmpresa
      })
      .sort((a, b) => (b.valor ?? -Infinity) - (a.valor ?? -Infinity))
  }, [linhas, filtro, mediaEmpresa])

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between flex-wrap gap-2 mb-1">
        <div>
          <p className="section-title" style={{ marginBottom: '2px' }}>{titulo}</p>
          <p style={{ fontSize: '12px', color: '#999999' }}>{descricao}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="section-label" style={{ marginBottom: '2px' }}>{mediaLabel}</p>
          <p className="font-mono font-extrabold" style={{ fontSize: '18px', color: '#111111' }}>{formatValor(mediaEmpresa)}</p>
        </div>
      </div>

      <div className="mt-3">
        {filtradas.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#999999', padding: '16px 0', textAlign: 'center' }}>
            Nenhum gestor {filtro !== 'todos' ? FILTRO_LABELS[filtro].toLowerCase() : 'com dados'} no período.
          </p>
        ) : (
          <motion.div variants={listVariants} initial="initial" animate="animate">
            {filtradas.map((l, i) => (
              <motion.div key={l.gestorId} variants={itemVariants}>
                <GestorMetricRow
                  nome={l.nome}
                  valor={l.valor}
                  mediaEmpresa={mediaEmpresa}
                  formatValor={formatValor}
                  boaSeAlta={boaSeAlta}
                  isLast={i === filtradas.length - 1}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ─── NichoSection ───────────────────────────────────────────────────────────

function NichoSection({ nichos, filtro }) {
  return (
    <div className="card p-5">
      <p className="section-title" style={{ marginBottom: '2px' }}>Crescimento por nicho</p>
      <p style={{ fontSize: '12px', color: '#999999', marginBottom: '14px' }}>
        Média de crescimento do nicho e quais gestores estão acima ou abaixo dela dentro de cada segmento.
      </p>

      {nichos.length === 0 ? (
        <p style={{ fontSize: '12px', color: '#999999', padding: '16px 0', textAlign: 'center' }}>
          Sem dados suficientes no período selecionado.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {nichos.map(nicho => {
            const linhasFiltradas = nicho.gestores.filter(g => {
              if (filtro === 'todos' || g.valor == null || nicho.media == null) return true
              return filtro === 'abaixo' ? g.valor < nicho.media : g.valor > nicho.media
            })
            if (linhasFiltradas.length === 0) return null

            return (
              <div key={nicho.segmento} style={{ borderTop: '1px solid #F0F0F0', paddingTop: '12px' }}>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#111111' }}>{nicho.segmento}</span>
                  <span className="font-mono" style={{ fontSize: '12px', color: '#999999' }}>
                    média do nicho: <strong style={{ color: '#111111' }}>{formatPct(nicho.media)}</strong>
                  </span>
                </div>
                <div className="flex flex-col">
                  {linhasFiltradas
                    .sort((a, b) => (b.valor ?? -Infinity) - (a.valor ?? -Infinity))
                    .map((g, i) => (
                      <GestorMetricRow
                        key={g.gestorId}
                        nome={g.nome}
                        valor={g.valor}
                        mediaEmpresa={nicho.media}
                        formatValor={formatPct}
                        boaSeAlta
                        isLast={i === linhasFiltradas.length - 1}
                      />
                    ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Metricas() {
  const { user, isSuperAdmin } = useAuth()
  const { modoTesteAtivo, organizacaoIdsPermitidos } = useModoTeste()

  const [loading,  setLoading]  = useState(true)
  const [lojas,    setLojas]    = useState([])
  const [gestores, setGestores] = useState([])
  // Padrão "1 semana": com pouco histórico acumulado (organização recente),
  // "4 semanas" abria a tela toda vazia (sem período anterior pra comparar),
  // então o usuário via "sem dados" antes mesmo de poder trocar o filtro.
  const [periodo,  setPeriodo]  = useState('1semana')
  const [resultadosAtual,    setResultadosAtual]    = useState([])
  const [resultadosAnterior, setResultadosAnterior] = useState([])
  const [loadingResultados,  setLoadingResultados]  = useState(true)
  const [filtro, setFiltro] = useState('todos')

  // ── Base: lojas + gestores (não dependem do período) ──────────────────────
  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const escopo = modoTesteAtivo
          ? [where('organizacaoId', 'in', organizacaoIdsPermitidos.slice(0, 10))]
          : isSuperAdmin ? [] : [where('organizacaoId', '==', user.organizacaoId ?? null)]
        const gestoresQuery = query(collection(db, COLLECTIONS.USERS), ...escopo, where('role', 'in', ['gestor', 'supervisor']))

        const [lojasSnap, gestoresSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.LOJAS), ...escopo)),
          getDocs(gestoresQuery),
        ])
        if (cancelled) return
        setLojas(lojasSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(lojaAtiva))
        setGestores(gestoresSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(g => g.status === 'ativo'))
      } catch (err) {
        console.error('[Metricas] erro ao carregar base:', err?.code, err?.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user, isSuperAdmin, modoTesteAtivo, organizacaoIdsPermitidos])

  // ── Resultados do período selecionado (atual + anterior equivalente) ──────
  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoadingResultados(true)
    async function load() {
      try {
        const n = N_SEMANAS_POR_PERIODO[periodo] ?? 4
        const refWeek = getPrevWeekStr(getISOWeekStr())
        const { atual, anterior } = getPeriodoComparativo(refWeek, n)
        const orgId = modoTesteAtivo ? organizacaoIdsPermitidos : isSuperAdmin ? null : (user.organizacaoId ?? null)
        const [resAtual, resAnterior] = await Promise.all([
          fetchByWeeksBatched(atual, orgId),
          fetchByWeeksBatched(anterior, orgId),
        ])
        if (cancelled) return
        setResultadosAtual(resAtual)
        setResultadosAnterior(resAnterior)
      } catch (err) {
        console.error('[Metricas] erro ao carregar resultados:', err?.code, err?.message)
      } finally {
        if (!cancelled) setLoadingResultados(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user, isSuperAdmin, periodo, modoTesteAtivo, organizacaoIdsPermitidos])

  const lojaMap = useMemo(() => Object.fromEntries(lojas.map(l => [l.id, l])), [lojas])
  const lojaIds = useMemo(() => new Set(lojas.map(l => l.id)), [lojas])

  // Só considera resultados de lojas ativas atualmente cadastradas — evita
  // contaminar as médias com lojas já encerradas cujo histórico ainda existe.
  const resAtualValidos    = useMemo(() => resultadosAtual.filter(r => lojaIds.has(r.lojaId)), [resultadosAtual, lojaIds])
  const resAnteriorValidos = useMemo(() => resultadosAnterior.filter(r => lojaIds.has(r.lojaId)), [resultadosAnterior, lojaIds])

  // ── 1. Crescimento médio da carteira, gestor a gestor ──────────────────────
  const crescimentoPorGestor = useMemo(() => {
    const linhas = gestores.map(g => {
      const atualG    = resAtualValidos.filter(r => responsavelDaLoja(lojaMap[r.lojaId]) === g.id)
      const anteriorG = resAnteriorValidos.filter(r => responsavelDaLoja(lojaMap[r.lojaId]) === g.id)
      return { gestorId: g.id, nome: g.nome, valor: crescimentoAgregado(atualG, anteriorG) }
    })
    const mediaEmpresa = crescimentoAgregado(resAtualValidos, resAnteriorValidos)
    return { linhas, mediaEmpresa }
  }, [gestores, lojaMap, resAtualValidos, resAnteriorValidos])

  // ── 2. Cancelamento médio, empresa x gestor ────────────────────────────────
  const cancelamentoPorGestor = useMemo(() => {
    const linhas = gestores.map(g => {
      const docsG = resAtualValidos.filter(r => responsavelDaLoja(lojaMap[r.lojaId]) === g.id && r.cancelamento != null)
      return { gestorId: g.id, nome: g.nome, valor: media(docsG.map(r => r.cancelamento)) }
    })
    const mediaEmpresa = media(resAtualValidos.filter(r => r.cancelamento != null).map(r => r.cancelamento))
    return { linhas, mediaEmpresa }
  }, [gestores, lojaMap, resAtualValidos])

  // ── 3. Crescimento por nicho — média do nicho e gestores dentro dele ───────
  const crescimentoPorNicho = useMemo(() => {
    const segmentos = [...new Set(lojas.map(l => l.segmento).filter(Boolean))]
    return segmentos
      .map(segmento => {
        const lojasDoNicho   = new Set(lojas.filter(l => l.segmento === segmento).map(l => l.id))
        const atualNicho     = resAtualValidos.filter(r => lojasDoNicho.has(r.lojaId))
        const anteriorNicho  = resAnteriorValidos.filter(r => lojasDoNicho.has(r.lojaId))
        const mediaNicho     = crescimentoAgregado(atualNicho, anteriorNicho)

        const gestoresDoNicho = [...new Set([...lojasDoNicho].map(id => responsavelDaLoja(lojaMap[id])).filter(Boolean))]
        const linhasGestores = gestoresDoNicho.map(gestorId => {
          const nome = gestores.find(g => g.id === gestorId)?.nome ?? '—'
          const atualGN    = atualNicho.filter(r => responsavelDaLoja(lojaMap[r.lojaId]) === gestorId)
          const anteriorGN = anteriorNicho.filter(r => responsavelDaLoja(lojaMap[r.lojaId]) === gestorId)
          return { gestorId, nome, valor: crescimentoAgregado(atualGN, anteriorGN) }
        }).filter(g => g.valor != null)

        return { segmento, media: mediaNicho, gestores: linhasGestores }
      })
      .filter(n => n.media != null && n.gestores.length > 0)
      .sort((a, b) => b.gestores.length - a.gestores.length)
  }, [lojas, gestores, lojaMap, resAtualValidos, resAnteriorValidos])

  // ── 4. Tempo médio de contrato, empresa x gestor ───────────────────────────
  const tempoContratoPorGestor = useMemo(() => {
    const agora = new Date()
    const mesesDe = l => {
      const inicio = tsDate(l.dataInicio)
      if (!inicio) return null
      return Math.max(0, (agora.getFullYear() - inicio.getFullYear()) * 12 + (agora.getMonth() - inicio.getMonth()))
    }
    const linhas = gestores.map(g => {
      const lojasG = lojas.filter(l => responsavelDaLoja(l) === g.id)
      return { gestorId: g.id, nome: g.nome, valor: media(lojasG.map(mesesDe)) }
    })
    const mediaEmpresa = media(lojas.map(mesesDe))
    return { linhas, mediaEmpresa }
  }, [gestores, lojas])

  const carregando = loading || loadingResultados

  return (
    <motion.div style={{ padding: '28px 20px' }} variants={pageVariants} initial="initial" animate="animate">
      <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Métricas</h1>
          <p style={{ fontSize: '13px', color: '#999999', marginTop: '2px' }}>
            Análise comparativa entre gestores — identifique problemas antes que virem tendência.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <PeriodoSelector periodo={periodo} onChange={setPeriodo} />
        <FiltroSelector filtro={filtro} onChange={setFiltro} />
      </div>

      {carregando ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="card p-5 flex flex-col gap-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : gestores.length === 0 ? (
        <div className="card p-8 flex flex-col items-center gap-2 text-center">
          <AlertTriangle size={20} strokeWidth={1.5} style={{ color: '#CBD5E1' }} />
          <p style={{ fontSize: '13px', color: '#999999' }}>Nenhum gestor ativo cadastrado ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricaGestorSection
            titulo="Crescimento da carteira"
            descricao={`Faturamento — ${PERIODO_LABELS[periodo]} vs período anterior equivalente`}
            mediaEmpresa={crescimentoPorGestor.mediaEmpresa}
            mediaLabel="Média da empresa"
            formatValor={formatPct}
            linhas={crescimentoPorGestor.linhas}
            filtro={filtro}
            boaSeAlta
          />

          <MetricaGestorSection
            titulo="Taxa de cancelamento"
            descricao={`Média semanal reportada — ${PERIODO_LABELS[periodo]}`}
            mediaEmpresa={cancelamentoPorGestor.mediaEmpresa}
            mediaLabel="Média da empresa"
            formatValor={v => v != null ? `${v.toFixed(1)}%` : '—'}
            linhas={cancelamentoPorGestor.linhas}
            filtro={filtro}
            boaSeAlta={false}
          />

          <MetricaGestorSection
            titulo="Tempo médio de contrato"
            descricao="Tempo de gestão das lojas ativas de cada gestor"
            mediaEmpresa={tempoContratoPorGestor.mediaEmpresa}
            mediaLabel="Média da empresa"
            formatValor={formatMeses}
            linhas={tempoContratoPorGestor.linhas}
            filtro={filtro}
            boaSeAlta
          />

          <NichoSection nichos={crescimentoPorNicho} filtro={filtro} />
        </div>
      )}
    </motion.div>
  )
}
