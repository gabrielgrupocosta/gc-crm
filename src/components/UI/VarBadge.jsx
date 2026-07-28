// Badge de variação percentual (verde/vermelho) — usado em Comparativo.jsx e
// Carteira.jsx (seção "Crescimento da Carteira").

import { formatVar } from '../../utils/format'

export default function VarBadge({ value }) {
  if (value == null || isNaN(value)) return null
  const pos = value >= 0
  return (
    <span style={{
      display: 'inline-block',
      fontSize: '11px', fontWeight: 500,
      padding: '2px 7px', borderRadius: '4px',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: pos ? '#16A34A' : '#DC2626',
      backgroundColor: pos ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
      border: `1px solid ${pos ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`,
    }}>
      {formatVar(value)}
    </span>
  )
}
