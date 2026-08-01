import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Plus, X, Phone, MessageSquare, Mail, Users as UsersIcon, FileText, Clock, Trash2 } from 'lucide-react'
import {
  db, COLLECTIONS,
  collection, doc, query, where, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, orderBy,
} from '../services/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/UI/Toast'
import Modal from '../components/UI/Modal'
import ConfirmModal from '../components/UI/ConfirmModal'
import Skeleton from '../components/UI/Skeleton'
import { parseLocalDate } from '../utils/format'

// ─── Constants ────────────────────────────────────────────────────────────────

const ESTAGIOS = [
  { key: 'novo_lead',           label: 'Novo Lead',            bg: '#EFF6FF', color: '#3B82F6' },
  { key: 'contato_feito',       label: 'Contato Feito',        bg: '#EEF2FF', color: '#6366F1' },
  { key: 'diagnostico_enviado', label: 'Diagnóstico Enviado',  bg: '#F5F3FF', color: '#8B5CF6' },
  { key: 'proposta_enviada',    label: 'Proposta Enviada',     bg: '#FFFBEB', color: '#F59E0B' },
  { key: 'negociacao',          label: 'Negociação',           bg: '#FFF7ED', color: '#EA580C' },
  { key: 'fechado_ganho',       label: 'Fechado — Ganho',      bg: '#ECFDF5', color: '#00C896' },
  { key: 'fechado_perdido',     label: 'Fechado — Perdido',    bg: '#FEF2F2', color: '#DC2626' },
]
const ESTAGIO_MAP = Object.fromEntries(ESTAGIOS.map(e => [e.key, e]))
const ESTAGIOS_FECHADOS = ['fechado_ganho', 'fechado_perdido']

const ORIGENS = [
  { value: 'indicacao',        label: 'Indicação'         },
  { value: 'instagram',        label: 'Instagram'         },
  { value: 'prospeccao_ativa', label: 'Prospecção Ativa'  },
  { value: 'trafego_pago',     label: 'Tráfego Pago'      },
  { value: 'outro',            label: 'Outro'             },
]
const ORIGEM_LABEL = Object.fromEntries(ORIGENS.map(o => [o.value, o.label]))

const MOTIVOS_PERDA = ['Preço', 'Concorrente', 'Sem retorno', 'Não é o momento', 'Outro']

const PLATAFORMAS_ALVO = ['ifood', '99food', 'keeta']
const PLATAFORMA_LABEL = { ifood: 'iFood', '99food': '99Food', keeta: 'Keeta' }

const TIPOS_INTERACAO = [
  { value: 'ligacao',  label: 'Ligação',  icon: Phone         },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'email',    label: 'E-mail',   icon: Mail          },
  { value: 'reuniao',  label: 'Reunião',  icon: UsersIcon     },
  { value: 'nota',     label: 'Nota',     icon: FileText      },
]
const TIPO_INTERACAO_MAP = Object.fromEntries(TIPOS_INTERACAO.map(t => [t.value, t]))

