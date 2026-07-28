import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calculator, Truck, MessageSquare } from 'lucide-react'
import { useAssistenteChat } from '../contexts/AssistenteChatContext'
import AssistenteChatPanel from '../components/UI/AssistenteChatPanel'

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatBRL(n) {
  if (n == null || isNaN(n)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

function parseNum(v) {
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? null : n
}

// ─── Animation variants ───────────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

// ─── Tabs internas da página ───────────────────────────────────────────────────

const TABS = [
  { key: 'chat', label: 'Chat', icon: MessageSquare },
  { key: 'precificacao', label: 'Calculadora de Precificação', icon: Calculator },
  { key: 'frete', label: 'Calculadora de Frete Grátis', icon: Truck },
]

// ─── Chat (usa o mesmo estado do popup flutuante, via Context) ─────────────────

function ChatTab() {
  const { lojas, lojaId, setLojaId, mensagens, limparConversa } = useAssistenteChat()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
        <label className="field-label" htmlFor="assist-loja">Loja (opcional — usa dados reais no diagnóstico)</label>
        <select
          id="assist-loja"
          value={lojaId}
          onChange={e => setLojaId(e.target.value)}
          className="select w-full sm:w-64"
        >
          <option value="">Nenhuma / pergunta geral</option>
          {lojas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
        {mensagens.length > 0 && (
          <button
            onClick={limparConversa}
            className="text-[12px] text-text-subtle hover:text-text-primary transition-colors duration-150 sm:ml-auto"
          >
            Limpar conversa
          </button>
        )}
      </div>

      <div style={{ height: '560px' }} className="shadow-card rounded-lg overflow-hidden">
        <AssistenteChatPanel />
      </div>
    </div>
  )
}

// ─── Calculadora de Precificação ────────────────────────────────────────────

function CalculadoraPrecificacao() {
  const [valorLiquido, setValorLiquido] = useState('')
  const [tipoEntrega, setTipoEntrega] = useState('propria')
  const [antecipacao, setAntecipacao] = useState('nao')

  const planoPct = tipoEntrega === 'propria' ? 12 : 23
  const antecipacaoPct = antecipacao === 'sim' ? 1.99 : 0
  const totalTaxasPct = planoPct + 3.2 + antecipacaoPct

  const valor = parseNum(valorLiquido)
  const precoVenda = valor != null && valor > 0 ? valor / (1 - totalTaxasPct / 100) : null
  const valorTaxas = precoVenda != null ? precoVenda - valor : null

  return (
    <div className="max-w-md flex flex-col gap-4">
      <div className="card-kpi flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="prec-valor">Valor líquido que você quer receber (R$)</label>
          <input
            id="prec-valor" type="number" min="0" step="0.01"
            value={valorLiquido}
            onChange={e => setValorLiquido(e.target.value)}
            placeholder="0,00"
            className="input font-mono"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="field-label">Tipo de entrega</label>
          <select value={tipoEntrega} onChange={e => setTipoEntrega(e.target.value)} className="select">
            <option value="propria">Entrega própria (12%)</option>
            <option value="parceira">Entrega parceira — iFood (23%)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="field-label">Antecipação de recebimento?</label>
          <select value={antecipacao} onChange={e => setAntecipacao(e.target.value)} className="select">
            <option value="nao">Não (30 dias) — sem taxa</option>
            <option value="sim">Sim (7 dias) — 1,99%</option>
          </select>
        </div>
      </div>

      {precoVenda != null && (
        <div className="card-kpi">
          <p className="section-label mb-3">Preço de venda</p>
          <p className="kpi-value">{formatBRL(precoVenda)}</p>
          <p className="text-[12px] text-text-subtle mt-2 leading-relaxed">
            {formatBRL(valorTaxas)} vai para taxas do iFood ({planoPct}% do plano + 3,2% pagamento online{antecipacaoPct ? ` + ${antecipacaoPct}% antecipação` : ''} = {totalTaxasPct.toFixed(1)}% no total).
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Calculadora de Frete Grátis ────────────────────────────────────────────

function CalculadoraFreteGratis() {
  const [custoEntrega, setCustoEntrega] = useState('')
  const [ticketMedio, setTicketMedio] = useState('')

  const custo = parseNum(custoEntrega)
  const ticket = parseNum(ticketMedio)
  const percentual = custo != null && ticket != null && ticket > 0 ? (custo / ticket) * 100 : null
  const novoTicket = percentual != null ? ticket * (1 + percentual / 100) : null

  return (
    <div className="max-w-md flex flex-col gap-4">
      <div className="card-kpi flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="frete-custo">Custo médio por entrega (R$)</label>
          <input
            id="frete-custo" type="number" min="0" step="0.01"
            value={custoEntrega}
            onChange={e => setCustoEntrega(e.target.value)}
            placeholder="0,00"
            className="input font-mono"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="frete-ticket">Ticket médio atual (R$)</label>
          <input
            id="frete-ticket" type="number" min="0" step="0.01"
            value={ticketMedio}
            onChange={e => setTicketMedio(e.target.value)}
            placeholder="0,00"
            className="input font-mono"
          />
        </div>
      </div>

      {percentual != null && (
        <div className="card-kpi">
          <p className="section-label mb-3">Aumento necessário no cardápio</p>
          <p className="kpi-value">{percentual.toFixed(1)}%</p>
          <p className="text-[12px] text-text-subtle mt-2 leading-relaxed">
            Ticket médio vai de {formatBRL(ticket)} para {formatBRL(novoTicket)} — o custo do frete grátis fica coberto pelo aumento. Verifique se os novos preços continuam competitivos na região.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AssistenteDelivery() {
  const [tab, setTab] = useState('chat')

  return (
    <motion.div
      style={{ padding: '28px 20px' }}
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      <div className="page-header">
        <h1 className="page-title">Assistente Delivery</h1>
      </div>

      <div className="flex gap-1 border-b border-border mb-5 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="inline-flex items-center gap-1.5 px-3 h-10 text-[13px] whitespace-nowrap"
              style={{
                color: active ? '#111111' : '#999999',
                fontWeight: active ? 500 : 400,
                borderBottom: active ? '2px solid #FF4B2E' : '2px solid transparent',
              }}
            >
              <Icon size={14} strokeWidth={1.75} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'chat' && <ChatTab />}
      {tab === 'precificacao' && <CalculadoraPrecificacao />}
      {tab === 'frete' && <CalculadoraFreteGratis />}
    </motion.div>
  )
}
