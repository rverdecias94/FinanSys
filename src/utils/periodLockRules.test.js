import { describe, it, expect } from 'vitest'
import {
  normalizePeriodLockSettings,
  targetClosedThroughForMonthly,
  nextAutoClosedThrough,
  endOfPreviousMonth,
} from './periodLockRules'

describe('periodLockRules', () => {
  it('normaliza modo y día (1–28)', () => {
    expect(normalizePeriodLockSettings({ mode: 'monthly', day_of_month: 25 })).toEqual({
      mode: 'monthly',
      day_of_month: 25,
    })
    expect(normalizePeriodLockSettings({ mode: 'monthly', day_of_month: 31 }).day_of_month).toBe(28)
    expect(normalizePeriodLockSettings({}).mode).toBe('manual')
  })

  it('fin de mes anterior', () => {
    const d = endOfPreviousMonth(new Date(2026, 10, 11)) // 11 nov 2026
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(9) // octubre
    expect(d.getDate()).toBe(31)
  })

  it('día 25 en noviembre → cierra hasta 31 oct', () => {
    expect(targetClosedThroughForMonthly(25, new Date(2026, 10, 25))).toBe('2026-10-31')
    expect(targetClosedThroughForMonthly(25, new Date(2026, 10, 30))).toBe('2026-10-31')
  })

  it('antes del día 25 en noviembre → objetivo aún es fin de sept', () => {
    expect(targetClosedThroughForMonthly(25, new Date(2026, 10, 10))).toBe('2026-09-30')
  })

  it('nextAutoClosedThrough avanza si el candado está atrasado', () => {
    expect(
      nextAutoClosedThrough({
        settings: { mode: 'monthly', day_of_month: 25 },
        currentClosedThrough: '2026-09-30',
        ref: new Date(2026, 10, 25),
      }),
    ).toBe('2026-10-31')

    expect(
      nextAutoClosedThrough({
        settings: { mode: 'monthly', day_of_month: 25 },
        currentClosedThrough: '2026-10-31',
        ref: new Date(2026, 10, 25),
      }),
    ).toBeNull()

    expect(
      nextAutoClosedThrough({
        settings: { mode: 'manual', day_of_month: 25 },
        currentClosedThrough: null,
        ref: new Date(2026, 10, 25),
      }),
    ).toBeNull()
  })
})
