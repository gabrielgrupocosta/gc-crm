import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  db, COLLECTIONS,
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where, orderBy, limit, startAfter, serverTimestamp, Timestamp,
} from '../services/firebase'
import { useToast } from '../components/UI/Toast'
import Modal from '../components/UI/Modal'
import Skeleton from '../components/UI/Skeleton'
import LojaSelect from '../components/UI/LojaSelect'

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDateTime(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const data = d.toLocaleDateString('pt-BR')
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${data} ${hora}`
}

function formatDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('pt-BR')
}

function tsToDateInput(ts) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : new Date()
  return d.toISOString().split('T')[0]
}

// ─── Animation variants ───────────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

const HISTORICO_PAGE_SIZE = 100

const listVariants = { animate: { transition: { staggerChildren: 0.04 } } }
const itemVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.15 } },
}

// ─── Modal de nova tarefa ─────────────────────────────────────────────────────

const EMPTY_TAREFA_FORM = { lojaId: '', descricao: '', data: '', observacao: '', agendar: true }

function AgendarSwitch({ id, checked, onChange }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: '34px', height: '20px', borderRadius: '10px', flexShrink: 0,
        border: 'none', cursor: 'pointer', position: 'relative',
        backgroundColor: checked ? '#E5322D' : '#E8E8E8',
        transition: 'background-color 150ms',
      }}
    >
      <span
        style={{
          position: 'absolute', top: '2px', left: checked ? '16px' : '2px',
          width: '16px', height: '16px', borderRadius: '50%',
          backgroundColor: '#FFFFFF', transition: 'left 150ms',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  )
}

function NovaTarefaModal({ isOpen, onClose, onSave, lojas, gestorMap }) {
  const [form, setForm] = useState(EMPTY_TAREFA_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setForm({
      ...EMPTY_TAREFA_FORM,
      data: tsToDateInput(new Date()),
    })
  }, [isOpen])

  function set(key, value) { setForm(prev => ({ ...prev, [key]: value })) }

  const canSave = form.lojaId && form.descricao.trim() && (!form.agendar || form.data)

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving || !canSave) return
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nova tarefa"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
          <button form="nova-tarefa-form" type="submit" disabled={!canSave || saving} className="btn-primary">
            {saving ? 'Salvando…' : 'Criar tarefa'}
          </button>
        </>
      }
    >
      <form id="nova-tarefa-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="tf-loja">Loja</label>
          <LojaSelect lojas={lojas} value={form.lojaId} onChange={id => set('lojaId', id)} gestorMap={gestorMap} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="tf-desc">Descrição da tarefa</label>
          <input
            id="tf-desc"
            type="text"
            value={form.descricao}
            onChange={e => set('descricao', e.target.value)}
            placeholder="Ex: Desligar anúncio patrocinado"
            className="input"
            required
          />
        </div>

        <div className="flex items-center justify-between" style={{ height: '36px' }}>
          <label className="field-label" htmlFor="tf-agendar">Agendar lembrete</label>
          <AgendarSwitch id="tf-agendar" checked={form.agendar} onChange={v => set('agendar', v)} />
        </div>

        {form.agendar && (
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="tf-data">Data do lembrete</label>
            <input id="tf-data" type="date" value={form.data} onChange={e => set('data', e.target.value)} className="input" required />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="tf-obs">Observação</label>
          <textarea
            id="tf-obs"
            value={form.observacao}
            onChange={e => set('observacao', e.target.value)}
            placeholder="Opcional…"
            rows={3}
            className="textarea"
          />
        </div>
      </form>
    </Modal>
  )
}

// ─── Linha de tarefa/registro ─────────────────────────────────────────────────

function TarefaRow({ tarefa: t, isLast, lojaMap, isAdmin, concluindoId, excluindoId, onConcluir, onExcluir }) {
  const concluida  = t.status === 'concluida'
  const isRegistro = t.tipo === 'registro'

  return (
    <motion.div
      variants={itemVariants}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px', opacity: concluida ? 0.55 : 1,
        borderBottom: isLast ? 'none' : '1px solid #F3F3F3',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-text-primary font-medium truncate" style={{ textDecoration: concluida ? 'line-through' : 'none' }}>
            {t.descricao}
          </span>
          {isRegistro ? (
            <span
              className="text-[10px] font-medium uppercase tracking-[0.04em] shrink-0"
              style={{
                padding: '1px 6px', borderRadius: '4px',
                color: '#999999', backgroundColor: 'rgba(153,153,153,0.1)',
                border: '1px solid rgba(153,153,153,0.2)',
              }}
            >
              Registro
            </span>
          ) : (
            <span
              className="text-[10px] font-medium uppercase tracking-[0.04em] shrink-0"
              style={{
                padding: '1px 6px', borderRadius: '4px',
                color: concluida ? '#16A34A' : '#CA8A04',
                backgroundColor: concluida ? 'rgba(22,163,74,0.1)' : 'rgba(202,138,4,0.1)',
                border: `1px solid ${concluida ? 'rgba(22,163,74,0.2)' : 'rgba(202,138,4,0.2)'}`,
              }}
            >
              {concluida ? 'Concluída' : 'Pendente'}
            </span>
          )}
        </div>
        <p className="text-[12px] text-text-subtle mt-0.5">
          {lojaMap[t.lojaId]?.nome ?? t.lojaNome ?? 'Loja removida'}
          {t.dataLembrete ? ` · ${formatDate(t.dataLembrete)}` : ''}
          {isAdmin && t.gestorNome ? ` · ${t.gestorNome}` : ''}
        </p>
        {t.observacao && (
          <p className="text-[12px] text-text-muted mt-1">{t.observacao}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!concluida && (
          <button
            onClick={() => onConcluir(t)}
            disabled={concluindoId === t.id}
            className="inline-flex items-center gap-1.5 text-[12px] text-positive hover:opacity-75 transition-opacity duration-150 px-2 py-1 rounded"
          >
            <Check size={13} strokeWidth={2} />
            Concluir
          </button>
        )}
        <button
          onClick={() => onExcluir(t)}
          disabled={excluindoId === t.id}
          className="inline-flex items-center gap-1.5 text-[12px] text-negative hover:opacity-75 transition-opacity duration-150 px-2 py-1 rounded"
        >
          <Trash2 size={13} strokeWidth={1.5} />
          Excluir
        </button>
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Atividades() {
  const { user, isAdmin, isSuperAdmin } = useAuth()
  const toast = useToast()

  const [activeTab, setActiveTab] = useState('tarefas')

  const [lojas,      setLojas]      = useState([])
  const [gestores,   setGestores]   = useState([])
  const [loadingBase, setLoadingBase] = useState(true)

  // ─ Histórico (feed global de ações, com filtro opcional por loja)
  const [filtroLojaHistorico,    setFiltroLojaHistorico]    = useState('')
  const [historicoAcoes,         setHistoricoAcoes]         = useState([])
  const [loadingHistorico,       setLoadingHistorico]       = useState(true)
  const [loadingMaisHistorico,   setLoadingMaisHistorico]   = useState(false)
  const [cursorHistorico,        setCursorHistorico]        = useState(null)
  const [hasMoreHistorico,       setHasMoreHistorico]       = useState(false)

  // ─ Tarefas
  const [tarefas,          setTarefas]          = useState([])
  const [loadingTarefas,   setLoadingTarefas]   = useState(true)
  const [tarefaModalOpen,  setTarefaModalOpen]  = useState(false)
  const [concluindoId,     setConcluindoId]     = useState(null)
  const [excluindoId,      setExcluindoId]      = useState(null)

  // ─ Ações
  const [filtroGestorAcoes,   setFiltroGestorAcoes]   = useState('')
  const [selectedLojaIdAcoes, setSelectedLojaIdAcoes] = useState('')
  const [acoes,               setAcoes]               = useState([])
  const [loadingAcoes,        setLoadingAcoes]        = useState(false)
  const [novaAcaoTexto,       setNovaAcaoTexto]       = useState('')
  const [salvandoNovaAcao,    setSalvandoNovaAcao]    = useState(false)
  const [excluindoAcaoId,     setExcluindoAcaoId]     = useState(null)

  // ─── Load lojas + gestores ──────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoadingBase(true)
      try {
        const orgId = user.organizacaoId ?? null
        const escopoOrg = isSuperAdmin ? [] : [where('organizacaoId', '==', orgId)]
        const [lojasSnap, gestoresSnap] = await Promise.all([
          isAdmin
            ? getDocs(query(collection(db, COLLECTIONS.LOJAS), ...escopoOrg))
            : getDocs(query(collection(db, COLLECTIONS.LOJAS), ...escopoOrg, where('gestorId', '==', user.uid))),
          isAdmin
            ? getDocs(query(collection(db, COLLECTIONS.USERS), ...escopoOrg, where('perfil', '==', 'gestor')))
            : Promise.resolve(null),
        ])
        if (cancelled) return
        setLojas(lojasSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => l.status?.toLowerCase() !== 'cancelada'))
        if (gestoresSnap) setGestores(gestoresSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } finally {
        if (!cancelled) setLoadingBase(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user, isAdmin, isSuperAdmin])

  const lojaMap   = useMemo(() => Object.fromEntries(lojas.map(l => [l.id, l])), [lojas])
  const gestorMap = useMemo(() => Object.fromEntries(gestores.map(g => [g.id, g])), [gestores])

  const tarefasAgendadas = useMemo(() => tarefas.filter(t => t.tipo !== 'registro'), [tarefas])
  const registros        = useMemo(() => tarefas.filter(t => t.tipo === 'registro'), [tarefas])

  const lojasVisiveisAcoes = useMemo(() => {
    if (!isAdmin || !filtroGestorAcoes) return lojas
    return lojas.filter(l => l.gestorId === filtroGestorAcoes)
  }, [lojas, isAdmin, filtroGestorAcoes])

  function tsMillis(ts) {
    if (!ts) return 0
    return ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime()
  }

  // ─── Histórico: feed global de `acoes` (gestor: só as suas; admin: todas) ──
  // Ordenado por timestamp decrescente no próprio Firestore, paginado de 100
  // em 100; o filtro por loja é só client-side sobre o que já foi carregado.

  async function loadHistorico(cursor = null) {
    const carregandoMais = !!cursor
    carregandoMais ? setLoadingMaisHistorico(true) : setLoadingHistorico(true)
    try {
      const constraints = []
      if (!isSuperAdmin) constraints.push(where('organizacaoId', '==', user.organizacaoId ?? null))
      if (!isAdmin) constraints.push(where('gestorId', '==', user.uid))
      constraints.push(orderBy('timestamp', 'desc'))
      if (cursor) constraints.push(startAfter(cursor))
      constraints.push(limit(HISTORICO_PAGE_SIZE))

      const snap = await getDocs(query(collection(db, COLLECTIONS.ACOES), ...constraints))
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setHistoricoAcoes(prev => carregandoMais ? [...prev, ...docs] : docs)
      setCursorHistorico(snap.docs[snap.docs.length - 1] ?? null)
      setHasMoreHistorico(snap.docs.length === HISTORICO_PAGE_SIZE)
    } catch (err) {
      console.error('[Atividades] erro ao carregar histórico:', err?.code, err?.message)
    } finally {
      carregandoMais ? setLoadingMaisHistorico(false) : setLoadingHistorico(false)
    }
  }

  useEffect(() => {
    if (!user) return
    loadHistorico()
  }, [user, isAdmin, isSuperAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  const historicoFiltrado = useMemo(() => {
    if (!filtroLojaHistorico) return historicoAcoes
    return historicoAcoes.filter(a => a.lojaId === filtroLojaHistorico)
  }, [historicoAcoes, filtroLojaHistorico])

  // ─── Ações: registro livre de atividades ───────────────────────────────────

  // Sem gestor nem loja selecionados: só faz sentido pro admin ficar sem nada
  // (estado vazio pedindo um filtro) — o gestor logado sempre tem um escopo
  // implícito (suas próprias lojas).
  const semFiltroAcoes = isAdmin && !filtroGestorAcoes && !selectedLojaIdAcoes

  async function loadAcoes() {
    if (semFiltroAcoes) { setAcoes([]); return }
    setLoadingAcoes(true)
    try {
      // Uma loja específica selecionada tem prioridade como filtro principal
      // da query (mais específico); sem loja, filtra pelo gestor (o
      // selecionado pelo admin, ou o próprio gestor logado).
      const [baseField, baseValue] = selectedLojaIdAcoes
        ? ['lojaId', selectedLojaIdAcoes]
        : ['gestorId', isAdmin ? filtroGestorAcoes : user.uid]

      const snap = await getDocs(query(
        collection(db, COLLECTIONS.ACOES),
        where(baseField, '==', baseValue),
        orderBy('timestamp', 'desc'),
        limit(100),
      ))
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      // Gestor + loja selecionados ao mesmo tempo: a query já filtrou por
      // loja, então aplica o gestor como segundo filtro client-side.
      if (selectedLojaIdAcoes && isAdmin && filtroGestorAcoes) {
        docs = docs.filter(a => a.gestorId === filtroGestorAcoes)
      }

      setAcoes(docs)
    } catch (err) {
      console.error('[Atividades] erro ao carregar ações:', err?.code, err?.message)
    } finally {
      setLoadingAcoes(false)
    }
  }

  useEffect(() => {
    if (!user) return
    loadAcoes()
  }, [user, isAdmin, filtroGestorAcoes, selectedLojaIdAcoes]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRegistrarNovaAcao() {
    if (!selectedLojaIdAcoes || !novaAcaoTexto.trim()) return
    setSalvandoNovaAcao(true)
    try {
      await addDoc(collection(db, COLLECTIONS.ACOES), {
        lojaId:        selectedLojaIdAcoes,
        gestorId:      user.uid,
        gestorNome:    user.nome ?? '',
        organizacaoId: user.organizacaoId ?? null,
        descricao:     novaAcaoTexto.trim(),
        timestamp:     serverTimestamp(),
      })
      setNovaAcaoTexto('')
      toast('Ação registrada.', 'success')
      loadAcoes()
    } catch (err) {
      console.error('[Atividades] erro ao registrar ação:', err?.code, err?.message)
      toast('Erro ao registrar ação. Tente novamente.', 'error')
    } finally {
      setSalvandoNovaAcao(false)
    }
  }

  async function handleExcluirAcao(acao) {
    setExcluindoAcaoId(acao.id)
    try {
      await deleteDoc(doc(db, COLLECTIONS.ACOES, acao.id))
      setAcoes(prev => prev.filter(a => a.id !== acao.id))
      toast('Ação excluída.', 'success')
    } catch (err) {
      console.error('[Atividades] erro ao excluir ação:', err?.code, err?.message)
      toast('Erro ao excluir ação.', 'error')
    } finally {
      setExcluindoAcaoId(null)
    }
  }

  // ─── Tarefas ────────────────────────────────────────────────────────────────

  async function loadTarefas() {
    setLoadingTarefas(true)
    try {
      const escopoOrg = isSuperAdmin ? [] : [where('organizacaoId', '==', user.organizacaoId ?? null)]
      const snap = isAdmin
        ? await getDocs(query(collection(db, COLLECTIONS.TAREFAS), ...escopoOrg))
        : await getDocs(query(collection(db, COLLECTIONS.TAREFAS), ...escopoOrg, where('gestorId', '==', user.uid)))
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      docs.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'pendente' ? -1 : 1
        return tsMillis(a.dataLembrete) - tsMillis(b.dataLembrete)
      })
      setTarefas(docs)
    } catch (err) {
      console.error('[Atividades] erro ao carregar tarefas:', err?.code, err?.message)
    } finally {
      setLoadingTarefas(false)
    }
  }

  useEffect(() => {
    if (!user) return
    loadTarefas()
  }, [user, isAdmin, isSuperAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSalvarTarefa(form) {
    let dataLembrete = null
    if (form.agendar) {
      const [ano, mes, dia] = form.data.split('-').map(Number)
      dataLembrete = Timestamp.fromDate(new Date(ano, mes - 1, dia))
    }

    await addDoc(collection(db, COLLECTIONS.TAREFAS), {
      lojaId:         form.lojaId,
      lojaNome:       lojaMap[form.lojaId]?.nome ?? '', // snapshot p/ o popup de lembrete não precisar buscar a loja
      gestorId:       user.uid,
      gestorNome:     user.nome ?? '',
      organizacaoId:  user.organizacaoId ?? null,
      descricao:    form.descricao.trim(),
      dataLembrete,
      observacao:   form.observacao.trim() || null,
      status:       'pendente',
      tipo:         form.agendar ? 'tarefa' : 'registro',
      criadoEm:     serverTimestamp(),
    })
    toast(form.agendar ? 'Tarefa criada.' : 'Registro criado.', 'success')
    loadTarefas()
  }

  async function handleConcluirTarefa(tarefa) {
    setConcluindoId(tarefa.id)
    try {
      await updateDoc(doc(db, COLLECTIONS.TAREFAS, tarefa.id), {
        status: 'concluida',
        concluidoEm: serverTimestamp(),
      })
      setTarefas(prev => prev.map(t => t.id === tarefa.id ? { ...t, status: 'concluida' } : t))
      toast('Tarefa concluída.', 'success')
    } catch (err) {
      console.error('[Atividades] erro ao concluir tarefa:', err?.code, err?.message)
      toast('Erro ao concluir tarefa.', 'error')
    } finally {
      setConcluindoId(null)
    }
  }

  async function handleExcluirTarefa(tarefa) {
    setExcluindoId(tarefa.id)
    try {
      await deleteDoc(doc(db, COLLECTIONS.TAREFAS, tarefa.id))
      setTarefas(prev => prev.filter(t => t.id !== tarefa.id))
      toast('Tarefa excluída.', 'success')
    } catch (err) {
      console.error('[Atividades] erro ao excluir tarefa:', err?.code, err?.message)
      toast('Erro ao excluir tarefa.', 'error')
    } finally {
      setExcluindoId(null)
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
      <div className="page-header">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Atividades</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        {[['tarefas', 'Tarefas'], ['acoes', 'Ações'], ['historico', 'Histórico']].map(([v, l]) => (
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

      {/* ── Aba Ações ──────────────────────────────────────────────────────── */}
      {activeTab === 'acoes' && (
        loadingBase ? (
          <Skeleton.Table rows={5} cols={2} />
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              {isAdmin && (
                <select
                  value={filtroGestorAcoes}
                  onChange={e => { setFiltroGestorAcoes(e.target.value); setSelectedLojaIdAcoes('') }}
                  className="select w-52"
                >
                  <option value="">Todos os gestores</option>
                  {gestores.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              )}
              <LojaSelect
                lojas={lojasVisiveisAcoes}
                value={selectedLojaIdAcoes}
                onChange={setSelectedLojaIdAcoes}
                gestorMap={gestorMap}
                className="w-64"
              />
            </div>

            {semFiltroAcoes ? (
              <div className="bg-surface border border-border rounded-lg shadow-card flex items-center justify-center py-16">
                <p className="text-[13px] text-text-subtle">Selecione um gestor ou uma loja para ver as ações.</p>
              </div>
            ) : (
              <>
                {/* Registrar ação — só quando uma loja específica está selecionada */}
                {selectedLojaIdAcoes && (
                  <div className="bg-surface border border-border rounded-lg shadow-card" style={{ padding: '16px' }}>
                    <p className="field-label mb-2">O que foi feito?</p>
                    <textarea
                      value={novaAcaoTexto}
                      onChange={e => setNovaAcaoTexto(e.target.value)}
                      placeholder="Ex: Ajustei o hits, ativei campanha de desconto, atualizei fotos do cardápio…"
                      rows={3}
                      className="textarea"
                    />
                    <div className="flex items-center justify-end mt-3">
                      <button
                        onClick={handleRegistrarNovaAcao}
                        disabled={salvandoNovaAcao || !novaAcaoTexto.trim()}
                        className="btn-primary"
                      >
                        {salvandoNovaAcao ? 'Salvando…' : 'Registrar Ação'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Lista */}
                <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
                  {loadingAcoes ? (
                    <Skeleton.Table rows={5} cols={2} />
                  ) : acoes.length === 0 ? (
                    <p className="text-[13px] text-text-subtle text-center py-10">
                      Nenhuma ação encontrada.
                    </p>
                  ) : (
                    <motion.div variants={listVariants} initial="initial" animate="animate">
                      {acoes.map((a, idx) => {
                        const podeExcluir = isAdmin || a.gestorId === user.uid
                        return (
                          <motion.div
                            key={a.id}
                            variants={itemVariants}
                            style={{
                              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
                              padding: '12px 16px',
                              borderBottom: idx < acoes.length - 1 ? '1px solid #F3F3F3' : 'none',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] text-text-subtle whitespace-nowrap">{formatDateTime(a.timestamp)}</span>
                                {a.origem === 'relatorio_semanal' && (
                                  <span
                                    className="text-[10px] font-medium shrink-0"
                                    style={{
                                      padding: '1px 6px', borderRadius: '10px',
                                      color: '#666666', backgroundColor: '#F3F3F3',
                                    }}
                                  >
                                    Relatório Semanal
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[13px] text-text-primary font-semibold">
                                  {lojaMap[a.lojaId]?.nome ?? a.lojaName ?? 'Loja removida'}
                                </span>
                                <span className="text-[12px] text-text-subtle">· {a.gestorNome || '—'}</span>
                              </div>
                              <p className="text-[13px] text-text-muted leading-relaxed mt-1">{a.descricao}</p>
                              {(a.semana || a.plataforma) && (
                                <p className="text-[11px] mt-0.5" style={{ color: '#999999' }}>
                                  {[a.semana, a.plataforma].filter(Boolean).join(' · ')}
                                </p>
                              )}
                            </div>
                            {podeExcluir && (
                              <button
                                onClick={() => handleExcluirAcao(a)}
                                disabled={excluindoAcaoId === a.id}
                                className="inline-flex items-center gap-1.5 text-[12px] text-negative hover:opacity-75 transition-opacity duration-150 px-2 py-1 rounded shrink-0"
                              >
                                <Trash2 size={13} strokeWidth={1.5} />
                              </button>
                            )}
                          </motion.div>
                        )
                      })}
                    </motion.div>
                  )}
                </div>
              </>
            )}
          </div>
        )
      )}

      {/* ── Aba Histórico ─────────────────────────────────────────────────── */}
      {activeTab === 'historico' && (
        loadingBase ? (
          <Skeleton.Table rows={5} cols={2} />
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <LojaSelect
                lojas={lojas}
                value={filtroLojaHistorico}
                onChange={setFiltroLojaHistorico}
                gestorMap={gestorMap}
                placeholder="Filtrar por loja..."
                className="w-64"
              />
            </div>

            <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
              {loadingHistorico ? (
                <Skeleton.Table rows={6} cols={2} />
              ) : historicoFiltrado.length === 0 ? (
                <p className="text-[13px] text-text-subtle text-center py-10">
                  {filtroLojaHistorico ? 'Nenhuma ação registrada para esta loja ainda.' : 'Nenhuma ação registrada ainda.'}
                </p>
              ) : (
                <motion.div variants={listVariants} initial="initial" animate="animate">
                  {historicoFiltrado.map((a, idx) => (
                    <motion.div
                      key={a.id}
                      variants={itemVariants}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: '4px',
                        padding: '12px 16px',
                        borderBottom: idx < historicoFiltrado.length - 1 ? '1px solid #F3F3F3' : 'none',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-text-subtle whitespace-nowrap">{formatDateTime(a.timestamp)}</span>
                        {a.origem === 'relatorio_semanal' && (
                          <span
                            className="text-[10px] font-medium shrink-0"
                            style={{ padding: '1px 6px', borderRadius: '10px', color: '#666666', backgroundColor: '#F3F3F3' }}
                          >
                            Relatório Semanal
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-text-primary font-semibold">
                          {lojaMap[a.lojaId]?.nome ?? a.lojaName ?? 'Loja removida'}
                        </span>
                        <span className="text-[12px] text-text-subtle">· {a.gestorNome || '—'}</span>
                      </div>
                      <p className="text-[13px] text-text-muted leading-relaxed">{a.descricao}</p>
                      {(a.semana || a.plataforma) && (
                        <p className="text-[11px]" style={{ color: '#999999' }}>
                          {[a.semana, a.plataforma].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>

            {!loadingHistorico && hasMoreHistorico && (
              <div className="flex justify-center">
                <button
                  onClick={() => loadHistorico(cursorHistorico)}
                  disabled={loadingMaisHistorico}
                  className="btn-secondary"
                >
                  {loadingMaisHistorico ? 'Carregando…' : 'Carregar mais'}
                </button>
              </div>
            )}
          </div>
        )
      )}

      {/* ── Aba Tarefas ───────────────────────────────────────────────────── */}
      {activeTab === 'tarefas' && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-end">
            <button onClick={() => setTarefaModalOpen(true)} className="btn-primary flex items-center gap-2 h-9">
              <Plus size={15} strokeWidth={2} />
              Nova Tarefa
            </button>
          </div>

          <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
            {loadingBase || loadingTarefas ? (
              <Skeleton.Table rows={5} cols={4} />
            ) : tarefasAgendadas.length === 0 ? (
              <p className="text-[13px] text-text-subtle text-center py-10">
                Nenhuma tarefa agendada.
              </p>
            ) : (
              <motion.div variants={listVariants} initial="initial" animate="animate">
                {tarefasAgendadas.map((t, idx) => (
                  <TarefaRow
                    key={t.id}
                    tarefa={t}
                    isLast={idx === tarefasAgendadas.length - 1}
                    lojaMap={lojaMap}
                    isAdmin={isAdmin}
                    concluindoId={concluindoId}
                    excluindoId={excluindoId}
                    onConcluir={handleConcluirTarefa}
                    onExcluir={handleExcluirTarefa}
                  />
                ))}
              </motion.div>
            )}
          </div>

          {!loadingBase && !loadingTarefas && registros.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="section-label">Registros</p>
              <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
                <motion.div variants={listVariants} initial="initial" animate="animate">
                  {registros.map((t, idx) => (
                    <TarefaRow
                      key={t.id}
                      tarefa={t}
                      isLast={idx === registros.length - 1}
                      lojaMap={lojaMap}
                      isAdmin={isAdmin}
                      concluindoId={concluindoId}
                      excluindoId={excluindoId}
                      onConcluir={handleConcluirTarefa}
                      onExcluir={handleExcluirTarefa}
                    />
                  ))}
                </motion.div>
              </div>
            </div>
          )}
        </div>
      )}

      <NovaTarefaModal
        isOpen={tarefaModalOpen}
        onClose={() => setTarefaModalOpen(false)}
        onSave={handleSalvarTarefa}
        lojas={lojas}
        gestorMap={gestorMap}
      />
    </motion.div>
  )
}
