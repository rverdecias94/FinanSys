/**
 * E7 — Conciliación venta → stock → cobro (gestión, no contabilidad formal).
 * Tres preguntas independientes: ¿se entregó? ¿se registró? ¿se cobró?
 */

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const RECONCILE_STATUS = {
  CONCILIADO: 'conciliado',
  PARCIAL: 'parcial',
  SIN_ENTREGA: 'sin_entrega',
  SIN_COBRO: 'sin_cobro',
  COBRADO_SIN_ENTREGA: 'cobrado_sin_entrega',
  SIN_VINCULO: 'sin_vinculo_stock',
}

/**
 * @param {object} args
 * @param {Array} args.transactions — ingresos del período (type income)
 * @param {Array} args.movements — movimientos con transaction_id (salidas de venta)
 * @param {Array} args.payments — abonos { transaction_id, amount }
 */
export function buildSaleStockPaymentRows({
  transactions = [],
  movements = [],
  payments = [],
} = {}) {
  const income = (transactions || []).filter((t) => t?.type === 'income')
  const outsByTx = new Map()
  for (const m of movements || []) {
    if (m?.type !== 'out' || m.transaction_id == null) continue
    const id = Number(m.transaction_id)
    if (!outsByTx.has(id)) outsByTx.set(id, [])
    outsByTx.get(id).push(m)
  }
  const paidByTx = new Map()
  for (const p of payments || []) {
    if (p?.transaction_id == null) continue
    const id = Number(p.transaction_id)
    paidByTx.set(id, (paidByTx.get(id) || 0) + num(p.amount))
  }

  return income.map((tx) => {
    const id = Number(tx.id)
    const saleAmount = num(tx.amount)
    const currency = tx.currency || null
    const linked = outsByTx.get(id) || []
    const qtyDelivered = linked.reduce((s, m) => s + num(m.qty), 0)
    const costs = linked.map((m) => {
      if (m.unit_cost === null || m.unit_cost === undefined || m.unit_cost === '') return null
      const c = Number(m.unit_cost)
      return Number.isFinite(c) ? c : null
    })
    const costOk = linked.length > 0 && costs.every((c) => c != null)
    const inventoryCost = costOk
      ? linked.reduce((s, m, i) => s + num(m.qty) * costs[i], 0)
      : linked.length === 0
        ? 0
        : null

    const fromLedger = paidByTx.has(id) ? paidByTx.get(id) : null
    const collected = fromLedger != null ? fromLedger : num(tx.paid_amount)
    const receivable = Math.max(0, saleAmount - collected)
    const delivered = qtyDelivered > 0
    const fullyPaid = collected + 1e-9 >= saleAmount && saleAmount > 0
    const partialPaid = collected > 0 && !fullyPaid

    let status = RECONCILE_STATUS.SIN_VINCULO
    if (!delivered && collected <= 0) status = RECONCILE_STATUS.SIN_ENTREGA
    else if (!delivered && collected > 0) status = RECONCILE_STATUS.COBRADO_SIN_ENTREGA
    else if (delivered && collected <= 0) status = RECONCILE_STATUS.SIN_COBRO
    else if (delivered && partialPaid) status = RECONCILE_STATUS.PARCIAL
    else if (delivered && fullyPaid) status = RECONCILE_STATUS.CONCILIADO
    else if (delivered) status = RECONCILE_STATUS.PARCIAL

    return {
      transactionId: id,
      date: tx.date || null,
      description: tx.description || null,
      currency,
      saleAmount,
      inventoryCost,
      inventoryCostAvailable: costOk || linked.length === 0,
      qtyDelivered,
      delivered,
      collected,
      receivable,
      status,
      movementIds: linked.map((m) => m.id).filter((x) => x != null),
      paymentSource: fromLedger != null ? 'ledger' : 'paid_amount_cache',
    }
  })
}

export function summarizeReconcile(rows = []) {
  const byStatus = {}
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1
  }
  return {
    total: rows.length,
    byStatus,
    withDelivery: rows.filter((r) => r.delivered).length,
    fullyCollected: rows.filter((r) => r.status === RECONCILE_STATUS.CONCILIADO).length,
  }
}

/**
 * FX en reportes: no consolidar. Solo reportar presencia de tasa sellada.
 */
export function describeFxReportingStatus(transactions = []) {
  let withRate = 0
  let withoutRate = 0
  const currencies = new Set()
  for (const t of transactions || []) {
    if (t?.currency) currencies.add(t.currency)
    const rate = t?.fx_units_per_base
    if (rate != null && Number.isFinite(Number(rate)) && Number(rate) > 0) withRate += 1
    else withoutRate += 1
  }
  return {
    withSealedRate: withRate,
    withoutSealedRate: withoutRate,
    distinctCurrencies: [...currencies],
    consolidatable: false,
    note:
      currencies.size > 1
        ? 'Hay varias monedas: los totales se mantienen por moneda nativa. No hay consolidación FX en reportes (falta tasa sellada uniforme o política de conversión).'
        : withRate > 0
          ? 'Algunos registros tienen fx_units_per_base sellado; igual no se convierte en el informe (solo moneda nativa).'
          : 'Sin consolidación FX: informe en moneda(s) nativa(s) del registro.',
  }
}
