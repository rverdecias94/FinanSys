/**
 * Precio de reposición operativo (no reescribe avg_cost / COGS histórico).
 *
 * Regla clave: sugerido y comparación SIEMPRE en la moneda del producto
 * (la misma de unit_price). Nunca comparar USD contra CUP ni aplicar un
 * sugerido CUP sobre un producto cotizado en USD.
 *
 * - Producto en CUP (u otra moneda tasada vs base): escala costo con R_hoy/R_compra.
 * - Producto en moneda base (tip. USD): reposición = avg_cost en esa moneda;
 *   la tasa CUP solo se usa como equivalencia informativa, no para el precio a aplicar.
 */

export function roundMoney(n, digits = 2) {
  const x = Number(n)
  if (!Number.isFinite(x)) return null
  const f = 10 ** digits
  return Math.round(x * f) / f
}

/**
 * @param {object} input
 * @param {number} input.avgCost — costo promedio en moneda del producto
 * @param {string} input.productCurrency — moneda de costo y de unit_price
 * @param {string} input.baseCurrency — moneda principal del negocio
 * @param {number|null} input.purchaseRate — units_per_base sellada (quote por 1 base)
 * @param {number|null} input.currentRate — units_per_base vigente
 * @param {string} [input.quoteCurrency] — moneda local informativa (tip. CUP)
 * @param {number} [input.marginPct]
 * @param {number|null} [input.unitPrice] — precio de venta en productCurrency
 * @param {boolean} [input.isForSale] — false = consumo interno, no sugerir venta
 */
export function computeReplacementPricing({
  avgCost,
  productCurrency,
  baseCurrency,
  purchaseRate,
  currentRate,
  quoteCurrency = null,
  marginPct = 25,
  unitPrice = null,
  isForSale = true,
} = {}) {
  if (isForSale === false) {
    return {
      ok: false,
      reason: 'not_for_sale',
      replacement: null,
      suggested: null,
      atRisk: false,
      currency: null,
    }
  }

  const cost = Number(avgCost)
  const margin = Number(marginPct)
  const price = unitPrice == null || unitPrice === '' ? null : Number(unitPrice)
  const R0 = purchaseRate == null || purchaseRate === '' ? null : Number(purchaseRate)
  const R1 = currentRate == null || currentRate === '' ? null : Number(currentRate)

  const base = String(baseCurrency || '').toUpperCase()
  const product = String(productCurrency || '').toUpperCase()
  const quote = String(quoteCurrency || '').toUpperCase() || null

  if (!Number.isFinite(cost) || cost <= 0) {
    return { ok: false, reason: 'missing_cost', replacement: null, suggested: null, atRisk: false, currency: product }
  }
  if (!Number.isFinite(margin) || margin < 0) {
    return { ok: false, reason: 'bad_margin', replacement: null, suggested: null, atRisk: false, currency: product }
  }
  // Sin precio de venta (0) no hay “margen a proteger” en venta.
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, reason: 'no_sale_price', replacement: null, suggested: null, atRisk: false, currency: product }
  }

  let replacement = null

  if (product === base) {
    // Costo y venta en moneda dura: el dólar no cambia el costo en USD.
    replacement = cost
  } else {
    // Venta/costo en moneda local (CUP…): ajustar por devaluación vs tasa de compra.
    if (!Number.isFinite(R0) || R0 <= 0) {
      replacement = cost
    } else if (!Number.isFinite(R1) || R1 <= 0) {
      return {
        ok: false,
        reason: 'missing_current_rate',
        replacement: null,
        suggested: null,
        atRisk: false,
        currency: product,
      }
    } else {
      replacement = cost * (R1 / R0)
    }
  }

  replacement = roundMoney(replacement)
  const suggested = roundMoney(replacement * (1 + margin / 100))
  const atRisk = Number.isFinite(price) && Number.isFinite(suggested) ? price < suggested : false
  const gap = Number.isFinite(price) && Number.isFinite(suggested) ? roundMoney(suggested - price) : null

  let cupEquivalent = null
  if (quote && quote !== product && Number.isFinite(R1) && R1 > 0 && product === base) {
    cupEquivalent = roundMoney(suggested * R1)
  }

  return {
    ok: true,
    reason: null,
    replacement,
    suggested,
    atRisk,
    gap,
    currency: product,
    marginPct: margin,
    purchaseRate: Number.isFinite(R0) ? R0 : null,
    currentRate: Number.isFinite(R1) ? R1 : null,
    cupEquivalent,
  }
}

export function sodaFixture() {
  return {
    boxUsd: 50,
    units: 50,
    r0: 800,
    r1: 1000,
    marginPct: 25,
    unitCostCupAtR0: 800,
    suggestedAtR0: 1000,
    replacementAtR1: 1000,
    suggestedAtR1: 1250,
  }
}
