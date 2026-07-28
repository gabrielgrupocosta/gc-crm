import { useState, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  db, COLLECTIONS, uploadImagem, deleteImagem,
  collection, doc, query, where, getDocs, updateDoc, serverTimestamp,
} from '../services/firebase'
import { useToast } from '../components/UI/Toast'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/UI/Modal'
import Skeleton from '../components/UI/Skeleton'
import ImageUpload from '../components/UI/ImageUpload'

// ─── Constants ────────────────────────────────────────────────────────────────

const SEGMENTOS = [
  'Açaí', 'Árabe', 'Cafeteria', 'Frutos do Mar', 'Hamburgeria',
  'Italiana', 'Japonesa', 'Marmitaria', 'Padaria', 'Pastelaria',
  'Pizza', 'Salgados', 'Sorveteria',
]

const DIAS_RELATORIO = [
  { value: 'segunda', label: 'Segunda-feira' },
  { value: 'terca',   label: 'Terça-feira'   },
  { value: 'quarta',  label: 'Quarta-feira'  },
  { value: 'quinta',  label: 'Quinta-feira'  },
  { value: 'sexta',   label: 'Sexta-feira'   },
  { value: 'sabado',  label: 'Sábado'        },
]

const PRINT_LABELS = {
  desempenho: 'Print Desempenho',
  financeiro: 'Print Financeiro',
  funil:      'Print Funil de Vendas',
  nota:       'Print Nota da Loja',
}

const EMPTY_PRINTS = { desempenho: null, financeiro: null, funil: null, nota: null }

const EMPTY_PRE_GESTAO_FORM = {
  segmento: '', diaRelatorio: '',
  preGestao30dias: '', preGestao7dias: '', preGestaoValorVendas: '', preGestaoTotalFaturamento: '',
}

const EMPTY_AGENDAR_FORM = { data: '', horario: '', observacoes: '' }

const PLATAFORMA_STRONG = {
  iFood:    '#EA1D2C',
  '99Food': '#FFD700',
  Keeta:    '#00B14F',
}

const PLATAFORMA_TEXT_COLOR = {
  iFood:    '#FFFFFF',
  '99Food': '#000000',
  Keeta:    '#FFFFFF',
}

