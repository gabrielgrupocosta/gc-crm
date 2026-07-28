import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, Search, X, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Layers } from 'lucide-react'
import {
  db, COLLECTIONS, uploadImagem, deleteImagem,
  collection, doc, query, where, getDocs, getDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp,
} from '../services/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/UI/Toast'
import Modal from '../components/UI/Modal'
import Badge from '../components/UI/Badge'
import PlatformBadge from '../components/UI/PlatformBadge'
import Skeleton from '../components/UI/Skeleton'
import ConfirmModal from '../components/UI/ConfirmModal'
import ImageUpload from '../components/UI/ImageUpload'
import LojaSelect from '../components/UI/LojaSelect'
import ClienteSelect from '../components/UI/ClienteSelect'

// ─── Constants ────────────────────────────────────────────────────────────────

const SEM_GESTOR = '__sem_gestor__'

const PLATAFORMAS    = ['iFood', '99Food', 'Keeta']
const STATUS_LOJAS   = ['Ativa', 'Pausada', 'Cancelada']
const STATUS_CLIENTES = ['Ativo', 'Inativo']

const PLATAFORMA_COLORS = {
  iFood:    { bg: '#FFF0F1', text: '#EA1D2C', border: '#FCCDD0' },
  '99Food': { bg: '#FFFBEB', text: '#E6951A', border: '#FDEAB0' },
  Keeta:    { bg: '#EDFBF3', text: '#00B14F', border: '#B3EDD0' },
}

const DIAS_RELATORIO = [
  { value: 'segunda', label: 'Segunda-feira' },
  { value: 'terca',   label: 'Terça-feira'   },
  { value: 'quarta',  label: 'Quarta-feira'  },
  { value: 'quinta',  label: 'Quinta-feira'  },
  { value: 'sexta',   label: 'Sexta-feira'   },
  { value: 'sabado',  label: 'Sábado'        },
]

const SEGMENTOS = [
  'Açaí', 'Árabe', 'Cafeteria', 'Frutos do Mar', 'Hamburgeria',
  'Italiana', 'Japonesa', 'Marmitaria', 'Padaria', 'Pastelaria',
  'Pizza', 'Salgados', 'Sorveteria',
]

const DIA_LABEL = Object.fromEntries(DIAS_RELATORIO.map(d => [d.value, d.label]))

const PRINT_LABELS = {
  desempenho: 'Print Desempenho',
  financeiro: 'Print Financeiro',
  funil:      'Print Funil de Vendas',
  nota:       'Print Nota da Loja',
}

const EMPTY_PRINTS = { desempenho: null, financeiro: null, funil: null, nota: null }

const EMPTY_FORM = {
  nome: '', organizacaoId: '', clienteId: '', gestorId: '', plataformas: [],
  segmento: '', status: 'Ativa', dataInicio: '', observacoes: '',
  diaRelatorio: '',
  preGestao30dias: '', preGestao7dias: '', preGestaoValorVendas: '', preGestaoTotalFaturamento: '',
}

const EMPTY_CLIENTE_FORM = {
  nome: '', telefone: '', email: '',
  status: 'Ativo', dataInicio: '', observacoes: '',
}

const EMPTY_LOJA_SUB = {
  nome: '', gestorId: '', plataformas: [],
  status: 'Ativa', observacoes: '',
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('pt-BR')
}

function tsToDateInput(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toISOString().split('T')[0]
}

function formatBRL(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

function parseMoney(str) {
  if (str === '' || str == null) return null
  const n = parseFloat(String(str).replace(',', '.'))
  return isNaN(n) ? null : n
}

function normalizar(s) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function caminhoPrintPreGestao(lojaId, key) {
  return `lojas/${lojaId}/pre-gestao/${key}.jpg`
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

// ─── CurrencyInput ────────────────────────────────────────────────────────────

function CurrencyInput({ id, value, onChange, placeholder = '0,00' }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ fontSize: '12px', color: '#999999' }}>R$</span>
      <input
        id={id}
        type="number"
        min="0"
        step="0.01"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input pl-9 font-mono"
      />
    </div>
  )
}

// ─── PlataformaPills ──────────────────────────────────────────────────────────

function PlataformaPills({ value, onChange }) {
  function toggle(p) {
    onChange(value.includes(p) ? value.filter(v => v !== p) : [...value, p])
  }
  return (
    <div className="flex gap-2">
      {PLATAFORMAS.map(p => {
        const active = value.includes(p)
        const colors = PLATAFORMA_COLORS[p]
        return (
          <button
            key={p}
            type="button"
            onClick={() => toggle(p)}
            style={{
              flex: 1, height: '36px', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', transition: 'all 150ms',
              backgroundColor: active ? colors.bg   : '#FFFFFF',
              color:           active ? colors.text : '#999999',
              border: `1px solid ${active ? colors.border : '#E8E8E8'}`,
            }}
          >
            {p}
          </button>
        )
      })}
    </div>
  )
}

// ─── Modal de novo cliente ────────────────────────────────────────────────────

