const VARIANTS = {
  // Status de cliente
  ativo:        { color: '#16A34A', bg: 'rgba(22,163,74,0.1)',  border: 'rgba(22,163,74,0.2)'  },
  inativo:      { color: '#999999', bg: 'rgba(153,153,153,0.1)', border: 'rgba(153,153,153,0.2)' },
  inadimplente: { color: '#DC2626', bg: 'rgba(220,38,38,0.1)',  border: 'rgba(220,38,38,0.2)'  },

  // Status de loja
  ativa:        { color: '#16A34A', bg: 'rgba(22,163,74,0.1)',  border: 'rgba(22,163,74,0.2)'  },
  pausada:      { color: '#CA8A04', bg: 'rgba(202,138,4,0.1)',  border: 'rgba(202,138,4,0.2)'  },
  cancelada:    { color: '#DC2626', bg: 'rgba(220,38,38,0.1)',  border: 'rgba(220,38,38,0.2)'  },

  // Relatório
  enviado:      { color: '#16A34A', bg: 'rgba(22,163,74,0.1)',  border: 'rgba(22,163,74,0.2)'  },
  pendente:     { color: '#CA8A04', bg: 'rgba(202,138,4,0.1)',  border: 'rgba(202,138,4,0.2)'  },

  // Tipo de feedback
  sugestao:     { color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  problema:     { color: '#DC2626', bg: 'rgba(220,38,38,0.1)',  border: 'rgba(220,38,38,0.2)' },
  elogio:       { color: '#16A34A', bg: 'rgba(22,163,74,0.1)',  border: 'rgba(22,163,74,0.2)' },

  // Status de feedback
  novo:         { color: '#CA8A04', bg: 'rgba(202,138,4,0.1)',  border: 'rgba(202,138,4,0.2)' },
  resolvido:    { color: '#16A34A', bg: 'rgba(22,163,74,0.1)',  border: 'rgba(22,163,74,0.2)' },
}

export default function Badge({ status, label }) {
  const key = status?.toLowerCase().replace(/\s+/g, '')
  const variant = VARIANTS[key] ?? VARIANTS.inativo

  return (
    <span
      className="font-sans inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-[0.04em]"
      style={{
        color:           variant.color,
        backgroundColor: variant.bg,
        border:          `1px solid ${variant.border}`,
        borderRadius:    '4px',
      }}
    >
      {label ?? status}
    </span>
  )
}
