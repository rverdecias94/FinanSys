// Parches optimistas de totales / panel / antigüedad (credibilidad offline).

function bumpMap(map = {}, currency, delta) {
  const code = currency || 'USD'
  const next = { ...map }
  next[code] = Number(next[code] || 0) + Number(delta || 0)
  return next
}

/**
 * Ajusta filteredTotals en caché tras crear una transacción (ingreso/gasto).
 * No inventa filas nuevas de moneda si el filtro activo no las incluiría:
 * solo suma sobre la estructura ya cacheada o siembra income/expense mínimos.
 */
export function applyOptimisticFilteredTotals(queryClient, { type, amount, currency }) {
  if (!queryClient || (type !== 'income' && type !== 'expense')) return
  const amt = Number(amount) || 0
  if (!amt) return
  queryClient.setQueriesData(
    { predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'filteredTotals' },
    (old) => {
      const base = old && typeof old === 'object'
        ? { income: { ...(old.income || {}) }, expense: { ...(old.expense || {}) } }
        : { income: {}, expense: {} }
      base[type] = bumpMap(base[type], currency, amt)
      return base
    },
  )
}

/** Panel general: income/expense.current del mes + balance aproximado. */
export function applyOptimisticDashboardStats(queryClient, { type, amount, currency }) {
  if (!queryClient || (type !== 'income' && type !== 'expense')) return
  const amt = Number(amount) || 0
  if (!amt) return
  const code = currency || 'USD'
  queryClient.setQueriesData(
    { predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'dashboard' && q.queryKey[1] === 'stats' },
    (old) => {
      if (!old || typeof old !== 'object') return old
      const next = {
        ...old,
        balance: { ...(old.balance || {}) },
        income: {
          ...(old.income || {}),
          current: { ...(old.income?.current || {}) },
          change: { ...(old.income?.change || {}) },
        },
        expense: {
          ...(old.expense || {}),
          current: { ...(old.expense?.current || {}) },
          change: { ...(old.expense?.change || {}) },
        },
      }
      if (type === 'income') {
        next.income.current[code] = Number(next.income.current[code] || 0) + amt
        next.balance[code] = Number(next.balance[code] || 0) + amt
      } else {
        next.expense.current[code] = Number(next.expense.current[code] || 0) + amt
        next.balance[code] = Number(next.balance[code] || 0) - amt
      }
      return next
    },
  )
}

/**
 * Antigüedad: suma/resta en tramo not_due (cuentas nuevas o abonos).
 * direction 'receivable' | 'payable'. deltaRemaining puede ser negativo al abonar.
 */
export function applyOptimisticAgingDelta(queryClient, direction, { currency, deltaRemaining, bucket = 'not_due' }) {
  if (!queryClient || !direction) return
  const code = currency || 'USD'
  const delta = Number(deltaRemaining) || 0
  if (!delta) return
  queryClient.setQueriesData(
    {
      predicate: (q) =>
        Array.isArray(q.queryKey)
        && q.queryKey[0] === 'aging'
        && q.queryKey[1] === direction,
    },
    (old) => {
      const rows = Array.isArray(old) ? old.map((r) => ({ ...r })) : []
      let row = rows.find((r) => r.currency === code)
      if (!row) {
        row = {
          currency: code,
          not_due: 0,
          d_1_30: 0,
          d_31_60: 0,
          d_61_90: 0,
          d_over_90: 0,
          total: 0,
          cnt: 0,
        }
        rows.push(row)
      }
      const key = bucket in row ? bucket : 'not_due'
      row[key] = Math.max(0, Number(row[key] || 0) + delta)
      row.total = Math.max(0, Number(row.total || 0) + delta)
      if (delta > 0) row.cnt = Number(row.cnt || 0) + 1
      if (delta < 0 && Number(row.total) <= 0) row.cnt = Math.max(0, Number(row.cnt || 0) - 1)
      return rows
    },
  )
}