function NovoClienteModal({ isOpen, onClose, onSave, gestores, lojas }) {
  const [form,       setForm]       = useState(EMPTY_CLIENTE_FORM)
  const [saving,     setSaving]     = useState(false)
  const [novasLojas, setNovasLojas] = useState([])
  const [vinculadas, setVinculadas] = useState([])
  const [subOpen,    setSubOpen]    = useState(false)
  const [subForm,    setSubForm]    = useState(EMPTY_LOJA_SUB)
  const [modoLoja,       setModoLoja]       = useState('nova') // 'nova' | 'vincular'
  const [lojaVincularId, setLojaVincularId] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setForm(EMPTY_CLIENTE_FORM)
    setNovasLojas([])
    setVinculadas([])
    setSubOpen(false)
    setSubForm(EMPTY_LOJA_SUB)
    setModoLoja('nova')
    setLojaVincularId('')
  }, [isOpen])

  function set(key, value)    { setForm(prev => ({ ...prev, [key]: value })) }
  function setSub(key, value) { setSubForm(prev => ({ ...prev, [key]: value })) }

  function adicionarLoja() {
    if (!subForm.nome.trim() || !subForm.plataformas.length || !subForm.status) return
    setNovasLojas(prev => [...prev, { ...subForm }])
    setSubForm(EMPTY_LOJA_SUB)
    setSubOpen(false)
  }

  function confirmarVinculo() {
    const loja = (lojas ?? []).find(l => l.id === lojaVincularId)
    if (!loja) return
    setVinculadas(prev => [...prev, loja])
    setLojaVincularId('')
    setSubOpen(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await onSave(form, novasLojas, vinculadas)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const canSave    = form.nome.trim() && form.status
  const canAddLoja = subForm.nome.trim() && subForm.plataformas.length > 0 && subForm.status

  // Lojas disponíveis pra vincular: sem cliente e ainda não escolhidas nesta sessão do modal
  const lojasSemCliente = useMemo(
    () => (lojas ?? []).filter(l => !l.clienteId && !vinculadas.some(v => v.id === l.id)),
    [lojas, vinculadas]
  )

  const lojasVisiveis = [
    ...novasLojas.map((l, i) => ({ ...l, _tempIdx: i, _novo: true })),
    ...vinculadas.map(l => ({ ...l, _vinculo: true })),
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Novo cliente"
      width="max-w-2xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button form="novo-cliente-form" type="submit" disabled={!canSave || saving} className="btn-primary">
            {saving ? 'Salvando…' : 'Criar cliente'}
          </button>
        </>
      }
    >
      <form id="novo-cliente-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="nc-nome">Nome</label>
          <input id="nc-nome" type="text" value={form.nome}
            onChange={e => set('nome', e.target.value)}
            placeholder="Nome do cliente ou empresa"
            className="input" required autoFocus />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="nc-tel">Telefone</label>
            <input id="nc-tel" type="tel" value={form.telefone}
              onChange={e => set('telefone', e.target.value)}
              placeholder="(11) 99999-9999" className="input" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="nc-email">E-mail</label>
            <input id="nc-email" type="email" value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="contato@empresa.com" className="input" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="nc-status">Status</label>
            <select id="nc-status" value={form.status}
              onChange={e => set('status', e.target.value)} className="select">
              {STATUS_CLIENTES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="nc-data">Início do contrato</label>
            <input id="nc-data" type="date" value={form.dataInicio}
              onChange={e => set('dataInicio', e.target.value)} className="input" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="nc-obs">Observações</label>
          <textarea id="nc-obs" value={form.observacoes}
            onChange={e => set('observacoes', e.target.value)}
            placeholder="Notas sobre o contrato, particularidades…"
            rows={3} className="textarea" />
        </div>

        {/* ── Seção Lojas ── */}
        <div className="pt-2" style={{ borderTop: '1px solid #E8E8E8' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="section-label">Lojas</p>
            {lojasVisiveis.length > 0 && (
              <span style={{ fontSize: '11px', color: '#999999' }}>
                {lojasVisiveis.length} loja{lojasVisiveis.length !== 1 ? 's' : ''} a adicionar
              </span>
            )}
          </div>

          {lojasVisiveis.length > 0 && (
            <div className="flex flex-col gap-1 mb-3">
              {lojasVisiveis.map(l => (
                <div key={l._vinculo ? `vinc-${l.id}` : `new-${l._tempIdx}`} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '0 12px', height: '36px',
                  border: '1px solid #E8E8E8', borderRadius: '5px',
                  transition: 'border-color 150ms',
                }}>
                  <span style={{ flex: 1, fontSize: '13px', color: '#111111', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.nome}
                  </span>
                  {(l.plataformas?.length ? l.plataformas : l.plataforma ? [l.plataforma] : []).length > 0 && (
                    <span style={{ fontSize: '11px', color: '#999999', flexShrink: 0 }}>
                      {(l.plataformas?.length ? l.plataformas : [l.plataforma]).join(', ')}
                    </span>
                  )}
                  <span style={{ fontSize: '10px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0, border: '1px solid #E8E8E8', padding: '2px 6px', borderRadius: '4px' }}>
                    {l._vinculo ? 'vincular' : 'novo'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (l._vinculo) {
                        setVinculadas(prev => prev.filter(v => v.id !== l.id))
                      } else {
                        setNovasLojas(prev => prev.filter((_, idx) => idx !== l._tempIdx))
                      }
                    }}
                    className="hover:text-negative transition-colors duration-150 shrink-0 p-1 rounded"
                    style={{ color: '#999999' }}
                  >
                    <X size={13} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {!subOpen && (
            <button type="button" onClick={() => setSubOpen(true)}
              className="btn-secondary flex items-center gap-2 h-8 text-[13px] px-3">
              <Plus size={13} strokeWidth={2} />
              Adicionar loja
            </button>
          )}

          {subOpen && (
            <div style={{ border: '1px solid #DDDDDD', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
              {/* Toggle: criar loja nova vs vincular existente */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModoLoja('nova')}
                  style={{
                    flex: 1, height: '32px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 150ms',
                    backgroundColor: modoLoja === 'nova' ? '#FFF0F1' : '#FFFFFF',
                    color:           modoLoja === 'nova' ? '#EA1D2C' : '#999999',
                    border: `1px solid ${modoLoja === 'nova' ? '#FCCDD0' : '#E8E8E8'}`,
                  }}
                >
                  Criar loja nova
                </button>
                <button
                  type="button"
                  onClick={() => setModoLoja('vincular')}
                  style={{
                    flex: 1, height: '32px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 150ms',
                    backgroundColor: modoLoja === 'vincular' ? '#FFF0F1' : '#FFFFFF',
                    color:           modoLoja === 'vincular' ? '#EA1D2C' : '#999999',
                    border: `1px solid ${modoLoja === 'vincular' ? '#FCCDD0' : '#E8E8E8'}`,
                  }}
                >
                  Vincular loja existente
                </button>
              </div>

              {modoLoja === 'vincular' ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="field-label">Loja sem cliente vinculado</label>
                    <LojaSelect
                      lojas={lojasSemCliente}
                      value={lojaVincularId}
                      onChange={setLojaVincularId}
                      placeholder="Buscar loja sem cliente..."
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button type="button"
                      onClick={() => { setSubOpen(false); setLojaVincularId(''); setModoLoja('nova') }}
                      className="btn-secondary h-8 px-3 text-[13px]">
                      Cancelar
                    </button>
                    <button type="button" onClick={confirmarVinculo} disabled={!lojaVincularId}
                      className="btn-primary h-8 px-3 text-[13px] disabled:opacity-40 disabled:cursor-not-allowed">
                      Vincular
                    </button>
                  </div>
                </>
              ) : (
              <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="field-label">Nome da loja</label>
                  <input type="text" value={subForm.nome}
                    onChange={e => setSub('nome', e.target.value)}
                    placeholder="Ex: Burguer King Centro"
                    className="input" autoFocus />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="field-label">Gestor responsável</label>
                  <select value={subForm.gestorId}
                    onChange={e => setSub('gestorId', e.target.value)} className="select">
                    <option value="">Sem gestor</option>
                    {(gestores ?? []).map(g => (
                      <option key={g.id} value={g.id}>{g.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="field-label">Plataforma(s)</label>
                <PlataformaPills value={subForm.plataformas} onChange={v => setSub('plataformas', v)} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="field-label">Status</label>
                <select value={subForm.status}
                  onChange={e => setSub('status', e.target.value)} className="select">
                  {STATUS_LOJAS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="field-label">Observações</label>
                <textarea
                  value={subForm.observacoes}
                  onChange={e => setSub('observacoes', e.target.value)}
                  placeholder="Notas internas sobre a loja…"
                  rows={2}
                  className="textarea"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button"
                  onClick={() => { setSubOpen(false); setSubForm(EMPTY_LOJA_SUB) }}
                  className="btn-secondary h-8 px-3 text-[13px]">
                  Cancelar
                </button>
                <button type="button" onClick={adicionarLoja} disabled={!canAddLoja}
                  className="btn-primary h-8 px-3 text-[13px] disabled:opacity-40 disabled:cursor-not-allowed">
                  Adicionar
                </button>
              </div>
              </>
              )}
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}

// ─── Modal de loja ────────────────────────────────────────────────────────────

function LojaModal({ isOpen, onClose, onSave, loja, clientes, gestores, organizacoes, isSuperAdmin, onClienteCriado }) {
  const toast = useToast()
  const [form,   setForm]   = useState(EMPTY_FORM)
  const [prints, setPrints] = useState(EMPTY_PRINTS)
  const [saving, setSaving] = useState(false)
  const [miniClienteOpen, setMiniClienteOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setForm(loja ? {
      nome:             loja.nome             ?? '',
      organizacaoId:    loja.organizacaoId     ?? '',
      clienteId:        loja.clienteId        ?? '',
      gestorId:         loja.gestorId         ?? '',
      plataformas:      loja.plataformas?.length ? loja.plataformas : loja.plataforma ? [loja.plataforma] : [],
      segmento:         loja.segmento         ?? '',
      status:           loja.status           ?? 'Ativa',
      dataInicio:       tsToDateInput(loja.dataInicio),
      observacoes:      loja.observacoes      ?? '',
      diaRelatorio:     loja.diaRelatorio     ?? '',
      preGestao30dias:           loja.preGestao?.faturamento30dias  != null ? String(loja.preGestao.faturamento30dias)  : '',
      preGestao7dias:            loja.preGestao?.faturamento7dias   != null ? String(loja.preGestao.faturamento7dias)   : '',
      preGestaoValorVendas:      loja.preGestao?.valorVendas        != null ? String(loja.preGestao.valorVendas)        : '',
      preGestaoTotalFaturamento: loja.preGestao?.totalFaturamento   != null ? String(loja.preGestao.totalFaturamento)   :
                                 loja.preGestao?.repasseTotal       != null ? String(loja.preGestao.repasseTotal)       : '',
    } : {
      ...EMPTY_FORM,
      // admin_org só enxerga a própria organização (única opção na lista) —
      // nova loja já nasce vinculada a ela, sem precisar escolher.
      organizacaoId: !isSuperAdmin ? (organizacoes[0]?.id ?? '') : '',
    })

    const pgPrints = loja?.preGestao?.prints ?? {}
    setPrints({
      desempenho: pgPrints.desempenho ? { url: pgPrints.desempenho, existing: true } : null,
      financeiro: pgPrints.financeiro ? { url: pgPrints.financeiro, existing: true } : null,
      funil:      pgPrints.funil      ? { url: pgPrints.funil,      existing: true } : null,
      nota:       pgPrints.nota       ? { url: pgPrints.nota,       existing: true } : null,
    })
    setMiniClienteOpen(false)
  }, [isOpen, loja, isSuperAdmin, organizacoes])

  function handleClienteCriado(cliente) {
    onClienteCriado?.(cliente)
    setForm(prev => ({ ...prev, clienteId: cliente.id }))
    setMiniClienteOpen(false)
  }

  function set(key, value) { setForm(prev => ({ ...prev, [key]: value })) }

  // Validação de tamanho/tipo já é feita pelo <ImageUpload>.
  function handlePrintFile(key, file) {
    const reader = new FileReader()
    reader.onload = e => {
      setPrints(prev => ({ ...prev, [key]: { file, dataUrl: e.target.result, existing: false } }))
    }
    reader.readAsDataURL(file)
  }

  function handlePrintRemove(key) {
    setPrints(prev => ({ ...prev, [key]: null }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await onSave(form, prints)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const canSave = form.nome.trim() && form.organizacaoId && form.clienteId && form.gestorId && form.plataformas.length > 0 && form.status

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={loja ? 'Editar loja' : 'Nova loja'}
      width="max-w-xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button form="loja-form" type="submit" disabled={!canSave || saving} className="btn-primary">
            {saving ? 'Salvando…' : loja ? 'Salvar alterações' : 'Criar loja'}
          </button>
        </>
      }
    >
      <form id="loja-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {/* Organização — só master escolhe; admin_org/gestor têm a própria preenchida automaticamente */}
        {isSuperAdmin && (
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="l-org">Organização</label>
            <select
              id="l-org"
              value={form.organizacaoId}
              onChange={e => set('organizacaoId', e.target.value)}
              className="select"
              required
            >
              <option value="">Selecione</option>
              {organizacoes.map(org => (
                <option key={org.id} value={org.id}>{org.nome}</option>
              ))}
            </select>
          </div>
        )}

        {/* Nome */}
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="l-nome">Nome da loja</label>
          <input id="l-nome" type="text" value={form.nome}
            onChange={e => set('nome', e.target.value)}
            placeholder="Ex: Burguer King Centro"
            className="input" required autoFocus />
        </div>

        {/* Cliente + Gestor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="l-cliente">Cliente</label>
            <div className="flex items-center gap-2">
              <ClienteSelect
                clientes={clientes}
                value={form.clienteId}
                onChange={v => setForm(prev => ({ ...prev, clienteId: v }))}
                placeholder="Buscar cliente..."
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => setMiniClienteOpen(true)}
                className="btn-secondary flex items-center justify-center shrink-0"
                style={{ width: '36px', height: '36px', padding: 0 }}
                title="Criar novo cliente"
              >
                <Plus size={15} strokeWidth={2} />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="l-gestor">Gestor responsável</label>
            <select id="l-gestor" value={form.gestorId}
              onChange={e => set('gestorId', e.target.value)} className="select" required>
              <option value="">Selecione</option>
              {gestores.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>
        </div>

        {/* Plataformas */}
        <div className="flex flex-col gap-1.5">
          <label className="field-label">Plataforma(s)</label>
          <PlataformaPills value={form.plataformas} onChange={v => set('plataformas', v)} />
          {form.plataformas.length > 1 && !loja && (
            <p style={{ fontSize: '11px', color: '#999999', marginTop: '2px' }}>
              Será criada uma loja separada para cada plataforma selecionada.
            </p>
          )}
        </div>

        {/* Segmento — só na edição, preenchido no Onboard na criação */}
        {loja && (
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="l-segmento">Segmento</label>
            <select id="l-segmento" value={form.segmento}
              onChange={e => set('segmento', e.target.value)} className="select">
              <option value="">Selecione</option>
              {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {/* Status + Data início */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="l-status">Status</label>
            <select id="l-status" value={form.status}
              onChange={e => set('status', e.target.value)} className="select">
              {STATUS_LOJAS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="l-data">Data início</label>
            <input id="l-data" type="date" value={form.dataInicio}
              onChange={e => set('dataInicio', e.target.value)} className="input" />
          </div>
        </div>

        {/* Data de cancelamento — só na edição, preenchida automaticamente ao marcar status Cancelada */}
        {loja && form.status === 'Cancelada' && (
          <div className="flex flex-col gap-1.5">
            <label className="field-label">Data de cancelamento</label>
            <div className="input flex items-center" style={{ color: '#666666', backgroundColor: '#F9F9F9', cursor: 'default' }}>
              {loja.status === 'Cancelada' && loja.dataCancelamento
                ? formatDate(loja.dataCancelamento)
                : 'Será registrada automaticamente ao salvar'}
            </div>
          </div>
        )}

        {/* Dia de envio do relatório — só na edição, preenchido no Onboard na criação */}
        {loja && (
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="l-dia-rel">Dia de envio do relatório</label>
            <select id="l-dia-rel" value={form.diaRelatorio}
              onChange={e => set('diaRelatorio', e.target.value)} className="select">
              <option value="">Sem dia definido</option>
              {DIAS_RELATORIO.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        )}

        {/* Observações */}
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="l-obs">Observações</label>
          <textarea id="l-obs" value={form.observacoes}
            onChange={e => set('observacoes', e.target.value)}
            placeholder="Notas internas sobre a loja…"
            rows={3} className="textarea" />
        </div>

        {/* ── Dados Pré-Gestão — só na edição, preenchidos pelo gestor no Onboard na criação ── */}
        {loja && (
          <div className="pt-3" style={{ borderTop: '1px solid #E8E8E8' }}>
            <p className="section-label" style={{ marginBottom: '12px' }}>Dados Pré-Gestão</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Card Desempenho */}
              <div style={{ backgroundColor: '#FAFAFA', border: '1px solid #E8E8E8', borderRadius: '8px', padding: '16px' }}>
                <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#999999', borderBottom: '1px solid #E8E8E8', paddingBottom: '8px', marginBottom: '12px' }}>
                  Desempenho
                </p>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="field-label" htmlFor="l-fat30">Faturamento últimos 30 dias</label>
                    <CurrencyInput id="l-fat30" value={form.preGestao30dias}
                      onChange={v => set('preGestao30dias', v)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="field-label" htmlFor="l-fat7">Faturamento últimos 7 dias</label>
                    <CurrencyInput id="l-fat7" value={form.preGestao7dias}
                      onChange={v => set('preGestao7dias', v)} />
                  </div>
                </div>
              </div>
              {/* Card Financeiro */}
              <div style={{ backgroundColor: '#FAFAFA', border: '1px solid #E8E8E8', borderRadius: '8px', padding: '16px' }}>
                <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#999999', borderBottom: '1px solid #E8E8E8', paddingBottom: '8px', marginBottom: '12px' }}>
                  Financeiro
                </p>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="field-label" htmlFor="l-valor-vendas">Valor das Vendas (R$)</label>
                    <CurrencyInput id="l-valor-vendas" value={form.preGestaoValorVendas}
                      onChange={v => set('preGestaoValorVendas', v)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="field-label" htmlFor="l-total-fat">Total Faturamento (R$)</label>
                    <CurrencyInput id="l-total-fat" value={form.preGestaoTotalFaturamento}
                      onChange={v => set('preGestaoTotalFaturamento', v)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Subseção Prints */}
            <div style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#999999', marginBottom: '10px' }}>
                Prints
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {Object.keys(PRINT_LABELS).map(key => (
                  <ImageUpload
                    key={key}
                    label={PRINT_LABELS[key]}
                    value={prints[key]?.file ?? prints[key]?.dataUrl ?? prints[key]?.url ?? null}
                    onChange={f => f ? handlePrintFile(key, f) : handlePrintRemove(key)}
                    onError={msg => toast(msg, 'error')}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </form>
    </Modal>
    <MiniClienteModal
      isOpen={miniClienteOpen}
      onClose={() => setMiniClienteOpen(false)}
      onCreated={handleClienteCriado}
    />
    </>
  )
}

// ─── MiniClienteModal ─────────────────────────────────────────────────────────
// Criação rápida de cliente direto do formulário de loja — evita sair do
// fluxo pra cadastrar um cliente novo. Cria só os campos básicos; detalhes
// adicionais (mensalidade, observações etc.) ficam pro cadastro completo em
// Clientes.jsx.

function MiniClienteModal({ isOpen, onClose, onCreated }) {
  const toast = useToast()
  const [form,   setForm]   = useState({ nome: '', telefone: '', email: '', status: 'Ativo' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) setForm({ nome: '', telefone: '', email: '', status: 'Ativo' })
  }, [isOpen])

  function set(key, value) { setForm(prev => ({ ...prev, [key]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving || !form.nome.trim()) return
    setSaving(true)
    try {
      const payload = {
        nome:        form.nome.trim(),
        telefone:    form.telefone.trim(),
        email:       form.email.trim().toLowerCase(),
        status:      form.status,
        dataInicio:  null,
        observacoes: '',
        criadoEm:    serverTimestamp(),
      }
      const ref = await addDoc(collection(db, COLLECTIONS.CLIENTES), payload)
      toast('Cliente criado.', 'success')
      onCreated({ id: ref.id, ...payload })
    } catch (err) {
      console.error('[MiniClienteModal] handleSubmit:', err)
      toast('Erro ao criar cliente: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const canSave = form.nome.trim()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Novo cliente"
      width="max-w-sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button form="mini-cliente-form" type="submit" disabled={!canSave || saving} className="btn-primary">
            {saving ? 'Criando…' : 'Criar cliente'}
          </button>
        </>
      }
    >
      <form id="mini-cliente-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="mc-nome">Nome</label>
          <input id="mc-nome" type="text" value={form.nome}
            onChange={e => set('nome', e.target.value)}
            placeholder="Nome do cliente ou empresa"
            className="input" required autoFocus />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="mc-tel">Telefone</label>
            <input id="mc-tel" type="tel" value={form.telefone}
              onChange={e => set('telefone', e.target.value)}
              placeholder="(11) 99999-9999" className="input" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="mc-email">E-mail</label>
            <input id="mc-email" type="email" value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="contato@empresa.com" className="input" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="mc-status">Status</label>
          <select id="mc-status" value={form.status}
            onChange={e => set('status', e.target.value)} className="select">
            {STATUS_CLIENTES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </form>
    </Modal>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ src, caption, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <AnimatePresence>
      {src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '32px', cursor: 'zoom-out',
          }}
        >
          <motion.img
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            src={src}
            alt={caption}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '82vh', borderRadius: '8px', objectFit: 'contain', cursor: 'default' }}
          />
          {caption && (
            <p style={{ color: '#FFFFFF', fontSize: '12px', marginTop: '14px' }}>{caption}</p>
          )}
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: '20px', right: '24px', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} color="#fff" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── LojaDetailPanel ──────────────────────────────────────────────────────────

function LojaDetailPanel({ loja }) {
  const [lightbox, setLightbox] = useState(null)

  const pg = loja.preGestao
  const hasDesempenho = pg && (pg.faturamento30dias != null || pg.faturamento7dias != null)
  const hasFinanceiro = pg && (pg.valorVendas != null || pg.totalFaturamento != null || pg.repasseTotal != null)
  const prints         = pg?.prints ?? {}
  const hasPrints       = Object.keys(PRINT_LABELS).some(k => prints[k])
  const hasPreGestao  = hasDesempenho || hasFinanceiro || hasPrints

  const cardStyle = {
    backgroundColor: '#FAFAFA', border: '1px solid #E8E8E8',
    borderRadius: '8px', padding: '16px',
  }
  const cardTitleStyle = {
    fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em',
    color: '#999999', borderBottom: '1px solid #E8E8E8',
    paddingBottom: '8px', marginBottom: '12px',
  }

  return (
    <td
      colSpan={8}
      style={{ padding: 0, borderBottom: '1px solid #F3F3F3', backgroundColor: 'rgba(0,0,0,0.015)' }}
    >
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Campos inline */}
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          {loja.diaRelatorio && (
            <div>
              <p className="section-label" style={{ marginBottom: '3px' }}>Dia de relatório</p>
              <p style={{ fontSize: '12px', color: '#111111' }}>{DIA_LABEL[loja.diaRelatorio]}</p>
            </div>
          )}
          {loja.segmento && (
            <div>
              <p className="section-label" style={{ marginBottom: '3px' }}>Segmento</p>
              <p style={{ fontSize: '12px', color: '#111111' }}>{loja.segmento}</p>
            </div>
          )}
          {loja.observacoes && (
            <div style={{ flex: 1, minWidth: '200px' }}>
              <p className="section-label" style={{ marginBottom: '3px' }}>Observações</p>
              <p style={{ fontSize: '12px', color: '#666666' }}>{loja.observacoes}</p>
            </div>
          )}
        </div>

        {/* Dados Pré-Gestão */}
        {hasPreGestao && (
          <div style={{ borderTop: '1px solid #E8E8E8', paddingTop: '12px' }}>
            <p className="section-label" style={{ marginBottom: '10px' }}>Dados Pré-Gestão</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {hasDesempenho && (
                <div style={cardStyle}>
                  <p style={cardTitleStyle}>Desempenho</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {pg.faturamento30dias != null && (
                      <div>
                        <p className="section-label" style={{ marginBottom: '3px' }}>Faturamento últimos 30 dias</p>
                        <p style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '13px', color: '#111111' }}>{formatBRL(pg.faturamento30dias)}</p>
                      </div>
                    )}
                    {pg.faturamento7dias != null && (
                      <div>
                        <p className="section-label" style={{ marginBottom: '3px' }}>Faturamento últimos 7 dias</p>
                        <p style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '13px', color: '#111111' }}>{formatBRL(pg.faturamento7dias)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {hasFinanceiro && (
                <div style={cardStyle}>
                  <p style={cardTitleStyle}>Financeiro</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {pg.valorVendas != null && (
                      <div>
                        <p className="section-label" style={{ marginBottom: '3px' }}>Valor das Vendas</p>
                        <p style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '13px', color: '#111111' }}>{formatBRL(pg.valorVendas)}</p>
                      </div>
                    )}
                    {(pg.totalFaturamento ?? pg.repasseTotal) != null && (
                      <div>
                        <p className="section-label" style={{ marginBottom: '3px' }}>Total Faturamento</p>
                        <p style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '13px', color: '#111111' }}>{formatBRL(pg.totalFaturamento ?? pg.repasseTotal)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {hasPrints && (
              <div style={{ marginTop: '12px' }}>
                <p className="section-label" style={{ marginBottom: '8px' }}>Prints</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', maxWidth: '420px' }}>
                  {Object.keys(PRINT_LABELS).map(key => prints[key] && (
                    <div key={key}>
                      <div
                        onClick={() => setLightbox({ src: prints[key], caption: PRINT_LABELS[key] })}
                        style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid #E8E8E8', cursor: 'zoom-in' }}
                      >
                        <img
                          src={prints[key]}
                          alt={PRINT_LABELS[key]}
                          style={{ width: '100%', height: '100px', objectFit: 'cover', display: 'block' }}
                        />
                      </div>
                      <p style={{ fontSize: '11px', color: '#666666', marginTop: '4px', textAlign: 'center' }}>
                        {PRINT_LABELS[key]}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!loja.diaRelatorio && !loja.segmento && !loja.observacoes && !hasPreGestao && (
          <p style={{ fontSize: '12px', color: '#999999' }}>Sem dados adicionais.</p>
        )}
      </div>

      <Lightbox
        src={lightbox?.src}
        caption={lightbox?.caption}
        onClose={() => setLightbox(null)}
      />
    </td>
  )
}

// ─── GestorCell ───────────────────────────────────────────────────────────────

function GestorCell({ loja, gestorMap, gestoresAtivos, contagemPorGestor, onSelect }) {
  const [open, setOpen]   = useState(false)
  const [rect, setRect]   = useState(null)
  const buttonRef         = useRef(null)
  const dropdownRef       = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e) {
      if (buttonRef.current?.contains(e.target)) return
      if (dropdownRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  function handleToggle() {
    if (!open) {
      const r = buttonRef.current.getBoundingClientRect()
      setRect({ top: r.bottom + 4, left: r.left })
    }
    setOpen(o => !o)
  }

  function handleSelect(gestor) {
    setOpen(false)
    onSelect(loja, gestor)
  }

  const nomeAtual = loja.gestorId ? (loja.gestorNome ?? gestorMap[loja.gestorId]?.nome ?? '—') : 'Sem gestor'

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '12px', color: loja.gestorId ? '#666666' : '#DC2626', fontWeight: loja.gestorId ? 400 : 500 }}
      >
        {nomeAtual}
        <ChevronDown size={11} strokeWidth={1.5} style={{ color: '#999999', flexShrink: 0 }} />
      </button>

      {open && rect && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed', top: rect.top, left: rect.left, zIndex: 200,
            minWidth: '210px', maxHeight: '200px', overflowY: 'auto',
            backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          <button
            type="button"
            onClick={() => handleSelect(null)}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: '#DC2626', background: 'none', border: 'none', borderBottom: '1px solid #F3F3F3', cursor: 'pointer', transition: 'background-color 150ms' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FAFAFA'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Sem gestor
          </button>
          {gestoresAtivos.map(g => (
            <button
              key={g.id}
              type="button"
              onClick={() => handleSelect(g)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: '#111111', background: 'none', border: 'none', cursor: 'pointer', transition: 'background-color 150ms' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FAFAFA'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.nome}</span>
              <span style={{ fontSize: '11px', color: '#999999', flexShrink: 0 }}>
                {contagemPorGestor[g.id] ?? 0} loja{(contagemPorGestor[g.id] ?? 0) !== 1 ? 's' : ''}
              </span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

// ─── ClienteCell ──────────────────────────────────────────────────────────────

function ClienteCell({ loja, clientes, clienteMap, onSelect, onClienteCriado }) {
  const [open,     setOpen]     = useState(false)
  const [rect,     setRect]     = useState(null)
  const [busca,    setBusca]    = useState('')
  const [miniOpen, setMiniOpen] = useState(false)
  const buttonRef   = useRef(null)
  const dropdownRef = useRef(null)
  const searchRef   = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e) {
      if (buttonRef.current?.contains(e.target)) return
      if (dropdownRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  useEffect(() => { if (open) searchRef.current?.focus() }, [open])

  function handleToggle() {
    if (!open) {
      const r = buttonRef.current.getBoundingClientRect()
      setRect({ top: r.bottom + 4, left: r.left })
      setBusca('')
    }
    setOpen(o => !o)
  }

  function handleSelect(cliente) {
    setOpen(false)
    onSelect(loja, cliente)
  }

  function handleClienteCriado(cliente) {
    onClienteCriado(cliente)
    setMiniOpen(false)
    setOpen(false)
    onSelect(loja, cliente)
  }

  const clientesOrdenados = useMemo(
    () => [...clientes].sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR')),
    [clientes]
  )
  const filtrados = useMemo(() => {
    const termo = normalizar(busca)
    if (!termo) return clientesOrdenados
    return clientesOrdenados.filter(c => normalizar(c.nome).includes(termo))
  }, [clientesOrdenados, busca])

  const nomeAtual = loja.clienteId ? (loja.clienteNome ?? clienteMap[loja.clienteId]?.nome ?? '—') : '—'

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '12px', color: '#666666' }}
      >
        {nomeAtual}
        <ChevronDown size={11} strokeWidth={1.5} style={{ color: '#999999', flexShrink: 0 }} />
      </button>

      {open && rect && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed', top: rect.top, left: rect.left, zIndex: 200,
            minWidth: '220px', maxHeight: '240px', display: 'flex', flexDirection: 'column',
            backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          <div style={{ padding: '6px', borderBottom: '1px solid #F3F3F3', flexShrink: 0 }}>
            <input
              ref={searchRef}
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar cliente..."
              style={{ width: '100%', height: '28px', fontSize: '12px', padding: '0 8px', border: '1px solid #E8E8E8', borderRadius: '5px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            <button
              type="button"
              onClick={() => handleSelect(null)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: '#DC2626', background: 'none', border: 'none', borderBottom: '1px solid #F3F3F3', cursor: 'pointer', transition: 'background-color 150ms' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FAFAFA'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Sem cliente
            </button>
            {filtrados.length === 0 ? (
              <p style={{ padding: '10px 12px', fontSize: '12px', color: '#999999', margin: 0 }}>Nenhum cliente encontrado.</p>
            ) : (
              filtrados.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: '#111111', background: 'none', border: 'none', cursor: 'pointer', transition: 'background-color 150ms', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FAFAFA'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {c.nome}
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() => setMiniOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', fontWeight: 500, color: '#EA1D2C', background: 'none', border: 'none', borderTop: '1px solid #F3F3F3', cursor: 'pointer', transition: 'background-color 150ms', flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FAFAFA'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Plus size={12} strokeWidth={2} />
            Novo cliente
          </button>
        </div>,
        document.body
      )}

      <MiniClienteModal isOpen={miniOpen} onClose={() => setMiniOpen(false)} onCreated={handleClienteCriado} />
    </>
  )
}

// ─── Edição inline ────────────────────────────────────────────────────────────
// Padrão comum: célula em modo exibição tem cursor pointer + hover sutil
// (#F9F9F9); ao clicar vira input/select; Enter ou blur salva; Escape cancela.

const CELL_HOVER_STYLE = {
  cursor: 'pointer', borderRadius: '4px', padding: '4px 8px', margin: '-4px -8px',
  transition: 'background-color 100ms', display: 'inline-block',
}

function EditableNomeCell({ loja, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState(loja.nome ?? '')
  const inputRef = useRef(null)

  useEffect(() => { setValue(loja.nome ?? '') }, [loja.nome])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commit() {
    setEditing(false)
    const trimmed = value.trim()
    if (!trimmed || trimmed === loja.nome) { setValue(loja.nome ?? ''); return }
    onSave(trimmed)
  }

  function cancel() {
    setValue(loja.nome ?? '')
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          else if (e.key === 'Escape') { e.preventDefault(); cancel() }
        }}
        style={{
          width: '100%', border: '1px solid #EA1D2C', borderRadius: '4px',
          padding: '4px 8px', margin: '-4px -8px', fontSize: '13px', fontWeight: 500,
          color: '#111111', outline: 'none', background: '#FFFFFF', boxSizing: 'border-box',
        }}
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      style={CELL_HOVER_STYLE}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F9F9F9'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {loja.nome}
    </div>
  )
}

function EditableStatusCell({ loja, onSave }) {
  const [editing, setEditing] = useState(false)
  const selectRef = useRef(null)

  useEffect(() => { if (editing) selectRef.current?.focus() }, [editing])

  function handleChange(e) {
    const value = e.target.value
    setEditing(false)
    if (value !== loja.status) onSave(value)
  }

  if (editing) {
    return (
      <select
        ref={selectRef}
        defaultValue={loja.status}
        onChange={handleChange}
        onBlur={() => setEditing(false)}
        onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setEditing(false) } }}
        className="select"
        style={{ height: '28px', fontSize: '12px', width: 'auto' }}
      >
        {STATUS_LOJAS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      style={CELL_HOVER_STYLE}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F9F9F9'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      <Badge status={loja.status?.toLowerCase()} label={loja.status} />
    </div>
  )
}

function EditableDiaRelatorioCell({ loja, onSave }) {
  const [editing, setEditing] = useState(false)
  const selectRef = useRef(null)

  useEffect(() => { if (editing) selectRef.current?.focus() }, [editing])

  function handleChange(e) {
    const value = e.target.value
    setEditing(false)
    const current = loja.diaRelatorio || ''
    if (value !== current) onSave(value || null)
  }

  if (editing) {
    return (
      <select
        ref={selectRef}
        defaultValue={loja.diaRelatorio || ''}
        onChange={handleChange}
        onBlur={() => setEditing(false)}
        onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setEditing(false) } }}
        className="select"
        style={{ height: '28px', fontSize: '12px', width: 'auto' }}
      >
        <option value="">Sem dia definido</option>
        {DIAS_RELATORIO.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
      </select>
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      style={{ ...CELL_HOVER_STYLE, fontSize: '12px', color: loja.diaRelatorio ? '#666666' : '#999999' }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F9F9F9'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {loja.diaRelatorio ? DIA_LABEL[loja.diaRelatorio] : 'Sem dia definido'}
    </div>
  )
}

function EditableDataInicioCell({ loja, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState(() => tsToDateInput(loja.dataInicio))
  const inputRef = useRef(null)

  useEffect(() => { setValue(tsToDateInput(loja.dataInicio)) }, [loja.dataInicio])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commit() {
    setEditing(false)
    const current = tsToDateInput(loja.dataInicio)
    if (value === current) return
    onSave(value || null)
  }

  function cancel() {
    setValue(tsToDateInput(loja.dataInicio))
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          else if (e.key === 'Escape') { e.preventDefault(); cancel() }
        }}
        style={{
          border: '1px solid #EA1D2C', borderRadius: '4px',
          padding: '4px 8px', margin: '-4px -8px', fontSize: '13px',
          color: '#111111', outline: 'none', background: '#FFFFFF', boxSizing: 'border-box',
        }}
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      style={{ ...CELL_HOVER_STYLE, fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '12px', color: '#666666', whiteSpace: 'nowrap' }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F9F9F9'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {formatDate(loja.dataInicio)}
    </div>
  )
}

function EditablePlataformasCell({ loja, onSave }) {
  const plats = loja.plataformas?.length ? loja.plataformas : (loja.plataforma ? [loja.plataforma] : [])

  const [open,     setOpen]     = useState(false)
  const [selected, setSelected] = useState(plats)
  const [rect,     setRect]     = useState(null)
  const buttonRef = useRef(null)
  const popRef    = useRef(null)
  const selectedRef = useRef(selected)
  useEffect(() => { selectedRef.current = selected }, [selected])

  useEffect(() => { setSelected(plats) }, [loja.plataformas, loja.plataforma]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e) {
      if (buttonRef.current?.contains(e.target)) return
      if (popRef.current?.contains(e.target)) return
      setOpen(false)
      const next = selectedRef.current
      const changed = next.length !== plats.length || next.some(p => !plats.includes(p))
      if (changed) onSave(next)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open, plats, onSave])

  function handleOpen() {
    const r = buttonRef.current.getBoundingClientRect()
    setRect({ top: r.bottom + 4, left: r.left })
    setOpen(true)
  }

  function toggle(p) {
    setSelected(prev => prev.includes(p) ? prev.filter(v => v !== p) : [...prev, p])
  }

  return (
    <>
      <div
        ref={buttonRef}
        onClick={handleOpen}
        style={{ ...CELL_HOVER_STYLE, display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F9F9F9'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        {plats.length ? plats.map(p => <PlatformBadge key={p} plataforma={p} />) : <span style={{ fontSize: '12px', color: '#666666' }}>—</span>}
      </div>

      {open && rect && createPortal(
        <div
          ref={popRef}
          style={{
            position: 'fixed', top: rect.top, left: rect.left, zIndex: 200,
            backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '10px',
          }}
        >
          <div className="flex gap-2">
            {PLATAFORMAS.map(p => {
              const active = selected.includes(p)
              const colors = PLATAFORMA_COLORS[p]
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggle(p)}
                  style={{
                    height: '30px', padding: '0 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
                    cursor: 'pointer', transition: 'all 150ms', whiteSpace: 'nowrap',
                    backgroundColor: active ? colors.bg   : '#FFFFFF',
                    color:           active ? colors.text : '#999999',
                    border: `1px solid ${active ? colors.border : '#E8E8E8'}`,
                  }}
                >
                  {p}
                </button>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

// ─── SortableTh ───────────────────────────────────────────────────────────────

function SortableTh({ col, label, current, dir, onSort }) {
  const isActive = col === current
  const Icon = dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th className="px-4 py-2 text-left whitespace-nowrap">
      <button
        type="button"
        onClick={() => onSort(col)}
        className="flex items-center gap-1 section-label hover:text-text-muted transition-colors duration-150 font-medium"
        style={isActive ? { color: '#666666' } : undefined}
      >
        {label}
        {isActive && <Icon size={10} strokeWidth={2} />}
      </button>
    </th>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Lojas() {
  const toast = useToast()
  const location = useLocation()
  const { user, isSuperAdmin } = useAuth()

  const [lojas,        setLojas]        = useState([])
  const [clientes,     setClientes]     = useState([])
  const [gestores,     setGestores]     = useState([])
  const [organizacoes, setOrganizacoes] = useState([])
  const [loading,  setLoading]  = useState(true)

  const [search,       setSearch]       = useState('')
  const [filtroGestor, setFiltroGestor] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  const [modalOpen,        setModalOpen]        = useState(false)
  const [editingLoja,      setEditingLoja]       = useState(null)
  const [clienteModalOpen, setClienteModalOpen]  = useState(false)
  const [expandedLojaId,   setExpandedLojaId]    = useState(null)
  const [deletingLoja,     setDeletingLoja]      = useState(null)

  const [sortCol, setSortCol] = useState('nome')
  const [sortDir, setSortDir] = useState('asc')

  // ─── Load data ──────────────────────────────────────────────────────────────

  async function loadAll() {
    setLoading(true)
    try {
      // master enxerga tudo (sem filtro); admin_org só a própria organização —
      // sem esse filtro a consulta nem passa pelas regras do Firestore pra
      // quem não é master (mesmo padrão do Clientes.jsx).
      const orgId = user?.organizacaoId ?? null
      const escopo = isSuperAdmin ? [] : [where('organizacaoId', '==', orgId)]

      // Contas novas (multi-tenant) usam o campo `role`, não o `perfil` legado —
      // um admin_org só tem gestores criados no modelo novo.
      const gestoresQuery = isSuperAdmin
        ? query(collection(db, COLLECTIONS.USERS), where('perfil', '==', 'gestor'))
        : query(collection(db, COLLECTIONS.USERS), where('organizacaoId', '==', orgId), where('role', '==', 'gestor'))

      const [lojasSnap, clientesSnap, gestoresSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.LOJAS), ...escopo)),
        getDocs(query(collection(db, COLLECTIONS.CLIENTES), ...escopo)),
        getDocs(gestoresQuery),
      ])
      setLojas(lojasSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setClientes(clientesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setGestores(gestoresSnap.docs.map(d => ({ id: d.id, ...d.data() })))

      // master escolhe entre todas as organizações; admin_org só pode
      // ler a própria (regra do Firestore), então busca só esse doc — em
      // ambos os casos vira uma lista, pro <select> do LojaModal funcionar igual.
      if (isSuperAdmin) {
        const orgsSnap = await getDocs(collection(db, COLLECTIONS.ORGANIZACOES))
        setOrganizacoes(orgsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } else if (orgId) {
        const orgSnap = await getDoc(doc(db, COLLECTIONS.ORGANIZACOES, orgId))
        setOrganizacoes(orgSnap.exists() ? [{ id: orgSnap.id, ...orgSnap.data() }] : [])
      }
    } catch (err) {
      console.error('[Lojas] loadAll:', err)
      toast('Erro ao carregar dados: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  // Chegou pela notificação de "lojas sem gestor" — aplica o filtro direto.
  useEffect(() => {
    if (location.state?.filtroSemGestor) setFiltroGestor(SEM_GESTOR)
  }, [location.state])

  // ─── Lookup maps ────────────────────────────────────────────────────────────

  const clienteMap = useMemo(() => Object.fromEntries(clientes.map(c => [c.id, c])), [clientes])
  const gestorMap  = useMemo(() => Object.fromEntries(gestores.map(g => [g.id, g])), [gestores])

  const gestoresAtivos = useMemo(
    () => gestores.filter(g => ['ativo', 'ativa'].includes(g.status?.toLowerCase())).sort((a, b) => a.nome?.localeCompare(b.nome ?? '', 'pt-BR')),
    [gestores]
  )

  const contagemPorGestor = useMemo(() => {
    const map = {}
    lojas.forEach(l => { if (l.gestorId) map[l.gestorId] = (map[l.gestorId] ?? 0) + 1 })
    return map
  }, [lojas])

  // ─── Filtered list ──────────────────────────────────────────────────────────

  const lojasFiltradas = useMemo(() => {
    const term = search.toLowerCase()
    return lojas.filter(l => {
      const matchNome   = l.nome?.toLowerCase().includes(term)
      const matchGestor = !filtroGestor || (filtroGestor === SEM_GESTOR ? !l.gestorId : l.gestorId === filtroGestor)
      const matchStatus = !filtroStatus || l.status?.toLowerCase() === filtroStatus.toLowerCase()
      return matchNome && matchGestor && matchStatus
    })
  }, [lojas, search, filtroGestor, filtroStatus])

  // ─── Ordenação ──────────────────────────────────────────────────────────────

  function handleSort(col) {
    if (sortCol !== col) {
      setSortCol(col)
      setSortDir('asc')
    } else if (sortDir === 'asc') {
      setSortDir('desc')
    } else {
      setSortCol(null)
      setSortDir(null)
    }
  }

  const lojasOrdenadas = useMemo(() => {
    if (!sortCol) return lojasFiltradas

    const valorPara = l => {
      if (sortCol === 'nome')       return l.nome ?? ''
      if (sortCol === 'gestor')     return gestorMap[l.gestorId]?.nome ?? ''
      if (sortCol === 'plataforma') return l.plataforma ?? ''
      return ''
    }

    return [...lojasFiltradas].sort((a, b) => {
      const cmp = valorPara(a).localeCompare(valorPara(b), 'pt-BR')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [lojasFiltradas, sortCol, sortDir, gestorMap])

  // Agrupa visualmente as lojas do mesmo cliente — automático, sem precisar de
  // um "grupo" cadastrado à parte: sempre que o cliente tem mais de uma loja
  // (entre as visíveis), elas aparecem juntas sob um cabeçalho com o nome do
  // cliente; cliente com uma loja só fica solto na lista.
  const linhasExibicao = useMemo(() => {
    // Ordenando por Gestor/Plataforma o agrupamento alfabético por nome não
    // faz sentido (um cliente pode ter lojas de gestores/plataformas
    // diferentes) — nesses casos mantém a lista plana já ordenada por esse critério.
    if (sortCol && sortCol !== 'nome') {
      return lojasOrdenadas.map(loja => ({ tipo: 'loja', loja, emGrupo: false }))
    }

    const porCliente = {}
    const semAgrupamento = []
    lojasFiltradas.forEach(l => {
      if (l.clienteId) {
        (porCliente[l.clienteId] ??= []).push(l)
      } else {
        semAgrupamento.push(l)
      }
    })

    const gruposPorCliente = {}
    Object.entries(porCliente).forEach(([clienteId, lojasDoCliente]) => {
      if (lojasDoCliente.length > 1) {
        gruposPorCliente[clienteId] = {
          clienteId,
          clienteNome: clienteMap[clienteId]?.nome ?? '—',
          lojas: [...lojasDoCliente].sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR')),
        }
      } else {
        semAgrupamento.push(...lojasDoCliente)
      }
    })

    // Um único bloco por cliente agrupado (chave = nome do cliente) + uma
    // entrada por loja avulsa (chave = nome da loja) — tudo intercalado em
    // ordem alfabética, sem tratar grupos como caso especial que sobe ao topo.
    const dir = sortDir === 'desc' ? -1 : 1
    const blocos = [
      ...Object.values(gruposPorCliente).map(g => ({ chave: g.clienteNome ?? '', tipo: 'grupo', grupo: g })),
      ...semAgrupamento.map(l => ({ chave: l.nome ?? '', tipo: 'loja', loja: l })),
    ].sort((a, b) => dir * a.chave.localeCompare(b.chave, 'pt-BR'))

    const linhas = []
    blocos.forEach(b => {
      if (b.tipo === 'grupo') {
        linhas.push({ tipo: 'grupo', clienteId: b.grupo.clienteId, clienteNome: b.grupo.clienteNome })
        b.grupo.lojas.forEach(loja => linhas.push({ tipo: 'loja', loja, emGrupo: true }))
      } else {
        linhas.push({ tipo: 'loja', loja: b.loja, emGrupo: false })
      }
    })

    return linhas
  }, [lojasFiltradas, lojasOrdenadas, sortCol, sortDir, clienteMap])

  // ─── Save ───────────────────────────────────────────────────────────────────

  async function handleSave(form, prints = EMPTY_PRINTS) {
    // Cancelamento é detectado pela transição de status ≠ 'Cancelada' → 'Cancelada';
    // a data fica travada no primeiro cancelamento e não muda em edições seguintes.
    const canceladoAgora = form.status === 'Cancelada' && editingLoja?.status !== 'Cancelada'
    const dataCancelamento = canceladoAgora
      ? serverTimestamp()
      : (editingLoja?.dataCancelamento ?? null)

    const basePayload = {
      nome:          form.nome.trim(),
      organizacaoId: isSuperAdmin ? form.organizacaoId : (user?.organizacaoId ?? null),
      clienteId:    form.clienteId,
      gestorId:     form.gestorId,
      segmento:     form.segmento.trim(),
      status:       form.status,
      dataInicio:   form.dataInicio ? Timestamp.fromDate(new Date(form.dataInicio)) : null,
      dataCancelamento,
      observacoes:  form.observacoes.trim(),
      diaRelatorio: form.diaRelatorio || null,
      preGestao: {
        faturamento30dias: parseMoney(form.preGestao30dias),
        faturamento7dias:  parseMoney(form.preGestao7dias),
        valorVendas:       parseMoney(form.preGestaoValorVendas),
        totalFaturamento:  parseMoney(form.preGestaoTotalFaturamento),
        prints: editingLoja?.preGestao?.prints ?? {},
      },
    }

    if (editingLoja) {
      const lojaId = editingLoja.id
      await updateDoc(doc(db, COLLECTIONS.LOJAS, lojaId), {
        ...basePayload,
        plataforma:  form.plataformas[0] ?? '',
        plataformas: form.plataformas,
      })
      toast('Loja atualizada.', 'success')

      // ── Prints: upload/remoção no Storage, só então grava as URLs no doc ────
      const printsAnteriores = editingLoja?.preGestao?.prints ?? {}
      let printsAlterados = false
      const printUrls = {}

      for (const key of Object.keys(PRINT_LABELS)) {
        const atual = prints[key]
        if (atual?.file) {
          printUrls[key] = await uploadImagem(atual.file, caminhoPrintPreGestao(lojaId, key))
          printsAlterados = true
        } else if (atual?.existing) {
          printUrls[key] = atual.url
        } else {
          printUrls[key] = null
          if (printsAnteriores[key]) {
            await deleteImagem(caminhoPrintPreGestao(lojaId, key))
            printsAlterados = true
          }
        }
      }

      if (printsAlterados) {
        await updateDoc(doc(db, COLLECTIONS.LOJAS, lojaId), { 'preGestao.prints': printUrls })
      }
    } else if (form.plataformas.length > 1) {
      // Múltiplas plataformas na criação → um documento de loja por plataforma
      await Promise.all(form.plataformas.map(p => addDoc(collection(db, COLLECTIONS.LOJAS), {
        ...basePayload,
        nome:          `${basePayload.nome} — ${p}`,
        plataforma:    p,
        plataformas:   [p],
        onboardStatus: 'dados_pendentes',
        criadoEm:      serverTimestamp(),
      })))
      toast(`${form.plataformas.length} lojas criadas — uma por plataforma.`, 'success')
    } else {
      await addDoc(collection(db, COLLECTIONS.LOJAS), {
        ...basePayload,
        plataforma:    form.plataformas[0] ?? '',
        plataformas:   form.plataformas,
        onboardStatus: 'dados_pendentes',
        criadoEm:      serverTimestamp(),
      })
      toast('Loja criada.', 'success')
    }

    await loadAll()
  }

  async function handleSaveCliente(form, novasLojas = [], vinculadas = []) {
    const ref = await addDoc(collection(db, COLLECTIONS.CLIENTES), {
      nome:        form.nome.trim(),
      telefone:    form.telefone.trim(),
      email:       form.email.trim().toLowerCase(),
      status:      form.status,
      dataInicio:  form.dataInicio ? Timestamp.fromDate(new Date(form.dataInicio)) : null,
      observacoes: form.observacoes.trim(),
      criadoEm:    serverTimestamp(),
    })
    if (novasLojas.length) {
      const dataInicioLoja = form.dataInicio ? Timestamp.fromDate(new Date(form.dataInicio)) : null
      // Só o master passa por aqui vendo múltiplas organizações — o
      // formulário de "novo cliente" não expõe seletor de organização, então
      // a loja nasce vinculada à organização do admin_org logado, ou sem
      // organização (null) se for o master criando sem contexto de org.
      const organizacaoId = !isSuperAdmin ? (user?.organizacaoId ?? null) : null
      await Promise.all(novasLojas.map(l => addDoc(collection(db, COLLECTIONS.LOJAS), {
        nome:          l.nome.trim(),
        organizacaoId,
        clienteId:     ref.id,
        gestorId:      l.gestorId || null,
        plataforma:    l.plataformas[0] ?? '',
        plataformas:   l.plataformas,
        status:        l.status,
        dataInicio:    dataInicioLoja,
        observacoes:   l.observacoes.trim(),
        onboardStatus: 'dados_pendentes',
        criadoEm:      serverTimestamp(),
      })))
    }
    if (vinculadas.length) {
      await Promise.all(vinculadas.map(l => updateDoc(doc(db, COLLECTIONS.LOJAS, l.id), { clienteId: ref.id })))
    }
    toast('Cliente criado.', 'success')
    await loadAll()
  }

  async function handleDeleteLoja() {
    if (!deletingLoja) return
    try {
      await deleteDoc(doc(db, COLLECTIONS.LOJAS, deletingLoja.id))
      setLojas(prev => prev.filter(l => l.id !== deletingLoja.id))
      toast('Loja excluída.', 'success')
      setDeletingLoja(null)
    } catch (err) {
      console.error('[Lojas] handleDeleteLoja:', err)
      if (err.code === 'permission-denied') {
        toast('Sem permissão para excluir esta loja.', 'error')
      } else {
        toast('Erro ao excluir loja: ' + err.message, 'error')
      }
    }
  }

  // Edição inline genérica (nome, plataformas, status, dia do relatório) —
  // atualiza Firestore + estado local e mostra um toast discreto de sucesso.
  async function handleInlineUpdate(loja, field, value) {
    try {
      const payload = { [field]: value }
      if (field === 'plataformas') {
        payload.plataforma = value[0] ?? ''
      }
      if (field === 'status' && value === 'Cancelada' && loja.status !== 'Cancelada') {
        payload.dataCancelamento = serverTimestamp()
      }
      await updateDoc(doc(db, COLLECTIONS.LOJAS, loja.id), payload)
      setLojas(prev => prev.map(l => l.id === loja.id ? { ...l, ...payload, dataCancelamento: payload.dataCancelamento ? Timestamp.now() : l.dataCancelamento } : l))
      toast('Salvo', 'success')
    } catch (err) {
      console.error('[Lojas] handleInlineUpdate:', err)
      toast('Erro ao salvar: ' + err.message, 'error')
    }
  }

  async function handleGestorChange(loja, gestor) {
    const gestorId   = gestor?.id ?? null
    const gestorNome = gestor?.nome ?? null
    try {
      await updateDoc(doc(db, COLLECTIONS.LOJAS, loja.id), { gestorId, gestorNome })
      setLojas(prev => prev.map(l => l.id === loja.id ? { ...l, gestorId, gestorNome } : l))
      toast(`Gestor atualizado para ${gestorNome ?? 'Sem gestor'}`, 'success')
    } catch (err) {
      console.error('[Lojas] handleGestorChange:', err)
      toast('Erro ao atualizar gestor: ' + err.message, 'error')
    }
  }

  async function handleClienteChange(loja, cliente) {
    const clienteId   = cliente?.id ?? null
    const clienteNome = cliente?.nome ?? null
    try {
      await updateDoc(doc(db, COLLECTIONS.LOJAS, loja.id), { clienteId, clienteNome })
      setLojas(prev => prev.map(l => l.id === loja.id ? { ...l, clienteId, clienteNome } : l))
      toast('Cliente atualizado', 'success')
    } catch (err) {
      console.error('[Lojas] handleClienteChange:', err)
      toast('Erro ao atualizar cliente: ' + err.message, 'error')
    }
  }

  function handleClienteCriado(cliente) {
    setClientes(prev => [...prev, cliente])
  }

  function openNew() { setEditingLoja(null); setModalOpen(true) }
  function openEdit(loja) { setEditingLoja(loja); setModalOpen(true) }

  function toggleDetail(lojaId) {
    setExpandedLojaId(prev => prev === lojaId ? null : lojaId)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      style={{ padding: '28px 20px' }}
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Lojas</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setClienteModalOpen(true)} className="btn-secondary flex-1 sm:flex-none flex items-center justify-center gap-2 h-11 sm:h-8">
            <Plus size={13} strokeWidth={2} />
            Novo cliente
          </button>
          <button onClick={openNew} className="btn-primary flex-1 sm:flex-none flex items-center justify-center gap-2 h-11 sm:h-8">
            <Plus size={13} strokeWidth={2} />
            Nova loja
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
        <div className="relative flex-1 sm:max-w-[280px]">
          <Search size={13} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#999999' }} />
          <input type="text" placeholder="Buscar por nome…" value={search}
            onChange={e => setSearch(e.target.value)} className="input pl-9 w-full h-11 sm:h-[30px]" style={{ fontSize: '12px' }} />
        </div>

        <select value={filtroGestor} onChange={e => setFiltroGestor(e.target.value)} className="select w-full sm:w-[180px] h-11 sm:h-[30px]" style={{ fontSize: '12px' }}>
          <option value="">Todos os gestores</option>
          <option value={SEM_GESTOR}>Sem gestor</option>
          {gestores.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
        </select>

        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="select w-full sm:w-[148px] h-11 sm:h-[30px]" style={{ fontSize: '12px' }}>
          <option value="">Todos os status</option>
          {STATUS_LOJAS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {(search || filtroGestor || filtroStatus) && (
          <button onClick={() => { setSearch(''); setFiltroGestor(''); setFiltroStatus('') }}
            style={{ fontSize: '12px', color: '#999999', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 150ms' }}
            className="text-left sm:text-center"
            onMouseEnter={e => e.currentTarget.style.color = '#111111'}
            onMouseLeave={e => e.currentTarget.style.color = '#999999'}>
            Limpar
          </button>
        )}
      </div>

      {/* Tabela */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {loading ? (
          <Skeleton.Table rows={8} cols={8} />
        ) : lojasFiltradas.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0' }}>
            <p style={{ fontSize: '12px', color: '#999999' }}>
              {lojas.length === 0 ? 'Nenhuma loja cadastrada.' : 'Nenhuma loja encontrada.'}
            </p>
          </div>
        ) : (
          <>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F9F9F9', borderBottom: '1px solid #E8E8E8' }}>
                  <SortableTh col="nome"       label="Nome da Loja" current={sortCol} dir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-2 text-left section-label whitespace-nowrap">Cliente</th>
                  <SortableTh col="gestor"     label="Gestor"     current={sortCol} dir={sortDir} onSort={handleSort} />
                  <SortableTh col="plataforma" label="Plataforma" current={sortCol} dir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-2 text-left section-label whitespace-nowrap">Status</th>
                  <th className="px-4 py-2 text-left section-label whitespace-nowrap">Dia do Relatório</th>
                  <th className="px-4 py-2 text-left section-label whitespace-nowrap">Início</th>
                  <th className="px-4 py-2 text-left section-label whitespace-nowrap"></th>
                </tr>
              </thead>
              <motion.tbody variants={listVariants} initial="initial" animate="animate">
                {linhasExibicao.map(item => {
                  if (item.tipo === 'grupo') {
                    return (
                      <tr key={`cliente-${item.clienteId}`}>
                        <td colSpan={8} style={{ padding: 0 }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            backgroundColor: '#F9F9F9', padding: '8px 12px',
                            borderRadius: '6px', marginBottom: '4px', marginTop: '4px',
                          }}>
                            <Layers size={14} strokeWidth={1.75} style={{ color: '#666666', flexShrink: 0 }} />
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#111111' }}>{item.clienteNome}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  const loja = item.loja
                  return (
                  <Fragment key={loja.id}>
                    <motion.tr
                      variants={itemVariants}
                      className="table-row-base"
                    >
                      <td
                        className="px-4"
                        style={{
                          height: '36px', fontSize: '13px', color: '#111111', fontWeight: 500,
                          paddingLeft: item.emGrupo ? '24px' : undefined,
                          borderLeft: item.emGrupo ? '2px solid #E8E8E8' : undefined,
                        }}
                      >
                        <EditableNomeCell loja={loja} onSave={v => handleInlineUpdate(loja, 'nome', v)} />
                      </td>
                      <td className="px-4" style={{ height: '36px', fontSize: '12px' }}>
                        <ClienteCell
                          loja={loja}
                          clientes={clientes}
                          clienteMap={clienteMap}
                          onSelect={handleClienteChange}
                          onClienteCriado={handleClienteCriado}
                        />
                      </td>
                      <td className="px-4" style={{ height: '36px', fontSize: '12px' }}>
                        <GestorCell
                          loja={loja}
                          gestorMap={gestorMap}
                          gestoresAtivos={gestoresAtivos}
                          contagemPorGestor={contagemPorGestor}
                          onSelect={handleGestorChange}
                        />
                      </td>
                      <td className="px-4" style={{ height: '36px' }}>
                        <EditablePlataformasCell loja={loja} onSave={v => handleInlineUpdate(loja, 'plataformas', v)} />
                      </td>
                      <td className="px-4" style={{ height: '36px' }}>
                        <EditableStatusCell loja={loja} onSave={v => handleInlineUpdate(loja, 'status', v)} />
                      </td>
                      <td className="px-4" style={{ height: '36px' }}>
                        <EditableDiaRelatorioCell loja={loja} onSave={v => handleInlineUpdate(loja, 'diaRelatorio', v)} />
                      </td>
                      <td className="px-4" style={{ height: '36px' }}>
                        <EditableDataInicioCell
                          loja={loja}
                          onSave={v => handleInlineUpdate(loja, 'dataInicio', v ? Timestamp.fromDate(new Date(v)) : null)}
                        />
                      </td>
                      <td className="px-4" style={{ height: '36px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => toggleDetail(loja.id)}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded transition-colors duration-150"
                          style={{ fontSize: '11px', color: expandedLojaId === loja.id ? '#111111' : '#999999', background: expandedLojaId === loja.id ? 'rgba(0,0,0,0.05)' : 'none', border: 'none', cursor: 'pointer', marginRight: '4px' }}
                        >
                          {expandedLojaId === loja.id
                            ? <ChevronDown size={12} strokeWidth={1.5} />
                            : <ChevronRight size={12} strokeWidth={1.5} />
                          }
                          Detalhes
                        </button>
                        <button
                          onClick={() => openEdit(loja)}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded transition-colors duration-150"
                          style={{ fontSize: '11px', color: '#999999', background: 'none', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#111111'}
                          onMouseLeave={e => e.currentTarget.style.color = '#999999'}
                        >
                          <Pencil size={12} strokeWidth={1.5} />
                          Editar
                        </button>
                        <button
                          onClick={() => setDeletingLoja(loja)}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded transition-colors duration-150"
                          style={{ fontSize: '11px', color: '#999999', background: 'none', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
                          onMouseLeave={e => e.currentTarget.style.color = '#999999'}
                        >
                          <Trash2 size={12} strokeWidth={1.5} />
                          Excluir
                        </button>
                      </td>
                    </motion.tr>

                    {expandedLojaId === loja.id && (
                      <tr>
                        <LojaDetailPanel loja={loja} />
                      </tr>
                    )}
                  </Fragment>
                  )
                })}
              </motion.tbody>
            </table>
          </div>

          {/* Mobile: cards (leitura + ações via modal — edição inline fica só no desktop) */}
          <motion.div className="sm:hidden flex flex-col" variants={listVariants} initial="initial" animate="animate">
            {linhasExibicao.map(item => {
              if (item.tipo === 'grupo') {
                return (
                  <div key={`cliente-${item.clienteId}`} className="flex items-center gap-1.5 px-4 py-2 bg-[#F9F9F9]">
                    <Layers size={14} strokeWidth={1.75} style={{ color: '#666666', flexShrink: 0 }} />
                    <span className="text-[12px] font-semibold text-text-primary">{item.clienteNome}</span>
                  </div>
                )
              }

              const loja = item.loja
              const clienteNome = loja.clienteId ? (loja.clienteNome ?? clienteMap[loja.clienteId]?.nome ?? '—') : '—'
              const gestorNome  = loja.gestorId  ? (loja.gestorNome  ?? gestorMap[loja.gestorId]?.nome   ?? '—') : 'Sem gestor'

              return (
                <motion.div
                  key={loja.id}
                  variants={itemVariants}
                  className="p-4 border-b border-border-subtle last:border-0 flex flex-col gap-2"
                  style={{ paddingLeft: item.emGrupo ? '28px' : undefined, borderLeft: item.emGrupo ? '2px solid #E8E8E8' : undefined }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[14px] text-text-primary font-medium truncate">{loja.nome}</span>
                    <Badge status={loja.status?.toLowerCase()} label={loja.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-muted">
                    <span>{clienteNome}</span>
                    <span>{gestorNome}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(loja.plataformas ?? []).map(p => {
                      const colors = PLATAFORMA_COLORS[p]
                      return (
                        <span key={p} className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: colors?.bg, color: colors?.text, border: `1px solid ${colors?.border}` }}>
                          {p}
                        </span>
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-text-subtle font-mono">
                    <span>Relatório: {loja.diaRelatorio || '—'}</span>
                    <span>Início: {loja.dataInicio ? loja.dataInicio.toDate?.().toLocaleDateString('pt-BR') ?? '—' : '—'}</span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => openEdit(loja)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 text-[13px] text-text-primary border border-border rounded-md h-10"
                    >
                      <Pencil size={13} strokeWidth={1.5} />
                      Editar
                    </button>
                    <button
                      onClick={() => setDeletingLoja(loja)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 text-[13px] text-negative border border-border rounded-md h-10"
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                      Excluir
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
          </>
        )}

        {/* Footer count */}
        {!loading && lojas.length > 0 && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid #F3F3F3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#999999' }}>
              {lojasFiltradas.length} de {lojas.length} lojas
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px' }}>
              <span style={{ color: '#16A34A' }}>{lojas.filter(l => ['ativa', 'ativo'].includes(l.status?.toLowerCase())).length} ativas</span>
              <span style={{ color: '#666666' }}>{lojas.filter(l => l.status?.toLowerCase() === 'pausada').length} pausadas</span>
              <span style={{ color: '#DC2626' }}>{lojas.filter(l => l.status?.toLowerCase() === 'cancelada').length} canceladas</span>
            </div>
          </div>
        )}
      </div>

      <LojaModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        loja={editingLoja}
        clientes={clientes}
        gestores={gestores}
        organizacoes={organizacoes}
        isSuperAdmin={isSuperAdmin}
        onClienteCriado={handleClienteCriado}
      />

      <NovoClienteModal
        isOpen={clienteModalOpen}
        onClose={() => setClienteModalOpen(false)}
        onSave={handleSaveCliente}
        gestores={gestores}
        lojas={lojas}
      />

      <ConfirmModal
        isOpen={!!deletingLoja}
        title="Excluir loja"
        message={`Tem certeza que deseja excluir ${deletingLoja?.nome}? Esta ação não pode ser desfeita.`}
        onConfirm={handleDeleteLoja}
        onCancel={() => setDeletingLoja(null)}
      />
    </motion.div>
  )
}
