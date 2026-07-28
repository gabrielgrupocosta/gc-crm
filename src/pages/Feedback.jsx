import { useState, useEffect, Fragment } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import {
  db, COLLECTIONS,
  collection, addDoc, getDocs, updateDoc, doc, serverTimestamp, query, orderBy, where,
} from '../services/firebase'
import { useToast } from '../components/UI/Toast'
import Badge from '../components/UI/Badge'
import Skeleton from '../components/UI/Skeleton'

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPOS = [
  { value: 'sugestao', label: 'Sugestão', desc: 'Ideias para melhorar o sistema' },
  { value: 'problema', label: 'Problema', desc: 'Reportar bugs ou dificuldades' },
  { value: 'elogio',   label: 'Elogio',   desc: 'Feedback positivo sobre o sistema' },
]

const TIPO_LABEL = Object.fromEntries(TIPOS.map(t => [t.value, t.label]))

const EMPTY_FORM = { tipo: '', assunto: '', mensagem: '' }

const ASSUNTO_MAX  = 100
const MENSAGEM_MAX = 1000

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const data = d.toLocaleDateString('pt-BR')
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${data} ${hora}`
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Feedback() {
  const { user, isAdmin, isSuperAdmin } = useAuth()
  const toast = useToast()

  const [activeTab, setActiveTab] = useState('enviar')

  // ─ Formulário
  const [form,   setForm]   = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // ─ Lista (admin)
  const [feedbacks,    setFeedbacks]    = useState([])
  const [loadingList,  setLoadingList]  = useState(false)
  const [expandedId,   setExpandedId]   = useState(null)

  function set(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  function validar() {
    const errs = {}
    if (!form.tipo)            errs.tipo     = 'Selecione o tipo de feedback.'
    if (!form.assunto.trim())  errs.assunto  = 'Informe o assunto.'
    if (!form.mensagem.trim()) errs.mensagem = 'Escreva sua mensagem.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleCancelar() {
    setForm(EMPTY_FORM)
    setErrors({})
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    if (!validar()) return

    setSaving(true)
    try {
      await addDoc(collection(db, COLLECTIONS.FEEDBACKS), {
        tipo:          form.tipo,
        assunto:       form.assunto.trim(),
        mensagem:      form.mensagem.trim(),
        userId:        user.uid,
        userName:      user.nome ?? '',
        perfil:        user.perfil ?? '',
        organizacaoId: user.organizacaoId ?? null,
        timestamp:     serverTimestamp(),
        status:        'novo',
      })
      toast('Feedback enviado! Obrigado pela sua opinião.', 'success')
      setForm(EMPTY_FORM)
      setErrors({})
    } catch (err) {
      console.error('[Feedback] erro ao enviar:', err?.code, err?.message)
      toast('Erro ao enviar feedback. Tente novamente.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ─ Lista de feedbacks (admin) ────────────────────────────────────────────

  async function loadFeedbacks() {
    setLoadingList(true)
    try {
      const escopoOrg = isSuperAdmin ? [] : [where('organizacaoId', '==', user.organizacaoId ?? null)]
      const snap = await getDocs(query(collection(db, COLLECTIONS.FEEDBACKS), ...escopoOrg, orderBy('timestamp', 'desc')))
      setFeedbacks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error('[Feedback] erro ao carregar lista:', err?.code, err?.message)
      toast('Erro ao carregar feedbacks.', 'error')
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'ver' && isAdmin) loadFeedbacks()
  }, [activeTab, isAdmin, isSuperAdmin])

  async function handleToggleResolvido(fb) {
    const novoStatus = fb.status === 'resolvido' ? 'novo' : 'resolvido'
    try {
      await updateDoc(doc(db, COLLECTIONS.FEEDBACKS, fb.id), { status: novoStatus })
      setFeedbacks(prev => prev.map(f => f.id === fb.id ? { ...f, status: novoStatus } : f))
    } catch (err) {
      console.error('[Feedback] erro ao atualizar status:', err?.code, err?.message)
      toast('Erro ao atualizar status.', 'error')
    }
  }

  function toggleExpand(id) {
    setExpandedId(prev => prev === id ? null : id)
  }

  const assuntoLen  = form.assunto.length
  const mensagemLen = form.mensagem.length

  return (
    <motion.div
      style={{ padding: '28px 20px' }}
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Feedback</h1>
        <p className="page-subtitle">
          Sua opinião é muito importante para nós!
        </p>
      </div>

      {/* Tabs (admin) */}
      {isAdmin && (
        <div className="flex gap-1 mb-6">
          {[['enviar', 'Enviar Feedback'], ['ver', 'Ver Feedbacks']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setActiveTab(v)}
              className={[
                'px-4 py-1.5 text-[13px] rounded border transition-colors duration-150',
                activeTab === v
                  ? 'border-accent text-accent bg-accent-soft'
                  : 'border-border-hover text-text-muted hover:text-text-primary hover:border-[#DDDDDD]',
              ].join(' ')}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {/* ── Aba Enviar Feedback ───────────────────────────────────────────── */}
      {activeTab === 'enviar' && (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="bg-surface border border-border rounded-lg shadow-card" style={{ padding: '28px' }}>
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              {/* Tipo */}
              <div className="flex flex-col gap-1.5">
                <label className="field-label" htmlFor="fb-tipo">Tipo de Feedback</label>
                <select
                  id="fb-tipo"
                  value={form.tipo}
                  onChange={e => set('tipo', e.target.value)}
                  className="select"
                >
                  <option value="">Selecione o tipo de feedback</option>
                  {TIPOS.map(t => (
                    <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>
                  ))}
                </select>
                {errors.tipo && <span style={{ fontSize: '12px', color: '#DC2626' }}>{errors.tipo}</span>}
              </div>

              {/* Assunto */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="field-label" htmlFor="fb-assunto">Assunto</label>
                  <span style={{ fontSize: '11px', color: assuntoLen >= ASSUNTO_MAX ? '#DC2626' : '#999999' }}>
                    {assuntoLen}/{ASSUNTO_MAX}
                  </span>
                </div>
                <input
                  id="fb-assunto"
                  type="text"
                  value={form.assunto}
                  onChange={e => set('assunto', e.target.value.slice(0, ASSUNTO_MAX))}
                  maxLength={ASSUNTO_MAX}
                  placeholder="Resuma seu feedback em poucas palavras"
                  className="input"
                />
                {errors.assunto && <span style={{ fontSize: '12px', color: '#DC2626' }}>{errors.assunto}</span>}
              </div>

              {/* Mensagem */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="field-label" htmlFor="fb-mensagem">Mensagem</label>
                  <span style={{ fontSize: '11px', color: mensagemLen >= MENSAGEM_MAX ? '#DC2626' : '#999999' }}>
                    {mensagemLen}/{MENSAGEM_MAX}
                  </span>
                </div>
                <textarea
                  id="fb-mensagem"
                  value={form.mensagem}
                  onChange={e => set('mensagem', e.target.value.slice(0, MENSAGEM_MAX))}
                  maxLength={MENSAGEM_MAX}
                  rows={4}
                  placeholder="Conte com detalhes o que você gostaria de compartilhar…"
                  className="textarea"
                />
                {errors.mensagem && <span style={{ fontSize: '12px', color: '#DC2626' }}>{errors.mensagem}</span>}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={handleCancelar} disabled={saving} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary min-w-[140px]">
                  {saving ? 'Enviando…' : 'Enviar Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Aba Ver Feedbacks (admin) ────────────────────────────────────── */}
      {activeTab === 'ver' && isAdmin && (
        <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
          {loadingList ? (
            <Skeleton.Table rows={6} cols={5} />
          ) : feedbacks.length === 0 ? (
            <div className="flex items-center justify-center" style={{ padding: '64px 0' }}>
              <p style={{ fontSize: '12px', color: '#999999' }}>Nenhum feedback recebido ainda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#F9F9F9', borderBottom: '1px solid #E8E8E8' }}>
                    {['Data', 'Usuário', 'Tipo', 'Assunto', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-2 text-left section-label whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <motion.tbody variants={listVariants} initial="initial" animate="animate">
                  {feedbacks.map(fb => {
                    const resolvido = fb.status === 'resolvido'
                    const isExpanded = expandedId === fb.id
                    return (
                      <Fragment key={fb.id}>
                        <motion.tr
                          variants={itemVariants}
                          onClick={() => toggleExpand(fb.id)}
                          className="table-row-base"
                          style={{ cursor: 'pointer', opacity: resolvido ? 0.55 : 1 }}
                        >
                          <td className="px-4" style={{ height: '44px', fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '12px', color: '#666666', whiteSpace: 'nowrap' }}>
                            {formatDate(fb.timestamp)}
                          </td>
                          <td className="px-4" style={{ fontSize: '13px', color: '#111111', fontWeight: 500, textDecoration: resolvido ? 'line-through' : 'none' }}>
                            {fb.userName || '—'}
                          </td>
                          <td className="px-4">
                            <Badge status={fb.tipo} label={TIPO_LABEL[fb.tipo] ?? fb.tipo} />
                          </td>
                          <td className="px-4" style={{ fontSize: '13px', color: '#666666', textDecoration: resolvido ? 'line-through' : 'none', maxWidth: '260px' }}>
                            <span className="block truncate">{fb.assunto}</span>
                          </td>
                          <td className="px-4">
                            <Badge status={fb.status} label={resolvido ? 'Resolvido' : 'Novo'} />
                          </td>
                          <td className="px-4 text-right" style={{ whiteSpace: 'nowrap' }}>
                            <button
                              onClick={e => { e.stopPropagation(); handleToggleResolvido(fb) }}
                              className="btn-secondary"
                              style={{ height: '26px', fontSize: '11px', padding: '0 10px' }}
                            >
                              {resolvido ? 'Reabrir' : 'Marcar como resolvido'}
                            </button>
                          </td>
                        </motion.tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={6} style={{ padding: '14px 16px', backgroundColor: 'rgba(0,0,0,0.015)', borderBottom: '1px solid #F3F3F3' }}>
                              <p className="section-label" style={{ marginBottom: '6px' }}>Mensagem completa</p>
                              <p style={{ fontSize: '13px', color: '#111111', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                {fb.mensagem}
                              </p>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </motion.tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}
