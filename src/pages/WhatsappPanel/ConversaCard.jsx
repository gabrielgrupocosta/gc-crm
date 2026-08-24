/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react'
import { motion } from 'framer-motion'

export const COLUNAS = [
  { value: 'grupos', label: 'Grupos', cor: '#7C3AED' },
  { value: 'gestores', label: 'Gestores', cor: '#2563EB' },
  { value: 'clientes', label: 'Clientes', cor: '#00A67E' },
  { value: 'leads', label: 'Leads', cor: '#F59E0B' },
  { value: 'importantes', label: 'Importantes', cor: '#FF4B2E' },
  { value: 'alerta', label: 'Alerta', cor: '#DC2626' },
  { value: 'arquivado', label: 'Arquivado', cor: '#737373' },
]

export const COLUNA_CORES = Object.fromEntries(COLUNAS.map(coluna => [coluna.value, coluna.cor]))
export const COLUNA_LABELS = Object.fromEntries(COLUNAS.map(coluna => [coluna.value, coluna.label]))

export const STATUS_LABELS = {
  aguardando: 'Aguardando',
  pendente: 'Pendente',
  respondido: 'Respondido',
}

function paraData(valor) {
  if (!valor) return null
  if (typeof valor.toDate === 'function') return valor.toDate()
  if (valor instanceof Date) return valor
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data
}

export function tempoRelativo(valor, agora = new Date()) {
  const data = paraData(valor)
  if (!data) return ''
  const segundos = Math.max(0, Math.floor((agora.getTime() - data.getTime()) / 1000))
  if (segundos < 60) return 'agora'
  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) return `há ${minutos}min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas}h`
  return `há ${Math.floor(horas / 24)}d`
}

export default function ConversaCard({ conversa, selecionada, onSelect }) {
  const cor = COLUNA_CORES[conversa.coluna] ?? COLUNA_CORES.arquivado
  const [arrastando, setArrastando] = useState(false)

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      draggable
      onDragStart={event => {
        event.dataTransfer.setData('text/plain', conversa.id)
        event.dataTransfer.effectAllowed = 'move'
        setArrastando(true)
      }}
      onDragEnd={() => setArrastando(false)}
      className="w-full rounded-lg text-left font-sans"
      style={{
        display: 'block', padding: '13px 14px', border: `1px solid ${selecionada ? cor : '#E8E8E8'}`,
        cursor: 'grab', backgroundColor: selecionada ? `${cor}0A` : '#FFFFFF',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)', opacity: arrastando ? 0.5 : 1,
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span style={{ flex: 1, minWidth: 0, color: '#111111', fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {conversa.nome || conversa.phone}
        </span>
        {conversa.lida === false && <span aria-label="Não lida" style={{ width: 7, height: 7, flexShrink: 0, borderRadius: '50%', backgroundColor: '#FF4B2E' }} />}
      </div>
      <p style={{ marginTop: 6, color: '#666666', fontSize: '12px', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {conversa.ultimaMensagem || 'Sem mensagens'}
      </p>
      <div className="flex items-center justify-between gap-2" style={{ marginTop: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 7px', borderRadius: 999, color: cor, backgroundColor: `${cor}14`, fontSize: '10px', fontWeight: 600 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: cor }} />
          {STATUS_LABELS[conversa.status] ?? conversa.status}
        </span>
        <span style={{ flexShrink: 0, color: '#999999', fontSize: '10px' }}>{tempoRelativo(conversa.ultimaAtividade)}</span>
      </div>
    </motion.button>
  )
}
