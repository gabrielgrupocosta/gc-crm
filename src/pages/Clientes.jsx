import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Plus, Pencil, Trash2, Search, X, Link2 } from 'lucide-react'
import {
  db, COLLECTIONS,
  collection, doc, query, where, getDocs, getDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp,
  criarComRateLimit,
} from '../services/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useModoTeste } from '../contexts/ModoTesteContext'
import { useToast } from '../components/UI/Toast'
import Modal from '../components/UI/Modal'
import Badge from '../components/UI/Badge'
import Skeleton from '../components/UI/Skeleton'
import ConfirmModal from '../components/UI/ConfirmModal'
import LojaSelect from '../components/UI/LojaSelect'
import LojasContratoBuilder, { EMPTY_LOJA_CONTRATO_ITEM, somaValorLojas } from '../components/UI/LojasContratoBuilder'
import { parseLocalDate } from '../utils/format'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CLIENTES  = ['Ativo', 'Inativo']
const PLATAFORMAS_LOJA = ['iFood', '99Food', 'Keeta']
const STATUS_LOJAS     = ['Ativa', 'Pausada', 'Cancelada']

const PLATAFORMA_COLORS = {
  iFood:    { bg: '#FFF0F1', text: '#EA1D2C', border: '#EA1D2C' },
  '99Food': { bg: '#FFFBEB', text: '#B45309', border: '#FFD700' },
  Keeta:    { bg: '#EDFBF3', text: '#00B14F', border: '#00B14F' },
}

const EMPTY_FORM = {
  nome: '', organizacaoId: '', telefone: '', email: '',
  status: 'Ativo', dataInicio: '', observacoes: '',
}

const EMPTY_CONTRATO_FORM = {
  tipoPagamento: 'mensal', lojasContrato: [{ ...EMPTY_LOJA_CONTRATO_ITEM }], dataInicio: '', observacoes: '',
}

const STATUS_CONTRATO_LABEL = { ativo: 'Ativo', futuro: 'Futuro', encerrado: 'Encerrado' }

