// ─── Marca (hexágono + pin/gráfico) — mesma marca usada na Sidebar e no Login ──
// Usa o asset oficial (public/logo.png) em vez de um SVG desenhado à mão —
// a versão aproximada divergia do desenho real (proporção do pin, posição
// das barras).

export default function LogoMark({ size = 32 }) {
  return (
    <img
      src="/logo-mark.png"
      alt="iHubFood"
      width={size}
      height={size}
      style={{ flexShrink: 0, objectFit: 'contain' }}
    />
  )
}
