/**
 * Formatea el resumen anual de finanzas para el snapshot del Copiloto.
 * "Facturación" en el chat = ingresos registrados (type income).
 */

function emptyTotals() {
  return { income_by_currency: {}, expense_by_currency: {} }
}

function addMaps(target, source) {
  for (const [code, amount] of Object.entries(source || {})) {
    const n = Number(amount)
    if (!Number.isFinite(n) || n === 0) continue
    target[code] = (target[code] || 0) + n
  }
}

function hasActivity(income, expense) {
  return Object.keys(income || {}).length > 0 || Object.keys(expense || {}).length > 0
}

/**
 * @param {number} year
 * @param {Record<number, { income?: Record<string, number>, expense?: Record<string, number> }>} monthlyData
 * @param {{ throughMonth?: number|null }} [opts] - si se indica, YTD solo hasta ese mes (1-12)
 */
export function formatYearHistory(year, monthlyData, opts = {}) {
  const throughMonth = opts.throughMonth == null ? 12 : Math.min(12, Math.max(1, Number(opts.throughMonth) || 12))
  const by_month = []
  const ytd = emptyTotals()
  const year_totals = emptyTotals()

  for (let month = 1; month <= 12; month++) {
    const row = monthlyData?.[month] || {}
    const income = { ...(row.income || {}) }
    const expense = { ...(row.expense || {}) }
    by_month.push({
      month,
      period: `${year}-${String(month).padStart(2, '0')}`,
      income_by_currency: income,
      expense_by_currency: expense,
      has_activity: hasActivity(income, expense),
    })
    addMaps(year_totals.income_by_currency, income)
    addMaps(year_totals.expense_by_currency, expense)
    if (month <= throughMonth) {
      addMaps(ytd.income_by_currency, income)
      addMaps(ytd.expense_by_currency, expense)
    }
  }

  return {
    year,
    glossary: {
      income: 'Ingresos / facturación / ventas registradas en Finanzas',
      expense: 'Gastos / egresos registrados en Finanzas',
    },
    by_month,
    ytd_through_month: throughMonth,
    ytd,
    year_totals,
  }
}
