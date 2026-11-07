/**
 * Cierre de período: fechas con date <= closed_through están bloqueadas
 * (ver supabase/migrations/20260622_s5_period_lock.sql).
 *
 * Importante: un string `YYYY-MM-DD` NO debe pasarse a `new Date('YYYY-MM-DD')`
 * (eso es medianoche UTC y en Américas resta un día en pantalla).
 */

/** @param {Date|string|null|undefined} value */
export function toDateOnlyISO(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof value === 'string') {
    const s = value.trim().slice(0, 10)
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
  }
  return null
}

/**
 * Interpreta YYYY-MM-DD como fecha de calendario LOCAL (sin sesgo UTC).
 * @param {Date|string|null|undefined} value
 * @returns {Date|null}
 */
export function parseDateOnlyLocal(value) {
  const iso = toDateOnlyISO(value)
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return Number.isNaN(dt.getTime()) ? null : dt
}

/**
 * @param {Date|string|null|undefined} date
 * @param {Date|string|null|undefined} closedThrough
 */
export function isDateInClosedPeriod(date, closedThrough) {
  const d = toDateOnlyISO(date)
  const lock = toDateOnlyISO(closedThrough)
  if (!d || !lock) return false
  return d <= lock
}

/** Texto corto para UI (DD/MM/AAAA). */
export function formatClosedThroughLabel(closedThrough) {
  const lock = toDateOnlyISO(closedThrough)
  if (!lock) return ''
  const [y, m, d] = lock.split('-')
  return `${d}/${m}/${y}`
}
