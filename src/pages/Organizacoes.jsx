import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { httpsCallable } from 'firebase/functions'
import { Plus, UserPlus, Pencil, Eye, EyeOff, FlaskConical } from 'lucide-react'
import {
  db, functions, COLLECTIONS,
  collection, doc, getDocs, addDoc, updateDoc, query, where, serverTimestamp,
} from '../services/firebase'
import { useToast } from '../components/UI/Toast'
import { useAuth } from '../contexts/AuthContext'
import { useModoTeste } from '../contexts/ModoTesteContext'
import Modal from '../components/UI/Modal'
import Badge from '../components/UI/Badge'
import Skeleton from '../components/UI/Skeleton'

// E-mail com permissão exclusiva para ativar/desativar o "modo teste" (filtro
// global que restringe todas as telas às organizações marcadas com a flag).
const EMAIL_MODO_TESTE = 'luiz@ihubfood.com.br'

const criarAdminOrg = httpsCallable(functions, 'criarAdminOrg')

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatBRL(n) {
  if (n == null || n === '') return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

const STATUS_LABEL = { ativo: 'Ativo', inativo: 'Inativo', inadimplente: 'Inadimplente' }

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

// ─── Modal: nova organização ──────────────────────────────────────────────────

function NovaOrgModal({ isOpen, onClose, onSave }) {
  const [nome,   setNome]   = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setNome('')
  }, [isOpen])

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await onSave(nome.trim())
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const canSave = nome.trim().length > 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nova organização"
      width="max-w-md"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button form="org-form" type="submit" disabled={!canSave || saving} className="btn-primary">
            {saving ? 'Criando…' : 'Criar organização'}
          </button>
        </>
      }
    >
      <form id="org-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="org-nome">Nome da organização</label>
          <input
            id="org-nome"
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex: Grupo Balaio"
            className="input"
            required
            autoFocus
          />
        </div>
        <p className="text-[12px] text-text-subtle leading-snug">
          A organização é criada com status <strong className="text-text-primary font-medium">ativo</strong>.
        </p>
      </form>
    </Modal>
  )
}

// ─── Modal: criar admin_org ───────────────────────────────────────────────────

