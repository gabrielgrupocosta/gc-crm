const PLATFORM_STYLES = {
  ifood:    { bg: '#EA1D2C', color: '#FFFFFF', label: 'iFood'  },
  '99food': { bg: '#FFD700', color: '#1A1A1A', label: '99Food' },
  keeta:    { bg: '#00B14F', color: '#FFFFFF', label: 'Keeta'  },
}

export default function PlatformBadge({ plataforma }) {
  if (!plataforma) return null
  const key = plataforma.toLowerCase().replace(/\s+/g, '')
  const style = PLATFORM_STYLES[key]
  if (!style) return null

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center',
        backgroundColor: style.bg,
        color: style.color,
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        borderRadius: '4px',
        padding: '3px 8px',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {style.label}
    </span>
  )
}