const PLATAFORMA_CARD_BORDER = {
  iFood:    'rgba(234,29,44,0.3)',
  '99Food': 'rgba(255,215,0,0.5)',
  Keeta:    'rgba(0,177,79,0.3)',
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getCardStyle(plataformas, hover) {
  const plats = plataformas?.length ? plataformas : []
  const borderColor = plats.length === 1
    ? (PLATAFORMA_CARD_BORDER[plats[0]] ?? '#E8E8E8')
    : '#E8E8E8'

  return {
    backgroundColor: '#FFFFFF',
    border: `1px solid ${borderColor}`,
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: hover
      ? '0 4px 12px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)'
      : '0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
    transition: 'box-shadow 200ms',
  }
}

function renderPlatformHeader(plataformas) {
  const plats = plataformas?.length ? plataformas : []

  if (plats.length === 0) {
    return (
      <div style={{
        height: '28px', borderRadius: '8px 8px 0 0', backgroundColor: '#CCCCCC',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#FFFFFF', textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}>
          Sem plataforma
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', borderRadius: '8px 8px 0 0', overflow: 'hidden', height: '28px' }}>
      {plats.map(p => {
        const bg = PLATAFORMA_STRONG[p] ?? '#CCCCCC'
        const color = PLATAFORMA_TEXT_COLOR[p] ?? '#FFFFFF'
        return (
          <div
            key={p}
            style={{
              width: `${100 / plats.length}%`, background: bg, boxSizing: 'border-box',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderBottom: p === 'Keeta' ? '3px solid #FFD700' : undefined,
            }}
          >
            <span style={{
              fontSize: '12px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
              color, textShadow: p === '99Food' ? 'none' : '0 1px 2px rgba(0,0,0,0.15)',
            }}>
              {p}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function formatDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('pt-BR')
}

function formatBRL(n) {
  if (n == null) return null
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

function parseMoney(str) {
  if (str === '' || str == null) return null
  const n = parseFloat(String(str).replace(',', '.'))
  return isNaN(n) ? null : n
}

function caminhoPrintPreGestao(lojaId, key) {
  return `lojas/${lojaId}/pre-gestao/${key}.jpg`
}

function formatDataHorario(dataStr, horaStr) {
  if (!dataStr) return '—'
  const [y, m, d] = dataStr.split('-')
  const dataFmt = `${d}/${m}/${y}`
  return horaStr ? `${dataFmt} às ${horaStr}` : dataFmt
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

function CurrencyInput({ id, value, onChange }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ fontSize: '12px', color: '#999999' }}>R$</span>
      <input
        id={id}
        type="number"
        min="0"
        step="0.01"
        placeholder="0,00"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input pl-9 font-mono"
      />
    </div>
  )
}

// ─── Modal: dados pré-gestão ───────────────────────────────────────────────────

function PreGestaoModal({ loja, advanceStatus, onClose, onSave }) {
  const toast = useToast()
  const [form,   setForm]   = useState(EMPTY_PRE_GESTAO_FORM)
  const [prints, setPrints] = useState(EMPTY_PRINTS)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loja) return
    setForm({
      segmento:                  loja.segmento     ?? '',
      diaRelatorio:              loja.diaRelatorio ?? '',
      preGestao30dias:           loja.preGestao?.faturamento30dias != null ? String(loja.preGestao.faturamento30dias) : '',
      preGestao7dias:            loja.preGestao?.faturamento7dias  != null ? String(loja.preGestao.faturamento7dias)  : '',
      preGestaoValorVendas:      loja.preGestao?.valorVendas       != null ? String(loja.preGestao.valorVendas)       : '',
      preGestaoTotalFaturamento: loja.preGestao?.totalFaturamento  != null ? String(loja.preGestao.totalFaturamento)  : '',
    })
    const pgPrints = loja.preGestao?.prints ?? {}
    setPrints({
      desempenho: pgPrints.desempenho ? { url: pgPrints.desempenho, existing: true } : null,
      financeiro: pgPrints.financeiro ? { url: pgPrints.financeiro, existing: true } : null,
      funil:      pgPrints.funil      ? { url: pgPrints.funil,      existing: true } : null,
      nota:       pgPrints.nota       ? { url: pgPrints.nota,       existing: true } : null,
    })
  }, [loja])

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
      await onSave(loja, form, prints, { advanceStatus })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={!!loja}
      onClose={onClose}
      title={advanceStatus ? `Preencher dados — ${loja?.nome ?? ''}` : `Editar dados — ${loja?.nome ?? ''}`}
      width="max-w-xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button form="pre-gestao-form" type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Salvando…' : advanceStatus ? 'Salvar e enviar para agendamento' : 'Salvar alterações'}
          </button>
        </>
      }
    >
      <form id="pre-gestao-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="og-segmento">Segmento</label>
            <select id="og-segmento" value={form.segmento}
              onChange={e => set('segmento', e.target.value)} className="select">
              <option value="">Selecione</option>
              {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="og-dia">Dia do relatório</label>
            <select id="og-dia" value={form.diaRelatorio}
              onChange={e => set('diaRelatorio', e.target.value)} className="select">
              <option value="">Sem dia definido</option>
              {DIAS_RELATORIO.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ backgroundColor: '#FAFAFA', border: '1px solid #E8E8E8', borderRadius: '8px', padding: '16px' }}>
            <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#999999', borderBottom: '1px solid #E8E8E8', paddingBottom: '8px', marginBottom: '12px' }}>
              Desempenho
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="field-label" htmlFor="og-fat30">Faturamento 30 dias</label>
                <CurrencyInput id="og-fat30" value={form.preGestao30dias} onChange={v => set('preGestao30dias', v)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="field-label" htmlFor="og-fat7">Faturamento 7 dias</label>
                <CurrencyInput id="og-fat7" value={form.preGestao7dias} onChange={v => set('preGestao7dias', v)} />
              </div>
            </div>
          </div>
          <div style={{ backgroundColor: '#FAFAFA', border: '1px solid #E8E8E8', borderRadius: '8px', padding: '16px' }}>
            <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#999999', borderBottom: '1px solid #E8E8E8', paddingBottom: '8px', marginBottom: '12px' }}>
              Financeiro
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="field-label" htmlFor="og-valor-vendas">Valor das Vendas</label>
                <CurrencyInput id="og-valor-vendas" value={form.preGestaoValorVendas} onChange={v => set('preGestaoValorVendas', v)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="field-label" htmlFor="og-total-fat">Total Faturamento</label>
                <CurrencyInput id="og-total-fat" value={form.preGestaoTotalFaturamento} onChange={v => set('preGestaoTotalFaturamento', v)} />
              </div>
            </div>
          </div>
        </div>

        <div>
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
      </form>
    </Modal>
  )
}

// ─── Modal: agendar onboard ─────────────────────────────────────────────────────

function AgendarModal({ loja, advanceStatus, onClose, onSave }) {
  const [form,   setForm]   = useState(EMPTY_AGENDAR_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loja) return
    setForm({
      data:        loja.onboardData ?? '',
      horario:     loja.onboardHorario ?? '',
      observacoes: loja.onboardObservacoes ?? '',
    })
  }, [loja])

  function set(key, value) { setForm(prev => ({ ...prev, [key]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await onSave(loja, form, { advanceStatus })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const canSave = form.data !== ''

  return (
    <Modal
      isOpen={!!loja}
      onClose={onClose}
      title={advanceStatus ? `Agendar onboard — ${loja?.nome ?? ''}` : `Editar agendamento — ${loja?.nome ?? ''}`}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button form="agendar-form" type="submit" disabled={!canSave || saving} className="btn-primary">
            {saving ? 'Salvando…' : advanceStatus ? 'Agendar e mover para início' : 'Salvar alterações'}
          </button>
        </>
      }
    >
      <form id="agendar-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="ag-data">Data do onboard</label>
            <input id="ag-data" type="date" value={form.data}
              onChange={e => set('data', e.target.value)} className="input" required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="ag-horario">Horário</label>
            <input id="ag-horario" type="time" value={form.horario}
              onChange={e => set('horario', e.target.value)} className="input" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="ag-obs">Observações</label>
          <textarea id="ag-obs" value={form.observacoes}
            onChange={e => set('observacoes', e.target.value)}
            placeholder="Ex: Cliente confirmou via WhatsApp"
            rows={3} className="textarea" />
        </div>
      </form>
    </Modal>
  )
}

// ─── Modal: confirmar início de gestão ─────────────────────────────────────────

function ConfirmIniciarModal({ loja, onClose, onConfirm }) {
  const [saving, setSaving] = useState(false)

  async function handleConfirm() {
    if (saving) return
    setSaving(true)
    try {
      await onConfirm(loja)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={!!loja}
      onClose={onClose}
      title="Iniciar gestão"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
          <button type="button" onClick={handleConfirm} className="btn-primary" disabled={saving}>
            {saving ? 'Confirmando…' : 'Confirmar'}
          </button>
        </>
      }
    >
      <p style={{ fontSize: '13px', color: '#111111', lineHeight: 1.5 }}>
        Confirmar início da gestão de <strong>{loja?.nome}</strong>?
      </p>
      <p style={{ fontSize: '12px', color: '#666666', marginTop: '8px', lineHeight: 1.5 }}>
        A loja sai do funil de onboard e passa a ficar ativa no sistema.
      </p>
    </Modal>
  )
}

// ─── Kanban card ────────────────────────────────────────────────────────────────

function OnboardCard({ loja, gestorNome, lineTop, lineBottom, children }) {
  const plats = loja.plataformas?.length ? loja.plataformas : []
  const [hover, setHover] = useState(false)

  return (
    <motion.div
      variants={itemVariants}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={getCardStyle(plats, hover)}
    >
      {renderPlatformHeader(plats)}
      <div style={{ padding: '14px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {loja.nome}
        </p>
        <p style={{ fontSize: '12px', color: '#888888', marginTop: '4px' }}>
          {gestorNome ?? 'Sem gestor'}
        </p>
        {lineTop && (
          <p style={{ fontSize: '11px', color: '#999999', marginTop: '4px' }}>{lineTop}</p>
        )}
        <p style={{ fontSize: '11px', color: '#BBBBBB', marginTop: '2px' }}>{lineBottom}</p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          {children}
        </div>
      </div>
    </motion.div>
  )
}

function CardButton({ primary, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={primary ? 'btn-primary' : 'btn-secondary'}
      style={{ height: '28px', padding: '0 10px', fontSize: '11px', flex: primary ? 1 : undefined }}
    >
      {children}
    </button>
  )
}

function PreencherButton({ onClick, children }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: '28px', padding: '0 10px', fontSize: '11px', flex: 1,
        borderRadius: '6px', border: `1px solid ${hover ? '#EA1D2C' : '#E8E8E8'}`,
        backgroundColor: hover ? '#EA1D2C' : '#FFFFFF',
        color: hover ? '#FFFFFF' : '#666666',
        transition: 'background-color 150ms, border-color 150ms, color 150ms',
      }}
    >
      {children}
    </button>
  )
}

// ─── Kanban column ────────────────────────────────────────────────────────────

function KanbanColumn({ title, count, headerBg, headerColor, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: headerBg, borderRadius: '8px 8px 0 0',
        padding: '10px 14px', border: '1px solid #E8E8E8', borderBottom: 'none',
      }}>
        <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: headerColor }}>
          {title}
        </span>
        <span style={{
          fontSize: '11px', fontWeight: 700, color: headerColor,
          backgroundColor: '#FFFFFF', borderRadius: '10px', padding: '1px 8px',
        }}>
          {count}
        </span>
      </div>
      <div style={{
        border: '1px solid #E8E8E8', borderRadius: '0 0 8px 8px', backgroundColor: '#FAFAFA',
        padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '160px',
      }}>
        {count === 0 ? (
          <p style={{ fontSize: '12px', color: '#999999', textAlign: 'center', padding: '24px 0' }}>
            Nenhuma loja nesta etapa.
          </p>
        ) : (
          <motion.div variants={listVariants} initial="initial" animate="animate" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {children}
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Onboard() {
  const toast = useToast()
  const { user, isAdmin, isSuperAdmin } = useAuth()

  const [lojas,    setLojas]    = useState([])
  const [gestores, setGestores] = useState([])
  const [loading,  setLoading]  = useState(true)

  const [preGestaoModal, setPreGestaoModal] = useState(null) // { loja, advanceStatus }
  const [agendarModal,   setAgendarModal]   = useState(null) // { loja, advanceStatus }
  const [confirmModal,   setConfirmModal]   = useState(null) // loja

  // Mobile: as 3 colunas viram carrossel com swipe — activeCol acompanha
  // qual coluna está visível pra destacar o indicador (dots) embaixo.
  const carouselRef = useRef(null)
  const [activeCol, setActiveCol] = useState(0)

  function handleCarouselScroll() {
    const el = carouselRef.current
    if (!el) return
    setActiveCol(Math.round(el.scrollLeft / el.clientWidth))
  }

  function scrollToCol(index) {
    const el = carouselRef.current
    if (!el) return
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
  }

  async function loadAll() {
    setLoading(true)
    try {
      const escopoOrg = isSuperAdmin ? [] : [where('organizacaoId', '==', user.organizacaoId ?? null)]
      const [lojasSnap, gestoresSnap] = await Promise.all([
        isAdmin
          ? getDocs(query(collection(db, COLLECTIONS.LOJAS), ...escopoOrg))
          : getDocs(query(collection(db, COLLECTIONS.LOJAS), ...escopoOrg, where('gestorId', '==', user.uid))),
        isAdmin
          ? getDocs(query(collection(db, COLLECTIONS.USERS), ...escopoOrg, where('perfil', '==', 'gestor')))
          : Promise.resolve(null),
      ])
      setLojas(lojasSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setGestores(gestoresSnap ? gestoresSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [{ id: user.uid, nome: user.nome }])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (user) loadAll() }, [user, isAdmin, isSuperAdmin])

  const gestorMap = useMemo(() => Object.fromEntries(gestores.map(g => [g.id, g])), [gestores])

  const dadosPendentes = useMemo(() => lojas.filter(l => l.onboardStatus === 'dados_pendentes'), [lojas])
  const agendarOnboard = useMemo(() => lojas.filter(l => l.onboardStatus === 'agendar_onboard'), [lojas])
  const inicioGestao   = useMemo(() => lojas.filter(l => l.onboardStatus === 'inicio_gestao'),   [lojas])

  function resumoPreGestao(loja) {
    const parts = []
    if (loja.segmento) parts.push(loja.segmento)
    const fat30 = formatBRL(loja.preGestao?.faturamento30dias)
    if (fat30) parts.push(`${fat30} (30d)`)
    return parts.length ? parts.join(' · ') : 'Sem resumo disponível'
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  async function handleSavePreGestao(loja, form, prints, { advanceStatus }) {
    const payload = {
      segmento:     form.segmento.trim(),
      diaRelatorio: form.diaRelatorio || null,
      preGestao: {
        faturamento30dias: parseMoney(form.preGestao30dias),
        faturamento7dias:  parseMoney(form.preGestao7dias),
        valorVendas:       parseMoney(form.preGestaoValorVendas),
        totalFaturamento:  parseMoney(form.preGestaoTotalFaturamento),
        prints: loja.preGestao?.prints ?? {},
      },
    }
    if (advanceStatus) payload.onboardStatus = 'agendar_onboard'

    await updateDoc(doc(db, COLLECTIONS.LOJAS, loja.id), payload)

    const printsAnteriores = loja.preGestao?.prints ?? {}
    let printsAlterados = false
    const printUrls = {}

    for (const key of Object.keys(PRINT_LABELS)) {
      const atual = prints[key]
      if (atual?.file) {
        printUrls[key] = await uploadImagem(atual.file, caminhoPrintPreGestao(loja.id, key))
        printsAlterados = true
      } else if (atual?.existing) {
        printUrls[key] = atual.url
      } else {
        printUrls[key] = null
        if (printsAnteriores[key]) {
          await deleteImagem(caminhoPrintPreGestao(loja.id, key))
          printsAlterados = true
        }
      }
    }

    if (printsAlterados) {
      await updateDoc(doc(db, COLLECTIONS.LOJAS, loja.id), { 'preGestao.prints': printUrls })
    }

    toast(advanceStatus ? 'Dados salvos — loja movida para agendamento.' : 'Dados atualizados.', 'success')
    await loadAll()
  }

  async function handleSaveAgendamento(loja, form, { advanceStatus }) {
    const payload = {
      onboardData:        form.data || null,
      onboardHorario:      form.horario || null,
      onboardObservacoes: form.observacoes.trim(),
    }
    if (advanceStatus) payload.onboardStatus = 'inicio_gestao'

    await updateDoc(doc(db, COLLECTIONS.LOJAS, loja.id), payload)
    toast(advanceStatus ? 'Onboard agendado.' : 'Agendamento atualizado.', 'success')
    await loadAll()
  }

  async function handleIniciarGestao(loja) {
    await updateDoc(doc(db, COLLECTIONS.LOJAS, loja.id), {
      onboardStatus:     'ativo',
      dataInicioGestao:  serverTimestamp(),
      status:            'Ativa',
    })
    toast('Gestão iniciada — loja ativa.', 'success')
    await loadAll()
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      style={{ padding: '28px 20px' }}
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      <div className="page-header">
        <h1 className="page-title">Onboard</h1>
        <p className="page-subtitle">Acompanhe o fluxo de entrada de novas lojas</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: '16px' }}>
          <Skeleton.Table rows={4} cols={1} />
          <Skeleton.Table rows={4} cols={1} />
          <Skeleton.Table rows={4} cols={1} />
        </div>
      ) : (
        <>
        {/* Mobile: carrossel com swipe (uma coluna por vez) — sm+: grid normal lado a lado */}
        <div
          ref={carouselRef}
          onScroll={handleCarouselScroll}
          className="flex sm:grid sm:grid-cols-3 overflow-x-auto sm:overflow-visible snap-x snap-mandatory"
          style={{ gap: '16px', scrollbarWidth: 'none' }}
        >
          {/* ── Coluna 1: Preencher Dados ── */}
          <div className="w-full shrink-0 snap-center sm:w-auto sm:shrink sm:snap-align-none">
          <KanbanColumn title="Preencher Dados" count={dadosPendentes.length} headerBg="#EFF6FF" headerColor="#3B82F6">
            {dadosPendentes.map(loja => (
              <OnboardCard
                key={loja.id}
                loja={loja}
                gestorNome={gestorMap[loja.gestorId]?.nome}
                lineBottom={`Cadastrada em ${formatDate(loja.criadoEm)}`}
              >
                <PreencherButton onClick={() => setPreGestaoModal({ loja, advanceStatus: true })}>
                  Preencher
                </PreencherButton>
              </OnboardCard>
            ))}
          </KanbanColumn>
          </div>

          {/* ── Coluna 2: Agendar Onboard ── */}
          <div className="w-full shrink-0 snap-center sm:w-auto sm:shrink sm:snap-align-none">
          <KanbanColumn title="Agendar Onboard" count={agendarOnboard.length} headerBg="#FFFBEB" headerColor="#F59E0B">
            {agendarOnboard.map(loja => (
              <OnboardCard
                key={loja.id}
                loja={loja}
                gestorNome={gestorMap[loja.gestorId]?.nome}
                lineTop={resumoPreGestao(loja)}
                lineBottom={`Cadastrada em ${formatDate(loja.criadoEm)}`}
              >
                <CardButton primary onClick={() => setAgendarModal({ loja, advanceStatus: true })}>
                  Registrar Data
                </CardButton>
                <CardButton onClick={() => setPreGestaoModal({ loja, advanceStatus: false })}>
                  Editar Dados
                </CardButton>
              </OnboardCard>
            ))}
          </KanbanColumn>
          </div>

          {/* ── Coluna 3: Início da Gestão ── */}
          <div className="w-full shrink-0 snap-center sm:w-auto sm:shrink sm:snap-align-none">
          <KanbanColumn title="Início da Gestão" count={inicioGestao.length} headerBg="#ECFDF5" headerColor="#10B981">
            {inicioGestao.map(loja => (
              <OnboardCard
                key={loja.id}
                loja={loja}
                gestorNome={gestorMap[loja.gestorId]?.nome}
                lineBottom={formatDataHorario(loja.onboardData, loja.onboardHorario)}
              >
                <CardButton primary onClick={() => setConfirmModal(loja)}>
                  Iniciar Gestão
                </CardButton>
                <CardButton onClick={() => setAgendarModal({ loja, advanceStatus: false })}>
                  Editar
                </CardButton>
              </OnboardCard>
            ))}
          </KanbanColumn>
          </div>
        </div>

        {/* Indicador de coluna — só mobile */}
        <div className="flex sm:hidden justify-center items-center gap-1.5 mt-3">
          {[0, 1, 2].map(i => (
            <button
              key={i}
              type="button"
              aria-label={`Ver coluna ${i + 1}`}
              onClick={() => scrollToCol(i)}
              style={{
                width: activeCol === i ? '18px' : '6px', height: '6px', borderRadius: '3px',
                backgroundColor: activeCol === i ? '#FF4B2E' : '#E0E0E0',
                border: 'none', padding: 0, transition: 'all 150ms',
              }}
            />
          ))}
        </div>
        </>
      )}

      <PreGestaoModal
        loja={preGestaoModal?.loja ?? null}
        advanceStatus={preGestaoModal?.advanceStatus}
        onClose={() => setPreGestaoModal(null)}
        onSave={handleSavePreGestao}
      />

      <AgendarModal
        loja={agendarModal?.loja ?? null}
        advanceStatus={agendarModal?.advanceStatus}
        onClose={() => setAgendarModal(null)}
        onSave={handleSaveAgendamento}
      />

      <ConfirmIniciarModal
        loja={confirmModal}
        onClose={() => setConfirmModal(null)}
        onConfirm={handleIniciarGestao}
      />
    </motion.div>
  )
}
