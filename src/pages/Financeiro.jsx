import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { httpsCallable } from 'firebase/functions'
import { RefreshCw, ChevronLeft, ChevronRight, Search, Check, Undo2, Plus, X, Trash2 } from 'lucide-react'
import {
  db, COLLECTIONS, functions,
  collection, doc, query, where, getDocs, updateDoc, Timestamp,
} from '../services/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/UI/Toast'
import Modal from '../components/UI/Modal'
import ConfirmModal from '../components/UI/ConfirmModal'
import Skeleton from '../components/UI/Skeleton'

// ─── Constants ────────────────────────────────────────────────────────────────

const sincronizarCobrancasAgoraFn = httpsCallable(functions, 'sincronizarCobrancasAgora')
const limparCobrancasAntigasNaoPagasFn = httpsCallable(functions, 'limparCobrancasAntigasNaoPagas')

const MESES_LABEL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// Divisões prontas — o padrão é sempre 100% no vencimento; estas são atalhos
// pra situações combinadas com o cliente (ex: 50% agora + 50% em 15 dias).
const PRESETS = [
  { label: '100% no vencimento', linhas: [{ pct: 100, dias: 0 }] },
  { label: '50/50 em 7 dias',    linhas: [{ pct: 50, dias: 0 }, { pct: 50, dias: 7 }] },
  { label: '50/50 em 15 dias',   linhas: [{ pct: 50, dias: 0 }, { pct: 50, dias: 15 }] },
  { label: '30/70 em 15 dias',   linhas: [{ pct: 30, dias: 0 }, { pct: 70, dias: 15 }] },
]

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatBRL(n) {
  if (n == null || n === '' || isNaN(n)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

function toDate(v) {
  if (!v) return null
  return v.toDate ? v.toDate() : new Date(v)
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateBR(d) {
  if (!d) return '—'
  return d.toLocaleDateString('pt-BR')
}

function inicioDoDia(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

// Segunda a domingo da semana corrente — usado pra filtrar a tabela do
// Financeiro só nas cobranças "da semana", em vez de listar tudo que já foi
// gerado (a geração automática olha até 60 dias à frente, então sem esse
// filtro a lista fica poluída com cobranças de meses futuros).
function inicioDaSemana(d) {
  const dia = (d.getDay() + 6) % 7 // 0=segunda..6=domingo
  const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dia)
  return inicio
}

function fimDaSemana(d) {
  const inicio = inicioDaSemana(d)
  return new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6, 23, 59, 59, 999)
}

// Status de uma parcela isolada — pago tem prioridade; senão, atrasado se já
// passou do vencimento; senão pendente (ainda dentro do prazo).
function statusParcela(parcela, hoje) {
  if (parcela.pago) return 'pago'
  const venc = toDate(parcela.dataVencimento)
  if (venc && inicioDoDia(venc) < inicioDoDia(hoje)) return 'atrasado'
  return 'pendente'
}

// Status agregado da cobrança inteira, a partir das parcelas — atrasado tem
// prioridade (precisa de atenção), depois parcial (mix de pago/pendente).
function statusCobranca(cobranca, hoje) {
  const parcelas = cobranca.parcelas ?? []
  if (!parcelas.length) return 'pendente'
  const statuses = parcelas.map(p => statusParcela(p, hoje))
  if (statuses.some(s => s === 'atrasado')) return 'atrasado'
  if (statuses.every(s => s === 'pago')) return 'pago'
  if (statuses.some(s => s === 'pago')) return 'parcial'
  return 'pendente'
}

const STATUS_COLORS = {
  pago:      { color: '#16A34A', bg: 'rgba(22,163,74,0.1)',  label: 'Pago' },
  parcial:   { color: '#CA8A04', bg: 'rgba(202,138,4,0.1)',  label: 'Parcial' },
  pendente:  { color: '#666666', bg: 'rgba(153,153,153,0.1)', label: 'Pendente' },
  atrasado:  { color: '#DC2626', bg: 'rgba(220,38,38,0.1)',  label: 'Atrasado' },
}

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.pendente
  return (
    <span
      className="text-[10px] font-medium uppercase tracking-[0.04em] whitespace-nowrap"
      style={{ padding: '2px 8px', borderRadius: '4px', color: c.color, backgroundColor: c.bg }}
    >
      {c.label}
    </span>
  )
}

// Aplica um preset de parcelamento — divide valorTotal pelos percentuais e
// soma os dias de offset à data-base; a última linha absorve o arredondamento
// de centavos, pra soma das parcelas nunca ficar 1 centavo fora do total.
function aplicarPreset(preset, valorTotal, dataBase) {
  let somaAcumulada = 0
  return preset.linhas.map((linha, i) => {
    let valor = Math.round(valorTotal * linha.pct) / 100
    if (i === preset.linhas.length - 1) valor = Math.round((valorTotal - somaAcumulada) * 100) / 100
    somaAcumulada += valor
    const data = new Date(dataBase)
    data.setDate(data.getDate() + linha.dias)
    return {
      id: `p${i}_${Date.now()}`,
      percentual: linha.pct,
      valor,
      dataVencimento: dateKey(data),
      pago: false,
      dataPagamento: null,
    }
  })
}

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

// ─── KPI card ───────────────────────────────────────────────────────────────

function KPICard({ label, value, valueColor }) {
  return (
    <div className="card-kpi">
      <p className="typography-section-label" style={{ marginBottom: '10px' }}>{label}</p>
      <p className="typography-kpi-value" style={valueColor ? { color: valueColor } : undefined}>{value}</p>
    </div>
  )
}

// ─── Modal: editar cobrança (parcelamento + marcar pago) ──────────────────────

function CobrancaModal({ isOpen, onClose, cobranca, clienteNome, onSalvar }) {
  const [parcelas, setParcelas] = useState([])
  const [saving,   setSaving]   = useState(false)
  const [dataBase, setDataBase] = useState(null)

  useEffect(() => {
    if (!isOpen || !cobranca) return
    const parcelasIniciais = (cobranca.parcelas ?? []).map(p => ({
      id: p.id,
      percentual: p.percentual ?? Math.round((p.valor / cobranca.valorTotal) * 100),
      valor: p.valor,
      dataVencimento: dateKey(toDate(p.dataVencimento)),
      pago: !!p.pago,
      dataPagamento: p.dataPagamento ?? null,
    }))
    setParcelas(parcelasIniciais)
    const menorData = parcelasIniciais.reduce((min, p) => !min || p.dataVencimento < min ? p.dataVencimento : min, null)
    setDataBase(menorData ? new Date(menorData) : new Date())
  }, [isOpen, cobranca])

  if (!cobranca) return null

  function updateLinha(idx, key, value) {
    setParcelas(prev => prev.map((p, i) => i === idx ? { ...p, [key]: value } : p))
  }

  function removerLinha(idx) {
    setParcelas(prev => prev.filter((_, i) => i !== idx))
  }

  function adicionarLinha() {
    setParcelas(prev => [...prev, {
      id: `novo_${Date.now()}`, percentual: 0, valor: '',
      dataVencimento: dateKey(dataBase ?? new Date()), pago: false, dataPagamento: null,
    }])
  }

  function usarPreset(preset) {
    setParcelas(aplicarPreset(preset, cobranca.valorTotal, dataBase ?? new Date()))
  }

  function toggleLinhaPago(idx) {
    setParcelas(prev => prev.map((p, i) => i === idx
      ? { ...p, pago: !p.pago, dataPagamento: !p.pago ? Timestamp.now() : null }
      : p
    ))
  }

  const somaParcelas = parcelas.reduce((s, p) => s + (parseFloat(String(p.valor).replace(',', '.')) || 0), 0)
  const diferenca = Math.round((cobranca.valorTotal - somaParcelas) * 100) / 100
  const parcelasValidas = parcelas.length > 0 && parcelas.every(p => p.valor !== '' && !isNaN(parseFloat(String(p.valor).replace(',', '.'))) && p.dataVencimento)
  const canSave = parcelasValidas && diferenca === 0

  async function handleSalvar() {
    setSaving(true)
    try {
      const payload = parcelas.map(p => ({
        id: p.id,
        percentual: p.percentual,
        valor: parseFloat(String(p.valor).replace(',', '.')),
        dataVencimento: Timestamp.fromDate(new Date(p.dataVencimento + 'T00:00:00')),
        pago: p.pago,
        dataPagamento: p.pago ? (p.dataPagamento ?? Timestamp.now()) : null,
      }))
      await onSalvar(cobranca, payload)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${clienteNome ?? '—'} — ${cobranca.competenciaLabel}`}
      width="max-w-lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="button" onClick={handleSalvar} disabled={!canSave || saving} className="btn-primary">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-text-muted">Valor total da cobrança</span>
          <span className="font-mono text-[15px] font-semibold text-text-primary">{formatBRL(cobranca.valorTotal)}</span>
        </div>

        <div className="flex flex-col gap-2">
          <p className="section-label">Modelos de parcelamento</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => usarPreset(preset)}
                className="btn-secondary text-[12px] px-3 h-8"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="section-label">Parcelas</p>
            {diferenca !== 0 && (
              <span className="text-[11px] text-negative font-mono">
                {diferenca > 0 ? `Faltam ${formatBRL(diferenca)}` : `Excede ${formatBRL(-diferenca)}`}
              </span>
            )}
          </div>

          {parcelas.map((p, idx) => (
            <div key={p.id} className="flex flex-col gap-2 p-3 border border-border-hover rounded-lg bg-[#FAFAFA]">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-text-muted">Parcela {idx + 1}</span>
                <div className="flex items-center gap-3">
                  {!p.pago && parcelas.length > 1 && (
                    <button type="button" onClick={() => removerLinha(idx)} className="inline-flex items-center gap-1 text-[12px] text-text-subtle hover:text-negative transition-colors duration-150">
                      <X size={13} strokeWidth={1.5} />
                      Remover
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="field-label">Valor (R$)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={p.valor}
                    disabled={p.pago}
                    onChange={e => updateLinha(idx, 'valor', e.target.value)}
                    className="input font-mono"
                    style={{ height: '34px', fontSize: '13px' }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="field-label">Vencimento</label>
                  <input
                    type="date"
                    value={p.dataVencimento}
                    disabled={p.pago}
                    onChange={e => updateLinha(idx, 'dataVencimento', e.target.value)}
                    className="input"
                    style={{ height: '34px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => toggleLinhaPago(idx)}
                className={p.pago ? 'btn-secondary' : 'btn-primary'}
                style={{ height: '32px', fontSize: '12px' }}
              >
                {p.pago
                  ? <span className="inline-flex items-center gap-1.5"><Undo2 size={12} strokeWidth={2} /> Desfazer pagamento</span>
                  : <span className="inline-flex items-center gap-1.5"><Check size={12} strokeWidth={2} /> Marcar como pago</span>}
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={adicionarLinha}
            className="btn-secondary flex items-center justify-center gap-2 h-9 text-[13px] self-start px-3"
          >
            <Plus size={13} strokeWidth={2} />
            Adicionar parcela
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Calendário de pagamentos ─────────────────────────────────────────────────

// Sempre preenche a grade em semanas completas (7 colunas) — dias do mês
// anterior/seguinte que caem na mesma semana aparecem esmaecidos, em vez de
// deixar a célula vazia (ex: sábado/domingo já do mês seguinte continuam
// visíveis na última linha).
function gerarGradeCalendario(mesRef) {
  const ano = mesRef.getFullYear()
  const mes = mesRef.getMonth()
  const primeiroDia = new Date(ano, mes, 1)
  const ultimoDia   = new Date(ano, mes + 1, 0)
  const diaSemanaISO = (primeiroDia.getDay() + 6) % 7 // 0=segunda...6=domingo

  const celulas = []
  for (let i = diaSemanaISO; i > 0; i--) {
    celulas.push({ data: new Date(ano, mes, 1 - i), foraDoMes: true })
  }
  for (let d = 1; d <= ultimoDia.getDate(); d++) {
    celulas.push({ data: new Date(ano, mes, d), foraDoMes: false })
  }
  let extra = 1
  while (celulas.length % 7 !== 0) {
    celulas.push({ data: new Date(ano, mes + 1, extra), foraDoMes: true })
    extra++
  }
  return celulas
}

function CalendarioPagamentos({ mesRef, onMudarMes, parcelasPorDia, hoje, diaSelecionado, onSelecionarDia }) {
  const celulas = useMemo(() => gerarGradeCalendario(mesRef), [mesRef])
  const hojeKey = dateKey(hoje)

  return (
    <div className="bg-surface border border-border rounded-lg shadow-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[15px] font-medium text-text-primary" style={{ letterSpacing: '-0.02em' }}>
          {MESES_LABEL[mesRef.getMonth()]} {mesRef.getFullYear()}
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => onMudarMes(-1)} className="p-1.5 rounded-md hover:bg-[#F9F9F9] text-text-subtle transition-colors duration-150">
            <ChevronLeft size={16} strokeWidth={1.5} />
          </button>
          <button onClick={() => onMudarMes(1)} className="p-1.5 rounded-md hover:bg-[#F9F9F9] text-text-subtle transition-colors duration-150">
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS_SEMANA.map(d => (
          <p key={d} className="text-[10px] uppercase tracking-[0.06em] text-text-faint text-center py-1">{d}</p>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {celulas.map(({ data, foraDoMes }, i) => {
          const key = dateKey(data)
          const itens = parcelasPorDia[key] ?? []
          const temAtrasado  = itens.some(it => statusParcela(it.parcela, hoje) === 'atrasado')
          const temPendente  = itens.some(it => statusParcela(it.parcela, hoje) === 'pendente')
          const todosPagos   = itens.length > 0 && itens.every(it => it.parcela.pago)
          const dotColor = temAtrasado ? '#DC2626' : temPendente ? '#CA8A04' : todosPagos ? '#16A34A' : null

          return (
            <button
              key={i}
              onClick={() => onSelecionarDia(itens.length ? key : null)}
              className="flex flex-col items-center justify-start gap-1 rounded-md transition-colors duration-150"
              style={{
                height: '52px', paddingTop: '6px',
                backgroundColor: diaSelecionado === key ? '#FFF5F5' : key === hojeKey ? '#F9F9F9' : 'transparent',
                border: key === hojeKey ? '1px solid #E8E8E8' : '1px solid transparent',
                cursor: itens.length ? 'pointer' : 'default',
                opacity: foraDoMes ? 0.4 : 1,
              }}
            >
              <span className="text-[12px] font-mono" style={{ color: key === hojeKey ? '#111111' : '#666666', fontWeight: key === hojeKey ? 700 : 400 }}>
                {data.getDate()}
              </span>
              {dotColor && (
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: dotColor }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Financeiro() {
  const { user, isSuperAdmin } = useAuth()
  const toast = useToast()

  const [cobrancas, setCobrancas] = useState([])
  const [clientes,  setClientes]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [syncing,   setSyncing]   = useState(false)
  const [limpando,  setLimpando]  = useState(false)
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false)

  const [mesRef,          setMesRef]          = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [diaSelecionado,  setDiaSelecionado]  = useState(null)
  const [semanaRef,       setSemanaRef]       = useState(() => new Date())
  const [search,          setSearch]          = useState('')
  const [filtroStatus,    setFiltroStatus]    = useState('')
  const [editingCobranca, setEditingCobranca] = useState(null)

  const hoje = useMemo(() => new Date(), [])

  async function loadAll() {
    setLoading(true)
    try {
      const orgId  = user?.organizacaoId ?? null
      const escopo = isSuperAdmin ? [] : [where('organizacaoId', '==', orgId)]
      const [cobrancasSnap, clientesSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.COBRANCAS), ...escopo)),
        getDocs(query(collection(db, COLLECTIONS.CLIENTES), ...escopo)),
      ])
      setCobrancas(cobrancasSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setClientes(clientesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error('[Financeiro] loadAll:', err)
      toast('Erro ao carregar dados financeiros.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (user) loadAll() }, [user, isSuperAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  const clienteMap = useMemo(() => Object.fromEntries(clientes.map(c => [c.id, c])), [clientes])

  async function handleSincronizar() {
    setSyncing(true)
    try {
      const { data } = await sincronizarCobrancasAgoraFn()
      toast(data.criadas > 0 ? `${data.criadas} cobrança${data.criadas > 1 ? 's' : ''} gerada${data.criadas > 1 ? 's' : ''}.` : 'Tudo sincronizado — nada novo.', 'success')
      await loadAll()
    } catch (err) {
      console.error('[Financeiro] sincronizar:', err)
      toast('Erro ao sincronizar cobranças.', 'error')
    } finally {
      setSyncing(false)
    }
  }

  async function handleLimparAntigas() {
    setLimpando(true)
    try {
      const { data } = await limparCobrancasAntigasNaoPagasFn()
      toast(data.removidas > 0 ? `${data.removidas} cobrança${data.removidas > 1 ? 's' : ''} antiga${data.removidas > 1 ? 's' : ''} removida${data.removidas > 1 ? 's' : ''}.` : 'Nenhuma cobrança antiga pendente pra remover.', 'success')
      setConfirmandoLimpeza(false)
      await loadAll()
    } catch (err) {
      console.error('[Financeiro] limpar antigas:', err)
      toast('Erro ao limpar cobranças antigas.', 'error')
    } finally {
      setLimpando(false)
    }
  }

  async function handleSalvarParcelas(cobranca, novasParcelas) {
    try {
      await updateDoc(doc(db, COLLECTIONS.COBRANCAS, cobranca.id), { parcelas: novasParcelas })
      toast('Cobrança atualizada.', 'success')
      await loadAll()
    } catch (err) {
      console.error('[Financeiro] salvar parcelas:', err)
      toast('Erro ao salvar. Tente novamente.', 'error')
    }
  }

  async function toggleParcelaRapido(cobranca, parcelaId) {
    const novasParcelas = (cobranca.parcelas ?? []).map(p => p.id === parcelaId
      ? { ...p, pago: !p.pago, dataPagamento: !p.pago ? Timestamp.now() : null }
      : p
    )
    try {
      await updateDoc(doc(db, COLLECTIONS.COBRANCAS, cobranca.id), { parcelas: novasParcelas })
      await loadAll()
    } catch (err) {
      console.error('[Financeiro] toggle rápido:', err)
      toast('Erro ao atualizar parcela.', 'error')
    }
  }

  // Mapa dia → parcelas que vencem naquele dia (junto da cobrança/cliente pai)
  const parcelasPorDia = useMemo(() => {
    const map = {}
    cobrancas.forEach(c => {
      (c.parcelas ?? []).forEach(p => {
        const d = toDate(p.dataVencimento)
        if (!d) return
        const key = dateKey(d)
        ;(map[key] ??= []).push({ cobranca: c, parcela: p })
      })
    })
    return map
  }, [cobrancas])

  // ─── KPIs ───────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    let aReceberMes = 0, recebidoMes = 0, atrasadoTotal = 0, emAbertoTotal = 0
    const anoRef = mesRef.getFullYear(), mesNum = mesRef.getMonth()
    const anoAtual = hoje.getFullYear(), mesAtual = hoje.getMonth()

    cobrancas.forEach(c => {
      (c.parcelas ?? []).forEach(p => {
        const venc = toDate(p.dataVencimento)
        if (!venc) return
        const noMesRef    = venc.getFullYear() === anoRef && venc.getMonth() === mesNum
        const noMesAtual  = venc.getFullYear() === anoAtual && venc.getMonth() === mesAtual
        const st = statusParcela(p, hoje)

        if (noMesRef && !p.pago) aReceberMes += p.valor
        if (noMesRef && p.pago) recebidoMes += p.valor
        if (st === 'atrasado') atrasadoTotal += p.valor
        if (noMesAtual && !p.pago) emAbertoTotal += p.valor
      })
    })

    return { aReceberMes, recebidoMes, atrasadoTotal, emAbertoTotal }
  }, [cobrancas, mesRef, hoje])

  // ─── Lista/tabela ───────────────────────────────────────────────────────────

  const cobrancasFiltradas = useMemo(() => {
    const term = search.toLowerCase()
    const inicio = inicioDaSemana(semanaRef)
    const fim    = fimDaSemana(semanaRef)
    return cobrancas
      .map(c => {
        const vencimentosNaSemana = (c.parcelas ?? [])
          .map(p => toDate(p.dataVencimento))
          .filter(d => d && d >= inicio && d <= fim)
          .sort((a, b) => a - b)
        return { ...c, vencimentoLabel: vencimentosNaSemana.map(formatDateBR).join(', ') }
      })
      .filter(c => {
        const nomeCliente = clienteMap[c.clienteId]?.nome ?? ''
        const matchNome    = !term || nomeCliente.toLowerCase().includes(term)
        const matchStatus  = !filtroStatus || statusCobranca(c, hoje) === filtroStatus
        const matchSemana  = c.vencimentoLabel !== ''
        return matchNome && matchStatus && matchSemana
      })
      .sort((a, b) => (b.competencia ?? '').localeCompare(a.competencia ?? ''))
  }, [cobrancas, clienteMap, search, filtroStatus, hoje, semanaRef])

  const itensDoDiaSelecionado = diaSelecionado ? (parcelasPorDia[diaSelecionado] ?? []) : []

  return (
    <motion.div style={{ padding: '28px 20px' }} variants={pageVariants} initial="initial" animate="animate">
      <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Financeiro</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setConfirmandoLimpeza(true)} disabled={limpando} className="btn-secondary flex items-center justify-center gap-2 h-11 sm:h-9">
            <Trash2 size={14} strokeWidth={2} />
            Limpar antigas
          </button>
          <button onClick={handleSincronizar} disabled={syncing} className="btn-secondary flex items-center justify-center gap-2 h-11 sm:h-9">
            <RefreshCw size={14} strokeWidth={2} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando…' : 'Sincronizar agora'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton.KPI key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <KPICard label={`A receber — ${MESES_LABEL[mesRef.getMonth()]}`} value={formatBRL(kpis.aReceberMes)} />
          <KPICard label={`Recebido — ${MESES_LABEL[mesRef.getMonth()]}`} value={formatBRL(kpis.recebidoMes)} valueColor="#16A34A" />
          <KPICard label="Atrasado" value={formatBRL(kpis.atrasadoTotal)} valueColor={kpis.atrasadoTotal > 0 ? '#DC2626' : undefined} />
          <KPICard label="Total em aberto" value={formatBRL(kpis.emAbertoTotal)} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mb-5">
        <CalendarioPagamentos
          mesRef={mesRef}
          onMudarMes={delta => setMesRef(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))}
          parcelasPorDia={parcelasPorDia}
          hoje={hoje}
          diaSelecionado={diaSelecionado}
          onSelecionarDia={setDiaSelecionado}
        />

        <div className="bg-surface border border-border rounded-lg shadow-card p-4 flex flex-col gap-3">
          <p className="section-label">
            {diaSelecionado ? `Vencimentos em ${diaSelecionado.split('-').reverse().join('/')}` : 'Selecione um dia'}
          </p>
          {!diaSelecionado ? (
            <p className="text-[12px] text-text-subtle">Clique num dia com marcação no calendário pra ver os vencimentos.</p>
          ) : itensDoDiaSelecionado.length === 0 ? (
            <p className="text-[12px] text-text-subtle">Nenhum vencimento neste dia.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {itensDoDiaSelecionado.map(({ cobranca, parcela }) => (
                <div key={parcela.id} className="flex items-center justify-between gap-2 p-2.5 border border-border-subtle rounded-md">
                  <div className="min-w-0 flex flex-col gap-0.5">
                    <span className="text-[13px] text-text-primary font-medium truncate">{clienteMap[cobranca.clienteId]?.nome ?? '—'}</span>
                    <span className="text-[12px] font-mono text-text-muted">{formatBRL(parcela.valor)}</span>
                  </div>
                  <button
                    onClick={() => toggleParcelaRapido(cobranca, parcela.id)}
                    className="shrink-0"
                    title={parcela.pago ? 'Desfazer pagamento' : 'Marcar como pago'}
                    style={{
                      width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: parcela.pago ? 'rgba(22,163,74,0.1)' : '#FFFFFF',
                      border: `1px solid ${parcela.pago ? 'rgba(22,163,74,0.3)' : '#E8E8E8'}`,
                    }}
                  >
                    <Check size={14} strokeWidth={2} color={parcela.pago ? '#16A34A' : '#BBBBBB'} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navegação de semana — a tabela abaixo mostra só as cobranças com
          parcela vencendo nessa semana, pra não poluir com o que a geração
          automática já criou pra meses futuros. */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] text-text-muted">
          Semana de <span className="font-mono text-text-primary">{formatDateBR(inicioDaSemana(semanaRef))}</span> a <span className="font-mono text-text-primary">{formatDateBR(fimDaSemana(semanaRef))}</span>
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => setSemanaRef(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7))} className="p-1.5 rounded-md hover:bg-[#F9F9F9] text-text-subtle transition-colors duration-150">
            <ChevronLeft size={16} strokeWidth={1.5} />
          </button>
          <button onClick={() => setSemanaRef(new Date())} className="btn-secondary text-[12px] px-3 h-7">Hoje</button>
          <button onClick={() => setSemanaRef(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7))} className="p-1.5 rounded-md hover:bg-[#F9F9F9] text-text-subtle transition-colors duration-150">
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-5">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por cliente…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 h-11 sm:h-9"
          />
        </div>

        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="select w-full sm:w-44 h-11 sm:h-9">
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="parcial">Parcial</option>
          <option value="pago">Pago</option>
          <option value="atrasado">Atrasado</option>
        </select>

        {(search || filtroStatus) && (
          <button
            onClick={() => { setSearch(''); setFiltroStatus('') }}
            className="text-[13px] text-text-subtle hover:text-text-primary transition-colors duration-150 text-left sm:text-center"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
        {loading ? (
          <Skeleton.Table rows={8} cols={5} />
        ) : cobrancasFiltradas.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-[13px] text-text-subtle">
              {cobrancas.length === 0 ? 'Nenhuma cobrança gerada ainda. Clique em "Sincronizar agora".' : 'Nenhuma cobrança encontrada.'}
            </p>
          </div>
        ) : (
          <>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-border">
                  {['Cliente', 'Vencimento', 'Parcelas', 'Valor total', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left section-label font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <motion.tbody variants={listVariants} initial="initial" animate="animate">
                {cobrancasFiltradas.map(c => (
                  <motion.tr
                    key={c.id}
                    variants={itemVariants}
                    className="table-row-base cursor-pointer"
                    onClick={() => setEditingCobranca(c)}
                  >
                    <td className="px-4 h-12 text-[14px] text-text-primary font-medium max-w-[200px]">
                      <span className="block truncate">{clienteMap[c.clienteId]?.nome ?? '—'}</span>
                    </td>
                    <td className="px-4 h-12 font-mono text-[13px] text-text-muted whitespace-nowrap">{c.vencimentoLabel}</td>
                    <td className="px-4 h-12 text-[13px] text-text-muted whitespace-nowrap">{(c.parcelas ?? []).length}</td>
                    <td className="px-4 h-12 font-mono text-[13px] text-text-muted whitespace-nowrap">{formatBRL(c.valorTotal)}</td>
                    <td className="px-4 h-12"><StatusBadge status={statusCobranca(c, hoje)} /></td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>

          <motion.div className="sm:hidden flex flex-col" variants={listVariants} initial="initial" animate="animate">
            {cobrancasFiltradas.map(c => (
              <motion.div
                key={c.id}
                variants={itemVariants}
                onClick={() => setEditingCobranca(c)}
                className="p-4 border-b border-border-subtle last:border-0 flex flex-col gap-2 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[14px] text-text-primary font-medium truncate">{clienteMap[c.clienteId]?.nome ?? '—'}</span>
                  <StatusBadge status={statusCobranca(c, hoje)} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-muted font-mono">
                  <span>{formatBRL(c.valorTotal)}</span>
                  <span>{c.vencimentoLabel}</span>
                  <span>{(c.parcelas ?? []).length} parcela{(c.parcelas ?? []).length !== 1 ? 's' : ''}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
          </>
        )}

        {!loading && cobrancas.length > 0 && (
          <div className="px-4 py-3 border-t border-border">
            <span className="text-[12px] text-text-subtle">{cobrancasFiltradas.length} de {cobrancas.length} cobranças</span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editingCobranca && (
          <CobrancaModal
            isOpen={!!editingCobranca}
            onClose={() => setEditingCobranca(null)}
            cobranca={editingCobranca}
            clienteNome={clienteMap[editingCobranca.clienteId]?.nome}
            onSalvar={handleSalvarParcelas}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmandoLimpeza}
        title="Limpar cobranças antigas"
        message="Remove as cobranças com vencimento no passado que ainda estão totalmente pendentes (nenhuma parcela paga). Cobranças com alguma parcela já paga não são afetadas. Essa ação não pode ser desfeita."
        confirmLabel="Limpar"
        onConfirm={handleLimparAntigas}
        onCancel={() => setConfirmandoLimpeza(false)}
      />
    </motion.div>
  )
}
