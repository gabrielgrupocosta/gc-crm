// ─── Lojas Novas — checkpoints de 7 em 7 dias ──────────────────────────────────
// Módulo compartilhado entre ControleSemanal.jsx (botão "Lojas Novas" no
// cabeçalho), Dashboard.jsx (ranking de lojas novas) e Ranking.jsx (aba lojas
// novas). Acompanha lojas nos primeiros 30 dias de contrato, com checkpoint a
// cada 7 dias contados a partir de `dataInicio` (data de cadastro, não
// `dataInicioGestao` — ver comentário em `checkpointPeriodo`).

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Store } from 'lucide-react'
import {
  db, COLLECTIONS, doc, getDoc, setDoc, serverTimestamp,
} from '../../services/firebase'
import { useToast } from './Toast'
import Modal from './Modal'
import Skeleton from './Skeleton'

export const CHECKPOINTS_DIAS = [7, 14, 21, 28]
export const JANELA_LOJA_NOVA_DIAS = 30
const MS_DIA_CHECKPOINT = 24 * 60 * 60 * 1000

export function diasDesde(ts) {
  if (!ts) return null
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return Math.floor((Date.now() - d.getTime()) / MS_DIA_CHECKPOINT)
}

export function checkpointDocId(lojaId, dias) {
  return `${lojaId}_${dias}`
}

// Cada checkpoint cobre um bloco de 7 dias sem sobreposição, contado a partir
// de `dataInicio`: dia 7 → dias 0-6, dia 14 → dias 7-13, dia 21 → dias 14-20,
// dia 28 → dias 21-27. Usado pra mostrar "de qual data a qual data" no
// checkpoint, já que "dia 14" sozinho não deixa claro o período coberto.
// Sempre baseado em `dataInicio` (não `dataInicioGestao`) — é a mesma
// referência usada pra decidir disponibilidade do checkpoint, então os dois
// precisam bater; "tempo na gestão" (dataInicioGestao) é só um rótulo
// informativo à parte, calculado separadamente por quem exibe o ranking.
export function checkpointPeriodo(dataInicio, diasCheckpoint) {
  const base = dataInicio.toDate ? dataInicio.toDate() : new Date(dataInicio)
  const inicio = new Date(base)
  inicio.setDate(inicio.getDate() + (diasCheckpoint - 7))
  const fim = new Date(base)
  fim.setDate(fim.getDate() + (diasCheckpoint - 1))
  const fmt = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  return `${fmt(inicio)} a ${fmt(fim)}`
}

// ─── Máscara de moeda (BRL) — mesmo padrão do resultado semanal ───────────────

export function maskCurrencyInput(rawText) {
  const digits = (rawText ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return (parseInt(digits, 10) / 100).toFixed(2)
}

export function formatCurrencyDisplay(value) {
  if (value === '' || value == null || isNaN(Number(value))) return ''
  return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Campos de formulário compartilhados ───────────────────────────────────────

export const INPUT_STYLE = {
  background: 'transparent', border: '1px solid #E8E8E8', borderRadius: '5px',
  height: '32px', fontSize: '13px', color: '#111111', padding: '0 10px',
  fontFamily: "'Segoe UI', system-ui, sans-serif", outline: 'none', width: '100%', boxSizing: 'border-box',
}

export function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '12px', color: '#666666', fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  )
}

export function PercentInput({ value, onChange, borderColor, placeholder }) {
  // Largura acompanha o texto REALMENTE exibido — valor digitado quando tem
  // um, senão o placeholder. `width: 'fit-content'` sobrescreve o
  // `width: 100%` herdado do INPUT_STYLE — sem isso, um pai flex-column com
  // align-items padrão (stretch) estica essa caixa pra ocupar a coluna
  // inteira do grid, deixando um vão vazio depois do "%".
  const textoExibido = (value !== '' && value != null) ? String(value) : String(placeholder ?? '')
  return (
    <div style={{ ...INPUT_STYLE, width: 'fit-content', display: 'flex', alignItems: 'center', gap: '4px', borderColor }}>
      <input
        style={{ border: 'none', outline: 'none', background: 'transparent', flex: '0 1 auto', width: `${Math.max(textoExibido.length, 1) + 1}ch`, minWidth: 0, fontSize: '13px', color: '#111111', fontFamily: "'Segoe UI', system-ui, sans-serif", padding: 0, height: '100%' }}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onFocus={e => { e.target.parentElement.style.borderColor = '#E5322D' }}
        onBlur={e => { e.target.parentElement.style.borderColor = borderColor }}
      />
      <span style={{ fontSize: '13px', color: '#999999', flexShrink: 0 }}>%</span>
    </div>
  )
}