function CriarAdminOrgModal({ isOpen, onClose, onSave, organizacao }) {
  const [form,     setForm]     = useState({ nome: '', email: '', senha: '' })
  const [showPass, setShowPass] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (!isOpen) return
    setForm({ nome: '', email: '', senha: '' })
    setShowPass(false)
    setError('')
  }, [isOpen, organizacao])

  function set(key, value) { setForm(prev => ({ ...prev, [key]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setError('')
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err?.message ?? 'Erro ao criar admin. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const canSave = form.nome.trim() && form.email.trim() && form.senha.length >= 6

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Criar admin — ${organizacao?.nome ?? ''}`}
      width="max-w-md"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button form="admin-org-form" type="submit" disabled={!canSave || saving} className="btn-primary">
            {saving ? 'Criando…' : 'Criar admin'}
          </button>
        </>
      }
    >
      <form id="admin-org-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="ao-nome">Nome completo</label>
          <input
            id="ao-nome"
            type="text"
            value={form.nome}
            onChange={e => set('nome', e.target.value)}
            placeholder="Nome do administrador"
            className="input"
            required
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="ao-email">E-mail</label>
          <input
            id="ao-email"
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder="admin@empresa.com"
            className="input"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="ao-senha">Senha inicial</label>
          <div className="relative">
            <input
              id="ao-senha"
              type={showPass ? 'text' : 'password'}
              value={form.senha}
              onChange={e => set('senha', e.target.value)}
              placeholder="mín. 6 caracteres"
              className="input pr-10"
              minLength={6}
              required
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-muted transition-colors duration-150"
            >
              {showPass ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-[13px] text-negative leading-snug">{error}</p>
        )}
      </form>
    </Modal>
  )
}

// ─── Modal: editar organização ────────────────────────────────────────────────

function EditarOrgModal({ isOpen, onClose, onSave, organizacao }) {
  const [form,   setForm]   = useState({ nome: '', status: 'ativo', valorPorLoja: '' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    if (!isOpen) return
    setForm({
      nome: organizacao?.nome ?? '',
      status: organizacao?.status ?? 'ativo',
      valorPorLoja: organizacao?.valorPorLoja ?? '',
    })
    setError('')
  }, [isOpen, organizacao])

  function set(key, value) { setForm(prev => ({ ...prev, [key]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setError('')
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err?.message ?? 'Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const canSave = form.nome.trim().length > 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Editar organização — ${organizacao?.nome ?? ''}`}
      width="max-w-md"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button form="editar-org-form" type="submit" disabled={!canSave || saving} className="btn-primary">
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </>
      }
    >
      <form id="editar-org-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="eo-nome">Nome da organização</label>
          <input
            id="eo-nome"
            type="text"
            value={form.nome}
            onChange={e => set('nome', e.target.value)}
            placeholder="Ex: Grupo Balaio"
            className="input"
            required
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="eo-status">Status</label>
          <select
            id="eo-status"
            value={form.status}
            onChange={e => set('status', e.target.value)}
            className="select w-40"
          >
            <option value="ativo">Ativo</option>
            <option value="inadimplente">Inadimplente</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="eo-valor">Valor por loja (R$)</label>
          <input
            id="eo-valor"
            type="number"
            step="0.01"
            min="0"
            value={form.valorPorLoja}
            onChange={e => set('valorPorLoja', e.target.value)}
            placeholder="0,00"
            className="input"
          />
          <span className="text-[11px] text-text-subtle leading-snug">
            Override do valor de contrato padrão aplicado às lojas desta organização. Deixe em branco para usar o valor padrão global.
          </span>
        </div>

        {error && (
          <p className="text-[13px] text-negative leading-snug">{error}</p>
        )}
      </form>
    </Modal>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Organizacoes() {
  const toast = useToast()
  const { user, firebaseUser } = useAuth()
  const podeAlternarModoTeste = (user?.email ?? firebaseUser?.email) === EMAIL_MODO_TESTE
  const { filtroOrganizacaoId, setFiltroOrganizacaoId } = useModoTeste()

  const [organizacoes, setOrganizacoes] = useState([])
  const [lojas,        setLojas]        = useState([])
  const [adminOrgs,    setAdminOrgs]    = useState([])
  const [loading,      setLoading]      = useState(true)

  const [novaOrgOpen,      setNovaOrgOpen]      = useState(false)
  const [criandoAdminPara, setCriandoAdminPara] = useState(null)
  const [editandoOrg,      setEditandoOrg]      = useState(null)

  async function loadAll() {
    setLoading(true)
    try {
      const [orgsSnap, lojasSnap, adminOrgsSnap] = await Promise.all([
        getDocs(collection(db, COLLECTIONS.ORGANIZACOES)),
        getDocs(collection(db, COLLECTIONS.LOJAS)),
        getDocs(query(collection(db, COLLECTIONS.USERS), where('role', '==', 'admin_org'))),
      ])
      const raw = orgsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setOrganizacoes(raw.sort((a, b) => a.nome?.localeCompare(b.nome ?? '') ?? 0))
      setLojas(lojasSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setAdminOrgs(adminOrgsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const lojasCountMap = useMemo(() => {
    const map = {}
    lojas.forEach(l => {
      if (l.organizacaoId) map[l.organizacaoId] = (map[l.organizacaoId] ?? 0) + 1
    })
    return map
  }, [lojas])

  // Cada organização tem no máximo 1 admin_org — mapa direto organizacaoId → conta.
  const adminOrgMap = useMemo(
    () => Object.fromEntries(adminOrgs.map(a => [a.organizacaoId, a])),
    [adminOrgs]
  )

  async function handleCriarOrg(nome) {
    await addDoc(collection(db, COLLECTIONS.ORGANIZACOES), {
      nome,
      status: 'ativo',
      valorPorLoja: null,
      dataCriacao: serverTimestamp(),
    })
    toast('Organização criada.', 'success')
    await loadAll()
  }

  async function handleEditarOrg(form) {
    if (!editandoOrg) return
    const valor = form.valorPorLoja === '' ? null : Number(form.valorPorLoja)
    await updateDoc(doc(db, COLLECTIONS.ORGANIZACOES, editandoOrg.id), {
      nome: form.nome.trim(),
      status: form.status,
      valorPorLoja: valor != null && !isNaN(valor) ? valor : null,
    })
    toast('Organização atualizada.', 'success')
    await loadAll()
  }

  async function handleAlternarFlagTeste(org) {
    if (!podeAlternarModoTeste) return
    const novoValor = !org.flagTeste
    setOrganizacoes(prev => prev.map(o => o.id === org.id ? { ...o, flagTeste: novoValor } : o))
    try {
      await updateDoc(doc(db, COLLECTIONS.ORGANIZACOES, org.id), { flagTeste: novoValor })
      toast(
        novoValor
          ? `Modo teste ativado para "${org.nome}" — os dados de outras organizações ficarão ocultos em todo o sistema.`
          : `Modo teste desativado para "${org.nome}".`,
        'success'
      )
    } catch (err) {
      setOrganizacoes(prev => prev.map(o => o.id === org.id ? { ...o, flagTeste: org.flagTeste } : o))
      toast('Erro ao atualizar a flag de teste.', 'error')
    }
  }

  async function handleCriarAdminOrg(form) {
    if (!criandoAdminPara) return
    try {
      await criarAdminOrg({
        nome: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
        senha: form.senha,
        organizacaoId: criandoAdminPara.id,
      })
      toast('Admin da organização criado com sucesso.', 'success')
    } catch (err) {
      console.error('[Organizacoes] erro ao criar admin_org:', err?.code, err?.message)
      throw err
    }
  }

  return (
    <motion.div
      style={{ padding: '28px 20px' }}
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Organizações</h1>
        <div className="flex items-center gap-3">
          <select
            value={filtroOrganizacaoId}
            onChange={e => setFiltroOrganizacaoId(e.target.value)}
            className="h-9 px-3 bg-surface border border-border rounded-md text-[13px] text-text-primary"
            style={{ minWidth: 220 }}
            title="Filtra todas as telas do sistema (Dashboard, Contratos, Lojas, Clientes, Financeiro, Carteira etc) só pra essa organização"
          >
            <option value="">Ver todas as organizações</option>
            {organizacoes.map(org => (
              <option key={org.id} value={org.id}>Ver como: {org.nome}</option>
            ))}
          </select>
          <button onClick={() => setNovaOrgOpen(true)} className="btn-primary flex items-center gap-2 h-9">
            <Plus size={15} strokeWidth={2} />
            Nova organização
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden mt-5">
        {loading ? (
          <Skeleton.Table rows={6} cols={6} />
        ) : organizacoes.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-[13px] text-text-subtle">Nenhuma organização cadastrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-border">
                {[
                  'Nome', 'Admin', 'Status', 'Lojas', 'Valor por loja',
                  ...(podeAlternarModoTeste ? ['Modo teste'] : []),
                  '',
                ].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left section-label font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <motion.tbody variants={listVariants} initial="initial" animate="animate">
              {organizacoes.map(org => {
                const admin = adminOrgMap[org.id]
                return (
                  <motion.tr key={org.id} variants={itemVariants} className="table-row-base">
                    <td className="px-4 h-12 text-[14px] text-text-primary font-medium max-w-[220px]">
                      <span className="block truncate">{org.nome}</span>
                    </td>
                    <td className="px-4 h-12 text-[13px] text-text-muted max-w-[200px]">
                      {admin ? (
                        <span className="block truncate" title={admin.email}>{admin.nome}</span>
                      ) : (
                        <span className="text-text-subtle">—</span>
                      )}
                    </td>
                    <td className="px-4 h-12">
                      <Badge status={org.status} label={STATUS_LABEL[org.status] ?? org.status} />
                    </td>
                    <td className="px-4 h-12 text-[13px] text-text-muted text-center font-mono">
                      {lojasCountMap[org.id] ?? 0}
                    </td>
                    <td className="px-4 h-12 font-mono text-[13px] text-text-muted whitespace-nowrap">
                      {formatBRL(org.valorPorLoja)}
                    </td>
                    {podeAlternarModoTeste && (
                      <td className="px-4 h-12">
                        <button
                          onClick={() => handleAlternarFlagTeste(org)}
                          title={org.flagTeste ? 'Desativar modo teste desta organização' : 'Ativar modo teste — restringe todas as telas a organizações com a flag ativa'}
                          className="inline-flex items-center gap-1.5 text-[12px] px-2 py-1 rounded border transition-colors duration-150"
                          style={org.flagTeste
                            ? { background: '#FFF5F5', borderColor: '#FECACA', color: '#FF4B2E' }
                            : { background: '#FFFFFF', borderColor: '#E8E8E8', color: '#999999' }
                          }
                        >
                          <FlaskConical size={13} strokeWidth={1.5} />
                          {org.flagTeste ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                    )}
                    <td className="px-4 h-12 text-right whitespace-nowrap">
                      <button
                        onClick={() => setEditandoOrg(org)}
                        className="inline-flex items-center gap-1.5 text-[12px] text-text-subtle hover:text-text-primary transition-colors duration-150 px-2 py-1 rounded hover:bg-black/[0.04]"
                      >
                        <Pencil size={13} strokeWidth={1.5} />
                        Editar
                      </button>
                      <button
                        onClick={() => setCriandoAdminPara(org)}
                        className="inline-flex items-center gap-1.5 text-[12px] text-text-subtle hover:text-text-primary transition-colors duration-150 px-2 py-1 rounded hover:bg-black/[0.04] ml-1"
                      >
                        <UserPlus size={13} strokeWidth={1.5} />
                        Criar admin_org
                      </button>
                    </td>
                  </motion.tr>
                )
              })}
            </motion.tbody>
          </table>
          </div>
        )}

        {!loading && organizacoes.length > 0 && (
          <div className="px-4 py-3 border-t border-border">
            <span className="text-[12px] text-text-subtle">
              {organizacoes.length} organizaç{organizacoes.length === 1 ? 'ão' : 'ões'}
            </span>
          </div>
        )}
      </div>

      <NovaOrgModal
        isOpen={novaOrgOpen}
        onClose={() => setNovaOrgOpen(false)}
        onSave={handleCriarOrg}
      />

      <CriarAdminOrgModal
        isOpen={!!criandoAdminPara}
        onClose={() => setCriandoAdminPara(null)}
        onSave={handleCriarAdminOrg}
        organizacao={criandoAdminPara}
      />

      <EditarOrgModal
        isOpen={!!editandoOrg}
        onClose={() => setEditandoOrg(null)}
        onSave={handleEditarOrg}
        organizacao={editandoOrg}
      />
    </motion.div>
  )
}