const EMPTY_LEAD_FORM = {
  nomeRestaurante: '', nomeContato: '', telefone: '', email: '',
  origem: 'indicacao', valorPotencialMensal: '', plataformasAlvo: [],
  responsavelId: '', tags: '',
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatBRL(n) {
  if (n == null) return null
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function parseMoney(str) {
  if (str === '' || str == null) return null
  const n = parseFloat(String(str).replace(',', '.'))
  return isNaN(n) ? null : n
}

function formatDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('pt-BR')
}

function formatDateTime(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

function tsToDateInput(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toISOString().split('T')[0]
}

function normalizarTelefone(s) {
  return (s ?? '').replace(/\D/g, '')
}

function proximaAcaoAtrasada(lead) {
  if (!lead.proximaAcao?.data) return false
  if (ESTAGIOS_FECHADOS.includes(lead.estagio)) return false
  const d = lead.proximaAcao.data.toDate ? lead.proximaAcao.data.toDate() : new Date(lead.proximaAcao.data)
  const hoje = new Date()
  d.setHours(0, 0, 0, 0)
  hoje.setHours(0, 0, 0, 0)
  return d < hoje
}

// ─── Animation variants ───────────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

// ─── PlataformasAlvoPills ─────────────────────────────────────────────────────

function PlataformasAlvoPills({ value, onChange }) {
  function toggle(p) {
    onChange(value.includes(p) ? value.filter(v => v !== p) : [...value, p])
  }
  return (
    <div className="flex gap-2">
      {PLATAFORMAS_ALVO.map(p => {
        const active = value.includes(p)
        return (
          <button
            key={p}
            type="button"
            onClick={() => toggle(p)}
            style={{
              flex: 1, height: '32px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
              cursor: 'pointer', transition: 'all 150ms',
              backgroundColor: active ? '#FFF1ED' : '#FFFFFF',
              color:           active ? '#FF4B2E' : '#999999',
              border: `1px solid ${active ? '#FF4B2E' : '#E8E8E8'}`,
            }}
          >
            {PLATAFORMA_LABEL[p]}
          </button>
        )
      })}
    </div>
  )
}

// ─── Modal: novo lead ─────────────────────────────────────────────────────────

function NovoLeadModal({ isOpen, onClose, onSave, isAdminOrg, responsaveis }) {
  const [form,   setForm]   = useState(EMPTY_LEAD_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setForm(EMPTY_LEAD_FORM)
  }, [isOpen])

  function set(key, value) { setForm(prev => ({ ...prev, [key]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const canSave = form.nomeRestaurante.trim() && (isAdminOrg ? form.responsavelId : true)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Novo lead"
      width="max-w-lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button form="lead-form" type="submit" disabled={!canSave || saving} className="btn-primary">
            {saving ? 'Criando…' : 'Criar lead'}
          </button>
        </>
      }
    >
      <form id="lead-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="ld-restaurante">Nome do restaurante</label>
          <input id="ld-restaurante" type="text" value={form.nomeRestaurante}
            onChange={e => set('nomeRestaurante', e.target.value)}
            placeholder="Ex: Burguer King Centro" className="input" required autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="ld-contato">Nome do contato</label>
            <input id="ld-contato" type="text" value={form.nomeContato}
              onChange={e => set('nomeContato', e.target.value)}
              placeholder="Nome do dono/gerente" className="input" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="ld-tel">Telefone</label>
            <input id="ld-tel" type="tel" value={form.telefone}
              onChange={e => set('telefone', e.target.value)}
              placeholder="(11) 99999-9999" className="input" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="ld-email">E-mail</label>
          <input id="ld-email" type="email" value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder="contato@restaurante.com" className="input" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="ld-origem">Origem</label>
            <select id="ld-origem" value={form.origem}
              onChange={e => set('origem', e.target.value)} className="select">
              {ORIGENS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="ld-valor">Valor potencial mensal (R$)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ fontSize: '12px', color: '#999999' }}>R$</span>
              <input id="ld-valor" type="number" min="0" step="0.01" placeholder="0,00"
                value={form.valorPotencialMensal} onChange={e => set('valorPotencialMensal', e.target.value)}
                className="input pl-9 font-mono" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="field-label">Plataformas-alvo</label>
          <PlataformasAlvoPills value={form.plataformasAlvo} onChange={v => set('plataformasAlvo', v)} />
        </div>

        {isAdminOrg && (
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="ld-resp">Responsável</label>
            <select id="ld-resp" value={form.responsavelId}
              onChange={e => set('responsavelId', e.target.value)} className="select" required>
              <option value="">Selecione</option>
              {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="ld-tags">Tags (separadas por vírgula)</label>
          <input id="ld-tags" type="text" value={form.tags}
            onChange={e => set('tags', e.target.value)}
            placeholder="Ex: urgente, zona sul" className="input" />
        </div>
      </form>
    </Modal>
  )
}

// ─── Modal: fechar lead como ganho ────────────────────────────────────────────

function FecharGanhoModal({ lead, onClose, onConfirm, clientesExistentes }) {
  const [saving, setSaving] = useState(false)
  const [vincularExistente, setVincularExistente] = useState(true)

  const match = useMemo(() => {
    if (!lead) return null
    return (clientesExistentes ?? []).find(c =>
      (lead.telefone && normalizarTelefone(c.telefone) === normalizarTelefone(lead.telefone) && normalizarTelefone(lead.telefone)) ||
      (lead.email && c.email && c.email.toLowerCase() === lead.email.toLowerCase())
    )
  }, [lead, clientesExistentes])

  useEffect(() => {
    setVincularExistente(true)
  }, [lead])

  async function handleConfirm() {
    if (saving) return
    setSaving(true)
    try {
      await onConfirm(lead, match && vincularExistente ? match.id : null)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={!!lead}
      onClose={onClose}
      title="Fechar negócio"
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
        Isso vai criar o cliente <strong>{lead?.nomeRestaurante}</strong> e vincular este lead a ele.
      </p>

      {match ? (
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '12px', color: '#92400E', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', padding: '10px 12px', lineHeight: 1.5 }}>
            Já existe um cliente com o mesmo telefone/e-mail: <strong>{match.nome}</strong>. Vincular a ele em vez de criar um novo?
          </p>
          <label className="flex items-center gap-2" style={{ fontSize: '13px', color: '#111111', cursor: 'pointer' }}>
            <input type="radio" checked={vincularExistente} onChange={() => setVincularExistente(true)} />
            Vincular ao cliente existente ({match.nome})
          </label>
          <label className="flex items-center gap-2" style={{ fontSize: '13px', color: '#111111', cursor: 'pointer' }}>
            <input type="radio" checked={!vincularExistente} onChange={() => setVincularExistente(false)} />
            Criar um novo cliente mesmo assim
          </label>
        </div>
      ) : (
        <p style={{ fontSize: '12px', color: '#666666', marginTop: '10px', lineHeight: 1.5 }}>
          Nenhum cliente existente com o mesmo telefone ou e-mail foi encontrado.
        </p>
      )}
    </Modal>
  )
}

// ─── Modal: fechar lead como perdido ──────────────────────────────────────────

function FecharPerdidoModal({ lead, onClose, onConfirm }) {
  const [motivo,      setMotivo]      = useState('')
  const [motivoOutro, setMotivoOutro] = useState('')
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    setMotivo('')
    setMotivoOutro('')
  }, [lead])

  async function handleConfirm() {
    const motivoFinal = motivo === 'Outro' ? motivoOutro.trim() : motivo
    if (!motivoFinal || saving) return
    setSaving(true)
    try {
      await onConfirm(lead, motivoFinal)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const canConfirm = motivo && (motivo !== 'Outro' || motivoOutro.trim())

  return (
    <Modal
      isOpen={!!lead}
      onClose={onClose}
      title="Marcar lead como perdido"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
          <button type="button" onClick={handleConfirm} className="btn-primary" disabled={!canConfirm || saving}>
            {saving ? 'Confirmando…' : 'Confirmar'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p style={{ fontSize: '13px', color: '#111111', lineHeight: 1.5 }}>
          Por que <strong>{lead?.nomeRestaurante}</strong> não fechou?
        </p>
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="motivo-perda">Motivo</label>
          <select id="motivo-perda" value={motivo} onChange={e => setMotivo(e.target.value)} className="select" autoFocus>
            <option value="">Selecione</option>
            {MOTIVOS_PERDA.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {motivo === 'Outro' && (
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="motivo-outro">Descreva o motivo</label>
            <input id="motivo-outro" type="text" value={motivoOutro}
              onChange={e => setMotivoOutro(e.target.value)} className="input" />
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Modal: detalhe do lead ───────────────────────────────────────────────────

function LeadDetailModal({ lead, onClose, responsavelNome, onSalvarProximaAcao, onRegistrarInteracao, onExcluir }) {
  const toast = useToast()
  const [interacoes,     setInteracoes]     = useState([])
  const [loadingInter,   setLoadingInter]   = useState(false)
  const [novoTipo,       setNovoTipo]       = useState('nota')
  const [novaDescricao,  setNovaDescricao]  = useState('')
  const [enviando,       setEnviando]       = useState(false)
  const [paDescricao,    setPaDescricao]    = useState('')
  const [paData,         setPaData]         = useState('')
  const [salvandoPa,     setSalvandoPa]     = useState(false)

  useEffect(() => {
    if (!lead) return
    setPaDescricao(lead.proximaAcao?.descricao ?? '')
    setPaData(tsToDateInput(lead.proximaAcao?.data))
    setNovoTipo('nota')
    setNovaDescricao('')
    carregarInteracoes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id])

  async function carregarInteracoes() {
    if (!lead) return
    setLoadingInter(true)
    try {
      const lista = await onRegistrarInteracao.carregar(lead.id)
      setInteracoes(lista)
    } finally {
      setLoadingInter(false)
    }
  }

  async function handleRegistrarInteracao() {
    if (!novaDescricao.trim() || enviando) return
    setEnviando(true)
    try {
      await onRegistrarInteracao.registrar(lead.id, novoTipo, novaDescricao)
      setNovaDescricao('')
      toast('Interação registrada.', 'success')
      await carregarInteracoes()
    } catch (err) {
      toast('Erro ao registrar interação: ' + err.message, 'error')
    } finally {
      setEnviando(false)
    }
  }

  async function handleSalvarProximaAcao() {
    setSalvandoPa(true)
    try {
      await onSalvarProximaAcao(lead.id, paDescricao, paData)
      toast('Próxima ação atualizada.', 'success')
    } catch (err) {
      toast('Erro ao salvar: ' + err.message, 'error')
    } finally {
      setSalvandoPa(false)
    }
  }

  if (!lead) return null

  const estagio = ESTAGIO_MAP[lead.estagio]

  return (
    <Modal
      isOpen={!!lead}
      onClose={onClose}
      title={lead.nomeRestaurante}
      width="max-w-2xl"
      footer={
        <>
          <button
            type="button"
            onClick={() => onExcluir(lead)}
            className="inline-flex items-center gap-1.5 text-[13px] text-negative hover:opacity-75 transition-opacity duration-150 px-2 py-1.5 rounded mr-auto"
          >
            <Trash2 size={14} strokeWidth={1.5} />
            Excluir lead
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">Fechar</button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Dados do lead */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <p className="section-label" style={{ marginBottom: '3px' }}>Estágio</p>
            <span style={{ fontSize: '12px', fontWeight: 600, color: estagio?.color, backgroundColor: estagio?.bg, padding: '2px 8px', borderRadius: '4px' }}>
              {estagio?.label}
            </span>
          </div>
          <div>
            <p className="section-label" style={{ marginBottom: '3px' }}>Contato</p>
            <p style={{ fontSize: '13px', color: '#111111' }}>{lead.nomeContato || '—'}</p>
          </div>
          <div>
            <p className="section-label" style={{ marginBottom: '3px' }}>Telefone</p>
            <p className="font-mono" style={{ fontSize: '13px', color: '#111111' }}>{lead.telefone || '—'}</p>
          </div>
          <div>
            <p className="section-label" style={{ marginBottom: '3px' }}>E-mail</p>
            <p style={{ fontSize: '13px', color: '#111111' }}>{lead.email || '—'}</p>
          </div>
          <div>
            <p className="section-label" style={{ marginBottom: '3px' }}>Origem</p>
            <p style={{ fontSize: '13px', color: '#111111' }}>{ORIGEM_LABEL[lead.origem] ?? lead.origem}</p>
          </div>
          <div>
            <p className="section-label" style={{ marginBottom: '3px' }}>Valor potencial</p>
            <p className="font-mono" style={{ fontSize: '13px', color: '#00C896', fontWeight: 600 }}>{formatBRL(lead.valorPotencialMensal) ?? '—'}</p>
          </div>
          <div>
            <p className="section-label" style={{ marginBottom: '3px' }}>Responsável</p>
            <p style={{ fontSize: '13px', color: '#111111' }}>{responsavelNome ?? '—'}</p>
          </div>
        </div>

        {lead.plataformasAlvo?.length > 0 && (
          <div className="flex gap-2">
            {lead.plataformasAlvo.map(p => (
              <span key={p} style={{ fontSize: '11px', fontWeight: 500, color: '#666666', border: '1px solid #E8E8E8', borderRadius: '4px', padding: '2px 8px' }}>
                {PLATAFORMA_LABEL[p] ?? p}
              </span>
            ))}
          </div>
        )}

        {lead.motivoPerda && (
          <p style={{ fontSize: '12px', color: '#DC2626', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '8px 12px' }}>
            Motivo da perda: {lead.motivoPerda}
          </p>
        )}

        {/* Próxima ação */}
        <div className="pt-3" style={{ borderTop: '1px solid #E8E8E8' }}>
          <p className="section-label" style={{ marginBottom: '10px' }}>Próxima ação</p>
          <div className="grid grid-cols-[1fr_160px_auto] gap-2 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="field-label">Descrição</label>
              <input type="text" value={paDescricao} onChange={e => setPaDescricao(e.target.value)}
                placeholder="Ex: Ligar de volta" className="input" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="field-label">Data</label>
              <input type="date" value={paData} onChange={e => setPaData(e.target.value)} className="input" />
            </div>
            <button type="button" onClick={handleSalvarProximaAcao} disabled={salvandoPa} className="btn-secondary h-9">
              {salvandoPa ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>

        {/* Registrar interação */}
        <div className="pt-3" style={{ borderTop: '1px solid #E8E8E8' }}>
          <p className="section-label" style={{ marginBottom: '10px' }}>Registrar interação</p>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <select value={novoTipo} onChange={e => setNovoTipo(e.target.value)} className="select">
                {TIPOS_INTERACAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input type="text" value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)}
                placeholder="O que foi conversado..." className="input" />
            </div>
            <button type="button" onClick={handleRegistrarInteracao} disabled={!novaDescricao.trim() || enviando}
              className="btn-primary h-8 self-start px-3 text-[13px]">
              {enviando ? 'Registrando…' : 'Registrar'}
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="pt-3" style={{ borderTop: '1px solid #E8E8E8' }}>
          <p className="section-label" style={{ marginBottom: '10px' }}>Histórico</p>
          {loadingInter ? (
            <Skeleton.Table rows={3} cols={1} />
          ) : interacoes.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#999999' }}>Nenhuma interação registrada ainda.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {interacoes.map(i => {
                const tipoInfo = TIPO_INTERACAO_MAP[i.tipo]
                const Icon = tipoInfo?.icon ?? Clock
                return (
                  <div key={i.id} className="flex gap-3">
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#F3F3F3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={13} strokeWidth={1.75} color="#666666" />
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', color: '#111111' }}>{i.descricao}</p>
                      <p style={{ fontSize: '11px', color: '#999999', marginTop: '2px' }}>
                        {tipoInfo?.label ?? i.tipo} · {formatDateTime(i.data)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─── Kanban card ──────────────────────────────────────────────────────────────

function LeadCard({ lead, responsavelNome, onClick }) {
  const atrasada = proximaAcaoAtrasada(lead)
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '8px',
        padding: '12px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#111111', lineHeight: 1.3 }}>{lead.nomeRestaurante}</p>
        {atrasada && (
          <span title="Próxima ação atrasada" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#DC2626', flexShrink: 0, marginTop: '4px' }} />
        )}
      </div>
      {lead.nomeContato && (
        <p style={{ fontSize: '12px', color: '#666666', marginTop: '2px' }}>{lead.nomeContato}</p>
      )}
      {lead.valorPotencialMensal != null && (
        <p className="font-mono" style={{ fontSize: '12px', color: '#00C896', fontWeight: 600, marginTop: '6px' }}>
          {formatBRL(lead.valorPotencialMensal)}/mês
        </p>
      )}
      <p style={{ fontSize: '11px', color: '#999999', marginTop: '6px' }}>{responsavelNome ?? 'Sem responsável'}</p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CRM() {
  const toast = useToast()
  const { user, isAdminOrg } = useAuth()

  const [leads,        setLeads]        = useState([])
  const [clientes,     setClientes]     = useState([])
  const [responsaveis, setResponsaveis] = useState([])
  const [loading,      setLoading]      = useState(true)

  const [filtroResponsavel, setFiltroResponsavel] = useState('')
  const [filtroOrigem,      setFiltroOrigem]      = useState('')

  const [novoLeadOpen, setNovoLeadOpen] = useState(false)
  const [detailLeadId, setDetailLeadId] = useState(null)
  const [ganhoLead,    setGanhoLead]    = useState(null)
  const [perdidoLead,  setPerdidoLead]  = useState(null)
  const [excluindoLead, setExcluindoLead] = useState(null)
  // Mobile: sem drag — abas por estágio, uma coluna por vez
  const [mobileEstagio, setMobileEstagio] = useState(ESTAGIOS[0].key)

  const orgId = user?.organizacaoId ?? null

  async function loadAll() {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    try {
      const leadsQuery = isAdminOrg
        ? query(collection(db, COLLECTIONS.CRM_LEADS), where('organizacaoId', '==', orgId))
        : query(collection(db, COLLECTIONS.CRM_LEADS), where('organizacaoId', '==', orgId), where('responsavelId', '==', user.uid))

      const [leadsSnap, clientesSnap, responsaveisSnap] = await Promise.all([
        getDocs(leadsQuery),
        getDocs(query(collection(db, COLLECTIONS.CLIENTES), where('organizacaoId', '==', orgId))),
        isAdminOrg
          ? getDocs(query(collection(db, COLLECTIONS.USERS), where('organizacaoId', '==', orgId), where('role', 'in', ['gestor', 'admin_org'])))
          : Promise.resolve(null),
      ])

      setLeads(leadsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setClientes(clientesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setResponsaveis(responsaveisSnap ? responsaveisSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [{ id: user.uid, nome: user.nome }])
    } catch (err) {
      console.error('[CRM] loadAll:', err)
      toast('Erro ao carregar leads: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (user) loadAll() }, [user, isAdminOrg]) // eslint-disable-line react-hooks/exhaustive-deps

  const responsavelMap = useMemo(() => Object.fromEntries(responsaveis.map(r => [r.id, r])), [responsaveis])

  const leadsFiltrados = useMemo(() => {
    return leads.filter(l => {
      const matchResp   = !filtroResponsavel || l.responsavelId === filtroResponsavel
      const matchOrigem = !filtroOrigem || l.origem === filtroOrigem
      return matchResp && matchOrigem
    })
  }, [leads, filtroResponsavel, filtroOrigem])

  const leadsPorEstagio = useMemo(() => {
    const map = Object.fromEntries(ESTAGIOS.map(e => [e.key, []]))
    leadsFiltrados.forEach(l => { if (map[l.estagio]) map[l.estagio].push(l) })
    return map
  }, [leadsFiltrados])

  // ─── Resumo ─────────────────────────────────────────────────────────────────

  const resumo = useMemo(() => {
    const abertos = leads.filter(l => !ESTAGIOS_FECHADOS.includes(l.estagio))
    const valorPotencialTotal = abertos.reduce((soma, l) => soma + (l.valorPotencialMensal ?? 0), 0)
    const ganhos = leads.filter(l => l.estagio === 'fechado_ganho').length
    const perdidos = leads.filter(l => l.estagio === 'fechado_perdido').length
    const totalFechados = ganhos + perdidos
    const taxaConversao = totalFechados > 0 ? (ganhos / totalFechados) * 100 : null
    const atrasados = leads.filter(proximaAcaoAtrasada).length
    return { totalAbertos: abertos.length, valorPotencialTotal, taxaConversao, atrasados }
  }, [leads])

  // ─── Save handlers ──────────────────────────────────────────────────────────

  async function handleCriarLead(form) {
    const payload = {
      organizacaoId:         orgId,
      clienteId:             null,
      nomeRestaurante:       form.nomeRestaurante.trim(),
      nomeContato:           form.nomeContato.trim(),
      telefone:              form.telefone.trim(),
      email:                 form.email.trim().toLowerCase(),
      origem:                form.origem,
      estagio:               'novo_lead',
      motivoPerda:           null,
      valorPotencialMensal:  parseMoney(form.valorPotencialMensal),
      plataformasAlvo:       form.plataformasAlvo,
      responsavelId:         isAdminOrg ? form.responsavelId : user.uid,
      tags:                  form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      proximaAcao:           null,
      dataCriacao:           serverTimestamp(),
      dataUltimaAtualizacao: serverTimestamp(),
    }
    await addDoc(collection(db, COLLECTIONS.CRM_LEADS), payload)
    toast('Lead criado.', 'success')
    await loadAll()
  }

  async function moverEstagio(lead, novoEstagio) {
    try {
      await updateDoc(doc(db, COLLECTIONS.CRM_LEADS, lead.id), { estagio: novoEstagio, dataUltimaAtualizacao: serverTimestamp() })
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, estagio: novoEstagio } : l))
    } catch (err) {
      console.error('[CRM] moverEstagio:', err)
      toast('Erro ao mover lead: ' + err.message, 'error')
    }
  }

  async function handleConfirmarGanho(lead, clienteIdExistente) {
    let clienteId = clienteIdExistente
    if (!clienteId) {
      const ref = await addDoc(collection(db, COLLECTIONS.CLIENTES), {
        nome:          lead.nomeRestaurante,
        telefone:      lead.telefone ?? '',
        email:         lead.email ?? '',
        status:        'Ativo',
        dataInicio:    null,
        mensalidade:   null,
        observacoes:   `Criado automaticamente a partir do lead do CRM${lead.nomeContato ? ` (contato: ${lead.nomeContato})` : ''}.`,
        organizacaoId: lead.organizacaoId,
        criadoEm:      serverTimestamp(),
      })
      clienteId = ref.id
    }
    await updateDoc(doc(db, COLLECTIONS.CRM_LEADS, lead.id), {
      estagio: 'fechado_ganho', clienteId, dataUltimaAtualizacao: serverTimestamp(),
    })
    toast('Lead fechado — cliente criado.', 'success')
    await loadAll()
  }

  async function handleConfirmarPerdido(lead, motivoPerda) {
    await updateDoc(doc(db, COLLECTIONS.CRM_LEADS, lead.id), {
      estagio: 'fechado_perdido', motivoPerda, dataUltimaAtualizacao: serverTimestamp(),
    })
    toast('Lead marcado como perdido.', 'success')
    await loadAll()
  }

  async function handleSalvarProximaAcao(leadId, descricao, dataStr) {
    const proximaAcao = dataStr && descricao.trim()
      ? { descricao: descricao.trim(), data: Timestamp.fromDate(parseLocalDate(dataStr)) }
      : null
    await updateDoc(doc(db, COLLECTIONS.CRM_LEADS, leadId), { proximaAcao, dataUltimaAtualizacao: serverTimestamp() })
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, proximaAcao } : l))
  }

  async function handleExcluirLead(lead) {
    const interacoesSnap = await getDocs(collection(db, COLLECTIONS.CRM_LEADS, lead.id, 'interacoes'))
    await Promise.all(interacoesSnap.docs.map(d => deleteDoc(d.ref)))
    await deleteDoc(doc(db, COLLECTIONS.CRM_LEADS, lead.id))
    setLeads(prev => prev.filter(l => l.id !== lead.id))
    setDetailLeadId(null)
    setExcluindoLead(null)
    toast('Lead excluído.', 'success')
  }

  async function carregarInteracoes(leadId) {
    const snap = await getDocs(query(collection(db, COLLECTIONS.CRM_LEADS, leadId, 'interacoes'), orderBy('data', 'desc')))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  async function registrarInteracao(leadId, tipo, descricao) {
    await addDoc(collection(db, COLLECTIONS.CRM_LEADS, leadId, 'interacoes'), {
      tipo, descricao: descricao.trim(), autorId: user.uid, data: serverTimestamp(),
    })
    await updateDoc(doc(db, COLLECTIONS.CRM_LEADS, leadId), { dataUltimaAtualizacao: serverTimestamp() })
  }

  // ─── Drag and drop ──────────────────────────────────────────────────────────

  function handleDragEnd(result) {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId) return
    const lead = leads.find(l => l.id === draggableId)
    if (!lead) return
    const destEstagio = destination.droppableId
    if (destEstagio === 'fechado_ganho') { setGanhoLead(lead); return }
    if (destEstagio === 'fechado_perdido') { setPerdidoLead(lead); return }
    moverEstagio(lead, destEstagio)
  }

  // Mobile: mesma lógica de destino do drag, disparada pelo select "mover
  // para" no card em vez do gesto de arrastar (não confiável em touch ao
  // lado do scroll horizontal das abas).
  function moverParaEstagioMobile(lead, destEstagio) {
    if (!destEstagio || destEstagio === lead.estagio) return
    if (destEstagio === 'fechado_ganho') { setGanhoLead(lead); return }
    if (destEstagio === 'fechado_perdido') { setPerdidoLead(lead); return }
    moverEstagio(lead, destEstagio)
  }

  const detailLead = detailLeadId ? leads.find(l => l.id === detailLeadId) ?? null : null

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (!orgId) {
    return (
      <motion.div style={{ padding: '28px 20px' }} variants={pageVariants} initial="initial" animate="animate">
        <div className="page-header">
          <h1 className="page-title">CRM</h1>
        </div>
        <p style={{ fontSize: '13px', color: '#999999' }}>
          O CRM de prospecção é um recurso por organização — disponível para contas de administrador de organização e gestores.
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div style={{ padding: '28px 20px' }} variants={pageVariants} initial="initial" animate="animate">
      {/* Header */}
      <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="page-title" style={{ marginBottom: 0 }}>CRM</h1>
        <button onClick={() => setNovoLeadOpen(true)} className="btn-primary flex items-center justify-center gap-2 h-11 sm:h-9">
          <Plus size={15} strokeWidth={2} />
          Novo lead
        </button>
      </div>

      {/* Resumo */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="card-kpi flex flex-col gap-1">
            <span className="section-label">Leads em aberto</span>
            <span className="font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#111111' }}>{resumo.totalAbertos}</span>
          </div>
          <div className="card-kpi flex flex-col gap-1">
            <span className="section-label">Valor potencial em negociação</span>
            <span className="font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#111111' }}>{formatBRL(resumo.valorPotencialTotal)}</span>
          </div>
          <div className="card-kpi flex flex-col gap-1">
            <span className="section-label">Taxa de conversão</span>
            <span className="font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#111111' }}>
              {resumo.taxaConversao != null ? `${resumo.taxaConversao.toFixed(0)}%` : '—'}
            </span>
          </div>
          <div className="card-kpi flex flex-col gap-1">
            <span className="section-label">Próxima ação atrasada</span>
            <span className="font-mono" style={{ fontSize: '22px', fontWeight: 700, color: resumo.atrasados > 0 ? '#DC2626' : '#111111' }}>{resumo.atrasados}</span>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <select value={filtroResponsavel} onChange={e => setFiltroResponsavel(e.target.value)} className="select w-full sm:w-52">
          <option value="">Todos os responsáveis</option>
          {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <select value={filtroOrigem} onChange={e => setFiltroOrigem(e.target.value)} className="select w-full sm:w-52">
          <option value="">Todas as origens</option>
          {ORIGENS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {(filtroResponsavel || filtroOrigem) && (
          <button
            onClick={() => { setFiltroResponsavel(''); setFiltroOrigem('') }}
            className="text-[13px] text-text-subtle hover:text-text-primary transition-colors duration-150"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-7" style={{ gap: '12px' }}>
          {ESTAGIOS.map(e => <Skeleton.Table key={e.key} rows={3} cols={1} />)}
        </div>
      ) : (
        <>
        {/* Desktop (sm+): 7 colunas com scroll horizontal, arrastar e soltar */}
        <div className="hidden sm:block">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(210px, 1fr))', gap: '12px', minWidth: '1400px' }}>
              {ESTAGIOS.map(estagio => {
                const lista = leadsPorEstagio[estagio.key] ?? []
                return (
                  <div key={estagio.key} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      backgroundColor: estagio.bg, borderRadius: '8px 8px 0 0',
                      padding: '10px 12px', border: '1px solid #E8E8E8', borderBottom: 'none',
                    }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: estagio.color }}>
                        {estagio.label}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: estagio.color, backgroundColor: '#FFFFFF', borderRadius: '10px', padding: '1px 7px' }}>
                        {lista.length}
                      </span>
                    </div>
                    <Droppable droppableId={estagio.key}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{
                            border: '1px solid #E8E8E8', borderRadius: '0 0 8px 8px',
                            backgroundColor: snapshot.isDraggingOver ? '#FAFAFA' : '#FAFAFA',
                            outline: snapshot.isDraggingOver ? `2px dashed ${estagio.color}` : '2px solid transparent',
                            outlineOffset: '-2px',
                            padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '160px',
                          }}
                        >
                          {lista.length === 0 && !snapshot.isDraggingOver && (
                            <p style={{ fontSize: '11px', color: '#CCCCCC', textAlign: 'center', paddingTop: '16px' }}>Nenhum lead nesta etapa.</p>
                          )}
                          {lista.map((lead, idx) => (
                            <Draggable key={lead.id} draggableId={lead.id} index={idx}>
                              {(dragProvided, dragSnapshot) => {
                                const card = (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    style={dragProvided.draggableProps.style}
                                  >
                                    <LeadCard
                                      lead={lead}
                                      responsavelNome={responsavelMap[lead.responsavelId]?.nome}
                                      onClick={() => setDetailLeadId(lead.id)}
                                    />
                                  </div>
                                )
                                return dragSnapshot.isDragging ? createPortal(card, document.body) : card
                              }}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )
              })}
            </div>
          </div>
        </DragDropContext>
        </div>

        {/* Mobile (<sm): abas por estágio, uma coluna por vez — "mover para" no lugar do drag */}
        <div className="sm:hidden">
          <div className="flex gap-1.5 overflow-x-auto" style={{ paddingBottom: '10px' }}>
            {ESTAGIOS.map(estagio => {
              const active = mobileEstagio === estagio.key
              const count = (leadsPorEstagio[estagio.key] ?? []).length
              return (
                <button
                  key={estagio.key}
                  type="button"
                  onClick={() => setMobileEstagio(estagio.key)}
                  style={{
                    flexShrink: 0, minHeight: '40px', padding: '0 12px', borderRadius: '6px',
                    fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap',
                    border: `1px solid ${active ? estagio.color : '#E8E8E8'}`,
                    backgroundColor: active ? estagio.bg : '#FFFFFF',
                    color: active ? estagio.color : '#666666',
                  }}
                >
                  {estagio.label} ({count})
                </button>
              )
            })}
          </div>
          <div style={{
            backgroundColor: '#FAFAFA', border: '1px solid #E8E8E8', borderRadius: '8px',
            padding: '10px', minHeight: '160px', display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            {(leadsPorEstagio[mobileEstagio] ?? []).length === 0 ? (
              <p style={{ fontSize: '11px', color: '#CCCCCC', textAlign: 'center', paddingTop: '16px' }}>Nenhum lead nesta etapa.</p>
            ) : (
              (leadsPorEstagio[mobileEstagio] ?? []).map(lead => (
                <div key={lead.id} className="flex flex-col gap-1.5">
                  <LeadCard
                    lead={lead}
                    responsavelNome={responsavelMap[lead.responsavelId]?.nome}
                    onClick={() => setDetailLeadId(lead.id)}
                  />
                  <select
                    value=""
                    onClick={e => e.stopPropagation()}
                    onChange={e => moverParaEstagioMobile(lead, e.target.value)}
                    className="select"
                    style={{ height: '32px', fontSize: '12px' }}
                  >
                    <option value="" disabled>Mover para…</option>
                    {ESTAGIOS.filter(e => e.key !== lead.estagio).map(e => (
                      <option key={e.key} value={e.key}>{e.label}</option>
                    ))}
                  </select>
                </div>
              ))
            )}
          </div>
        </div>
        </>
      )}

      <NovoLeadModal
        isOpen={novoLeadOpen}
        onClose={() => setNovoLeadOpen(false)}
        onSave={handleCriarLead}
        isAdminOrg={isAdminOrg}
        responsaveis={responsaveis}
      />

      <LeadDetailModal
        lead={detailLead}
        onClose={() => setDetailLeadId(null)}
        responsavelNome={detailLead ? responsavelMap[detailLead.responsavelId]?.nome : null}
        onSalvarProximaAcao={handleSalvarProximaAcao}
        onRegistrarInteracao={{ carregar: carregarInteracoes, registrar: registrarInteracao }}
        onExcluir={setExcluindoLead}
      />

      <ConfirmModal
        isOpen={!!excluindoLead}
        title="Excluir lead"
        message={`Tem certeza que quer excluir "${excluindoLead?.nomeRestaurante}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={() => handleExcluirLead(excluindoLead)}
        onCancel={() => setExcluindoLead(null)}
      />

      <FecharGanhoModal
        lead={ganhoLead}
        onClose={() => setGanhoLead(null)}
        onConfirm={handleConfirmarGanho}
        clientesExistentes={clientes}
      />

      <FecharPerdidoModal
        lead={perdidoLead}
        onClose={() => setPerdidoLead(null)}
        onConfirm={handleConfirmarPerdido}
      />
    </motion.div>
  )
}
