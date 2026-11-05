/**
 * E4/post-revisión — Existencias y Kardex.
 * Valoración SOLO con movements.unit_cost sellado. Nunca products.avg_cost actual.
 * No agregar cantidades entre productos (UDM distintas).
 * productName limpio (sin SKU concatenado); sku en campo aparte.
 */

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function movementEffectiveAt(m) {
  return m?.moved_at || m?.created_at || null
}

export function productKey(m) {
  if (m?.product_id != null) return String(m.product_id)
  return String(m?.products?.name || m?.product_name || 'unknown')
}

/** Nombre de producto sin concatenar SKU (evitar duplicados en tablas). */
export function productNameOnly(m) {
  return m?.products?.name || m?.product_name || 'Producto'
}

/** @deprecated Preferir productNameOnly + sku separado. Conservado para callers legacy. */
export function productLabel(m) {
  return productNameOnly(m)
}

export function productSku(m) {
  return m?.products?.sku || m?.sku || null
}

export function productCurrency(m) {
  return m?.products?.currency || m?.currency || null
}

/** UDM no está en el modelo de products; no se inventa. */
export function productUom(_m) {
  return null
}

export function sortMovementsChronologically(movements = []) {
  return [...(movements || [])].sort((a, b) => {
    const ta = new Date(movementEffectiveAt(a) || 0).getTime()
    const tb = new Date(movementEffectiveAt(b) || 0).getTime()
    if (ta !== tb) return ta - tb
    return Number(a?.id || 0) - Number(b?.id || 0)
  })
}

export function splitMovementsByPeriod(movements = [], from = null, to = null) {
  const before = []
  const during = []
  const after = []
  const fromT = from != null ? new Date(from).getTime() : null
  const toT = to != null ? new Date(to).getTime() : null
  for (const m of sortMovementsChronologically(movements)) {
    const t = new Date(movementEffectiveAt(m) || 0).getTime()
    if (!Number.isFinite(t)) {
      during.push(m)
      continue
    }
    if (fromT != null && t < fromT) before.push(m)
    else if (toT != null && t > toT) after.push(m)
    else during.push(m)
  }
  return { before, during, after }
}

function parseUnitCost(m) {
  if (m?.unit_cost === null || m?.unit_cost === undefined || m?.unit_cost === '') return null
  const n = Number(m.unit_cost)
  return Number.isFinite(n) ? n : null
}

function movementRefLabel(m) {
  const parts = []
  if (m?.document_id != null) parts.push(`Doc ${m.document_id}`)
  if (m?.transaction_id != null) parts.push(`Tx ${m.transaction_id}`)
  return parts.length ? parts.join(' · ') : null
}

/**
 * Kardex de un producto: saldo corrido de cantidad; valor solo si TODAS las líneas
 * hasta el momento tienen unit_cost.
 */
export function buildKardexForProduct(movements = [], key = null) {
  const filtered = key == null
    ? sortMovementsChronologically(movements)
    : sortMovementsChronologically(movements.filter((m) => productKey(m) === String(key)))

  let qty = 0
  let value = 0
  let valuationOk = true
  const rows = []

  for (const m of filtered) {
    const q = num(m.qty)
    const cost = parseUnitCost(m)
    const inbound = m.type === 'in'
    if (cost == null) valuationOk = false

    if (inbound) {
      qty += q
      if (cost != null) value += q * cost
    } else {
      qty -= q
      if (cost != null) value -= q * cost
    }

    rows.push({
      movementId: m.id ?? null,
      documentId: m.document_id ?? null,
      transactionId: m.transaction_id ?? null,
      sourceRef: movementRefLabel(m),
      effectiveAt: movementEffectiveAt(m),
      type: m.type,
      qtyIn: inbound ? q : null,
      qtyOut: inbound ? null : q,
      unitCost: cost,
      lineValue: cost == null ? null : (inbound ? q * cost : -(q * cost)),
      balanceQty: qty,
      balanceValue: valuationOk ? value : null,
      valuationAvailable: valuationOk,
      missingCost: cost == null,
      negativeBalance: qty < 0,
      productId: m.product_id ?? null,
      productName: productNameOnly(m),
      sku: productSku(m),
      currency: productCurrency(m),
      uom: productUom(m),
    })
  }

  const sample = filtered[0]
  return {
    productKey: key != null ? String(key) : (sample ? productKey(sample) : null),
    productName: sample ? productNameOnly(sample) : null,
    sku: sample ? productSku(sample) : null,
    currency: sample ? productCurrency(sample) : null,
    uom: null,
    rows,
    finalQty: qty,
    finalValue: valuationOk ? value : null,
    valuationAvailable: valuationOk && filtered.length > 0,
    missingCostLines: filtered.filter((m) => parseUnitCost(m) == null).length,
    negativeBalance: qty < 0,
  }
}

/**
 * Kardex con saldo inicial explícito respecto a un período.
 * opening = Kardex de movimientos previos; periodRows = líneas del período con saldo corrido.
 */
