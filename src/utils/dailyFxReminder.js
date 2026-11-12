/**
 * Reglas del recordatorio diario de tipo de cambio.
 * Soft al entrar (se puede postergar); obligatorio si una operación depende de la tasa de hoy.
 */

export const DEFAULT_TARGET_MARGIN_PCT = 25

export function normalizeFxSettings(fx) {
  const src = fx && typeof fx === 'object' ? fx : {}
  const margin = Number(src.target_margin_pct)
  return {
    daily_fx_reminder: src.daily_fx_reminder !== false,
    target_margin_pct: Number.isFinite(margin) && margin >= 0 ? margin : DEFAULT_TARGET_MARGIN_PCT,
    last_fx_prompt_date: typeof src.last_fx_prompt_date === 'string' ? src.last_fx_prompt_date : null,
  }
}

/** YYYY-MM-DD en zona local del navegador. */
export function todayLocalIso(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** True si todas las monedas cotizadas tienen tasa con effective_date = hoy. */
export function hasTodayFxRates({
  ratedCurrencyCodes = [],
  ratesMap = {},
  today = todayLocalIso(),
} = {}) {
  if (!ratedCurrencyCodes.length) return true
  return ratedCurrencyCodes.every((code) => ratesMap?.[code]?.effective_date === today)
}

/**
 * Recordatorio suave al entrar: se puede postergar con "Más tarde".
 * @param {object} opts
 * @param {boolean} opts.reminderEnabled
 * @param {string|null} opts.lastPromptDate — día en que eligió "Más tarde"
 * @param {string[]} opts.ratedCurrencyCodes — monedas no-base activas
 * @param {Record<string,{effective_date?:string}>} opts.ratesMap — última tasa por moneda
 * @param {string} [opts.today] — override test
 * @param {boolean} [opts.isOwner]
 * @param {boolean} [opts.online]
 */
export function shouldShowDailyFxModal({
  reminderEnabled,
  lastPromptDate,
  ratedCurrencyCodes = [],
  ratesMap = {},
  today = todayLocalIso(),
  isOwner = true,
  online = true,
} = {}) {
  if (!online || !isOwner) return false
  if (!reminderEnabled) return false
  if (!ratedCurrencyCodes.length) return false
  if (lastPromptDate === today) return false
  return !hasTodayFxRates({ ratedCurrencyCodes, ratesMap, today })
}

/**
 * Operaciones que sellan o usan la tasa vigente de hoy (no basta una tasa vieja).
 * - warehouse_in: entrada de almacén sella fx_units_per_base
 * - replacement_price: precios sugeridos de reposición
 * - finance_today_fx: movimiento financiero en moneda no-base con fecha de hoy
 */
export const FX_REQUIRED_REASONS = {
  warehouse_in:
    'Para registrar esta entrada necesitamos la tasa de hoy: se sella con el movimiento y no se puede inventar después.',
  replacement_price:
    'Para aplicar precios de reposición necesitamos la tasa de hoy; si no, el sugerido quedaría descuadrado.',
  finance_today_fx:
    'Esta operación en otra moneda usa la tasa del día. Regístrala ahora para sellarla bien.',
}

export const FX_REMINDER_OFF_CONSEQUENCES =
  'Si desactivas el recordatorio, Gestia no te pedirá la tasa en CUP al abrir. Cuando hagas una entrada de almacén, un precio de reposición o un movimiento en otra moneda, sí te la pedirá de forma obligatoria para no descuadrar.'
