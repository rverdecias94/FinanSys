import { parseDateOnlyLocal } from '@/utils/periodLock'

/**
 * Reglas de cierre automático de período.
 * mode:
 *  - manual: solo fecha elegida a mano
 *  - monthly: el día `dayOfMonth` de cada mes cierra el mes anterior completo
 *    (closed_through = último día del mes previo).
 */

export function normalizePeriodLockSettings(raw) {
  const mode = raw?.mode === 'monthly' ? 'monthly' : 'manual'
  let day = Number(raw?.day_of_month)
  if (!Number.isFinite(day)) day = 25
  day = Math.min(28, Math.max(1, Math.floor(day)))
  return { mode, day_of_month: day }
}

/** Último día del mes anterior a `ref` (Date local). */
export function endOfPreviousMonth(ref = new Date()) {
  const y = ref.getFullYear()
  const m = ref.getMonth() // 0-based month of ref
  // Día 0 del mes actual = último del mes anterior
  return new Date(y, m, 0)
}

function toIsoDateLocal(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Si hoy >= día N del mes, el objetivo de cierre es fin del mes anterior.
 * Si hoy < día N, aún no toca: objetivo = fin del mes anteanterior
 * (el cierre del ciclo previo ya debería estar aplicado).
 */
export function targetClosedThroughForMonthly(dayOfMonth, ref = new Date()) {
  const day = Math.min(28, Math.max(1, Number(dayOfMonth) || 25))
  const today = ref.getDate()
  if (today >= day) {
    return toIsoDateLocal(endOfPreviousMonth(ref))
  }
  // Todavía no llega el día N: el objetivo vigente es el cierre del ciclo pasado
  // (fin del mes anterior al mes previo = hace dos meses).
  const prevMonthEnd = endOfPreviousMonth(ref)
  return toIsoDateLocal(endOfPreviousMonth(prevMonthEnd))
}

/**
 * ¿Hay que avanzar el candado?
 * @returns {string|null} nueva fecha ISO YYYY-MM-DD o null si no aplica
 */
export function nextAutoClosedThrough({ settings, currentClosedThrough, ref = new Date() }) {
  const s = normalizePeriodLockSettings(settings)
  if (s.mode !== 'monthly') return null
  const target = targetClosedThroughForMonthly(s.day_of_month, ref)
  if (!currentClosedThrough) return target
  const cur = String(currentClosedThrough).slice(0, 10)
  if (target > cur) return target
  return null
}

export function formatClosedThroughLabel(iso) {
  const d = parseDateOnlyLocal(iso)
  if (!d) return iso || '—'
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}