// ─── Animation variants ───────────────────────────────────────────────────────

const listVariants = { animate: { transition: { staggerChildren: 0.04 } } }
const itemVariants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.12 } },
}

// ─── Modal: preencher checkpoint de loja nova ─────────────────────────────────

export function CheckpointModal({ item, onClose, onSave }) {
  const toast = useToast()
  const [faturamento, setFaturamento] = useState('') // mesmo formato do resultado semanal: string decimal "1234.56"
  const [variacao,    setVariacao]    = useState('') // texto digitado cru, ex: "-12.5" — só vira número no save
  const [observacoes, setObservacoes] = useState('')
  const [saving,       setSaving]      = useState(false)

  useEffect(() => {
    if (!item) return
    setFaturamento(item.checkpoint?.faturamento != null ? String(item.checkpoint.faturamento) : '')
    setVariacao(item.checkpoint?.variacao != null ? String(item.checkpoint.variacao) : '')
    setObservacoes(item.checkpoint?.observacoes ?? '')
  }, [item])

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await onSave(item, {
        faturamento: parseFloat(faturamento) || 0,
        variacao:    parseFloat(variacao)    || 0,
        observacoes: observacoes.trim(),
      })
      onClose()
    } catch (err) {
      console.error('[CheckpointModal] salvar checkpoint:', err?.code, err?.message)
      toast('Erro ao salvar checkpoint. Tente novamente.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={!!item}
      onClose={onClose}
      title={item ? `Checkpoint dia ${item.dias} — ${item.loja.nome}` : ''}
      width="max-w-md"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button form="checkpoint-form" type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      {item && (
        <p style={{ fontSize: '12px', color: '#999999', marginTop: '-8px', marginBottom: '16px', whiteSpace: 'normal', wordBreak: 'keep-all' }}>
          Período: {checkpointPeriodo(item.loja.dataInicio, item.dias)}
        </p>
      )}
      <form id="checkpoint-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Field label="Faturamento da semana (R$)">
            <input
              id="cp-faturamento"
              style={INPUT_STYLE}
              value={formatCurrencyDisplay(faturamento)}
              onChange={e => setFaturamento(maskCurrencyInput(e.target.value))}
              inputMode="numeric"
              placeholder="R$ 0,00"
              onFocus={e => e.target.style.borderColor = '#E5322D'}
              onBlur={e => e.target.style.borderColor = '#E8E8E8'}
            />
          </Field>
          <Field label="Variação % vs semana anterior">
            <PercentInput
              value={variacao}
              onChange={e => setVariacao(e.target.value)}
              placeholder="-12.5 ou 8.3"
              borderColor="#E8E8E8"
            />
          </Field>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="cp-observacoes">Observações</label>
          <textarea
            id="cp-observacoes"
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            rows={4}
            className="textarea"
            placeholder="Como foi essa semana da loja?"
          />
        </div>
      </form>
    </Modal>
  )
}

// ─── Card de loja nova (checkpoints pendentes) ─────────────────────────────────
// Mostra só o(s) checkpoint(s) já disponível(is) e ainda não preenchido(s) —
// nada de "preenchido" nem "aguardando data futura" aqui, isso é uma lista de
// pendência, não um painel de status completo.

