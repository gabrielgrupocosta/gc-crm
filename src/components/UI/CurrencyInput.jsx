// Input de valor em reais — usado no Onboard (pré-gestão) e no Controle
// Semanal (checkpoints de loja nova).

export function parseMoney(str) {
  if (str === '' || str == null) return null
  const n = parseFloat(String(str).replace(',', '.'))
  return isNaN(n) ? null : n
}

export default function CurrencyInput({ id, value, onChange }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ fontSize: '12px', color: '#999999' }}>R$</span>
      <input
        id={id}
        type="number"
        min="0"
        step="0.01"
        placeholder="0,00"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input pl-9 font-mono"
      />
    </div>
  )
}
