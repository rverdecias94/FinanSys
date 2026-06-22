// Q5 — Flujo de Efectivo y Posición simplificada. Helpers puros sobre datos que ya
// provee la app (getFilteredTotals, getBalanceConfig, getAgingReport): NO hay RPC nueva.

const num = (v) => Number(v || 0)

// Flujo de Efectivo del período por moneda, a partir de getFilteredTotals
// ({ income: {USD,CUP,...}, expense: {...} }). net = entradas - salidas.
export function buildCashFlow(totals) {
  const income = totals?.income || {}
  const expense = totals?.expense || {}
  const currencies = [...new Set([...Object.keys(income), ...Object.keys(expense)])].sort()
  return currencies.map((currency) => {
    const inflow = num(income[currency])
    const outflow = num(expense[currency])
    return { currency, inflow, outflow, net: inflow - outflow }
  })
}

// Posición simplificada por moneda. El saldo (business_balances) es DEVENGADO: ya
// incluye lo pendiente (el trigger suma toda income/expense por `amount`, sin mirar
// status). Por eso la caja real hoy = saldo - por cobrar + por pagar: lo que te deben
// aún no entró (se descuenta) y lo que debes aún no salió (sigue en tu caja).
// balances: [{currency_code, current_balance}]; receivable/payable: filas de
// get_aging_report ([{currency, total}]).
export function buildPosition(balances, receivable, payable) {
  const recByCur = Object.fromEntries((receivable || []).map((r) => [r.currency, num(r.total)]))
  const payByCur = Object.fromEntries((payable || []).map((r) => [r.currency, num(r.total)]))
  const currencies = [...new Set([
    ...(balances || []).map((b) => b.currency_code),
    ...Object.keys(recByCur),
    ...Object.keys(payByCur),
  ])].sort()
  return currencies.map((currency) => {
    const saldo = num((balances || []).find((b) => b.currency_code === currency)?.current_balance)
    const porCobrar = recByCur[currency] || 0
    const porPagar = payByCur[currency] || 0
    return { currency, saldo, porCobrar, porPagar, caja: saldo - porCobrar + porPagar }
  // Omite monedas configuradas pero sin nada (saldo y pendientes en 0): son ruido y
  // dejan la Posición inconsistente con el Flujo (que solo muestra monedas con actividad).
  }).filter((r) => r.saldo !== 0 || r.porCobrar !== 0 || r.porPagar !== 0)
}

// Filas planas para exportar el flujo (Excel/PDF).
export function cashFlowToExportRows(rows) {
  return (rows || []).map((r) => ({
    Moneda: r.currency,
    Entradas: r.inflow,
    Salidas: r.outflow,
    'Flujo neto': r.net,
  }))
}

// Filas planas para exportar la posición.
export function positionToExportRows(rows) {
  return (rows || []).map((r) => ({
    Moneda: r.currency,
    'Saldo registrado': r.saldo,
    'Por cobrar': r.porCobrar,
    'Por pagar': r.porPagar,
    'Caja real hoy': r.caja,
  }))
}
