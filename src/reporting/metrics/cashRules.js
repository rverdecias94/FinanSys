/**
 * E2 — Clasificación de operaciones financieras (GESTIA).
 * Ver docs/reportes/E2_LIQUIDACION.md
 */

export const CASH_BASIS = {
  RECORDED: 'recorded',
  SETTLED: 'settled',
}

export const CASH_BASIS_LABELS = {
  recorded: {
    title: 'Flujo registrado',
    short: 'Registrado',
    description: 'Suma de transacciones del período por fecha de registro (cualquier estado de cobro/pago). No equivale a caja cobrada.',
    inflow: 'Entradas registradas',
    outflow: 'Salidas registradas',
    net: 'Flujo neto registrado',
  },
  settled: {
    title: 'Flujo liquidado',
    short: 'Liquidado',
    description: 'Efectivo movido en el período: abonos (paid_at) + altas al contado sin ledger. No usa paid_amount como segunda fuente.',
    inflow: 'Entradas liquidadas',
    outflow: 'Salidas liquidadas',
    net: 'Flujo neto liquidado',
  },
}

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Tipos que entran en flujo de caja de gestión. */
export function isCashFlowType(type) {
  return type === 'income' || type === 'expense'
}

/** Transferencias entre cuentas (si existieran) no son ingreso/gasto. */
export function isTransferType(type) {
  return type === 'transfer'
}

export function openBalance(tx) {
  const amount = num(tx?.amount)
  const paid = num(tx?.paid_amount)
  return Math.max(0, amount - paid)
}

export function isPendingOpen(tx) {
  if (!isCashFlowType(tx?.type)) return false
  const status = tx?.status || 'paid'
  return (status === 'pending' || status === 'partial') && openBalance(tx) > 0
}

/**
 * Alta al contado: status paid y sin filas en account_payments.
 * (createTransaction paid fija paid_amount=amount sin pasar por el ledger; S2.)
 * Si hay CUALQUIER abono en ledger, la caja se toma solo de account_payments.
 */
export function isCashAtCreation(tx, paymentCount = 0) {
  if (!isCashFlowType(tx?.type)) return false
  if ((tx?.status || 'paid') !== 'paid') return false
  if (paymentCount > 0) return false
  return num(tx?.amount) > 0
}

export function classifyTransaction(tx, paymentCount = 0) {
  if (isTransferType(tx?.type)) {
    return { kind: 'transfer', open: 0, cashAtCreation: false }
  }
  if (!isCashFlowType(tx?.type)) {
    return { kind: 'other', open: 0, cashAtCreation: false }
  }
  const status = tx?.status || 'paid'
  const open = openBalance(tx)
  if (status === 'pending' && open > 0) {
    return { kind: 'pending', open, cashAtCreation: false }
  }
  if (status === 'partial' && open > 0) {
    return { kind: 'partial', open, cashAtCreation: false }
  }
  if (isCashAtCreation(tx, paymentCount)) {
    return { kind: 'cash_at_creation', open: 0, cashAtCreation: true }
  }
  if (status === 'paid') {
    return { kind: 'paid_via_ledger', open: 0, cashAtCreation: false }
  }
  return { kind: 'recorded', open, cashAtCreation: false }
}

export { num as toNum }
