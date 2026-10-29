/**
 * Motor determinista de la Calculadora de negocio (sin IA).
 * La IA solo puede proponer mode+params; el resultado sale de aquí.
 */

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function findRate(rates, from, to, baseCurrency) {
  const f = (from || '').toUpperCase()
  const t = (to || '').toUpperCase()
  const base = (baseCurrency || '').toUpperCase()
  if (!f || !t || f === t) return 1

  // rates: map currency -> number | { units_per_base } (unidades por 1 base)
  const units = (code) => {
    if (code === base) return 1
    const r = rates?.[code]
    const v = Number(r?.units_per_base ?? r)
    return Number.isFinite(v) && v > 0 ? v : null
  }

  const fromUnits = units(f)
  const toUnits = units(t)
  if (fromUnits == null || toUnits == null) return null
  // amount_from / fromUnits = amount_base; amount_base * toUnits = amount_to
  return toUnits / fromUnits
}

export function runAffordability({ balances = {}, expenses = [] }) {
  const byCurrency = { ...balances }
  const lines = []

  for (const exp of expenses || []) {
    const currency = (exp.currency || 'USD').toUpperCase()
    const amount = Math.abs(num(exp.amount))
    const before = num(byCurrency[currency])
    const after = before - amount
    byCurrency[currency] = after
    lines.push({
      label: exp.label || 'Gasto',
      currency,
      amount,
      before,
      after,
      ok: after >= 0,
    })
  }

  const ok = lines.every((l) => l.ok)
  return {
    mode: 'affordability',
    ok,
    title: ok ? 'Sí te alcanza' : 'No te alcanza en alguna moneda',
    lines,
    remaining: byCurrency,
  }
}

export function runFx({ amount, fromCurrency, toCurrency, rates, baseCurrency }) {
  const a = Math.abs(num(amount))
  const rate = findRate(rates, fromCurrency, toCurrency, baseCurrency)
  if (rate == null) {
    return {
      mode: 'fx',
      ok: false,
      title: 'Falta tipo de cambio',
      message: `No hay tasa para convertir ${fromCurrency} → ${toCurrency}. Configura tasas en Monedas.`,
    }
  }
  const converted = a * rate
  return {
    mode: 'fx',
    ok: true,
    title: 'Conversión',
    amount: a,
    fromCurrency: (fromCurrency || '').toUpperCase(),
    toCurrency: (toCurrency || '').toUpperCase(),
    rate,
    converted,
  }
}

export function runMargin({ cost, sellPrice, quantity = 1, currency = 'USD' }) {
  const c = Math.abs(num(cost))
  const s = Math.abs(num(sellPrice))
  const q = Math.max(0, num(quantity) || 1)
  const unitProfit = s - c
  const marginPct = s > 0 ? (unitProfit / s) * 100 : 0
  const totalProfit = unitProfit * q
  return {
    mode: 'margin',
    ok: true,
    title: unitProfit >= 0 ? 'Margen positivo' : 'Margen negativo',
    currency: (currency || 'USD').toUpperCase(),
    cost: c,
    sellPrice: s,
    quantity: q,
    unitProfit,
    marginPct,
    totalProfit,
  }
}

export function runCollection({ percent, currency, agingByCurrency = {} }) {
  const p = Math.min(100, Math.max(0, num(percent)))
  const code = (currency || Object.keys(agingByCurrency)[0] || 'USD').toUpperCase()
  const overdue = num(agingByCurrency[code]?.overdue ?? agingByCurrency[code]?.total ?? 0)
  const collectable = overdue * (p / 100)
  return {
    mode: 'collection',
    ok: true,
    title: 'Escenario de cobro',
    currency: code,
    percent: p,
    overdue,
    collectable,
  }
}

export function runCalculator(mode, params, context = {}) {
  switch (mode) {
    case 'affordability':
      return runAffordability({
        balances: context.balances || {},
        expenses: params?.expenses || [],
      })
    case 'fx':
      return runFx({
        amount: params?.amount,
        fromCurrency: params?.fromCurrency,
        toCurrency: params?.toCurrency,
        rates: context.rates || {},
        baseCurrency: context.baseCurrency,
      })
    case 'margin':
      return runMargin(params || {})
    case 'collection':
      return runCollection({
        percent: params?.percent,
        currency: params?.currency,
        agingByCurrency: context.agingByCurrency || {},
      })
    case 'unsupported':
      return {
        mode: 'unsupported',
        ok: false,
        title: 'Esa pregunta no la cubre esta calculadora',
        message: params?.reason || 'Solo respondo ¿me alcanza?, conversión FX, margen y cobro de CxC.',
        suggestion: params?.suggestion || 'Ej.: "¿Me alcanzan 150 USD para pagar nómina?"',
      }
    default:
      return {
        mode: 'unknown',
        ok: false,
        title: 'Modo no reconocido',
        message: 'Elige un modo de la calculadora o reformula la pregunta.',
        suggestion: 'Ej.: "Convierte 50 USD a CUP" o "Si cobro el 40% de lo vencido en USD…"',
      }
  }
}
