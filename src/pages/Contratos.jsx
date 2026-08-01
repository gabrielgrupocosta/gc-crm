import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search } from 'lucide-react'
import {
  db, COLLECTIONS,
  collection, doc, query, where, getDocs, getDoc, addDoc, updateDoc, deleteDoc, Timestamp, serverTimestamp,
} from '../services/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/UI/Toast'
import Modal from '../components/UI/Modal'
import ConfirmModal from '../components/UI/ConfirmModal'
import Skeleton from '../components/UI/Skeleton'
import LojasContratoBuilder, { EMPTY_LOJA_CONTRATO_ITEM, somaValorLojas } from '../components/UI/LojasContratoBuilder'
import { parseLocalDate } from '../utils/format'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONTRATO_LABEL = { ativo: 'Ativo', futuro: 'Futuro', encerrado: 'Encerrado' }

// Dia da semana de vencimento (pagamento semanal) — valores no padrão
// Date#getDay() (0=domingo..6=sábado), o mesmo usado na geração de cobranças
// na Cloud Function, pra não precisar converter nada entre front e back.
const DIAS_SEMANA_OPTIONS = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]

function diaSemanaDeDataInicio(dataInicioStr) {
  return dataInicioStr ? new Date(dataInicioStr + 'T00:00:00').getDay() : new Date().getDay()
}

const EMPTY_FORM = {
  modoCliente: 'novo', clienteId: '',
  novoClienteNome: '', novoClienteTelefone: '', novoClienteEmail: '', novoClienteOrganizacaoId: '',
  lojasContrato: [{ ...EMPTY_LOJA_CONTRATO_ITEM }],
  tipoPagamento: 'mensal', dataInicio: '', diaVencimentoSemanal: null, observacoes: '',
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('pt-BR')
}

