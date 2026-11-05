/**
 * E2 — Flujo registrado vs liquidado (puro, testeable).
 */
import {
  CASH_BASIS,
  isCashFlowType,
  isTransferType,
  isCashAtCreation,
  toNum,
} from './cashRules'

function emptyBucket() {
  return { inflow: 0, outflow: 0, net: 0 }
}

function addAmount(byCurrency, currency, type, amount) {
  const cur = currency || 'USD'
  if (!byCurrency[cur]) byCurrency[cur] = emptyBucket()
  const n = toNum(amount)
  if (type === 'income') byCurrency[cur].inflow += n
  else if (type === 'expense') byCurrency[cur].outflow += n
}

function toRows(byCurrency) {
  return Object.keys(byCurrency)
    .sort()
    .map((currency) => {
      const b = byCurrency[currency]
      return {
        currency,
        inflow: b.inflow,
        outflow: b.outflow,
        net: b.inflow - b.outflow,
      }
    })
    .filter((r) => r.inflow !== 0 || r.outflow !== 0)
}

/**
 * Compatibilidad con getFilteredTotals / computeTotals:
 * { income: { USD: n }, expense: { USD: n } } → filas de flujo.
 * Equivale al antiguo buildCashFlow (base recorded).
 */
export function buildRecordedFlowFromTotals(totals) {
  const income = totals?.income || {}
  const expense = totals?.expense || {}
  const currencies = [...new Set([...Object.keys(income), ...Object.keys(expense)])].sort()
  return currencies.map((currency) => {
    const inflow = toNum(income[currency])
    const outflow = toNum(expense[currency])
    return { currency, inflow, outflow, net: inflow - outflow }
  })
}

/**
 * Flujo registrado desde filas de transactions (ya filtradas por período o no).
 * Ignora type=transfer. Suma `amount` completo sin mirar status.
 */
export function buildRecordedCashFlow(transactions = []) {
  const byCurrency = {}
  for (const tx of transactions || []) {
    if (isTransferType(tx?.type) || !isCashFlowType(tx?.type)) continue
    addAmount(byCurrency, tx.currency, tx.type, tx.amount)
  }
  return toRows(byCurrency)
}

/**
 * Flujo liquidado (caja movida) sin doble conteo.
 *
 * @param {object} args
 * @param {Array} args.transactions — txs relevantes (al menos las del período + padres de abonos)
 * @param {Array} args.payments — abonos con { transaction_id, amount, paid_at } ya filtrados por período
 * @param {Map<number,number>|Record<string,number>} [args.paymentCountsByTx] — total de abonos por tx (no solo del período). Si falta, se infiere contando `payments` (INCORRECTO para detectar contado si el abono está fuera del período). Preferir conteo global.
 * @param {{ from?: string|Date, to?: string|Date }} [args.period] — si se pasa, filtra cash-at-creation por transactions.date
 */
export function buildSettledCashFlow({
  transactions = [],
  payments = [],
  paymentCountsByTx = null,
  period = null,
} = {}) {
  const txsById = new Map()
  for (const tx of transactions || []) {
    if (tx?.id != null) txsById.set(Number(tx.id), tx)
  }

  const counts = new Map()
  if (paymentCountsByTx instanceof Map) {
    for (const [k, v] of paymentCountsByTx) counts.set(Number(k), toNum(v))
  } else if (paymentCountsByTx && typeof paymentCountsByTx === 'object') {
    for (const [k, v] of Object.entries(paymentCountsByTx)) counts.set(Number(k), toNum(v))
  }

  const byCurrency = {}

  // 1) Abonos del período → caja movida (nunca sumar amount de la tx aquí)
  for (const pay of payments || []) {
    const tx = txsById.get(Number(pay.transaction_id))
    if (!tx || isTransferType(tx.type) || !isCashFlowType(tx.type)) continue
    addAmount(byCurrency, tx.currency, tx.type, pay.amount)
  }

  // 2) Altas al contado sin ledger, por fecha de la transacción
  for (const tx of transactions || []) {
    if (isTransferType(tx?.type) || !isCashFlowType(tx?.type)) continue
    const count = counts.has(Number(tx.id))
      ? counts.get(Number(tx.id))
      : 0
    if (!isCashAtCreation(tx, count)) continue
    if (period && !isDateInPeriod(tx.date, period.from, period.to)) continue
    addAmount(byCurrency, tx.currency, tx.type, tx.amount)
  }

  return toRows(byCurrency)
}

function isDateInPeriod(dateValue, from, to) {
  if (!dateValue) return false
  const t = new Date(dateValue).getTime()
  if (!Number.isFinite(t)) return false
  if (from != null && t < new Date(from).getTime()) return false
  if (to != null && t > new Date(to).getTime()) return false
  return true
}

export function cashFlowRowsToExport(rows, basis = CASH_BASIS.RECORDED) {
  const labels = basis === CASH_BASIS.SETTLED
    ? { in: 'Entradas liquidadas', out: 'Salidas liquidadas', net: 'Flujo neto liquidado' }
    : { in: 'Entradas registradas', out: 'Salidas registradas', net: 'Flujo neto registrado' }
  return (rows || []).map((r) => ({
    Moneda: r.currency,
    [labels.in]: r.inflow,
    [labels.out]: r.outflow,
    [labels.net]: r.net,
  }))
}
