/**
 * Modelo mental cubano: siempre "1 USD|EUR|MLC = ¿cuántos CUP?".
 * Todo gira alrededor del CUP, aunque la moneda principal del negocio sea otra.
 *
 * BD (sin cambiar): units_per_base = unidades de esa moneda por 1 unidad de la base.
 * Ej. base USD, CUP=800 → 1 USD = 800 CUP.
 */

export const FX_ANCHOR = 'CUP'

function code(c) {
  return String(c || '').toUpperCase()
}

function roundDisplay(v) {
  return String(Math.round(v * 1e8) / 1e8)
}

function roundStored(v) {
  return Math.round(v * 1e12) / 1e12
}

/**
 * Monedas habilitadas a preguntar al inicio / en Monedas.
 * Regla Cuba: 1 X = ¿cuántos CUP? para CADA moneda activa distinta de CUP.
 * La moneda principal (is_default) NO cambia el sentido de la pregunta:
 * si el negocio opera en USD, igual se pregunta «1 USD = ¿cuántos CUP?»
 * y «1 MLC = ¿cuántos CUP?» — nunca «1 USD = ¿cuántos MLC?».
 */
export function fxCupPromptCurrencies(_baseCode, activeCodes = []) {
  const codes = (activeCodes || []).map(code).filter(Boolean)
  // Deduplicar y ordenar estable (USD/EUR/MLC primero si están, luego el resto).
  const preferred = ['USD', 'EUR', 'MLC']
  const unique = [...new Set(codes.filter((c) => c !== FX_ANCHOR))]
  return unique.sort((a, b) => {
    const ia = preferred.indexOf(a)
    const ib = preferred.indexOf(b)
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    }
    return a.localeCompare(b)
  })
}

/** Siempre anclado a CUP. Nunca usa la moneda principal como denominador. */
export function fxCupLabel(foreignCode) {
  const f = code(foreignCode)
  if (!f || f === FX_ANCHOR) return ''
  return `1 ${f} = ¿cuántos ${FX_ANCHOR}?`
}

/**
 * Lee el valor de UI (CUP por 1 unidad de `foreign`) desde el mapa de tasas.
 * @param {string} foreignCode
 * @param {string} baseCode
 * @param {Record<string, {units_per_base?: number}|number>} ratesMap
 */
export function fxCupDisplayFromRates(foreignCode, baseCode, ratesMap) {
  const foreign = code(foreignCode)
  const base = code(baseCode)
  const units = (c) => {
    const r = ratesMap?.[c]
    const v = Number(r?.units_per_base ?? r)
    return Number.isFinite(v) && v > 0 ? v : null
  }

  if (foreign === FX_ANCHOR) return ''

  // Base = CUP: stored = foreign por 1 CUP → display = 1/stored
  if (base === FX_ANCHOR) {
    const u = units(foreign)
    if (u == null) return ''
    return roundDisplay(1 / u)
  }

  // Base = foreign (ej. negocio en USD): stored en CUP = CUP por 1 USD → display directo
  if (base === foreign) {
    const cup = units(FX_ANCHOR)
    if (cup == null) return ''
    return roundDisplay(cup)
  }

  // Base otra (USD) + foreign EUR: CUP/EUR = (CUP por USD) / (EUR por USD)
  const cupPerBase = units(FX_ANCHOR)
  const foreignPerBase = units(foreign)
  if (cupPerBase == null || foreignPerBase == null) return ''
  return roundDisplay(cupPerBase / foreignPerBase)
}

/**
 * Convierte el valor UI (CUP por 1 foreign) al units_per_base a guardar para esa moneda.
 * Si foreign === base, el guardado va en la fila CUP (no en foreign).
 * @returns {{ currency_code: string, units_per_base: number } | null}
 */
export function fxCupStoredFromDisplay(foreignCode, baseCode, display, ratesMap) {
  const foreign = code(foreignCode)
  const base = code(baseCode)
  const cupPerForeign = Number(display)
  if (!Number.isFinite(cupPerForeign) || cupPerForeign <= 0) return null
  if (foreign === FX_ANCHOR) return null

  const units = (c) => {
    const r = ratesMap?.[c]
    const v = Number(r?.units_per_base ?? r)
    return Number.isFinite(v) && v > 0 ? v : null
  }

  // Base CUP: guardar foreign = 1 / (CUP por foreign)
  if (base === FX_ANCHOR) {
    return { currency_code: foreign, units_per_base: roundStored(1 / cupPerForeign) }
  }

  // Base = foreign (negocio en USD): guardar CUP = cupPerForeign
  if (base === foreign) {
    return { currency_code: FX_ANCHOR, units_per_base: roundStored(cupPerForeign) }
  }

  // Base USD + foreign EUR: necesitamos CUP/base para cruzar.
  // 1 EUR = cupPerForeign CUP; 1 USD = cupPerBase CUP
  // → EUR por 1 USD = cupPerBase / cupPerForeign
  const cupPerBase = units(FX_ANCHOR)
  if (cupPerBase == null) {
    // Sin tasa USD→CUP aún no podemos fijar EUR vs base.
    return null
  }
  return {
    currency_code: foreign,
    units_per_base: roundStored(cupPerBase / cupPerForeign),
  }
}

/**
 * Códigos de fila en BD que deben tener tasa de hoy para cubrir las preguntas CUP.
 * Ej. base USD + prompts [USD,EUR] → ['CUP','EUR'].
 */
export function fxCupStorageCodesForCheck(promptCodes, baseCode) {
  const base = code(baseCode)
  const set = new Set()
  for (const f of promptCodes || []) {
    const foreign = code(f)
    if (!foreign || foreign === FX_ANCHOR) continue
    if (base === FX_ANCHOR) set.add(foreign)
    else if (foreign === base) set.add(FX_ANCHOR)
    else {
      set.add(FX_ANCHOR)
      set.add(foreign)
    }
  }
  return [...set]
}

/** true si hace falta tener CUP activa / tasa de la base vs CUP primero. */
export function fxCupNeedsBaseCupRate(foreignCode, baseCode, ratesMap) {
  const foreign = code(foreignCode)
  const base = code(baseCode)
  if (base === FX_ANCHOR || base === foreign) return false
  const r = ratesMap?.[FX_ANCHOR]
  const v = Number(r?.units_per_base ?? r)
  return !(Number.isFinite(v) && v > 0)
}

/** @deprecated usar API CUP; se mantiene por compat tests antiguos */
export function fxPromptForPair(baseCode, quoteCode) {
  const base = code(baseCode)
  const quote = code(quoteCode)
  if (quote === FX_ANCHOR && base !== FX_ANCHOR) {
    return { invert: false, label: fxCupLabel(base), hint: `${FX_ANCHOR} por cada ${base}` }
  }
  return { invert: base === FX_ANCHOR, label: fxCupLabel(quote), hint: `${FX_ANCHOR} por cada ${quote}` }
}

export function fxDisplayFromStored(stored, invert) {
  const n = Number(stored)
  if (!Number.isFinite(n) || n <= 0) return ''
  return roundDisplay(invert ? 1 / n : n)
}

export function fxStoredFromDisplay(display, invert) {
  const n = Number(display)
  if (!Number.isFinite(n) || n <= 0) return null
  return roundStored(invert ? 1 / n : n)
}
