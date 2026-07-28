// Formatação de variação percentual — compartilhado entre VarBadge, Comparativo
// e Carteira.

export function formatVar(v) {
  if (v == null || isNaN(v)) return '—'
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`
}
