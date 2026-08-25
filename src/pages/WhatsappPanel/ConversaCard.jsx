/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

export const COLUNAS = [
  { value: 'grupos', label: 'Grupos', cor: '#6E5AA3' },
  { value: 'gestores', label: 'Gestores', cor: '#3E6FA6' },
  { value: 'clientes', label: 'Clientes', cor: '#3F8F68' },
  { value: 'leads', label: 'Leads', cor: '#C4881F' },
  { value: 'importantes', label: 'Importantes', cor: '#E8503A' },
  { value: 'alerta', label: 'Alerta', cor: '#BE3B30' },
  { value: 'arquivado', label: 'Arquivado', cor: '#8A8D93' },
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

function iniciais(texto) {
  const limpo = (texto || '').trim()
  if (!limpo) return '#'
  const partes = limpo.split(/\s+/)
  const primeira = partes[0]?.[0] ?? ''
  const segunda = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primeira + segunda).toUpperCase()
}

export default function ConversaCard({ conversa, selecionada, onSelect, onResolverAlerta }) {
  const cor = COLUNA_CORES[conversa.coluna] ?? COLUNA_CORES.arquivado
  const [arrastando, setArrastando] = useState(false)
  const mensagens = conversa.mensagens ?? []
  const remetenteGrupo = conversa.isGroup ? mensagens[mensagens.length - 1]?.remetente : null
  const naoLida = conversa.lida === false
  const emAlerta = conversa.coluna === 'alerta'

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      draggable
      onDragStart={event => {
        event.dataTransfer.setData('text/plain', conversa.id)
        event.dataTransfer.effectAllowed = 'move'
        setArrastando(true)
      }}
      onDragEnd={() => setArrastando(false)}
      className="flex w-full items-start rounded-lg text-left font-sans"
      style={{
        gap: 10, padding: '11px 12px', border: `1px solid ${selecionada ? cor : '#E4E5E9'}`,
        cursor: 'grab', backgroundColor: selecionada ? `${cor}0C` : '#FFFFFF',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)', opacity: arrastando ? 0.5 : 1,
      }}
    >
      <span
        aria-hidden="true"
        className="flex flex-shrink-0 items-center justify-center"
        style={{
          width: 34, height: 34, borderRadius: conversa.isGroup ? 10 : '50%',
          backgroundColor: `${cor}17`, color: cor, fontSize: '12px', fontWeight: 800,
        }}
      >
        {conversa.isGroup ? '👥' : iniciais(conversa.nome || conversa.phone)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span style={{ flex: 1, minWidth: 0, color: '#1B1E24', fontSize: '13px', fontWeight: conversa.isGroup || naoLida ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conversa.nome || conversa.phone}
          </span>
          <span style={{ flexShrink: 0, color: '#9A9DA4', fontSize: '10px', fontVariantNumeric: 'tabular-nums' }}>{tempoRelativo(conversa.ultimaAtividade)}</span>
        </span>

        {remetenteGrupo && (
          <span style={{ display: 'block', marginTop: 3, color: '#6B7178', fontSize: '11px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {remetenteGrupo}
          </span>
        )}
        <span style={{ display: '-webkit-box', marginTop: remetenteGrupo ? 2 : 4, color: remetenteGrupo ? '#9A9DA4' : '#6B7178', fontSize: '12px', lineHeight: 1.45, WebkitLineClamp: remetenteGrupo ? 1 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {conversa.ultimaMensagem || 'Sem mensagens'}
        </span>

        <span className="flex items-center justify-between gap-2" style={{ marginTop: 8 }}>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px 2px 6px', borderRadius: 999,
              color: cor, backgroundColor: `${cor}12`, fontSize: '10px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.04em',
              boxShadow: `inset 0 0 0 1px ${cor}33`,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: cor }} />
            {STATUS_LABELS[conversa.status] ?? conversa.status}
          </span>
          <span className="flex flex-shrink-0 items-center gap-2">
            {emAlerta && onResolverAlerta && (
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation()
                  onResolverAlerta()
                }}
                aria-label="Marcar alerta como resolvido"
                className="flex items-center gap-1"
                style={{
                  padding: '2px 8px', borderRadius: 999, fontSize: '10px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  color: '#00C896', backgroundColor: '#00C89614', boxShadow: 'inset 0 0 0 1px #00C89633',
                }}
              >
                <Check size={11} strokeWidth={2.5} />
                OK
              </button>
            )}
            {naoLida && <span aria-label="Não lida" style={{ width: 7, height: 7, flexShrink: 0, borderRadius: '50%', backgroundColor: '#E8503A' }} />}
          </span>
        </span>
      </span>
    </motion.div>
  )
}
