/**
 * Reglas del recordatorio diario de tipo de cambio.
 * No inventa tasas: solo decide si mostrar el modal.
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

/**
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

  const missingToday = ratedCurrencyCodes.some((code) => {
    const effective = ratesMap?.[code]?.effective_date
    return !effective || effective !== today
  })

  return missingToday
}

export const FX_REMINDER_OFF_CONSEQUENCES =
  'Si desactivas el recordatorio, Gestia no te pedirá el dólar al abrir. El panel consolidado, las alertas de margen y los precios sugeridos pueden usar una tasa vieja: actualízala a mano en Monedas cuando cambie el mercado.'
