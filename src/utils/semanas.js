// ─── Utilitários de semana ISO (segunda a domingo) ─────────────────────────────
// Compartilhado entre Dashboard.jsx, Carteira.jsx e qualquer outra página que
// precise calcular/formatar semanas ISO ou janelas de comparação de período.

import {
  db, COLLECTIONS,
  collection, query, where, getDocs,
} from '../services/firebase'

export function getISOWeekStr(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

export function getLast8Weeks() {
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    return getISOWeekStr(d)
  })
}

export function weekLabel(str) {
  return `Sem ${parseInt(str.split('-W')[1])}`
}

export const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export function getLast26WeekOptions() {
  return Array.from({ length: 26 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    const w   = getISOWeekStr(d)
    const num = parseInt(w.split('-W')[1])
    const yr  = w.split('-W')[0]
    return { value: w, label: `Semana ${num} / ${yr}` }
  })
}

export function getDashboardWeekOptions() {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (i + 1) * 7)
    const w       = getISOWeekStr(d)
    const num     = parseInt(w.split('-W')[1])
    const periodo = formatWeekPeriod(w)
    return {
      value:     w,
      label:     i === 0 ? `Semana passada — ${periodo}` : `Semana ${num} — ${periodo}`,
      fullLabel: `Semana ${num} — ${periodo}`,
    }
  })
}

export function getLast12MonthOptions() {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const y = d.getFullYear()
    const m = d.getMonth()
    return {
      value: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `${MONTH_NAMES[m]}/${y}`,
    }
  })
}

export function getWeeksInMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const last  = new Date(y, m, 0)
  const weeks = new Set()
  const cur   = new Date(first)
  while (cur <= last) {
    weeks.add(getISOWeekStr(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return [...weeks]
}

export function getWeeksInRange(fromStr, toStr) {
  const from = new Date(fromStr + 'T00:00:00')
  const to   = new Date(toStr   + 'T00:00:00')
  if (isNaN(from) || isNaN(to) || from > to) return []
  const weeks = new Set()
  const cur   = new Date(from)
  while (cur <= to) {
    weeks.add(getISOWeekStr(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return [...weeks]
}

export function getPrevMonthStr(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Constrói a segunda-feira em horário LOCAL (não UTC) — getISOWeekStr também
// lê o dia/mês em horário local, então misturar UTC aqui fazia a meia-noite UTC
// de segunda cair no domingo anterior pra fusos atrás de UTC (ex: Brasília,
// UTC-3), e o resultado saía uma semana adiantada — bug real: getPrevWeekStr
// pulava 2 semanas em vez de 1, fazendo "Crescimento da Carteira" nunca achar
// dados reais (as semanas buscadas nunca batiam com as semanas lançadas).
export function getPrevWeekStr(weekStr) {
  const [yearStr, wStr] = weekStr.split('-W')
  const year = parseInt(yearStr), week = parseInt(wStr)
  const jan4    = new Date(year, 0, 4)
  const jan4Day = (jan4.getDay() + 6) % 7
  const week1Mon = new Date(jan4)
  week1Mon.setDate(jan4.getDate() - jan4Day)
  const monday = new Date(week1Mon)
  monday.setDate(week1Mon.getDate() + (week - 1) * 7 - 7)
  return getISOWeekStr(monday)
}

export function weekToMonth(weekStr) {
  const [yearStr, wStr] = weekStr.split('-W')
  const year = parseInt(yearStr), week = parseInt(wStr)
  const jan4    = new Date(Date.UTC(year, 0, 4))
  const jan4Day = (jan4.getUTCDay() + 6) % 7
  const week1Mon = new Date(jan4)
  week1Mon.setUTCDate(jan4.getUTCDate() - jan4Day)
  const thu = new Date(week1Mon)
  thu.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7 + 3)
  return `${thu.getUTCFullYear()}-${String(thu.getUTCMonth() + 1).padStart(2, '0')}`
}

export function getWeekDates(weekStr) {
  const [yearStr, wStr] = weekStr.split('-W')
  const year = parseInt(yearStr), week = parseInt(wStr)
  const jan4    = new Date(Date.UTC(year, 0, 4))
  const jan4Day = (jan4.getUTCDay() + 6) % 7
  const monday  = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + (week - 1) * 7)
  const sunday  = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return { start: monday, end: sunday }
}

export function formatWeekPeriod(weekStr) {
  const { start, end } = getWeekDates(weekStr)
  const fmt = d => `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}`
  return `${fmt(start)} a ${fmt(end)}`
}

export function formatWeekPeriodFull(weekStr) {
  const { start, end } = getWeekDates(weekStr)
  const fmt = d => `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}`
  return `${fmt(start)} – ${fmt(end)}/${end.getUTCFullYear()}`
}

// ─── Janelas de comparação de período (usadas em Carteira "Crescimento") ──────

// n semanas ISO terminando em `refWeek` (inclusive), da mais recente pra mais antiga.
export function getLastNWeeks(refWeek, n) {
  const weeks = []
  let w = refWeek
  for (let i = 0; i < n; i++) {
    weeks.push(w)
    w = getPrevWeekStr(w)
  }
  return weeks
}

// Dado um período de referência (n semanas terminando em refWeek), retorna esse
// período ("atual") e o período equivalente imediatamente anterior ("anterior") —
// sempre em blocos de semanas ISO completas, nunca dias parciais.
export function getPeriodoComparativo(refWeek, n) {
  const atual        = getLastNWeeks(refWeek, n)
  const anteriorRef   = getPrevWeekStr(atual[atual.length - 1])
  const anterior      = getLastNWeeks(anteriorRef, n)
  return { atual, anterior }
}

// ─── Fetch em lote por semana (contorna o limite do operador `in`) ────────────

// `orgId`: passe a organizacaoId do usuário logado quando ele NÃO for master —
// sem isso a regra mesmaOrg() do Firestore rejeita a query inteira pra admin_org.
// Aceita também um array de ids (ex.: organizacaoIdsPermitidos do modo teste,
// limitado a 10 pelo operador `in` do Firestore).
export async function fetchByWeeksBatched(allWeeks, orgId = null) {
  const results = []
  const escopo = Array.isArray(orgId)
    ? [where('organizacaoId', 'in', orgId.slice(0, 10))]
    : orgId ? [where('organizacaoId', '==', orgId)] : []
  for (let i = 0; i < allWeeks.length; i += 30) {
    const batch = allWeeks.slice(i, i + 30)
    const snap  = await getDocs(query(
      collection(db, COLLECTIONS.RESULTADOS),
      ...escopo,
      where('semana', 'in', batch),
    ))
    snap.docs.forEach(d => results.push({ id: d.id, ...d.data() }))
  }
  return results
}
