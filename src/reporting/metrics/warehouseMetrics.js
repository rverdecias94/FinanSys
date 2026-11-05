/**
 * E4 — Existencias y Kardex.
 * Valoración SOLO con movements.unit_cost sellado. Nunca products.avg_cost actual.
 * No agregar cantidades entre productos (UDM distintas).
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

export function productLabel(m) {
  const name = m?.products?.name || m?.product_name || 'Producto'
  const sku = m?.products?.sku || m?.sku
  return sku ? `${name} (${sku})` : name
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
      effectiveAt: movementEffectiveAt(m),
      type: m.type,
      qtyIn: inbound ? q : null,
      qtyOut: inbound ? null : q,
      unitCost: cost,
      lineValue: cost == null ? null : (inbound ? q * cost : -(q * cost)),
      balanceQty: qty,
      balanceValue: valuationOk ? value : null,
      valuationAvailable: valuationOk,
      productId: m.product_id ?? null,
      productName: productLabel(m),
      sku: m.products?.sku || m.sku || null,
      currency: m.products?.currency || m.currency || null,
    })
  }

  return {
    productKey: key != null ? String(key) : (filtered[0] ? productKey(filtered[0]) : null),
    productName: filtered[0] ? productLabel(filtered[0]) : null,
    sku: filtered[0]?.products?.sku || filtered[0]?.sku || null,
    currency: filtered[0]?.products?.currency || filtered[0]?.currency || null,
    rows,
    finalQty: qty,
    finalValue: valuationOk ? value : null,
    valuationAvailable: valuationOk && filtered.length > 0,
    missingCostLines: filtered.filter((m) => parseUnitCost(m) == null).length,
  }
}

/** Kardex de todos los productos presentes en `movements`. */
export function buildKardexByProduct(movements = []) {
  const keys = [...new Set((movements || []).map(productKey))]
  return keys
    .map((k) => buildKardexForProduct(movements, k))
    .sort((a, b) => String(a.productName || '').localeCompare(String(b.productName || ''), 'es'))
}

/**
 * Resumen de existencias por producto en un período.
 * Requiere movimientos previos (before) + del período (during) para saldo inicial.
 * Nunca suma qty entre productos.
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

    return {
      productKey: k,
      productName: sample ? productLabel(sample) : k,
      sku: sample?.products?.sku || sample?.sku || null,
      currency: sample?.products?.currency || sample?.currency || null,
      qtyInitial: opening.finalQty,
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
    }
  }).sort((a, b) => String(a.productName).localeCompare(String(b.productName), 'es'))
}

export function formatValuation(value, available) {
  if (!available || value == null || !Number.isFinite(Number(value))) return 'N/D'
  return Number(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}
