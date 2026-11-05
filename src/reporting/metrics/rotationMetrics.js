/**
 * E7 — Rotación de inventario (COGS / inventario medio) solo con valoración unit_cost.
 * No usa ratio salidas/entradas en cantidad ni avg_cost actual.
 */

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * @param {Array} stockRows — salida de buildWarehouseStockByProduct
 * @param {{ periodDays?: number|null }} opts
 */
export function buildInventoryRotation(stockRows = [], { periodDays = null } = {}) {
  return (stockRows || []).map((r) => {
    const available =
      r.valuationAvailable &&
      r.valueOut != null &&
      Number.isFinite(Number(r.valueOut)) &&
      r.valueInitial != null &&
      r.valueFinal != null

    if (!available) {
      return {
        productKey: r.productKey,
        productName: r.productName,
        sku: r.sku,
        currency: r.currency,
        cogs: null,
        avgInventory: null,
        rotation: null,
        daysOfInventory: null,
        available: false,
        reason: 'Valoración incompleta (unit_cost). Rotación N/D.',
      }
    }

    const cogs = num(r.valueOut)
    const avgInventory = (num(r.valueInitial) + num(r.valueFinal)) / 2
    if (avgInventory <= 0) {
      return {
        productKey: r.productKey,
        productName: r.productName,
        sku: r.sku,
        currency: r.currency,
        cogs,
        avgInventory,
        rotation: null,
        daysOfInventory: null,
        available: false,
        reason: 'Inventario medio ≤ 0; no se calcula rotación.',
      }
    }

    const rotation = cogs / avgInventory
    const days =
      periodDays != null && Number.isFinite(Number(periodDays)) && periodDays > 0 && rotation > 0
        ? Number(periodDays) / rotation
        : null

    return {
      productKey: r.productKey,
      productName: r.productName,
      sku: r.sku,
      currency: r.currency,
      cogs,
      avgInventory,
      rotation,
      daysOfInventory: days,
      available: true,
      reason: null,
    }
  })
}

/** Días del período inclusivos (start/end ISO o Date). */
export function periodLengthDays(from, to) {
  if (from == null || to == null) return null
  const a = new Date(from).getTime()
  const b = new Date(to).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null
  return Math.max(1, Math.round((b - a) / (24 * 60 * 60 * 1000)) + 1)
}
