// Formatação de variação percentual — compartilhado entre VarBadge, Comparativo
// e Carteira.

export function formatVar(v) {
  if (v == null || isNaN(v)) return '—'
  return `${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(1)}%`
}

// Converte uma string "YYYY-MM-DD" (valor de <input type="date">) num Date do
// dia local à meia-noite. `new Date('YYYY-MM-DD')` direto interpreta como
// UTC — em fusos atrás de UTC (Brasil) isso volta pro dia anterior assim que
// formatado/exibido localmente. Sempre usar isto antes de Timestamp.fromDate
// ao salvar uma data vinda de um input de data.
export function parseLocalDate(dateStr) {
  if (!dateStr) return null
  const [ano, mes, dia] = dateStr.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}
