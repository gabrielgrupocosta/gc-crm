import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { httpsCallable } from 'firebase/functions'
import { Plus, Pencil, Trash2, Search, Check, Eye, EyeOff } from 'lucide-react'
import {
  db, functions, COLLECTIONS,
  collection, doc, query, where, getDocs, getDoc, updateDoc, deleteDoc, setDoc,
  createAuthUser, updateGestorEmail, updateGestorPassword, getAuthUid,
} from '../services/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/UI/Toast'
import Modal from '../components/UI/Modal'
import Badge from '../components/UI/Badge'
import Skeleton from '../components/UI/Skeleton'

const criarGestorFn = httpsCallable(functions, 'criarGestor')
const excluirGestorFn = httpsCallable(functions, 'excluirGestor')

// ─── Utilities ────────────────────────────────────────────────────────────────

const AUTH_ERRORS = {
  'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
  'auth/weak-password':        'A senha precisa ter ao menos 6 caracteres.',
  'auth/invalid-email':        'E-mail inválido.',
}

function parseAuthError(err) {
  return AUTH_ERRORS[err?.code] ?? err?.message ?? 'Erro ao salvar. Tente novamente.'
}

const ACESSO_ERRORS = {
  'auth/wrong-password':        'Senha atual incorreta.',
  'auth/email-already-in-use':  'Este e-mail já está em uso por outra conta.',
  'auth/weak-password':         'A senha deve ter pelo menos 6 caracteres.',
  'auth/requires-recent-login': 'Sessão expirada. Tente novamente com a senha atual.',
  'auth/invalid-email':         'E-mail inválido.',
  'auth/user-not-found':        'Não foi possível autenticar com a senha informada.',
}

function parseAcessoError(err) {
  return ACESSO_ERRORS[err?.code] ?? err?.message ?? 'Erro ao atualizar. Tente novamente.'
}

const VINCULO_ERRORS = {
  'auth/invalid-credential': 'Credenciais incorretas. Verifique o e-mail e senha do gestor.',
  'auth/wrong-password':     'Credenciais incorretas. Verifique o e-mail e senha do gestor.',
  'auth/user-not-found':     'Não existe conta com esse e-mail no Firebase Auth.',
  'auth/invalid-email':      'E-mail inválido.',
  'auth/too-many-requests':  'Muitas tentativas. Aguarde um momento e tente novamente.',
}

function parseVinculoError(err) {
  return VINCULO_ERRORS[err?.code] ?? err?.message ?? 'Erro ao vincular conta. Tente novamente.'
}

