/** Nombres comerciales (IDs internos: free / premium / ultra). */
export const PLAN_LABEL = {
  free: 'Inicial',
  premium: 'Negocio',
  ultra: 'Élite',
}

export const ANNUAL_DISCOUNT_PCT = 20

/** Fallback de precios mensuales USD (fuente real: plans.pricing en BD). */
export const PLAN_MONTHLY_PRICE = {
  free: 0,
  premium: 10,
  ultra: 20,
}

export function planLabel(planId) {
  return PLAN_LABEL[planId] || planId || '—'
}

export function isPaidPlanId(planId) {
  return planId === 'premium' || planId === 'ultra'
}

export function annualTotalFromMonthly(monthly) {
  const m = Number(monthly) || 0
  return Math.round(m * 12 * (1 - ANNUAL_DISCOUNT_PCT / 100))
}

export function annualMonthlyEquivalent(monthly) {
  const m = Number(monthly) || 0
  return Math.round(m * (1 - ANNUAL_DISCOUNT_PCT / 100))
}

/**
 * Resuelve precio de un plan/ciclo usando pricing de BD o fallback comercial.
 * @param {object|null} pricingRow — plans.pricing
 * @param {'monthly'|'annual'|string} cycle
 * @param {string} planId
 */
export function resolvePlanPrice(pricingRow, cycle, planId) {
  const monthlyFallback = PLAN_MONTHLY_PRICE[planId] ?? 0
  const monthly = Number(pricingRow?.monthly)
  const baseMonthly = Number.isFinite(monthly) ? monthly : monthlyFallback

  if (cycle === 'annual') {
    const annual = Number(pricingRow?.annual)
    if (Number.isFinite(annual)) return annual
    return annualTotalFromMonthly(baseMonthly)
  }

  return baseMonthly
}
