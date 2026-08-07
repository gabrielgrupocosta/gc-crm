import { useId } from 'react'

// ─── Marca (hexágono + pin/gráfico) — mesma marca usada na Sidebar e no Login ──
// useId() garante um id de gradiente único por instância — sem isso, duas
// LogoMark montadas ao mesmo tempo (ex: overlay de intro sobre a tela de
// Login) compartilhariam o mesmo <linearGradient id>, o que é HTML inválido
// mesmo passando despercebido visualmente (mesmas cores nos dois usos).

export default function LogoMark({ size = 32 }) {
  const gradId = `ihubGrad-${useId()}`
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={gradId} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FF7A3D" />
          <stop offset="1" stopColor="#FF4B2E" />
        </linearGradient>
      </defs>
      <polygon points="12,2 20.66,7 20.66,17 12,22 3.34,17 3.34,7" fill={`url(#${gradId})`} stroke={`url(#${gradId})`} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 7.5c-2.21 0-4 1.7-4 3.8 0 2.62 4 6.7 4 6.7s4-4.08 4-6.7c0-2.1-1.79-3.8-4-3.8Z" fill="#FFFFFF" />
      <rect x="10.1" y="10.6" width="1.15" height="2.3" rx="0.3" fill={`url(#${gradId})`} />
      <rect x="11.8" y="9.4" width="1.15" height="3.5" rx="0.3" fill={`url(#${gradId})`} />
      <rect x="13.5" y="10.1" width="1.15" height="2.8" rx="0.3" fill={`url(#${gradId})`} />
    </svg>
  )
}