// UIDs do Firebase Auth têm ~28 caracteres alfanuméricos. Contas importadas
// antes da migração para Auth usam IDs curtos (ex: prefixos "MF", "VI") como ID
// do documento em users/ — o AuthContext busca users/{auth.currentUser.uid}, então
// esses documentos nunca são encontrados no login até serem vinculados.
function isProvavelUidAuth(id) {
  return typeof id === 'string' && id.length >= 20 && /^[A-Za-z0-9]+$/.test(id)
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function Checkbox({ checked, onChange }) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer shrink-0 transition-colors duration-150 ${
        checked ? 'bg-accent border-accent' : 'border-border-hover hover:border-[#DDDDDD]'
      }`}
    >
      {checked && <Check size={10} strokeWidth={2.5} className="text-white" />}
    </div>
  )
}

function LojasMultiselect({ lojas, selected, onChange, gestores, gestorAtualId }) {
  const [somenteSemGestor, setSomenteSemGestor] = useState(true)

  const gestorMap = useMemo(
    () => Object.fromEntries((gestores ?? []).map(g => [g.id, g.nome])),
    [gestores]
  )

  const sorted = useMemo(() =>
    [...lojas].sort((a, b) => {
      const aAtiva = ['ativa', 'ativo'].includes(a.status?.toLowerCase())
      const bAtiva = ['ativa', 'ativo'].includes(b.status?.toLowerCase())
      if (aAtiva && !bAtiva) return -1
      if (!aAtiva && bAtiva) return  1
      return a.nome?.localeCompare(b.nome ?? '') ?? 0
    }),
    [lojas]
  )

  const visiveis = useMemo(() => {
    if (!somenteSemGestor) return sorted
    return sorted.filter(l => !l.gestorId || l.gestorId === gestorAtualId)
  }, [sorted, somenteSemGestor, gestorAtualId])

  if (!sorted.length) return (
    <p className="text-[13px] text-text-subtle py-3">Nenhuma loja cadastrada.</p>
  )

  return (
    <div className="flex flex-col gap-2">
      <label
        className="flex items-center gap-2 cursor-pointer select-none"
        onClick={() => setSomenteSemGestor(v => !v)}
      >
        <Checkbox checked={somenteSemGestor} onChange={() => {}} />
        <span className="text-[12px] text-text-muted">Mostrar apenas lojas sem gestor</span>
      </label>

      <div className="border border-border-hover rounded overflow-y-auto max-h-52">
        {visiveis.length === 0 ? (
          <p className="text-[13px] text-text-subtle py-3 px-3">
            Nenhuma loja sem gestor no momento.
          </p>
        ) : (
          visiveis.map(loja => {
            const isSelected = selected.includes(loja.id)
            const outroGestor = loja.gestorId && !selected.includes(loja.id)
              ? gestorMap[loja.gestorId]
              : null

            return (
              <label
                key={loja.id}
                className="flex items-center gap-3 px-3 h-10 hover:bg-black/[0.03] cursor-pointer border-b border-border last:border-0"
                onClick={() => onChange(
                  isSelected ? selected.filter(id => id !== loja.id) : [...selected, loja.id]
                )}
              >
                <Checkbox checked={isSelected} onChange={() => {}} />
                <span className={`flex-1 text-[13px] truncate ${isSelected ? 'text-text-primary' : 'text-text-muted'}`}>
                  {loja.nome}
                </span>
                {loja.status !== 'Ativa' && (
                  <span className="text-[11px] text-text-subtle shrink-0">{loja.status}</span>
                )}
                {outroGestor && (
                  <span className="text-[11px] text-text-subtle shrink-0 max-w-[80px] truncate" title={`Atual: ${outroGestor}`}>
                    {outroGestor}
                  </span>
                )}
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Modal de gestor ──────────────────────────────────────────────────────────

function GestorModal({ isOpen, onClose, onSave, onVincularAuth, gestor, lojas, gestores, organizacoes, isSuperAdmin }) {
  const toast = useToast()

  const [form, setForm] = useState({
    nome: '', email: '', senha: '', status: 'ativo', organizacaoId: '', lojasIds: [],
  })
  const [showPass, setShowPass] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  // ─ Acesso ao sistema (troca de e-mail de login / senha via Firebase Auth)
  const [emailAtualConhecido, setEmailAtualConhecido] = useState('')
  const [novoEmailAcesso,     setNovoEmailAcesso]     = useState('')
  const [senhaAtualEmail,     setSenhaAtualEmail]     = useState('')
  const [salvandoEmailAcesso, setSalvandoEmailAcesso] = useState(false)
  const [senhaAtualSenha,     setSenhaAtualSenha]     = useState('')
  const [novaSenha,           setNovaSenha]           = useState('')
  const [confirmarSenha,      setConfirmarSenha]      = useState('')
  const [salvandoSenha,       setSalvandoSenha]       = useState(false)

  // ─ Vincular conta Auth (contas legadas com ID de documento != UID do Auth)
  const [tabVinculo,    setTabVinculo]    = useState('existente') // 'existente' | 'criar'
  const [emailVinculo,  setEmailVinculo]  = useState('')
  const [senhaVinculo,  setSenhaVinculo]  = useState('')
  const [vinculando,    setVinculando]    = useState(false)
  const [emailCriar,    setEmailCriar]    = useState('')
  const [senhaCriar,    setSenhaCriar]    = useState('')
  const [criandoConta,  setCriandoConta]  = useState(false)

  const isEditing = !!gestor
  const precisaVincular = isEditing && !isProvavelUidAuth(gestor.id)

  useEffect(() => {
    if (!isOpen) return
    setError('')
    setShowPass(false)
    if (gestor) {
      const atribuidas = lojas.filter(l => l.gestorId === gestor.id).map(l => l.id)
      setForm({ nome: gestor.nome ?? '', email: gestor.email ?? '', senha: '', status: gestor.status ?? 'ativo', organizacaoId: gestor.organizacaoId ?? '', lojasIds: atribuidas })
    } else {
      setForm({ nome: '', email: '', senha: '', status: 'ativo', organizacaoId: !isSuperAdmin ? (organizacoes[0]?.id ?? '') : '', lojasIds: [] })
    }
    setEmailAtualConhecido(gestor?.email ?? '')
    setNovoEmailAcesso('')
    setSenhaAtualEmail('')
    setSenhaAtualSenha('')
    setNovaSenha('')
    setConfirmarSenha('')
    setTabVinculo('existente')
    setEmailVinculo(gestor?.email ?? '')
    setSenhaVinculo('')
    setEmailCriar(gestor?.email ?? '')
    setSenhaCriar('')
  }, [isOpen, gestor, lojas, isSuperAdmin, organizacoes])

  async function handleAtualizarEmailAcesso() {
    if (!novoEmailAcesso.trim() || !senhaAtualEmail) return
    setSalvandoEmailAcesso(true)
    try {
      const novoEmail = novoEmailAcesso.trim().toLowerCase()
      const { uid } = await updateGestorEmail(emailAtualConhecido, senhaAtualEmail, novoEmail)
      if (uid !== gestor.id) {
        // O e-mail já foi trocado no Auth (uid real), mas o documento em users/
        // ainda está sob o ID legado — gravar aqui deixaria o app permanentemente
        // sem achar esse perfil no login. Precisa vincular a conta primeiro.
        toast('Este cadastro usa um ID de documento diferente do UID real da conta. Use "Vincular Conta Auth" abaixo antes de trocar o e-mail.', 'error')
        return
      }
      await updateDoc(doc(db, COLLECTIONS.USERS, gestor.id), { email: novoEmail })
      setEmailAtualConhecido(novoEmail)
      setForm(prev => ({ ...prev, email: novoEmail }))
      setNovoEmailAcesso('')
      setSenhaAtualEmail('')
      toast('E-mail de login atualizado.', 'success')
    } catch (err) {
      toast(parseAcessoError(err), 'error')
    } finally {
      setSalvandoEmailAcesso(false)
    }
  }

  async function handleVincularAuth() {
    if (!emailVinculo.trim() || !senhaVinculo) return
    setVinculando(true)
    try {
      const email = emailVinculo.trim().toLowerCase()
      const uidReal = await getAuthUid(email, senhaVinculo)
      await onVincularAuth(gestor, uidReal, email)
      setSenhaVinculo('')
      toast('Conta vinculada ao Firebase Auth com sucesso.', 'success')
      onClose()
    } catch (err) {
      toast(parseVinculoError(err), 'error')
    } finally {
      setVinculando(false)
    }
  }

  async function handleCriarContaAgora() {
    console.log('criando conta...')
    if (!emailCriar.trim() || senhaCriar.length < 6) return
    setCriandoConta(true)
    try {
      const email = emailCriar.trim().toLowerCase()
      const { uid } = await createAuthUser(email, senhaCriar)
      await onVincularAuth(gestor, uid, email)
      setSenhaCriar('')
      toast('Conta criada e vinculada com sucesso!', 'success')
      onClose()
    } catch (err) {
      console.error('[Gestores] erro ao criar conta Auth:', err?.code, err?.message)
      toast(parseAuthError(err), 'error')
    } finally {
      setCriandoConta(false)
    }
  }

  async function handleAtualizarSenha() {
    if (!senhaAtualSenha || !novaSenha) return
    if (novaSenha.length < 6) { toast('A senha deve ter pelo menos 6 caracteres.', 'error'); return }
    if (novaSenha !== confirmarSenha) { toast('As senhas não coincidem.', 'error'); return }
    setSalvandoSenha(true)
    try {
      await updateGestorPassword(emailAtualConhecido, senhaAtualSenha, novaSenha)
      setSenhaAtualSenha('')
      setNovaSenha('')
      setConfirmarSenha('')
      toast('Senha atualizada.', 'success')
    } catch (err) {
      toast(parseAcessoError(err), 'error')
    } finally {
      setSalvandoSenha(false)
    }
  }

  function set(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setError('')
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(parseAuthError(err))
    } finally {
      setSaving(false)
    }
  }

  const canSave = form.nome.trim() && form.status && form.email.trim() &&
    (isEditing || (form.senha.length >= 6 && form.organizacaoId))

  const modalTitle = isEditing ? 'Editar gestor' : 'Novo gestor'

  const submitLabel = saving
    ? 'Salvando…'
    : isEditing
      ? 'Salvar alterações'
      : 'Criar gestor'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      width="max-w-xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            form="gestor-form"
            type="submit"
            disabled={!canSave || saving}
            className="btn-primary"
          >
            {submitLabel}
          </button>
        </>
      }
    >
      <form id="gestor-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {/* Nome */}
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="g-nome">Nome completo</label>
          <input
            id="g-nome"
            type="text"
            value={form.nome}
            onChange={e => set('nome', e.target.value)}
            placeholder="Nome do usuário"
            className="input"
            required
            autoFocus
          />
        </div>

        {/* E-mail + Senha (senha só no create) */}
        {!isEditing ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="field-label" htmlFor="g-email">E-mail</label>
              <input
                id="g-email"
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="usuario@empresa.com"
                className="input"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="field-label" htmlFor="g-senha">Senha inicial</label>
              <div className="relative">
                <input
                  id="g-senha"
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
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="g-email">E-mail</label>
            <input
              id="g-email"
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="usuario@empresa.com"
              className="input"
              required
            />
            <span className="text-[11px] text-text-subtle leading-snug">
              Atualiza só o e-mail exibido no sistema. O login continua com o e-mail antigo — trocar isso exige reautenticação, que não dá pra fazer por aqui.
            </span>
            <span className="font-mono text-[11px] text-text-subtle leading-snug">
              UID do documento: {gestor.id}
            </span>
          </div>
        )}

        {/* Organização (só no create, e só master escolhe — admin_org sempre cria na própria) */}
        {!isEditing && isSuperAdmin && (
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="g-org">Organização</label>
            <select
              id="g-org"
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

        {/* Status */}
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="g-status">Status</label>
          <select
            id="g-status"
            value={form.status}
            onChange={e => set('status', e.target.value)}
            className="select w-40"
          >
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>

        {/* Vincular conta Auth (cadastros legados cujo ID do documento != UID real) */}
        {precisaVincular && (
          <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderLeft: '3px solid #CA8A04', borderRadius: '6px', padding: '14px' }}>
            <p style={{ fontSize: '12px', fontWeight: 500, color: '#92400E', marginBottom: '4px' }}>
              Conta não vinculada ao Firebase Auth
            </p>
            <p style={{ fontSize: '12px', color: '#92400E', lineHeight: 1.5, marginBottom: '10px' }}>
              O ID deste documento (<span className="font-mono">{gestor.id}</span>) não é o UID real da conta no Auth — provavelmente veio de uma importação antiga.
              Isso faz o login falhar com "perfil não encontrado", já que o app busca o perfil por <span className="font-mono">users/&#123;uid&#125;</span>.
            </p>

            {/* Abas */}
            <div className="flex gap-4" style={{ borderBottom: '1px solid #FDE68A', marginBottom: '10px' }}>
              <button
                type="button"
                onClick={() => setTabVinculo('existente')}
                style={{
                  fontSize: '12px', fontWeight: 500, padding: '0 0 8px 0',
                  color: tabVinculo === 'existente' ? '#92400E' : '#B45309',
                  borderBottom: tabVinculo === 'existente' ? '2px solid #CA8A04' : '2px solid transparent',
                  opacity: tabVinculo === 'existente' ? 1 : 0.6,
                }}
              >
                Já tem login
              </button>
              <button
                type="button"
                onClick={() => setTabVinculo('criar')}
                style={{
                  fontSize: '12px', fontWeight: 500, padding: '0 0 8px 0',
                  color: tabVinculo === 'criar' ? '#92400E' : '#B45309',
                  borderBottom: tabVinculo === 'criar' ? '2px solid #CA8A04' : '2px solid transparent',
                  opacity: tabVinculo === 'criar' ? 1 : 0.6,
                }}
              >
                Criar login
              </button>
            </div>

            {tabVinculo === 'existente' && (
              <div key="tab-existente" className="flex flex-col gap-2">
                <p style={{ fontSize: '12px', color: '#92400E', lineHeight: 1.5 }}>
                  Informe o e-mail e a senha atuais do gestor pra buscar o UID real e migrar o cadastro.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="email"
                    value={emailVinculo}
                    onChange={e => setEmailVinculo(e.target.value)}
                    placeholder="E-mail do gestor"
                    className="input"
                    style={{ height: '32px', fontSize: '12px' }}
                  />
                  <input
                    type="password"
                    value={senhaVinculo}
                    onChange={e => setSenhaVinculo(e.target.value)}
                    placeholder="Senha atual do gestor"
                    className="input"
                    style={{ height: '32px', fontSize: '12px' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleVincularAuth}
                  disabled={vinculando || !emailVinculo.trim() || !senhaVinculo}
                  className="btn-secondary self-start"
                  style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
                >
                  {vinculando ? 'Vinculando…' : 'Vincular Conta Auth'}
                </button>
              </div>
            )}

            {tabVinculo === 'criar' && (
              <div key="tab-criar" className="flex flex-col gap-2">
                <p style={{ fontSize: '12px', color: '#92400E', lineHeight: 1.5 }}>
                  Gestor ainda não tem login? Crie uma conta nova no Firebase Auth agora — o cadastro é migrado
                  automaticamente pro UID dela.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="email"
                    value={emailCriar}
                    onChange={e => setEmailCriar(e.target.value)}
                    placeholder="E-mail do gestor"
                    className="input"
                    style={{ height: '32px', fontSize: '12px' }}
                  />
                  <input
                    type="password"
                    value={senhaCriar}
                    onChange={e => setSenhaCriar(e.target.value)}
                    placeholder="Senha inicial (mín. 6 caracteres)"
                    minLength={6}
                    className="input"
                    style={{ height: '32px', fontSize: '12px' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCriarContaAgora}
                  disabled={criandoConta || !emailCriar.trim() || senhaCriar.length < 6}
                  className="btn-secondary self-start"
                  style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
                >
                  {criandoConta ? 'Criando…' : 'Criar conta agora'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Acesso ao Sistema (só no edit — precisa de uma conta já existente pra reautenticar) */}
        {isEditing && (
          <div style={{ border: '1px solid #E8E8E8', borderRadius: '8px', padding: '16px' }}>
            <p style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#999999', marginBottom: '12px' }}>
              Acesso ao Sistema
            </p>

            {/* Alterar e-mail de login */}
            <div className="flex flex-col gap-2">
              <p style={{ fontSize: '11px', fontWeight: 500, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Alterar E-mail de Login
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="email"
                  value={novoEmailAcesso}
                  onChange={e => setNovoEmailAcesso(e.target.value)}
                  placeholder="Novo e-mail"
                  className="input"
                  style={{ height: '32px', fontSize: '12px' }}
                />
                <input
                  type="password"
                  value={senhaAtualEmail}
                  onChange={e => setSenhaAtualEmail(e.target.value)}
                  placeholder="Senha atual do gestor"
                  className="input"
                  style={{ height: '32px', fontSize: '12px' }}
                />
              </div>
              <button
                type="button"
                onClick={handleAtualizarEmailAcesso}
                disabled={salvandoEmailAcesso || !novoEmailAcesso.trim() || !senhaAtualEmail}
                className="btn-secondary self-start"
                style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
              >
                {salvandoEmailAcesso ? 'Atualizando…' : 'Atualizar E-mail'}
              </button>
            </div>

            <div style={{ borderTop: '1px solid #E8E8E8', margin: '14px 0' }} />

            {/* Alterar senha */}
            <div className="flex flex-col gap-2">
              <p style={{ fontSize: '11px', fontWeight: 500, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Alterar Senha
              </p>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="password"
                  value={senhaAtualSenha}
                  onChange={e => setSenhaAtualSenha(e.target.value)}
                  placeholder="Senha atual"
                  className="input"
                  style={{ height: '32px', fontSize: '12px' }}
                />
                <input
                  type="password"
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                  placeholder="Nova senha"
                  minLength={6}
                  className="input"
                  style={{ height: '32px', fontSize: '12px' }}
                />
                <input
                  type="password"
                  value={confirmarSenha}
                  onChange={e => setConfirmarSenha(e.target.value)}
                  placeholder="Confirmar nova senha"
                  className="input"
                  style={{ height: '32px', fontSize: '12px' }}
                />
              </div>
              <button
                type="button"
                onClick={handleAtualizarSenha}
                disabled={salvandoSenha || !senhaAtualSenha || novaSenha.length < 6 || novaSenha !== confirmarSenha}
                className="btn-secondary self-start"
                style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
              >
                {salvandoSenha ? 'Atualizando…' : 'Atualizar Senha'}
              </button>
            </div>
          </div>
        )}

        {/* Lojas atribuídas */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="field-label">Lojas atribuídas</label>
            <span className="text-[12px] text-text-subtle">
              {form.lojasIds.length} selecionada{form.lojasIds.length !== 1 ? 's' : ''}
            </span>
          </div>
          <LojasMultiselect
            lojas={lojas}
            selected={form.lojasIds}
            onChange={ids => set('lojasIds', ids)}
            gestores={gestores}
            gestorAtualId={gestor?.id}
          />
        </div>

        {/* Erro */}
        {error && (
          <p className="text-[13px] text-negative leading-snug">{error}</p>
        )}
      </form>
    </Modal>
  )
}

// ─── Modal de confirmação de exclusão ────────────────────────────────────────

function DeleteGestorModal({ isOpen, onClose, onExcluir, onDesativarSemSenha, gestor }) {
  const [excluindo,    setExcluindo]    = useState(false)
  const [desativando,  setDesativando]  = useState(false)

  const busy = excluindo || desativando

  async function handleExcluir() {
    setExcluindo(true)
    try {
      await onExcluir()
    } finally {
      setExcluindo(false)
    }
  }

  async function handleDesativar() {
    setDesativando(true)
    try {
      await onDesativarSemSenha()
    } finally {
      setDesativando(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title="Excluir gestor"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">
            Cancelar
          </button>
          <button type="button" onClick={handleDesativar} disabled={busy} className="btn-secondary">
            {desativando ? 'Desativando…' : 'Só desativar'}
          </button>
          <button type="button" onClick={handleExcluir} disabled={busy} className="btn-primary">
            {excluindo ? 'Excluindo…' : 'Excluir e revogar acesso'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-text-muted leading-relaxed">
          Tem certeza que deseja excluir o gestor <strong className="text-text-primary font-medium">{gestor?.nome}</strong>?
          Esta ação não pode ser desfeita. As lojas atribuídas a ele ficarão sem gestor responsável.
        </p>
        <p className="text-[11px] text-text-subtle leading-snug">
          "Excluir e revogar acesso" remove o cadastro e o login por completo, sem precisar da senha do gestor.
          "Só desativar" mantém a conta existindo, mas com o status inativo e login bloqueado.
        </p>
      </div>
    </Modal>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Gestores() {
  const toast = useToast()
  const { user, isSuperAdmin } = useAuth()

  const [gestores,     setGestores]     = useState([])
  const [lojas,        setLojas]        = useState([])
  const [organizacoes, setOrganizacoes] = useState([])
  const [loading,      setLoading]      = useState(true)

  const [search,      setSearch]      = useState('')
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editingGestor, setEditingGestor] = useState(null)
  const [deletingGestor, setDeletingGestor] = useState(null)

  // ─── Load ───────────────────────────────────────────────────────────────────

  async function loadAll() {
    setLoading(true)
    try {
      // master enxerga gestores de todas as organizações; admin_org só os da
      // própria — sem esse filtro a consulta nem passa pelas regras do
      // Firestore pra quem não é master (mesmo padrão de Clientes/Lojas).
      const orgId = user?.organizacaoId ?? null
      const escopoLojas = isSuperAdmin ? [] : [where('organizacaoId', '==', orgId)]
      const usuariosQuery = isSuperAdmin
        ? query(collection(db, COLLECTIONS.USERS), where('role', '==', 'gestor'))
        : query(collection(db, COLLECTIONS.USERS), where('organizacaoId', '==', orgId), where('role', '==', 'gestor'))

      const [usuariosSnap, lojasSnap] = await Promise.all([
        getDocs(usuariosQuery),
        getDocs(query(collection(db, COLLECTIONS.LOJAS), ...escopoLojas)),
      ])
      const gs = usuariosSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setGestores(gs.sort((a, b) => a.nome?.localeCompare(b.nome ?? '') ?? 0))
      setLojas(lojasSnap.docs.map(d => ({ id: d.id, ...d.data() })))

      if (isSuperAdmin) {
        const orgsSnap = await getDocs(collection(db, COLLECTIONS.ORGANIZACOES))
        setOrganizacoes(orgsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } else if (orgId) {
        const orgSnap = await getDoc(doc(db, COLLECTIONS.ORGANIZACOES, orgId))
        setOrganizacoes(orgSnap.exists() ? [{ id: orgSnap.id, ...orgSnap.data() }] : [])
      }
    } catch (err) {
      console.error('[Gestores] loadAll:', err)
      toast('Erro ao carregar dados: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  // ─── Derived ────────────────────────────────────────────────────────────────

  const organizacaoMap = useMemo(
    () => Object.fromEntries(organizacoes.map(o => [o.id, o.nome])),
    [organizacoes]
  )

  const lojasCountMap = useMemo(() => {
    const map = {}
    lojas.forEach(l => {
      if (l.gestorId) map[l.gestorId] = (map[l.gestorId] ?? 0) + 1
    })
    return map
  }, [lojas])

  const gestoresFiltrados = useMemo(() => {
    const term = search.toLowerCase()
    return gestores.filter(g =>
      g.nome?.toLowerCase().includes(term) || g.email?.toLowerCase().includes(term)
    )
  }, [gestores, search])

  const lojasNaoAtribuidas = useMemo(
    () => lojas.filter(l => l.status?.toLowerCase() !== 'cancelada'),
    [lojas]
  )

  // ─── Save ───────────────────────────────────────────────────────────────────

  async function handleSave(form) {
    if (editingGestor) {
      // Atualiza dados do gestor
      await updateDoc(doc(db, COLLECTIONS.USERS, editingGestor.id), {
        nome:   form.nome.trim(),
        email:  form.email.trim().toLowerCase(),
        status: form.status,
      })

      // Recalcula atribuição de lojas
      const anteriores = lojas.filter(l => l.gestorId === editingGestor.id).map(l => l.id)
      const adicionadas = form.lojasIds.filter(id => !anteriores.includes(id))
      const removidas   = anteriores.filter(id => !form.lojasIds.includes(id))

      await Promise.all([
        ...adicionadas.map(id => updateDoc(doc(db, COLLECTIONS.LOJAS, id), { gestorId: editingGestor.id })),
        ...removidas.map(id   => updateDoc(doc(db, COLLECTIONS.LOJAS, id), { gestorId: null })),
      ])

      toast('Gestor atualizado.', 'success')
    } else {
      // Cria a conta via Cloud Function: garante custom claims (role/organizacaoId)
      // corretos desde o início — criar direto pelo client (Auth + Firestore)
      // deixava o gestor sem claim nenhum e incapaz de logar.
      const organizacaoId = isSuperAdmin ? form.organizacaoId : (user?.organizacaoId ?? null)
      const { data } = await criarGestorFn({
        email: form.email.trim().toLowerCase(),
        senha: form.senha,
        nome:  form.nome.trim(),
        organizacaoId,
      })
      const uid = data.uid

      if (form.status === 'inativo') {
        await updateDoc(doc(db, COLLECTIONS.USERS, uid), { status: 'inativo' })
      }

      // Atribui lojas selecionadas
      if (form.lojasIds.length > 0) {
        await Promise.all(
          form.lojasIds.map(id => updateDoc(doc(db, COLLECTIONS.LOJAS, id), { gestorId: uid }))
        )
      }

      toast('Gestor criado com sucesso.', 'success')
    }

    await loadAll()
  }

  // ─── Vincular conta Auth (migração de cadastros legados) ───────────────────

  async function handleVincularContaAuth(gestorAntigo, uidReal, novoEmail) {
    const idAntigo = gestorAntigo.id
    if (uidReal === idAntigo) return

    const { id: _id, ...dados } = gestorAntigo
    await setDoc(doc(db, COLLECTIONS.USERS, uidReal), {
      ...dados,
      uid: uidReal,
      ...(novoEmail ? { email: novoEmail } : {}),
    })

    // Lojas atribuídas ao gestor referenciam o ID antigo — precisam apontar pro UID real
    const lojasSnap = await getDocs(query(collection(db, COLLECTIONS.LOJAS), where('gestorId', '==', idAntigo)))
    await Promise.all(
      lojasSnap.docs.map(d => updateDoc(doc(db, COLLECTIONS.LOJAS, d.id), { gestorId: uidReal }))
    )

    await deleteDoc(doc(db, COLLECTIONS.USERS, idAntigo))

    await loadAll()
  }

  function openNew() {
    setEditingGestor(null)
    setModalOpen(true)
  }

  function openEdit(g) {
    setEditingGestor(g)
    setModalOpen(true)
  }

  // ─── Excluir ────────────────────────────────────────────────────────────────

  async function handleExcluirGestor() {
    const gestor = deletingGestor
    if (!gestor) return
    try {
      const lojasSnap = await getDocs(query(collection(db, COLLECTIONS.LOJAS), where('gestorId', '==', gestor.id)))
      await Promise.all(
        lojasSnap.docs.map(d => updateDoc(doc(db, COLLECTIONS.LOJAS, d.id), { gestorId: null, gestorNome: '' }))
      )

      // Exclusão via Cloud Function (privilégio de admin) — apaga Auth + Firestore
      // juntos, sem depender de conhecer a senha do gestor.
      await excluirGestorFn({ gestorUid: gestor.id })

      toast('Gestor excluído e acesso revogado com sucesso.', 'success')

      setDeletingGestor(null)
      await loadAll()
    } catch (err) {
      console.error('[Gestores] erro ao excluir gestor:', err?.code, err?.message)
      toast(err?.message ?? 'Erro ao excluir gestor. Tente novamente.', 'error')
    }
  }

  async function handleDesativarGestorSemSenha() {
    const gestor = deletingGestor
    if (!gestor) return
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, gestor.id), { status: 'inativo' })

      toast('Acesso bloqueado. O gestor não conseguirá mais fazer login.', 'success')

      setDeletingGestor(null)
      await loadAll()
    } catch (err) {
      console.error('[Gestores] erro ao desativar gestor:', err?.code, err?.message)
      toast('Erro ao desativar gestor. Tente novamente.', 'error')
    }
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
      <div className="page-header flex items-center justify-between">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Gestores</h1>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 h-9">
          <Plus size={15} strokeWidth={2} />
          Novo gestor
        </button>
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-[13px] text-text-subtle hover:text-text-primary transition-colors duration-150"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
        {loading ? (
          <Skeleton.Table rows={6} cols={isSuperAdmin ? 6 : 5} />
        ) : gestoresFiltrados.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-[13px] text-text-subtle">
              {gestores.length === 0 ? 'Nenhum gestor cadastrado.' : 'Nenhum gestor encontrado.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-border">
                {[...(isSuperAdmin ? ['Nome', 'E-mail', 'Organização', 'Status', 'Lojas', ''] : ['Nome', 'E-mail', 'Status', 'Lojas', ''])].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left section-label font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <motion.tbody variants={listVariants} initial="initial" animate="animate">
              {gestoresFiltrados.map(g => {
                const count = lojasCountMap[g.id] ?? 0
                return (
                  <motion.tr key={g.id} variants={itemVariants} className="table-row-base">
                    <td className="px-4 h-12 text-[14px] text-text-primary font-medium">
                      <span className="inline-flex items-center gap-2">
                        {g.nome}
                        {g.status === 'inativo' && (
                          <span
                            className="text-[10px] font-medium uppercase tracking-[0.04em] shrink-0"
                            style={{
                              padding: '1px 6px', borderRadius: '4px',
                              color: '#DC2626', backgroundColor: 'rgba(220,38,38,0.1)',
                              border: '1px solid rgba(220,38,38,0.2)',
                            }}
                          >
                            Inativo
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 h-12 text-[14px] text-text-muted font-mono">
                      {g.email}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 h-12 text-[13px] text-text-muted">
                        {organizacaoMap[g.organizacaoId] ?? '—'}
                      </td>
                    )}
                    <td className="px-4 h-12">
                      <Badge
                        status={g.status}
                        label={g.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      />
                    </td>
                    <td className="px-4 h-12">
                      <span className={`font-mono text-[14px] ${
                        count === 0 ? 'text-text-subtle' : 'text-text-muted'
                      }`}>
                        {count}
                        <span className="text-[12px] text-text-subtle ml-1">
                          {count === 1 ? 'loja' : 'lojas'}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 h-12 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEdit(g)}
                        className="inline-flex items-center gap-1.5 text-[12px] text-text-subtle hover:text-text-primary transition-colors duration-150 px-2 py-1 rounded hover:bg-black/[0.04]"
                      >
                        <Pencil size={13} strokeWidth={1.5} />
                        Editar
                      </button>
                      <button
                        onClick={() => setDeletingGestor(g)}
                        className="inline-flex items-center gap-1.5 text-[12px] text-negative hover:opacity-75 transition-opacity duration-150 px-2 py-1 rounded ml-1"
                      >
                        <Trash2 size={13} strokeWidth={1.5} />
                        Excluir
                      </button>
                    </td>
                  </motion.tr>
                )
              })}
            </motion.tbody>
          </table>
          </div>
        )}

        {/* Footer */}
        {!loading && gestores.length > 0 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <span className="text-[12px] text-text-subtle">
              {gestoresFiltrados.length} de {gestores.length} gestores
            </span>
            <span className="text-[12px] text-text-subtle">
              {gestores.filter(g => g.status === 'ativo').length} ativos
            </span>
          </div>
        )}
      </div>

      <GestorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onVincularAuth={handleVincularContaAuth}
        gestor={editingGestor}
        lojas={lojasNaoAtribuidas}
        gestores={gestores}
        organizacoes={organizacoes}
        isSuperAdmin={isSuperAdmin}
      />

      <DeleteGestorModal
        isOpen={!!deletingGestor}
        onClose={() => setDeletingGestor(null)}
        onExcluir={handleExcluirGestor}
        onDesativarSemSenha={handleDesativarGestorSemSenha}
        gestor={deletingGestor}
      />
    </motion.div>
  )
}