export function buildPeriodKardexForProduct(movements = [], key, { from = null, to = null } = {}) {
  const { before, during } = splitMovementsByPeriod(movements, from, to)
  const beforeForKey = before.filter((m) => productKey(m) === String(key))
  const duringForKey = during.filter((m) => productKey(m) === String(key))
  const opening = buildKardexForProduct(beforeForKey, key)
  const full = buildKardexForProduct([...beforeForKey, ...duringForKey], key)
  const periodRows = full.rows.slice(beforeForKey.length)

  const openingSource = beforeForKey.length
    ? 'Saldo reconstruido con movimientos previos al inicio del período (fecha efectiva).'
    : 'Sin movimientos previos al período: saldo inicial 0 (reconstruido; no es conteo físico).'

  return {
    ...full,
    openingQty: opening.finalQty,
    openingValue: opening.finalValue,
    openingValuationAvailable: opening.valuationAvailable,
    openingSource,
    periodRows,
    beforeCount: beforeForKey.length,
    negativeBalance: full.finalQty < 0,
  }
}

/** Kardex de todos los productos presentes en `movements`. */
export function buildKardexByProduct(movements = []) {
  const keys = [...new Set((movements || []).map(productKey))]
  return keys
    .map((k) => buildKardexForProduct(movements, k))
    .sort((a, b) => String(a.productName || '').localeCompare(String(b.productName || ''), 'es'))
}

/** Kardex por producto con apertura de período. */
export function buildPeriodKardexByProduct(movements = [], { from = null, to = null } = {}) {
  const { before, during } = splitMovementsByPeriod(movements, from, to)
  const keys = [...new Set([...before, ...during].map(productKey))]
  return keys
    .map((k) => buildPeriodKardexForProduct(movements, k, { from, to }))
    .sort((a, b) => String(a.productName || '').localeCompare(String(b.productName || ''), 'es'))
}

/**
 * Resumen de existencias por producto en un período.
 * Requiere movimientos previos (before) + del período (during) para saldo inicial.
 * Nunca suma qty entre productos. Saldo = reconstruido, no físico verificado.
 */
export function buildWarehouseStockByProduct(movements = [], { from = null, to = null } = {}) {
  const { before, during } = splitMovementsByPeriod(movements, from, to)
  const keys = [...new Set([
    ...before.map(productKey),
    ...during.map(productKey),
  ])]

  return keys.map((k) => {
    const opening = buildKardexForProduct(before, k)
    const periodMoves = during.filter((m) => productKey(m) === k)
    const ins = periodMoves.filter((m) => m.type === 'in')
    const outs = periodMoves.filter((m) => m.type === 'out')
    const qtyIn = ins.reduce((s, m) => s + num(m.qty), 0)
    const qtyOut = outs.reduce((s, m) => s + num(m.qty), 0)
    const closing = buildKardexForProduct([...before.filter((m) => productKey(m) === k), ...periodMoves], k)

    const valueInParts = ins.map(parseUnitCost)
    const valueOutParts = outs.map(parseUnitCost)
    const inValOk = ins.length === 0 || valueInParts.every((c) => c != null)
    const outValOk = outs.length === 0 || valueOutParts.every((c) => c != null)
    const valueIn = inValOk
      ? ins.reduce((s, m) => s + num(m.qty) * (parseUnitCost(m) || 0), 0)
      : null
    const valueOut = outValOk
      ? outs.reduce((s, m) => s + num(m.qty) * (parseUnitCost(m) || 0), 0)
      : null

    const sample = periodMoves[0] || before.find((m) => productKey(m) === k)
    const openingSource = before.some((m) => productKey(m) === k)
      ? 'movimientos_previos'
      : 'sin_historial_previo'

    return {
      productKey: k,
      productName: sample ? productNameOnly(sample) : k,
      sku: sample ? productSku(sample) : null,
      uom: null,
      currency: sample ? productCurrency(sample) : null,
      qtyInitial: opening.finalQty,
      openingSource,
      openingSourceLabel: openingSource === 'movimientos_previos'
        ? 'Reconstruido con movimientos previos al período'
        : 'Sin movimientos previos (inicial 0 reconstruido)',
      qtyIn,
      qtyOut,
      qtyFinal: closing.finalQty,
      valueInitial: opening.finalValue,
      valueIn,
      valueOut,
      valueFinal: closing.finalValue,
      valuationAvailable: closing.valuationAvailable,
      missingCostLines: closing.missingCostLines,
      movementCount: periodMoves.length,
      negativeBalance: closing.finalQty < 0,
      qualityLabel: !closing.valuationAvailable
        ? 'Valoración N/D'
        : (closing.finalQty < 0 ? 'Saldo negativo' : 'OK'),
    }
  }).sort((a, b) => String(a.productName).localeCompare(String(b.productName), 'es'))
}

export function summarizeWarehouseDataQuality(rows = []) {
  const total = rows.length
  const valued = rows.filter((r) => r.valuationAvailable).length
  const negative = rows.filter((r) => r.negativeBalance).length
  const missingCost = rows.filter((r) => !r.valuationAvailable).length
  return {
    total,
    valued,
    negative,
    missingCost,
    valuedPct: total ? Math.round((valued / total) * 100) : 0,
  }
}

export function formatValuation(value, available) {
  if (!available || value == null || !Number.isFinite(Number(value))) return 'N/D'
  return Number(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}
