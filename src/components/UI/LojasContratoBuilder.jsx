import { Plus, X } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

export const PLATAFORMAS_LOJA = ['iFood', '99Food', 'Keeta']
export const STATUS_LOJAS_CONTRATO = ['Ativa', 'Pausada', 'Cancelada']

export const PLATAFORMA_COLORS = {
  iFood:    { bg: '#FFF0F1', text: '#EA1D2C', border: '#EA1D2C' },
  '99Food': { bg: '#FFFBEB', text: '#B45309', border: '#FFD700' },
  Keeta:    { bg: '#EDFBF3', text: '#00B14F', border: '#00B14F' },
}

export const EMPTY_LOJA_CONTRATO_ITEM = {
  nome: '', gestorId: '', plataformas: [], status: 'Ativa', valor: '', entrarOnboard: true,
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
              flex: 1, height: '32px', borderRadius: '6px', fontSize: '12px',
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

function formatBRL(n) {
  if (n == null || n === '' || isNaN(n)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

// Soma os valores das lojas do contrato — usada tanto pelo builder (exibição do
// total) quanto por quem cria o contrato de fato (valorTotal salvo no doc).
export function somaValorLojas(itens) {
  return itens.reduce((soma, item) => {
    const v = parseFloat(String(item.valor).replace(',', '.'))
    return soma + (isNaN(v) ? 0 : v)
  }, 0)
}

// ─── Builder principal ────────────────────────────────────────────────────────

// Lista de "lojas do contrato" — cada uma com nome, valor próprio, gestor,
// plataformas e status. Usado tanto na criação de contrato (Contratos.jsx)
// quanto no cadastro de cliente (Clientes.jsx), sempre criando lojas NOVAS
// vinculadas ao cliente do contrato — nunca edita lojas já existentes.
export default function LojasContratoBuilder({ itens, onChange, gestores }) {
  function updateItem(idx, key, value) {
    onChange(itens.map((it, i) => i === idx ? { ...it, [key]: value } : it))
  }

  function addItem() {
    onChange([...itens, { ...EMPTY_LOJA_CONTRATO_ITEM }])
  }

  function removeItem(idx) {
    onChange(itens.filter((_, i) => i !== idx))
  }

  const total = somaValorLojas(itens)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="section-label">Lojas do contrato</p>
        {itens.length > 0 && (
          <span className="text-[12px] text-text-subtle font-mono">Total: {formatBRL(total)}</span>
        )}
      </div>

      {itens.map((item, idx) => (
        <div key={idx} className="flex flex-col gap-3 p-3 border border-border-hover rounded-lg bg-[#FAFAFA]">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-text-muted">Loja {idx + 1}</span>
            <button
              type="button"
              onClick={() => removeItem(idx)}
              className="inline-flex items-center gap-1 text-[12px] text-text-subtle hover:text-negative transition-colors duration-150"
            >
              <X size={13} strokeWidth={1.5} />
              Remover
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="field-label">Nome da loja</label>
              <input
                type="text"
                value={item.nome}
                onChange={e => updateItem(idx, 'nome', e.target.value)}
                placeholder="Ex: Burguer King Centro"
                className="input"
                style={{ height: '34px', fontSize: '13px' }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="field-label">Valor (R$)</label>
              <input
                type="number" min="0" step="0.01" placeholder="0,00"
                value={item.valor}
                onChange={e => updateItem(idx, 'valor', e.target.value)}
                className="input font-mono"
                style={{ height: '34px', fontSize: '13px' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="field-label">Gestor responsável</label>
              <select
                value={item.gestorId}
                onChange={e => updateItem(idx, 'gestorId', e.target.value)}
                className="select"
                style={{ height: '34px', fontSize: '13px' }}
              >
                <option value="">Sem gestor</option>
                {(gestores ?? []).map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="field-label">Status</label>
              <select
                value={item.status}
                onChange={e => updateItem(idx, 'status', e.target.value)}
                className="select"
                style={{ height: '34px', fontSize: '13px' }}
              >
                {STATUS_LOJAS_CONTRATO.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="field-label">Plataformas</label>
            <PlataformaPills value={item.plataformas} onChange={v => updateItem(idx, 'plataformas', v)} />
          </div>

          <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={item.entrarOnboard ?? true}
              onChange={e => updateItem(idx, 'entrarOnboard', e.target.checked)}
              style={{ accentColor: '#E5322D' }}
            />
            <span style={{ fontSize: '13px', color: '#111111' }}>Adicionar essa loja ao fluxo de Onboard</span>
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        className="btn-secondary flex items-center justify-center gap-2 h-9 text-[13px] self-start px-3"
      >
        <Plus size={13} strokeWidth={2} />
        Adicionar loja
      </button>
    </div>
  )
}