const EMPTY_LOJA_FORM = {
  nome: '', gestorId: '', plataformas: [],
  status: 'Ativa', observacoes: '', entrarOnboard: true,
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
  if (n == null || n === '') return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

function hojeDateInput() {
  return new Date().toISOString().split('T')[0]
}

// Calcula o status "real" do contrato a partir das datas — a coleção guarda um
// campo `status` como cache pra facilitar consultas, mas quem manda são as datas
// (evita depender de Cloud Function agendada só pra ativar contrato futuro).
function statusEfetivoContrato(contrato, agora = new Date()) {
  const inicio = contrato.dataInicio?.toDate ? contrato.dataInicio.toDate() : null
  const fim    = contrato.dataFim?.toDate    ? contrato.dataFim.toDate()    : null
  if (fim && fim <= agora) return 'encerrado'
  if (inicio && inicio > agora) return 'futuro'
  return 'ativo'
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

// ─── PlataformaPills ──────────────────────────────────────────────────────────

function PlataformaPills({ value, onChange }) {
  function toggle(p) {
    onChange(value.includes(p) ? value.filter(v => v !== p) : [...value, p])
  }
  return (
    <div className="flex gap-2">
      {PLATAFORMAS_LOJA.map(p => {
        const active = value.includes(p)
        const colors = PLATAFORMA_COLORS[p]
        return (
          <button
            key={p}
            type="button"
            onClick={() => toggle(p)}
            style={{
              flex: 1, height: '36px', borderRadius: '6px', fontSize: '13px',
              fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 150ms',
              backgroundColor: active ? colors.bg   : '#FFFFFF',
              color:           active ? colors.text : '#888888',
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

// ─── Modal de cliente ─────────────────────────────────────────────────────────

function ClienteModal({ isOpen, onClose, onSave, cliente, gestores, lojas, lojasDoCliente, organizacoes, isSuperAdmin, contratos, onCriarContrato }) {
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)
  const [removidasIds, setRemovidasIds] = useState([])
  const [novasLojas,  setNovasLojas]  = useState([])
  const [subFormOpen, setSubFormOpen] = useState(false)
  const [subForm,     setSubForm]     = useState(EMPTY_LOJA_FORM)
  const [vincularOpen,   setVincularOpen]   = useState(false)
  const [lojaVincularId, setLojaVincularId] = useState('')
  const [vinculadas,     setVinculadas]     = useState([])

  const [contratoFormOpen, setContratoFormOpen] = useState(false)
  const [contratoForm,     setContratoForm]     = useState(EMPTY_CONTRATO_FORM)
  const [salvandoContrato, setSalvandoContrato] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setForm(cliente ? {
      nome:          cliente.nome          ?? '',
      organizacaoId: cliente.organizacaoId ?? '',
      telefone:      cliente.telefone      ?? '',
      email:         cliente.email         ?? '',
      status:        cliente.status        ?? 'Ativo',
      dataInicio:    tsToDateInput(cliente.dataInicio),
      observacoes:   cliente.observacoes   ?? '',
    } : {
      ...EMPTY_FORM,
      // admin_org só enxerga a própria organização (única opção na lista) —
      // novo cliente já nasce vinculado a ela, sem precisar escolher.
      organizacaoId: !isSuperAdmin ? (organizacoes[0]?.id ?? '') : '',
    })
    setRemovidasIds([])
    setNovasLojas([])
    setSubFormOpen(false)
    setSubForm(EMPTY_LOJA_FORM)
    setVincularOpen(false)
    setLojaVincularId('')
    setVinculadas([])
    setContratoFormOpen(false)
    setContratoForm({ ...EMPTY_CONTRATO_FORM, lojasContrato: [{ ...EMPTY_LOJA_CONTRATO_ITEM }] })
  }, [isOpen, cliente, isSuperAdmin, organizacoes])

  function set(key, value) { setForm(prev => ({ ...prev, [key]: value })) }
  function setSub(key, value) { setSubForm(prev => ({ ...prev, [key]: value })) }
  function setContratoField(key, value) { setContratoForm(prev => ({ ...prev, [key]: value })) }

  async function handleCriarContratoSubmit(e) {
    e.preventDefault()
    if (salvandoContrato || !onCriarContrato) return
    setSalvandoContrato(true)
    try {
      await onCriarContrato(contratoForm)
      setContratoForm({ ...EMPTY_CONTRATO_FORM, lojasContrato: [{ ...EMPTY_LOJA_CONTRATO_ITEM }] })
      setContratoFormOpen(false)
    } finally {
      setSalvandoContrato(false)
    }
  }

  const canSaveContrato = contratoForm.lojasContrato.length > 0 && contratoForm.lojasContrato.every(item =>
    item.nome.trim().length > 0 && item.valor !== '' && !isNaN(parseFloat(String(item.valor).replace(',', '.')))
  ) && contratoForm.dataInicio

  function adicionarLoja() {
    if (!subForm.nome.trim() || !subForm.plataformas.length || !subForm.status) return
    setNovasLojas(prev => [...prev, { ...subForm }])
    setSubForm(EMPTY_LOJA_FORM)
    setSubFormOpen(false)
  }

  function confirmarVinculo() {
    const loja = (lojas ?? []).find(l => l.id === lojaVincularId)
    if (!loja) return
    setVinculadas(prev => [...prev, loja])
    setLojaVincularId('')
    setVincularOpen(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await onSave(form, cliente, { novasLojas, removidasIds, vinculadas })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const canSave    = form.nome.trim() && form.organizacaoId && form.status
  const canAddLoja = subForm.nome.trim() && subForm.plataformas.length > 0 && subForm.status

  // Lojas disponíveis pra vincular: sem cliente e ainda não escolhidas nesta sessão do modal
  const lojasSemCliente = useMemo(
    () => (lojas ?? []).filter(l => !l.clienteId && !vinculadas.some(v => v.id === l.id)),
    [lojas, vinculadas]
  )

  const lojasVisiveis = [
    ...(lojasDoCliente ?? [])
      .filter(l => !removidasIds.includes(l.id))
      .map(l => ({ ...l, _pending: false })),
    ...novasLojas.map((l, i) => ({ ...l, _tempIdx: i, _pending: true, _novo: true })),
    ...vinculadas.map(l => ({ ...l, _pending: true, _vinculo: true })),
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={cliente ? 'Editar cliente' : 'Novo cliente'}
      width="max-w-2xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button
            form="cliente-form"
            type="submit"
            disabled={!canSave || saving}
            className="btn-primary"
          >
            {saving ? 'Salvando…' : cliente ? 'Salvar alterações' : 'Criar cliente'}
          </button>
        </>
      }
    >
      <form id="cliente-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {/* Organização — só master escolhe; admin_org/gestor têm a própria preenchida automaticamente */}
        {isSuperAdmin && (
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="c-org">Organização</label>
            <select
              id="c-org"
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

        {/* ── Dados do cliente ── */}
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="c-nome">Nome</label>
          <input
            id="c-nome" type="text" value={form.nome}
            onChange={e => set('nome', e.target.value)}
            placeholder="Nome do cliente ou empresa"
            className="input" required autoFocus
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="c-tel">Telefone</label>
            <input id="c-tel" type="tel" value={form.telefone}
              onChange={e => set('telefone', e.target.value)}
              placeholder="(11) 99999-9999" className="input" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="c-email">E-mail</label>
            <input id="c-email" type="email" value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="contato@empresa.com" className="input" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="c-status">Status</label>
            <select id="c-status" value={form.status}
              onChange={e => set('status', e.target.value)} className="select">
              {STATUS_CLIENTES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="c-data">Início do contrato</label>
            <input id="c-data" type="date" value={form.dataInicio}
              onChange={e => set('dataInicio', e.target.value)} className="input" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="c-obs">Observações</label>
          <textarea id="c-obs" value={form.observacoes}
            onChange={e => set('observacoes', e.target.value)}
            placeholder="Notas sobre o contrato, particularidades…"
            rows={3} className="textarea" />
        </div>

        {/* ── Seção Contratos (só na edição — precisa do cliente já existir) ── */}
        {cliente && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <p className="section-label">Contratos</p>
              {!contratoFormOpen && (
                <button
                  type="button"
                  onClick={() => setContratoFormOpen(true)}
                  className="text-[12px] text-accent hover:opacity-75 transition-opacity duration-150"
                >
                  + Novo contrato
                </button>
              )}
            </div>

            {contratoFormOpen && (
              <div className="flex flex-col gap-3 p-3 mb-3 border border-border-hover rounded-lg bg-[#FAFAFA]">
                <LojasContratoBuilder
                  itens={contratoForm.lojasContrato}
                  onChange={v => setContratoField('lojasContrato', v)}
                  gestores={gestores}
                />
                <div className="flex flex-col gap-1.5">
                  <label className="field-label" htmlFor="ct-tipo">Tipo de pagamento</label>
                  <select
                    id="ct-tipo"
                    value={contratoForm.tipoPagamento}
                    onChange={e => setContratoField('tipoPagamento', e.target.value)}
                    className="select w-40"
                    style={{ height: '32px', fontSize: '12px' }}
                  >
                    <option value="mensal">Mensal</option>
                    <option value="semanal">Semanal</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="field-label" htmlFor="ct-data">Início do contrato</label>
                  <input
                    id="ct-data" type="date"
                    value={contratoForm.dataInicio || hojeDateInput()}
                    onChange={e => setContratoField('dataInicio', e.target.value)}
                    className="input"
                    style={{ height: '32px', fontSize: '12px' }}
                  />
                  <span className="text-[11px] text-text-subtle leading-snug">
                    Data de hoje ou passada ativa o contrato na hora (encerrando o contrato ativo atual, se houver). Data futura cria como "futuro" — vira ativo automaticamente ao chegar a data.
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="field-label" htmlFor="ct-obs">Observações</label>
                  <textarea
                    id="ct-obs" value={contratoForm.observacoes}
                    onChange={e => setContratoField('observacoes', e.target.value)}
                    placeholder="Notas sobre este contrato…"
                    rows={2} className="textarea"
                    style={{ fontSize: '12px' }}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => { setContratoFormOpen(false); setContratoForm({ ...EMPTY_CONTRATO_FORM, lojasContrato: [{ ...EMPTY_LOJA_CONTRATO_ITEM }] }) }} className="btn-secondary" style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}>
                    Cancelar
                  </button>
                  <button type="button" onClick={handleCriarContratoSubmit} disabled={!canSaveContrato || salvandoContrato} className="btn-primary" style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}>
                    {salvandoContrato ? 'Salvando…' : 'Criar contrato'}
                  </button>
                </div>
              </div>
            )}

            {(contratos ?? []).length === 0 ? (
              <p className="text-[13px] text-text-subtle py-2">Nenhum contrato cadastrado.</p>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                {[...contratos]
                  .sort((a, b) => (b.dataInicio?.toMillis?.() ?? 0) - (a.dataInicio?.toMillis?.() ?? 0))
                  .map(c => (
                    <div key={c.id} className="flex items-center justify-between px-3 h-11 border-b border-border-subtle last:border-0" title={(c.itensLojas ?? []).map(i => `${i.lojaNome}: ${formatBRL(i.valor)}`).join(' · ')}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[13px] text-text-primary font-medium">{formatBRL(c.valorTotal)}</span>
                        <span className="text-[11px] text-text-subtle uppercase tracking-[0.04em]">
                          {c.tipoPagamento === 'semanal' ? 'Semanal' : 'Mensal'}
                        </span>
                        <span className="text-[11px] text-text-subtle">
                          {(c.itensLojas ?? []).length} loja{(c.itensLojas ?? []).length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[12px] text-text-subtle font-mono">
                          {formatDate(c.dataInicio)}{c.dataFim ? ` – ${formatDate(c.dataFim)}` : ''}
                        </span>
                        <span
                          className="text-[10px] font-medium uppercase tracking-[0.04em]"
                          style={{
                            padding: '1px 6px', borderRadius: '4px',
                            color: c.status === 'ativo' ? '#16A34A' : c.status === 'futuro' ? '#CA8A04' : '#999999',
                            backgroundColor: c.status === 'ativo' ? 'rgba(22,163,74,0.1)' : c.status === 'futuro' ? 'rgba(202,138,4,0.1)' : 'rgba(153,153,153,0.1)',
                          }}
                        >
                          {STATUS_CONTRATO_LABEL[c.status] ?? c.status}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ── Seção Lojas ── */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <p className="section-label">Lojas</p>
            {lojasVisiveis.length > 0 && (
              <span className="text-[12px] text-text-subtle">
                {lojasVisiveis.length} loja{lojasVisiveis.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Lista de lojas */}
          {lojasVisiveis.length > 0 && (
            <div className="flex flex-col gap-1 mb-3">
              {lojasVisiveis.map((l, i) => (
                <div
                  key={l._vinculo ? `vinc-${l.id}` : l._pending ? `new-${l._tempIdx}` : l.id}
                  className="flex items-center gap-3 px-3 h-10 border border-border rounded-md hover:border-border-hover transition-colors duration-150"
                >
                  <span className="flex-1 text-[13px] text-text-primary font-medium truncate">
                    {l.nome}
                  </span>
                  {(l.plataformas?.length ? l.plataformas : l.plataforma ? [l.plataforma] : []).length > 0 && (
                    <span className="text-[11px] text-text-subtle shrink-0">
                      {(l.plataformas?.length ? l.plataformas : [l.plataforma]).join(', ')}
                    </span>
                  )}
                  {l._pending && (
                    <span className="text-[10px] text-text-subtle uppercase tracking-wide shrink-0 border border-border px-1.5 py-0.5 rounded">
                      {l._vinculo ? 'vincular' : 'novo'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (l._vinculo) {
                        setVinculadas(prev => prev.filter(v => v.id !== l.id))
                      } else if (l._pending) {
                        setNovasLojas(prev => prev.filter((_, idx) => idx !== l._tempIdx))
                      } else {
                        setRemovidasIds(prev => [...prev, l.id])
                      }
                    }}
                    className="text-text-subtle hover:text-negative transition-colors duration-150 shrink-0 p-1 rounded hover:bg-black/[0.04]"
                  >
                    <X size={13} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Botões adicionar */}
          {!subFormOpen && !vincularOpen && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSubFormOpen(true)}
                className="btn-secondary flex items-center gap-2 h-8 text-[13px] px-3"
              >
                <Plus size={13} strokeWidth={2} />
                Adicionar loja nova
              </button>
              <button
                type="button"
                onClick={() => setVincularOpen(true)}
                className="btn-secondary flex items-center gap-2 h-8 text-[13px] px-3"
              >
                <Link2 size={13} strokeWidth={2} />
                Vincular loja existente
              </button>
            </div>
          )}

          {/* Vincular loja existente */}
          {vincularOpen && (
            <div className="border border-[#E8E8E8] rounded-lg p-4 flex flex-col gap-3 mt-1">
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
                <button
                  type="button"
                  onClick={() => { setVincularOpen(false); setLojaVincularId('') }}
                  className="btn-secondary h-8 px-3 text-[13px]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarVinculo}
                  disabled={!lojaVincularId}
                  className="btn-primary h-8 px-3 text-[13px] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Vincular
                </button>
              </div>
            </div>
          )}

          {/* Subformulário inline */}
          {subFormOpen && (
            <div className="border border-[#E8E8E8] rounded-lg p-4 flex flex-col gap-3 mt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="field-label">Nome da loja</label>
                  <input
                    type="text"
                    value={subForm.nome}
                    onChange={e => setSub('nome', e.target.value)}
                    placeholder="Ex: Burguer King Centro"
                    className="input"
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="field-label">Gestor responsável</label>
                  <select
                    value={subForm.gestorId}
                    onChange={e => setSub('gestorId', e.target.value)}
                    className="select"
                  >
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
                <select
                  value={subForm.status}
                  onChange={e => setSub('status', e.target.value)}
                  className="select"
                >
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

              <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={subForm.entrarOnboard}
                  onChange={e => setSub('entrarOnboard', e.target.checked)}
                  style={{ accentColor: '#FF4B2E' }}
                />
                <span style={{ fontSize: '13px', color: '#111111' }}>Adicionar essa loja ao fluxo de Onboard</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setSubFormOpen(false); setSubForm(EMPTY_LOJA_FORM) }}
                  className="btn-secondary h-8 px-3 text-[13px]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={adicionarLoja}
                  disabled={!canAddLoja}
                  className="btn-primary h-8 px-3 text-[13px] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Adicionar
                </button>
              </div>
            </div>
          )}
        </div>

      </form>
    </Modal>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Clientes() {
  const toast = useToast()
  const { user, isSuperAdmin } = useAuth()
  const { modoTesteAtivo, organizacaoIdsPermitidos } = useModoTeste()

  const [clientes,     setClientes]     = useState([])
  const [lojas,        setLojas]        = useState([])
  const [gestores,     setGestores]     = useState([])
  const [organizacoes, setOrganizacoes] = useState([])
  const [contratos,    setContratos]    = useState([])
  const [loading,  setLoading]  = useState(true)

  const [search,       setSearch]       = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  const [modalOpen,      setModalOpen]      = useState(false)
  const [editingCliente, setEditingCliente] = useState(null)
  const [deletingCliente, setDeletingCliente] = useState(null)

  // ─── Load data ──────────────────────────────────────────────────────────────

  async function loadAll() {
    setLoading(true)
    try {
      // master enxerga tudo (sem filtro); admin_org só a própria
      // organização — sem esse filtro a consulta nem passa pelas regras
      // do Firestore pra quem não é master.
      const orgId = user?.organizacaoId ?? null
      const escopo = modoTesteAtivo
        ? [where('organizacaoId', 'in', organizacaoIdsPermitidos.slice(0, 10))]
        : isSuperAdmin ? [] : [where('organizacaoId', '==', orgId)]

      // Contas usam o campo `role` — nenhuma conta atual tem o `perfil` legado.
      // Antes, o branch de master buscava por `perfil` e nunca achava ninguém.
      const gestoresQuery = isSuperAdmin
        ? query(collection(db, COLLECTIONS.USERS), where('role', '==', 'gestor'))
        : query(collection(db, COLLECTIONS.USERS), where('organizacaoId', '==', orgId), where('role', '==', 'gestor'))

      const [clientesSnap, lojasSnap, gestoresSnap, contratosSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.CLIENTES), ...escopo)),
        getDocs(query(collection(db, COLLECTIONS.LOJAS), ...escopo)),
        getDocs(gestoresQuery),
        getDocs(query(collection(db, COLLECTIONS.CONTRATOS), ...escopo)),
      ])
      const raw = clientesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setClientes(raw.sort((a, b) => a.nome?.localeCompare(b.nome ?? '') ?? 0))
      setLojas(lojasSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setGestores(gestoresSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setContratos(contratosSnap.docs.map(d => ({ id: d.id, ...d.data() })))

      if (isSuperAdmin) {
        const orgsSnap = await getDocs(collection(db, COLLECTIONS.ORGANIZACOES))
        setOrganizacoes(orgsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } else if (orgId) {
        const orgSnap = await getDoc(doc(db, COLLECTIONS.ORGANIZACOES, orgId))
        setOrganizacoes(orgSnap.exists() ? [{ id: orgSnap.id, ...orgSnap.data() }] : [])
      }
    } catch (err) {
      console.error('[Clientes] loadAll:', err)
      toast('Erro ao carregar dados: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-ativação de contratos futuros: se a dataInicio de um contrato "futuro"
  // já passou, ele vira "ativo" e o contrato "ativo" anterior (se houver) é
  // encerrado — calculado no client a cada carregamento, sem depender de
  // Cloud Function agendada.
  useEffect(() => {
    if (!contratos.length) return
    const agora = new Date()
    const porCliente = {}
    contratos.forEach(c => {
      (porCliente[c.clienteId] ??= []).push(c)
    })
    Object.values(porCliente).forEach(async (lista) => {
      const paraAtivar = lista.find(c => c.status === 'futuro' && statusEfetivoContrato(c, agora) === 'ativo')
      if (!paraAtivar) return
      const ativoAnterior = lista.find(c => c.status === 'ativo' && c.id !== paraAtivar.id)
      try {
        if (ativoAnterior) {
          await updateDoc(doc(db, COLLECTIONS.CONTRATOS, ativoAnterior.id), {
            status: 'encerrado',
            dataFim: paraAtivar.dataInicio,
          })
        }
        await updateDoc(doc(db, COLLECTIONS.CONTRATOS, paraAtivar.id), { status: 'ativo' })
        await loadAll()
      } catch (err) {
        console.error('[Clientes] auto-ativação de contrato:', err)
      }
    })
  }, [contratos]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Derived data ───────────────────────────────────────────────────────────

  const lojasCountMap = useMemo(() => {
    const map = {}
    lojas.forEach(l => {
      if (l.clienteId) map[l.clienteId] = (map[l.clienteId] ?? 0) + 1
    })
    return map
  }, [lojas])

  const contratoAtivoMap = useMemo(() => {
    const map = {}
    contratos.forEach(c => {
      if (c.status === 'ativo') map[c.clienteId] = c
    })
    return map
  }, [contratos])

  const clientesFiltrados = useMemo(() => {
    const term = search.toLowerCase()
    return clientes.filter(c => {
      const matchNome   = c.nome?.toLowerCase().includes(term) || c.email?.toLowerCase().includes(term)
      const matchStatus = !filtroStatus || c.status === filtroStatus
      return matchNome && matchStatus
    })
  }, [clientes, search, filtroStatus])

  // ─── Contratos ──────────────────────────────────────────────────────────────

  async function handleCriarContrato(cliente, form) {
    const orgId = cliente.organizacaoId ?? (isSuperAdmin ? null : user?.organizacaoId ?? null)
    const dataInicioDate = form.dataInicio ? parseLocalDate(form.dataInicio) : new Date()
    const agora = new Date()
    const imediato = dataInicioDate <= agora

    // Cada linha de "lojas do contrato" vira uma loja nova vinculada a este
    // cliente — o valor de cada uma vai pro item do contrato, e a soma é o
    // valorTotal (não existe mais um valor único pro contrato inteiro). Cada
    // loja usa sua própria data de início (definida no builder); só cai pra
    // data do contrato se o campo da loja ficar em branco.
    const itensLojas = []
    for (const item of form.lojasContrato) {
      const dataInicioLoja = item.dataInicio ? parseLocalDate(item.dataInicio) : dataInicioDate
      const lojaRef = await criarComRateLimit(COLLECTIONS.LOJAS, {
        nome:          item.nome.trim(),
        organizacaoId: orgId,
        clienteId:     cliente.id,
        gestorId:      item.gestorId || null,
        plataformas:   item.plataformas,
        plataforma:    item.plataformas[0] ?? '',
        status:        item.status,
        dataInicio:    Timestamp.fromDate(dataInicioLoja),
        observacoes:   '',
        ...(item.entrarOnboard ? { onboardStatus: 'dados_pendentes' } : {}),
        criadoEm:      serverTimestamp(),
      })
      const valorLoja = parseFloat(String(item.valor).replace(',', '.'))
      itensLojas.push({ lojaId: lojaRef.id, lojaNome: item.nome.trim(), valor: isNaN(valorLoja) ? 0 : valorLoja })
    }
    const valorTotal = somaValorLojas(form.lojasContrato)

    const contratosDoCliente = contratos.filter(c => c.clienteId === cliente.id)
    const ativoAtual = contratosDoCliente.find(c => c.status === 'ativo')

    if (imediato && ativoAtual) {
      await updateDoc(doc(db, COLLECTIONS.CONTRATOS, ativoAtual.id), {
        status: 'encerrado',
        dataFim: Timestamp.fromDate(dataInicioDate),
      })
    }

    await criarComRateLimit(COLLECTIONS.CONTRATOS, {
      organizacaoId: orgId,
      clienteId: cliente.id,
      tipoPagamento: form.tipoPagamento,
      itensLojas,
      valorTotal,
      dataInicio: Timestamp.fromDate(dataInicioDate),
      dataFim: null,
      status: imediato ? 'ativo' : 'futuro',
      observacoes: form.observacoes.trim() || null,
      dataCriacao: serverTimestamp(),
    })

    toast(imediato ? 'Contrato criado e ativado.' : 'Contrato futuro criado.', 'success')
    await loadAll()
  }

  // ─── Save ───────────────────────────────────────────────────────────────────

  async function handleSave(form, original, lojaOps = {}) {
    const { novasLojas = [], removidasIds = [], vinculadas = [] } = lojaOps

    const payload = {
      nome:          form.nome.trim(),
      organizacaoId: form.organizacaoId,
      telefone:    form.telefone.trim(),
      email:       form.email.trim().toLowerCase(),
      status:      form.status,
      dataInicio:  form.dataInicio ? Timestamp.fromDate(parseLocalDate(form.dataInicio)) : null,
      observacoes: form.observacoes.trim(),
    }

    // Registra data de inativação quando muda de Ativo → Inativo
    if (original && original.status === 'Ativo' && form.status === 'Inativo') {
      payload.dataInativacao = serverTimestamp()
    }

    let clienteId
    if (original) {
      await updateDoc(doc(db, COLLECTIONS.CLIENTES, original.id), payload)
      clienteId = original.id
      toast('Cliente atualizado.', 'success')
    } else {
      const ref = await criarComRateLimit(COLLECTIONS.CLIENTES, { ...payload, criadoEm: serverTimestamp() })
      clienteId = ref.id
      toast('Cliente criado.', 'success')
    }

    // Salva novas lojas vinculadas
    const ops = []
    novasLojas.forEach(l => {
      ops.push(criarComRateLimit(COLLECTIONS.LOJAS, {
        nome:          l.nome.trim(),
        organizacaoId: payload.organizacaoId,
        clienteId,
        clienteNome:   payload.nome,
        gestorId:    l.gestorId || null,
        plataforma:  l.plataformas[0] ?? '',
        plataformas: l.plataformas,
        status:      l.status,
        dataInicio:  payload.dataInicio,
        observacoes: l.observacoes.trim(),
        ...(l.entrarOnboard ? { onboardStatus: 'dados_pendentes' } : {}),
        criadoEm:    serverTimestamp(),
      }))
    })
    // Desvincula lojas removidas
    removidasIds.forEach(id => {
      ops.push(updateDoc(doc(db, COLLECTIONS.LOJAS, id), { clienteId: null, clienteNome: null }))
    })
    // Vincula lojas existentes selecionadas
    vinculadas.forEach(l => {
      ops.push(updateDoc(doc(db, COLLECTIONS.LOJAS, l.id), { clienteId, clienteNome: payload.nome }))
    })
    // Cliente renomeado: refaz o cache de clienteNome nas lojas já vinculadas
    // que não foram tocadas acima (senão ficam com o nome antigo até alguém
    // reabrir e resalvar aquela loja especificamente).
    if (original && original.nome !== payload.nome) {
      const idsJaTratados = new Set([...vinculadas.map(l => l.id), ...removidasIds])
      lojas
        .filter(l => l.clienteId === clienteId && !idsJaTratados.has(l.id))
        .forEach(l => {
          ops.push(updateDoc(doc(db, COLLECTIONS.LOJAS, l.id), { clienteNome: payload.nome }))
        })
    }
    if (ops.length) await Promise.all(ops)

    await loadAll()
  }

  async function handleDeleteCliente() {
    if (!deletingCliente) return
    const temContratos = contratos.some(c => c.clienteId === deletingCliente.id)
    const temLojas = lojas.some(l => l.clienteId === deletingCliente.id)
    if (temContratos || temLojas) {
      toast('Esse cliente tem contratos ou lojas vinculados — desvincule ou exclua-os antes de excluir o cliente.', 'error')
      setDeletingCliente(null)
      return
    }
    try {
      await deleteDoc(doc(db, COLLECTIONS.CLIENTES, deletingCliente.id))
      setClientes(prev => prev.filter(c => c.id !== deletingCliente.id))
      toast('Cliente excluído.', 'success')
      setDeletingCliente(null)
    } catch (err) {
      console.error('[Clientes] handleDeleteCliente:', err)
      if (err.code === 'permission-denied') {
        toast('Sem permissão para excluir este cliente.', 'error')
      } else {
        toast('Erro ao excluir cliente: ' + err.message, 'error')
      }
    }
  }


  function openNew() {
    setEditingCliente(null)
    setModalOpen(true)
  }

  function openEdit(cliente) {
    setEditingCliente(cliente)
    setModalOpen(true)
  }

  // ─── Status counters ────────────────────────────────────────────────────────

  const counts = useMemo(() => ({
    ativo:   clientes.filter(c => c.status === 'Ativo').length,
    inativo: clientes.filter(c => c.status === 'Inativo').length,
  }), [clientes])

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
        <h1 className="page-title" style={{ marginBottom: 0 }}>Clientes</h1>
        <button onClick={openNew} className="btn-primary flex items-center justify-center gap-2 h-11 sm:h-9">
          <Plus size={15} strokeWidth={2} />
          Novo cliente
        </button>
      </div>

      {/* KPI rápido */}
      {!loading && clientes.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                { label: 'Ativos',   value: counts.ativo,   color: 'text-positive'    },
                { label: 'Inativos', value: counts.inativo, color: 'text-text-subtle' },
              ].map(({ label, value, color }) => (
                <div key={label} className="card-kpi flex items-center justify-between">
                  <span className="section-label">{label}</span>
                  <span className={`font-mono text-[22px] font-medium ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Filtros */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-5">
            <div className="relative flex-1 sm:max-w-xs">
              <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por nome ou e-mail…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-9 h-11 sm:h-9"
              />
            </div>

            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="select w-full sm:w-44 h-11 sm:h-9">
              <option value="">Todos os status</option>
              {STATUS_CLIENTES.map(s => <option key={s} value={s}>{s}</option>)}
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
              <Skeleton.Table rows={8} cols={6} />
            ) : clientesFiltrados.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-[13px] text-text-subtle">
                  {clientes.length === 0 ? 'Nenhum cliente cadastrado.' : 'Nenhum cliente encontrado.'}
                </p>
              </div>
            ) : (
              <>
              {/* Desktop: tabela */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F9F9F9] border-b border-border">
                      {['Nome', 'E-mail', 'Telefone', 'Status', 'Contrato ativo', 'Início', 'Lojas', ''].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left section-label font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <motion.tbody variants={listVariants} initial="initial" animate="animate">
                    {clientesFiltrados.map(cliente => (
                      <motion.tr key={cliente.id} variants={itemVariants} className="table-row-base">
                        <td className="px-4 h-12 text-[14px] text-text-primary font-medium max-w-[200px]">
                          <span className="block truncate">{cliente.nome}</span>
                        </td>
                        <td className="px-4 h-12 text-[14px] text-text-muted max-w-[180px]">
                          <span className="block truncate">{cliente.email || '—'}</span>
                        </td>
                        <td className="px-4 h-12 text-[14px] text-text-muted whitespace-nowrap">
                          {cliente.telefone || '—'}
                        </td>
                        <td className="px-4 h-12">
                          <Badge status={cliente.status?.toLowerCase()} label={cliente.status} />
                        </td>
                        <td className="px-4 h-12 font-mono text-[13px] text-text-muted whitespace-nowrap">
                          {formatBRL(contratoAtivoMap[cliente.id]?.valorTotal)}
                        </td>
                        <td className="px-4 h-12 font-mono text-[13px] text-text-muted whitespace-nowrap">
                          {formatDate(cliente.dataInicio)}
                        </td>
                        <td className="px-4 h-12 text-[13px] text-text-muted text-center">
                          {lojasCountMap[cliente.id] ?? 0}
                        </td>
                        <td className="px-4 h-12 text-right whitespace-nowrap">
                          <button
                            onClick={() => openEdit(cliente)}
                            className="inline-flex items-center gap-1.5 text-[12px] text-text-subtle hover:text-text-primary transition-colors duration-150 px-2 py-1 rounded hover:bg-black/[0.04]"
                          >
                            <Pencil size={13} strokeWidth={1.5} />
                            Editar
                          </button>
                          <button
                            onClick={() => setDeletingCliente(cliente)}
                            className="inline-flex items-center gap-1.5 text-[12px] text-text-subtle hover:text-negative transition-colors duration-150 px-2 py-1 rounded hover:bg-black/[0.04]"
                          >
                            <Trash2 size={13} strokeWidth={1.5} />
                            Excluir
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </motion.tbody>
                </table>
              </div>

              {/* Mobile: cards */}
              <motion.div className="sm:hidden flex flex-col" variants={listVariants} initial="initial" animate="animate">
                {clientesFiltrados.map(cliente => (
                  <motion.div
                    key={cliente.id}
                    variants={itemVariants}
                    className="p-4 border-b border-border-subtle last:border-0 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[14px] text-text-primary font-medium truncate">{cliente.nome}</span>
                      <Badge status={cliente.status?.toLowerCase()} label={cliente.status} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-muted">
                      <span>{cliente.email || '—'}</span>
                      <span>{cliente.telefone || '—'}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-text-subtle font-mono">
                      <span>Contrato: {formatBRL(contratoAtivoMap[cliente.id]?.valorTotal)}</span>
                      <span>Início: {formatDate(cliente.dataInicio)}</span>
                      <span>{lojasCountMap[cliente.id] ?? 0} loja{(lojasCountMap[cliente.id] ?? 0) !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => openEdit(cliente)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 text-[13px] text-text-primary border border-border rounded-md h-10"
                      >
                        <Pencil size={13} strokeWidth={1.5} />
                        Editar
                      </button>
                      <button
                        onClick={() => setDeletingCliente(cliente)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 text-[13px] text-negative border border-border rounded-md h-10"
                      >
                        <Trash2 size={13} strokeWidth={1.5} />
                        Excluir
                      </button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
              </>
            )}

            {!loading && clientes.length > 0 && (
              <div className="px-4 py-3 border-t border-border">
                <span className="text-[12px] text-text-subtle">
                  {clientesFiltrados.length} de {clientes.length} clientes
                </span>
              </div>
            )}
          </div>

      <ClienteModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        cliente={editingCliente}
        gestores={gestores}
        lojas={lojas}
        lojasDoCliente={editingCliente ? lojas.filter(l => l.clienteId === editingCliente.id) : []}
        organizacoes={organizacoes}
        isSuperAdmin={isSuperAdmin}
        contratos={editingCliente ? contratos.filter(c => c.clienteId === editingCliente.id) : []}
        onCriarContrato={form => handleCriarContrato(editingCliente, form)}
      />

      <ConfirmModal
        isOpen={!!deletingCliente}
        title="Excluir cliente"
        message={`Tem certeza que deseja excluir ${deletingCliente?.nome}? Esta ação não pode ser desfeita.`}
        onConfirm={handleDeleteCliente}
        onCancel={() => setDeletingCliente(null)}
      />
    </motion.div>
  )
}