function formatBRL(n) {
  if (n == null || n === '') return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

// "Valor total" precisa representar o valor mensal do contrato — pra
// pagamento semanal isso é o valor por ciclo vezes a média de semanas por
// mês (52 semanas / 12 meses ≈ 4,3). O valor bruto salvo no contrato
// continua sendo o valor por ciclo (é o que a cobrança automática usa);
// essa conversão é só de exibição.
function valorMensalEquivalente(contrato) {
  if (contrato.valorTotal == null) return contrato.valorTotal
  return contrato.tipoPagamento === 'semanal' ? contrato.valorTotal * 4.3 : contrato.valorTotal
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

// ─── Badge de status do contrato ──────────────────────────────────────────────

function StatusContratoBadge({ status }) {
  const cores = {
    ativo:     { color: '#16A34A', bg: 'rgba(22,163,74,0.1)' },
    futuro:    { color: '#CA8A04', bg: 'rgba(202,138,4,0.1)' },
    encerrado: { color: '#999999', bg: 'rgba(153,153,153,0.1)' },
  }
  const c = cores[status] ?? cores.encerrado
  return (
    <span
      className="text-[10px] font-medium uppercase tracking-[0.04em]"
      style={{ padding: '2px 8px', borderRadius: '4px', color: c.color, backgroundColor: c.bg }}
    >
      {STATUS_CONTRATO_LABEL[status] ?? status}
    </span>
  )
}

// (PlataformaPills e o builder de lojas do contrato vivem em
// components/UI/LojasContratoBuilder.jsx — compartilhado com Clientes.jsx)

// ─── Modal: novo contrato ──────────────────────────────────────────────────────

function NovoContratoModal({ isOpen, onClose, onSave, clientes, organizacoes, isSuperAdmin, gestores }) {
  const [form,   setForm]   = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setForm({
      ...EMPTY_FORM,
      lojasContrato: [{ ...EMPTY_LOJA_CONTRATO_ITEM }],
      // admin_org só tem a própria organização — já nasce preenchida, sem
      // precisar escolher (mesmo padrão do resto do sistema).
      novoClienteOrganizacaoId: !isSuperAdmin ? (organizacoes[0]?.id ?? '') : '',
    })
  }, [isOpen, isSuperAdmin, organizacoes])

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

  const clienteValido = form.modoCliente === 'existente'
    ? !!form.clienteId
    : form.novoClienteNome.trim().length > 0 && (!isSuperAdmin || !!form.novoClienteOrganizacaoId)
  const lojasValidas = form.lojasContrato.length > 0 && form.lojasContrato.every(item =>
    item.nome.trim().length > 0 && item.valor !== '' && !isNaN(parseFloat(String(item.valor).replace(',', '.')))
  )
  const canSave = clienteValido && lojasValidas && form.dataInicio

  const clientesOrdenados = useMemo(
    () => [...clientes].sort((a, b) => a.nome?.localeCompare(b.nome ?? '') ?? 0),
    [clientes]
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Novo contrato"
      width="max-w-md"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button form="contrato-form" type="submit" disabled={!canSave || saving} className="btn-primary">
            {saving ? 'Salvando…' : 'Criar contrato'}
          </button>
        </>
      }
    >
      <form id="contrato-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {/* Abas: novo cliente x cliente existente */}
        <div className="flex gap-4 border-b border-border">
          {[{ key: 'novo', label: 'Novo cliente' }, { key: 'existente', label: 'Cliente existente' }].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => set('modoCliente', tab.key)}
              className="text-[13px] font-medium pb-2"
              style={{
                color: form.modoCliente === tab.key ? '#111111' : '#999999',
                borderBottom: form.modoCliente === tab.key ? '2px solid #FF4B2E' : '2px solid transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {form.modoCliente === 'existente' ? (
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="ct-cliente">Cliente</label>
            <select
              id="ct-cliente"
              value={form.clienteId}
              onChange={e => set('clienteId', e.target.value)}
              className="select"
              required
              autoFocus
            >
              <option value="">Selecione</option>
              {clientesOrdenados.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {isSuperAdmin && (
              <div className="flex flex-col gap-1.5">
                <label className="field-label" htmlFor="ct-nc-org">Organização</label>
                <select
                  id="ct-nc-org"
                  value={form.novoClienteOrganizacaoId}
                  onChange={e => set('novoClienteOrganizacaoId', e.target.value)}
                  className="select"
                  required
                >
                  <option value="">Selecione</option>
                  {organizacoes.map(org => <option key={org.id} value={org.id}>{org.nome}</option>)}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="field-label" htmlFor="ct-nc-nome">Nome do cliente</label>
              <input
                id="ct-nc-nome" type="text"
                value={form.novoClienteNome}
                onChange={e => set('novoClienteNome', e.target.value)}
                placeholder="Nome do cliente ou empresa"
                className="input"
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="field-label" htmlFor="ct-nc-tel">Telefone</label>
                <input
                  id="ct-nc-tel" type="tel"
                  value={form.novoClienteTelefone}
                  onChange={e => set('novoClienteTelefone', e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="input"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="field-label" htmlFor="ct-nc-email">E-mail</label>
                <input
                  id="ct-nc-email" type="email"
                  value={form.novoClienteEmail}
                  onChange={e => set('novoClienteEmail', e.target.value)}
                  placeholder="contato@empresa.com"
                  className="input"
                />
              </div>
            </div>
          </div>
        )}

        {/* Lojas do contrato — uma ou mais, cada uma com valor próprio (soma vira o valor total do contrato) */}
        <div className="pt-2 border-t border-border">
          <LojasContratoBuilder itens={form.lojasContrato} onChange={v => set('lojasContrato', v)} gestores={gestores} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="ct-tipo">Tipo de pagamento</label>
          <select id="ct-tipo" value={form.tipoPagamento} onChange={e => set('tipoPagamento', e.target.value)} className="select w-40">
            <option value="mensal">Mensal</option>
            <option value="semanal">Semanal</option>
          </select>
        </div>

        {form.tipoPagamento === 'semanal' && (
          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="ct-dia-venc">Dia de vencimento semanal</label>
            <select
              id="ct-dia-venc"
              value={form.diaVencimentoSemanal ?? diaSemanaDeDataInicio(form.dataInicio)}
              onChange={e => set('diaVencimentoSemanal', Number(e.target.value))}
              className="select w-48"
            >
              {DIAS_SEMANA_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
            <span className="text-[11px] text-text-subtle leading-snug">
              Toda cobrança semanal cai nesse dia — por padrão, o mesmo dia da semana do início do contrato.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="ct-data">Início do contrato</label>
          <input
            id="ct-data" type="date"
            value={form.dataInicio || hojeDateInput()}
            onChange={e => set('dataInicio', e.target.value)}
            className="input"
          />
          <span className="text-[11px] text-text-subtle leading-snug">
            Data de hoje ou passada ativa o contrato na hora (encerrando o contrato ativo atual do cliente, se houver). Data futura cria como "futuro" — vira ativo automaticamente ao chegar a data.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="ct-obs">Observações</label>
          <textarea
            id="ct-obs" value={form.observacoes}
            onChange={e => set('observacoes', e.target.value)}
            placeholder="Notas sobre este contrato…"
            rows={2} className="textarea"
          />
        </div>
      </form>
    </Modal>
  )
}

// ─── Modal: editar contrato ────────────────────────────────────────────────────

function EditarContratoModal({ isOpen, onClose, onSave, onPedirExclusao, contrato, clienteNome, gestores }) {
  const [form,     setForm]     = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!isOpen || !contrato) { setForm(null); return }
    let cancelled = false
    setCarregando(true)
    ;(async () => {
      // As lojas do contrato guardam gestor/plataformas/status só no próprio
      // doc da loja (o item do contrato só tem lojaId/lojaNome/valor) — busca
      // cada uma pra pré-preencher o formulário de edição.
      const itens = await Promise.all((contrato.itensLojas ?? []).map(async item => {
        const lojaSnap = await getDoc(doc(db, COLLECTIONS.LOJAS, item.lojaId))
        const loja = lojaSnap.exists() ? lojaSnap.data() : {}
        return {
          lojaId:      item.lojaId,
          nome:        loja.nome ?? item.lojaNome ?? '',
          gestorId:    loja.gestorId ?? '',
          plataformas: loja.plataformas ?? (loja.plataforma ? [loja.plataforma] : []),
          status:      loja.status ?? 'Ativa',
          valor:       item.valor ?? '',
        }
      }))
      if (cancelled) return
      setForm({
        lojasContrato: itens.length ? itens : [{ ...EMPTY_LOJA_CONTRATO_ITEM }],
        tipoPagamento: contrato.tipoPagamento ?? 'mensal',
        diaVencimentoSemanal: contrato.diaVencimentoSemanal ?? null,
        dataInicio: contrato.dataInicio?.toDate ? contrato.dataInicio.toDate().toISOString().split('T')[0] : hojeDateInput(),
        observacoes: contrato.observacoes ?? '',
      })
      setCarregando(false)
    })()
    return () => { cancelled = true }
  }, [isOpen, contrato])

  function set(key, value) { setForm(prev => ({ ...prev, [key]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving || !form) return
    setSaving(true)
    try {
      await onSave(contrato, form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const lojasValidas = !!form && form.lojasContrato.length > 0 && form.lojasContrato.every(item =>
    item.nome.trim().length > 0 && item.valor !== '' && !isNaN(parseFloat(String(item.valor).replace(',', '.')))
  )
  const canSave = !!form && lojasValidas && form.dataInicio

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Editar contrato — ${clienteNome ?? ''}`}
      width="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={() => onPedirExclusao(contrato)}
            className="text-[13px] text-negative hover:opacity-80 transition-opacity duration-150 mr-auto"
          >
            Excluir contrato
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button form="editar-contrato-form" type="submit" disabled={!canSave || saving} className="btn-primary">
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </>
      }
    >
      {carregando || !form ? (
        <div className="py-8 flex justify-center"><Skeleton className="w-full h-32" /></div>
      ) : (
        <form id="editar-contrato-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="pt-0">
            <LojasContratoBuilder itens={form.lojasContrato} onChange={v => set('lojasContrato', v)} gestores={gestores} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="ect-tipo">Tipo de pagamento</label>
            <select id="ect-tipo" value={form.tipoPagamento} onChange={e => set('tipoPagamento', e.target.value)} className="select w-40">
              <option value="mensal">Mensal</option>
              <option value="semanal">Semanal</option>
            </select>
          </div>

          {form.tipoPagamento === 'semanal' && (
            <div className="flex flex-col gap-1.5">
              <label className="field-label" htmlFor="ect-dia-venc">Dia de vencimento semanal</label>
              <select
                id="ect-dia-venc"
                value={form.diaVencimentoSemanal ?? diaSemanaDeDataInicio(form.dataInicio)}
                onChange={e => set('diaVencimentoSemanal', Number(e.target.value))}
                className="select w-48"
              >
                {DIAS_SEMANA_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="ect-data">Início do contrato</label>
            <input
              id="ect-data" type="date"
              value={form.dataInicio}
              onChange={e => set('dataInicio', e.target.value)}
              className="input"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="field-label" htmlFor="ect-obs">Observações</label>
            <textarea
              id="ect-obs" value={form.observacoes}
              onChange={e => set('observacoes', e.target.value)}
              placeholder="Notas sobre este contrato…"
              rows={2} className="textarea"
            />
          </div>
        </form>
      )}
    </Modal>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Contratos() {
  const toast = useToast()
  const { user, isSuperAdmin } = useAuth()

  const [contratos,    setContratos]    = useState([])
  const [clientes,     setClientes]     = useState([])
  const [gestores,     setGestores]     = useState([])
  const [organizacoes, setOrganizacoes] = useState([])
  const [loading,      setLoading]      = useState(true)

  const [search,       setSearch]       = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingContrato, setEditingContrato] = useState(null)
  const [contratoParaExcluir, setContratoParaExcluir] = useState(null)

  async function loadAll() {
    setLoading(true)
    try {
      const orgId  = user?.organizacaoId ?? null
      const escopo = isSuperAdmin ? [] : [where('organizacaoId', '==', orgId)]

      // Contas usam o campo `role` — nenhuma conta atual tem o `perfil` legado
      // (mesmo padrão de Clientes.jsx/Lojas.jsx). Antes, o branch de master
      // buscava por `perfil` e nunca achava ninguém.
      const gestoresQuery = isSuperAdmin
        ? query(collection(db, COLLECTIONS.USERS), where('role', '==', 'gestor'))
        : query(collection(db, COLLECTIONS.USERS), where('organizacaoId', '==', orgId), where('role', '==', 'gestor'))

      const [contratosSnap, clientesSnap, gestoresSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.CONTRATOS), ...escopo)),
        getDocs(query(collection(db, COLLECTIONS.CLIENTES), ...escopo)),
        getDocs(gestoresQuery),
      ])
      setContratos(contratosSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setClientes(clientesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setGestores(gestoresSnap.docs.map(d => ({ id: d.id, ...d.data() })))

      if (isSuperAdmin) {
        const orgsSnap = await getDocs(collection(db, COLLECTIONS.ORGANIZACOES))
        setOrganizacoes(orgsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } else if (orgId) {
        const orgSnap = await getDoc(doc(db, COLLECTIONS.ORGANIZACOES, orgId))
        setOrganizacoes(orgSnap.exists() ? [{ id: orgSnap.id, ...orgSnap.data() }] : [])
      }
    } catch (err) {
      console.error('[Contratos] loadAll:', err)
      toast('Erro ao carregar dados: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-ativação de contratos futuros — mesmo mecanismo usado na seção de
  // Contratos dentro do cadastro de Cliente (ver Clientes.jsx).
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
        console.error('[Contratos] auto-ativação:', err)
      }
    })
  }, [contratos]) // eslint-disable-line react-hooks/exhaustive-deps

  const clienteMap = useMemo(
    () => Object.fromEntries(clientes.map(c => [c.id, c])),
    [clientes]
  )

  const organizacaoMap = useMemo(
    () => Object.fromEntries(organizacoes.map(o => [o.id, o.nome])),
    [organizacoes]
  )

  const contratosFiltrados = useMemo(() => {
    const term = search.toLowerCase()
    return contratos
      .filter(c => {
        const nomeCliente = clienteMap[c.clienteId]?.nome ?? ''
        const matchNome   = !term || nomeCliente.toLowerCase().includes(term)
        const matchStatus = !filtroStatus || c.status === filtroStatus
        return matchNome && matchStatus
      })
      .sort((a, b) => (b.dataInicio?.toMillis?.() ?? 0) - (a.dataInicio?.toMillis?.() ?? 0))
  }, [contratos, clienteMap, search, filtroStatus])

  async function handleCriarContrato(form) {
    let clienteId = form.clienteId
    let orgId

    if (form.modoCliente === 'novo') {
      // Cliente nasce direto no fluxo de contrato — evita ter que ir cadastrar
      // em Clientes primeiro pra depois voltar aqui e criar o contrato.
      orgId = isSuperAdmin ? form.novoClienteOrganizacaoId : (user?.organizacaoId ?? null)
      const ref = await addDoc(collection(db, COLLECTIONS.CLIENTES), {
        nome:        form.novoClienteNome.trim(),
        organizacaoId: orgId,
        telefone:    form.novoClienteTelefone.trim(),
        email:       form.novoClienteEmail.trim().toLowerCase(),
        status:      'Ativo',
        dataInicio:  null,
        observacoes: '',
        criadoEm:    serverTimestamp(),
      })
      clienteId = ref.id
    } else {
      const cliente = clienteMap[form.clienteId]
      if (!cliente) return
      orgId = cliente.organizacaoId ?? (isSuperAdmin ? null : user?.organizacaoId ?? null)
    }

    const dataInicioDate = form.dataInicio ? parseLocalDate(form.dataInicio) : new Date()
    const agora    = new Date()
    const imediato = dataInicioDate <= agora

    // Cada linha de "lojas do contrato" vira uma loja nova vinculada ao
    // cliente — o valor de cada uma vai pro item do contrato, e a soma é o
    // valorTotal (não existe mais um valor único pro contrato inteiro). A
    // loja nasce com a mesma dataInicio do contrato — sem isso, o "Tempo de
    // contrato atual" da Carteira fica sem dado nenhum pra calcular.
    const itensLojas = []
    for (const item of form.lojasContrato) {
      const lojaRef = await addDoc(collection(db, COLLECTIONS.LOJAS), {
        nome:          item.nome.trim(),
        organizacaoId: orgId,
        clienteId,
        gestorId:      item.gestorId || null,
        plataformas:   item.plataformas,
        plataforma:    item.plataformas[0] ?? '',
        status:        item.status,
        dataInicio:    Timestamp.fromDate(dataInicioDate),
        observacoes:   '',
        ...(item.entrarOnboard ? { onboardStatus: 'dados_pendentes' } : {}),
        criadoEm:      serverTimestamp(),
      })
      const valorLoja = parseFloat(String(item.valor).replace(',', '.'))
      itensLojas.push({ lojaId: lojaRef.id, lojaNome: item.nome.trim(), valor: isNaN(valorLoja) ? 0 : valorLoja })
    }
    const valorTotal = somaValorLojas(form.lojasContrato)

    const contratosDoCliente = contratos.filter(c => c.clienteId === clienteId)
    const ativoAtual = contratosDoCliente.find(c => c.status === 'ativo')

    if (imediato && ativoAtual) {
      await updateDoc(doc(db, COLLECTIONS.CONTRATOS, ativoAtual.id), {
        status: 'encerrado',
        dataFim: Timestamp.fromDate(dataInicioDate),
      })
    }

    await addDoc(collection(db, COLLECTIONS.CONTRATOS), {
      organizacaoId: orgId,
      clienteId,
      tipoPagamento: form.tipoPagamento,
      diaVencimentoSemanal: form.tipoPagamento === 'semanal'
        ? (form.diaVencimentoSemanal ?? diaSemanaDeDataInicio(form.dataInicio))
        : null,
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

  async function handleEditarContrato(contrato, form) {
    const orgId = contrato.organizacaoId ?? user?.organizacaoId ?? null
    const idsOriginais = new Set((contrato.itensLojas ?? []).map(i => i.lojaId))
    const idsMantidos  = new Set()
    const dataInicioContrato = form.dataInicio ? Timestamp.fromDate(parseLocalDate(form.dataInicio)) : null

    const itensLojas = []
    for (const item of form.lojasContrato) {
      const valorLoja = parseFloat(String(item.valor).replace(',', '.'))
      const dadosLoja = {
        nome:        item.nome.trim(),
        gestorId:    item.gestorId || null,
        plataformas: item.plataformas,
        plataforma:  item.plataformas[0] ?? '',
        status:      item.status,
        // Mantém a loja sincronizada com a dataInicio do contrato — sem isso,
        // lojas já existentes nunca recebiam essa data ao editar o contrato
        // (só lojas novas criadas na própria edição ganhavam o campo).
        ...(dataInicioContrato ? { dataInicio: dataInicioContrato } : {}),
      }

      if (item.lojaId) {
        idsMantidos.add(item.lojaId)
        await updateDoc(doc(db, COLLECTIONS.LOJAS, item.lojaId), dadosLoja)
        itensLojas.push({ lojaId: item.lojaId, lojaNome: dadosLoja.nome, valor: isNaN(valorLoja) ? 0 : valorLoja })
      } else {
        const lojaRef = await addDoc(collection(db, COLLECTIONS.LOJAS), {
          ...dadosLoja,
          organizacaoId: orgId,
          clienteId: contrato.clienteId,
          observacoes: '',
          ...(item.entrarOnboard ? { onboardStatus: 'dados_pendentes' } : {}),
          criadoEm: serverTimestamp(),
        })
        itensLojas.push({ lojaId: lojaRef.id, lojaNome: dadosLoja.nome, valor: isNaN(valorLoja) ? 0 : valorLoja })
      }
    }

    // Loja removida do contrato na edição: não deletamos, só arquivamos
    // (regra do sistema é nunca apagar dados, usar status pra arquivar).
    for (const lojaId of idsOriginais) {
      if (!idsMantidos.has(lojaId)) {
        await updateDoc(doc(db, COLLECTIONS.LOJAS, lojaId), { status: 'Cancelada' })
      }
    }

    const valorTotal = somaValorLojas(form.lojasContrato)
    await updateDoc(doc(db, COLLECTIONS.CONTRATOS, contrato.id), {
      tipoPagamento: form.tipoPagamento,
      diaVencimentoSemanal: form.tipoPagamento === 'semanal'
        ? (form.diaVencimentoSemanal ?? diaSemanaDeDataInicio(form.dataInicio))
        : null,
      itensLojas,
      valorTotal,
      dataInicio: Timestamp.fromDate(parseLocalDate(form.dataInicio)),
      observacoes: form.observacoes.trim() || null,
    })

    toast('Contrato atualizado.', 'success')
    await loadAll()
  }

  async function handleExcluirContrato() {
    if (!contratoParaExcluir) return
    try {
      await deleteDoc(doc(db, COLLECTIONS.CONTRATOS, contratoParaExcluir.id))
      toast('Contrato excluído.', 'success')
      setContratoParaExcluir(null)
      await loadAll()
    } catch (err) {
      console.error('[Contratos] excluir:', err)
      toast('Erro ao excluir contrato.', 'error')
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
      <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Contratos</h1>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center justify-center gap-2 h-11 sm:h-9">
          <Plus size={15} strokeWidth={2} />
          Novo contrato
        </button>
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
          <option value="ativo">Ativo</option>
          <option value="futuro">Futuro</option>
          <option value="encerrado">Encerrado</option>
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
          <Skeleton.Table rows={8} cols={isSuperAdmin ? 8 : 7} />
        ) : contratosFiltrados.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-[13px] text-text-subtle">
              {contratos.length === 0 ? 'Nenhum contrato cadastrado.' : 'Nenhum contrato encontrado.'}
            </p>
          </div>
        ) : (
          <>
          {/* Desktop: tabela */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-border">
                  {[...(isSuperAdmin ? ['Cliente', 'Organização', 'Tipo', 'Lojas', 'Valor total', 'Início', 'Fim', 'Status'] : ['Cliente', 'Tipo', 'Lojas', 'Valor total', 'Início', 'Fim', 'Status'])].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left section-label font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <motion.tbody variants={listVariants} initial="initial" animate="animate">
                {contratosFiltrados.map(c => (
                  <motion.tr
                    key={c.id}
                    variants={itemVariants}
                    className="table-row-base cursor-pointer"
                    onClick={() => setEditingContrato(c)}
                  >
                    <td className="px-4 h-12 text-[14px] text-text-primary font-medium max-w-[200px]">
                      <span className="block truncate">{clienteMap[c.clienteId]?.nome ?? '—'}</span>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 h-12 text-[13px] text-text-muted max-w-[180px]">
                        <span className="block truncate">{organizacaoMap[c.organizacaoId] ?? '—'}</span>
                      </td>
                    )}
                    <td className="px-4 h-12 text-[13px] text-text-muted whitespace-nowrap">
                      {c.tipoPagamento === 'semanal' ? 'Semanal' : 'Mensal'}
                    </td>
                    <td className="px-4 h-12 text-[13px] text-text-muted whitespace-nowrap" title={(c.itensLojas ?? []).map(i => i.lojaNome).join(', ')}>
                      {(c.itensLojas ?? []).length}
                    </td>
                    <td className="px-4 h-12 font-mono text-[13px] text-text-muted whitespace-nowrap">
                      {formatBRL(valorMensalEquivalente(c))}
                    </td>
                    <td className="px-4 h-12 font-mono text-[13px] text-text-muted whitespace-nowrap">
                      {formatDate(c.dataInicio)}
                    </td>
                    <td className="px-4 h-12 font-mono text-[13px] text-text-muted whitespace-nowrap">
                      {formatDate(c.dataFim)}
                    </td>
                    <td className="px-4 h-12">
                      <StatusContratoBadge status={c.status} />
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <motion.div className="sm:hidden flex flex-col" variants={listVariants} initial="initial" animate="animate">
            {contratosFiltrados.map(c => (
              <motion.div
                key={c.id}
                variants={itemVariants}
                onClick={() => setEditingContrato(c)}
                className="p-4 border-b border-border-subtle last:border-0 flex flex-col gap-2 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[14px] text-text-primary font-medium truncate">{clienteMap[c.clienteId]?.nome ?? '—'}</span>
                  <StatusContratoBadge status={c.status} />
                </div>
                {isSuperAdmin && (
                  <span className="text-[12px] text-text-subtle">{organizacaoMap[c.organizacaoId] ?? '—'}</span>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-muted font-mono">
                  <span>{formatBRL(valorMensalEquivalente(c))}</span>
                  <span>{c.tipoPagamento === 'semanal' ? 'Semanal' : 'Mensal'}</span>
                  <span>{(c.itensLojas ?? []).length} loja{(c.itensLojas ?? []).length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-text-subtle font-mono">
                  <span>Início: {formatDate(c.dataInicio)}</span>
                  <span>Fim: {formatDate(c.dataFim)}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
          </>
        )}

        {!loading && contratos.length > 0 && (
          <div className="px-4 py-3 border-t border-border">
            <span className="text-[12px] text-text-subtle">
              {contratosFiltrados.length} de {contratos.length} contratos
            </span>
          </div>
        )}
      </div>

      <NovoContratoModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCriarContrato}
        clientes={clientes}
        organizacoes={organizacoes}
        isSuperAdmin={isSuperAdmin}
        gestores={gestores}
      />

      <EditarContratoModal
        isOpen={!!editingContrato}
        onClose={() => setEditingContrato(null)}
        onSave={handleEditarContrato}
        onPedirExclusao={contrato => { setEditingContrato(null); setContratoParaExcluir(contrato) }}
        contrato={editingContrato}
        clienteNome={editingContrato ? clienteMap[editingContrato.clienteId]?.nome : ''}
        gestores={gestores}
      />

      <ConfirmModal
        isOpen={!!contratoParaExcluir}
        title="Excluir contrato"
        message={`Tem certeza que quer excluir o contrato de ${contratoParaExcluir ? (clienteMap[contratoParaExcluir.clienteId]?.nome ?? '') : ''}? As lojas vinculadas a ele não são apagadas — só o registro do contrato em si. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleExcluirContrato}
        onCancel={() => setContratoParaExcluir(null)}
      />
    </motion.div>
  )
}
