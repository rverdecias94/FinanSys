/**
 * Conversión de tasas TRMI (CUP por unidad extranjera) al modelo Gestia
 * `units_per_base` = cuántas unidades de la moneda cotizada equivalen a 1 de la base.
 *
 * Fuente de referencia: elTOQUE TRMI (mercado informal). El euro suele venir como ECU.
 */

/** Alias de códigos que elTOQUE usa distinto al ISO habitual. */
export const ELTOQUE_CODE_ALIASES = {
  EUR: ['EUR', 'ECU'],
  ECU: ['ECU', 'EUR'],
}

/**
 * @param {Record<string, number|null|undefined>} cupPerForeign — p.ej. { USD: 930, EUR: 1015 }
 * @param {string} code
 * @returns {number|null}
 */
export function cupPerUnit(cupPerForeign, code) {
  const upper = String(code || '').toUpperCase()
  if (!upper) return null
  if (upper === 'CUP') return 1

  const aliases = ELTOQUE_CODE_ALIASES[upper] || [upper]
  const map = cupPerForeign && typeof cupPerForeign === 'object' ? cupPerForeign : {}
  for (const key of aliases) {
    const n = Number(map[key])
    if (Number.isFinite(n) && n > 0) return n
  }
  // También probar clave exacta por si el mapa ya normalizó ECU→EUR
  const direct = Number(map[upper])
  if (Number.isFinite(direct) && direct > 0) return direct
  return null
}

/**
 * Normaliza el mapa de elTOQUE: ECU → EUR (si no había EUR).
 * @param {Record<string, number|null|undefined>} tasas
 * @returns {Record<string, number>}
 */
export function normalizeCupPerForeign(tasas) {
  const out = {}
  for (const [k, v] of Object.entries(tasas || {})) {
    const n = Number(v)
    if (!Number.isFinite(n) || n <= 0) continue
    const code = String(k).toUpperCase()
    out[code] = n
  }
  if (out.ECU != null && out.EUR == null) out.EUR = out.ECU
  if (out.EUR != null && out.ECU == null) out.ECU = out.EUR
  return out
}

/**
 * Calcula units_per_base para `currencyCode` respecto a `baseCode`
 * usando un mapa CUP-por-unidad-extranjera.
 *
 * @returns {number|null}
 */
export function cupPerForeignToUnitsPerBase(baseCode, currencyCode, cupPerForeign) {
  const base = String(baseCode || '').toUpperCase()
  const cur = String(currencyCode || '').toUpperCase()
  if (!base || !cur || base === cur) return null

  const baseCup = cupPerUnit(cupPerForeign, base)
  const curCup = cupPerUnit(cupPerForeign, cur)
  if (baseCup == null || curCup == null) return null

  // 1 base = baseCup CUP; X cur = baseCup CUP ⇒ X = baseCup / curCup
  const units = baseCup / curCup
  return Number.isFinite(units) && units > 0 ? units : null
}

/**
 * Para cada moneda cotizada, sugiere el units_per_base a partir del TRMI.
 * @returns {{ suggestions: Record<string, number>, missing: string[] }}
 */
export function suggestUnitsPerBaseForCurrencies({
  baseCode,
  currencyCodes = [],
  cupPerForeign = {},
} = {}) {
  const suggestions = {}
  const missing = []
  for (const code of currencyCodes) {
    const n = cupPerForeignToUnitsPerBase(baseCode, code, cupPerForeign)
    if (n == null) missing.push(code)
    else suggestions[code] = roundRate(n)
  }
  return { suggestions, missing }
}

/** Redondeo legible: enteros si ≥ 10; si no, hasta 6 decimales útiles. */
export function roundRate(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return n
  if (x >= 10) return Math.round(x * 100) / 100
  if (x >= 1) return Math.round(x * 10000) / 10000
  return Math.round(x * 1_000_000) / 1_000_000
}

export const INFORMAL_FX_SOURCE_LABEL = 'elTOQUE (TRMI · mercado informal)'
export const INFORMAL_FX_SOURCE_URL = 'https://eltoque.com/tasas-de-cambio-cuba/mercado-informal'
