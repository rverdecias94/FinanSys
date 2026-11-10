// Q5 / E2 — Flujo y Posición. buildCashFlow conserva la firma histórica (= flujo registrado
// desde getFilteredTotals). La lógica settled vive en src/reporting/metrics/.

import { buildRecordedFlowFromTotals } from '@/reporting/metrics/cashMetrics'

const num = (v) => Number(v || 0)

// Flujo REGISTRADO del período por moneda, a partir de getFilteredTotals
// ({ income: {USD,CUP,...}, expense: {...} }). net = entradas - salidas.
// Misma forma que antes de E2; no es caja liquidada.
export function buildCashFlow(totals) {
  return buildRecordedFlowFromTotals(totals)
}

// Posición por moneda. Desde P0-005, business_balances es CAJA COBRADA (settled:
// solo paid_amount; los abonos actualizan el saldo). Por eso caja === saldo.
// porCobrar / porPagar se muestran como contexto, sin recalcular la caja.
// balances: [{currency_code, current_balance}]; receivable/payable: aging.
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
    return { currency, saldo, porCobrar, porPagar, caja: saldo }
  // Omite monedas configuradas pero sin nada (saldo y pendientes en 0): son ruido y
  // dejan la Posición inconsistente con el Flujo (que solo muestra monedas con actividad).
  }).filter((r) => r.saldo !== 0 || r.porCobrar !== 0 || r.porPagar !== 0)
}

// Filas planas para exportar el flujo (Excel/PDF). Etiquetas históricas por compatibilidad.
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
    'Caja cobrada': r.saldo,
    'Por cobrar': r.porCobrar,
    'Por pagar': r.porPagar,
    'Caja disponible': r.caja,
  }))
}
