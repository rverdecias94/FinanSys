import { describe, expect, it } from 'vitest'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  formatClosedThroughLabel,
  isDateInClosedPeriod,
  parseDateOnlyLocal,
  toDateOnlyISO,
} from './periodLock'

describe('periodLock', () => {
  it('toDateOnlyISO normaliza Date y string', () => {
    expect(toDateOnlyISO('2026-10-31T12:00:00Z')).toBe('2026-10-31')
    expect(toDateOnlyISO(new Date(2026, 9, 31))).toBe('2026-10-31')
    expect(toDateOnlyISO(null)).toBe(null)
  })

  it('isDateInClosedPeriod: inclusive en la fecha de cierre', () => {
    expect(isDateInClosedPeriod('2026-10-31', '2026-10-31')).toBe(true)
    expect(isDateInClosedPeriod('2026-10-30', '2026-10-31')).toBe(true)
    expect(isDateInClosedPeriod('2026-11-01', '2026-10-31')).toBe(false)
    expect(isDateInClosedPeriod('2026-10-31', null)).toBe(false)
  })

  it('formatClosedThroughLabel usa DD/MM/AAAA', () => {
    expect(formatClosedThroughLabel('2026-10-31')).toBe('31/10/2026')
  })

  it('parseDateOnlyLocal no resta un día al formatear (bug UTC)', () => {
    const local = parseDateOnlyLocal('2026-10-31')
    expect(local.getFullYear()).toBe(2026)
    expect(local.getMonth()).toBe(9)
    expect(local.getDate()).toBe(31)
    // Contraste: new Date('YYYY-MM-DD') es UTC y en Américas suele mostrar el 30.
    expect(format(local, 'd MMM yyyy', { locale: es })).toMatch(/31/)
  })
})