export function CheckpointPendenteRow({ dias, periodoLabel, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between"
      style={{
        width: '100%', borderRadius: '6px', padding: '8px 10px',
        backgroundColor: '#FFF1ED', border: '1px solid #FECACA', cursor: 'pointer',
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1px', flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#DC2626', whiteSpace: 'normal' }}>Checkpoint dia {dias} — pendente</span>
        <span style={{ fontSize: '11px', fontWeight: 500, color: '#B91C1C', whiteSpace: 'normal' }}>{periodoLabel}</span>
      </span>
      <span style={{ fontSize: '11px', fontWeight: 600, color: '#DC2626', flexShrink: 0, marginLeft: '8px' }}>Preencher</span>
    </button>
  )
}

export function LojaNovaPendenciaCard({ loja, diasPendentes, gestorNome, onFillCheckpoint }) {
  return (
    <div style={{
      backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '10px',
      padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <p style={{ fontSize: '14px', fontWeight: 700, color: '#111111' }}>{loja.nome}</p>
      {gestorNome && <p style={{ fontSize: '11px', color: '#999999', marginTop: '2px', marginBottom: '10px' }}>{gestorNome}</p>}

      <div className="flex flex-col" style={{ gap: '6px', marginTop: gestorNome ? 0 : '10px' }}>
        {diasPendentes.map(dias => (
          <CheckpointPendenteRow
            key={dias}
            dias={dias}
            periodoLabel={checkpointPeriodo(loja.dataInicio, dias)}
            onClick={() => onFillCheckpoint({ loja, dias, checkpoint: null })}
          />
        ))}
      </div>
    </div>
  )
}

// Escreve um checkpoint no Firestore — compartilhado entre LojasNovasButton
// (todas as lojas) e CheckpointStatusModal (uma loja só), evitando duplicar a
// mesma lógica de save nos dois lugares.
export async function salvarCheckpoint(loja, dias, { faturamento, variacao, observacoes }) {
  await setDoc(doc(db, COLLECTIONS.CHECKPOINTS_LOJAS_NOVAS, checkpointDocId(loja.id, dias)), {
    lojaId:        loja.id,
    gestorId:      loja.gestorId || null,
    organizacaoId: loja.organizacaoId ?? null,
    diasCheckpoint: dias,
    faturamento,
    variacao,
    observacoes,
    atualizadoEm:  serverTimestamp(),
  }, { merge: true })
}

// ─── Botão + modal: Lojas Novas (checkpoints pendentes) ────────────────────────
// Usado no cabeçalho do Relatório Semanal. O modal só lista lojas com pelo
// menos um checkpoint pendente, e dentro de cada loja só o(s) dia(s)
// pendente(s) — nada de campo já preenchido ou de checkpoint futuro que
// ainda nem chegou.

export function LojasNovasButton({ lojas, gestorMap, toast }) {
  const [checkpointsMap, setCheckpointsMap] = useState({})
  const [loadingCheckpoints, setLoadingCheckpoints] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [fillModal,   setFillModal]   = useState(null) // { loja, dias, checkpoint }

  const lojasNovas = useMemo(() => {
    return lojas
      .filter(l => l.dataInicio)
      .map(l => ({ ...l, diasDesdeInicio: diasDesde(l.dataInicio) }))
      .filter(l => l.diasDesdeInicio != null && l.diasDesdeInicio >= 0 && l.diasDesdeInicio <= JANELA_LOJA_NOVA_DIAS)
  }, [lojas])

  async function loadCheckpoints() {
    setLoadingCheckpoints(true)
    try {
      const docs = await Promise.all(
        lojasNovas.flatMap(loja => CHECKPOINTS_DIAS.map(async dias => {
          const snap = await getDoc(doc(db, COLLECTIONS.CHECKPOINTS_LOJAS_NOVAS, checkpointDocId(loja.id, dias)))
          return snap.exists() ? [snap.id, snap.data()] : null
        }))
      )
      setCheckpointsMap(Object.fromEntries(docs.filter(Boolean)))
    } finally {
      setLoadingCheckpoints(false)
    }
  }

  useEffect(() => { loadCheckpoints() }, [lojasNovas.map(l => l.id).join(',')])

  async function handleSaveCheckpoint({ loja, dias }, dados) {
    await salvarCheckpoint(loja, dias, dados)
    toast('Checkpoint salvo.', 'success')
    await loadCheckpoints()
  }

  // Só lojas com pelo menos 1 checkpoint pendente, e só os dias pendentes —
  // filtra fora "preenchido" e "ainda não chegou o dia" nos dois níveis.
  const pendenciasPorLoja = useMemo(() => {
    return lojasNovas
      .map(loja => ({
        loja,
        diasPendentes: CHECKPOINTS_DIAS.filter(d =>
          loja.diasDesdeInicio >= d && !checkpointsMap[checkpointDocId(loja.id, d)]
        ),
      }))
      .filter(({ diasPendentes }) => diasPendentes.length > 0)
  }, [lojasNovas, checkpointsMap])

  const totalPendencias = pendenciasPorLoja.reduce((s, { diasPendentes }) => s + diasPendentes.length, 0)

  return (
    <>
      <button
        type="button"
        onClick={() => setModalAberto(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px',
          fontSize: '13px', fontWeight: 500, borderRadius: '5px', cursor: 'pointer',
          backgroundColor: totalPendencias > 0 ? '#FFFBEB' : '#FFFFFF',
          border: `1px solid ${totalPendencias > 0 ? '#FDE68A' : '#E8E8E8'}`,
          color: totalPendencias > 0 ? '#92400E' : '#666666',
          transition: 'border-color 150ms, color 150ms, background-color 150ms',
        }}
        onMouseEnter={e => {
          if (totalPendencias > 0) return
          e.currentTarget.style.backgroundColor = '#F9F9F9'
          e.currentTarget.style.borderColor = '#DDDDDD'
          e.currentTarget.style.color = '#333333'
        }}
        onMouseLeave={e => {
          if (totalPendencias > 0) return
          e.currentTarget.style.backgroundColor = '#FFFFFF'
          e.currentTarget.style.borderColor = '#E8E8E8'
          e.currentTarget.style.color = '#666666'
        }}
      >
        <Store size={13} strokeWidth={1.75} style={{ flexShrink: 0 }} />
        Lojas Novas
        {!loadingCheckpoints && totalPendencias > 0 && (
          <span className="font-mono flex items-center justify-center" style={{
            minWidth: '17px', height: '17px', borderRadius: '9px', padding: '0 5px', flexShrink: 0,
            backgroundColor: '#CA8A04', color: '#FFFFFF', fontSize: '10.5px', fontWeight: 700,
          }}>
            {totalPendencias}
          </span>
        )}
      </button>

      <Modal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        title="Lojas Novas — checkpoints pendentes"
        width="max-w-lg"
      >
        {loadingCheckpoints ? (
          <div className="flex flex-col gap-3">
            <Skeleton.Table rows={2} cols={1} />
          </div>
        ) : pendenciasPorLoja.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#999999', textAlign: 'center', padding: '24px 0' }}>
            Nenhum checkpoint pendente no momento.
          </p>
        ) : (
          <motion.div variants={listVariants} initial="initial" animate="animate" className="flex flex-col" style={{ gap: '12px' }}>
            {pendenciasPorLoja.map(({ loja, diasPendentes }) => (
              <motion.div key={loja.id} variants={itemVariants}>
                <LojaNovaPendenciaCard
                  loja={loja}
                  diasPendentes={diasPendentes}
                  gestorNome={gestorMap[loja.gestorId]?.nome}
                  onFillCheckpoint={setFillModal}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </Modal>

      <CheckpointModal
        item={fillModal}
        onClose={() => setFillModal(null)}
        onSave={handleSaveCheckpoint}
      />
    </>
  )
}

// ─── Modal: status dos 4 checkpoints de UMA loja ──────────────────────────────
// Usado no ranking de Lojas Novas (Dashboard e Ranking) — ao contrário do
// LojasNovasButton (que só mostra pendências, de todas as lojas), este mostra
// os 4 checkpoints de uma loja específica com status completo (preenchido /
// pendente / aguardando); clicar num disponível abre o CheckpointModal.

const STATUS_CHECKPOINT = {
  preenchido: { bg: '#F0FDF9', border: '#B3EDD0', color: '#00A67D', label: 'Preenchido' },
  pendente:   { bg: '#FFF1ED', border: '#FECACA', color: '#DC2626', label: 'Pendente' },
  aguardando: { bg: '#F9F9F9', border: '#E8E8E8', color: '#999999', label: 'Aguardando' },
}

export function CheckpointStatusModal({ loja, onClose, onSaved }) {
  const toast = useToast()
  const [checkpointsMap, setCheckpointsMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [fillModal, setFillModal] = useState(null)

  async function loadCheckpoints() {
    if (!loja) return
    setLoading(true)
    try {
      const docs = await Promise.all(CHECKPOINTS_DIAS.map(async dias => {
        const snap = await getDoc(doc(db, COLLECTIONS.CHECKPOINTS_LOJAS_NOVAS, checkpointDocId(loja.id, dias)))
        return snap.exists() ? [dias, snap.data()] : null
      }))
      setCheckpointsMap(Object.fromEntries(docs.filter(Boolean)))
    } finally {
      setLoading(false)
    }
  }

  // Fechar o modal zera `loja` pra null — sem resetar `loading` aqui, ele
  // ficava travado em `false` (do último carregamento bem-sucedido) e o
  // próximo render caía direto no branch de conteúdo, que lê `loja.dataInicio`
  // sem guarda e quebrava com "Cannot read properties of null".
  useEffect(() => {
    if (!loja) { setLoading(true); setCheckpointsMap({}); return }
    loadCheckpoints()
  }, [loja?.id])

  async function handleSaveCheckpoint({ loja: l, dias }, dados) {
    await salvarCheckpoint(l, dias, dados)
    toast('Checkpoint salvo.', 'success')
    await loadCheckpoints()
    onSaved?.()
  }

  const diasDesdeInicio = loja ? diasDesde(loja.dataInicio) : null

  return (
    <>
      <Modal
        isOpen={!!loja}
        onClose={onClose}
        title={loja ? `Checkpoints — ${loja.nome}` : ''}
        width="max-w-md"
      >
        {loading || !loja ? (
          <Skeleton.Table rows={4} cols={1} />
        ) : (
          <div className="flex flex-col" style={{ gap: '8px' }}>
            {CHECKPOINTS_DIAS.map(d => {
              const checkpoint  = checkpointsMap[d]
              const preenchido  = !!checkpoint
              const disponivel  = diasDesdeInicio != null && diasDesdeInicio >= d
              const statusKey   = preenchido ? 'preenchido' : disponivel ? 'pendente' : 'aguardando'
              const st          = STATUS_CHECKPOINT[statusKey]
              return (
                <button
                  key={d}
                  type="button"
                  disabled={!disponivel}
                  onClick={() => disponivel && setFillModal({ loja, dias: d, checkpoint: checkpoint ?? null })}
                  className="flex items-center justify-between"
                  style={{
                    borderRadius: '6px', padding: '10px 12px',
                    backgroundColor: st.bg, border: `1px solid ${st.border}`,
                    cursor: disponivel ? 'pointer' : 'default', textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#111111' }}>Checkpoint dia {d}</span>
                    <span style={{ fontSize: '11px', color: '#999999' }}>{checkpointPeriodo(loja.dataInicio, d)}</span>
                    {preenchido && (
                      <span style={{ fontSize: '11px', color: '#666666', marginTop: '2px' }}>
                        {formatCurrencyDisplay(checkpoint.faturamento)}
                        {checkpoint.variacao != null && ` · ${checkpoint.variacao > 0 ? '+' : ''}${checkpoint.variacao}%`}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: st.color, flexShrink: 0, marginLeft: '8px' }}>
                    {st.label}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </Modal>

      <CheckpointModal
        item={fillModal}
        onClose={() => setFillModal(null)}
        onSave={handleSaveCheckpoint}
      />
    </>
  )
}
