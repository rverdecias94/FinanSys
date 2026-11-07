import { describe, expect, it } from 'vitest'
import {
  hasTodayFxRates,
  normalizeFxSettings,
  shouldShowDailyFxModal,
  todayLocalIso,
} from './dailyFxReminder'

describe('normalizeFxSettings', () => {
  it('defaults reminder ON and margin 25', () => {
    expect(normalizeFxSettings(null)).toEqual({
      daily_fx_reminder: true,
      target_margin_pct: 25,
      last_fx_prompt_date: null,
    })
  })

  it('honors explicit false reminder', () => {
    expect(normalizeFxSettings({ daily_fx_reminder: false }).daily_fx_reminder).toBe(false)
  })
})

describe('shouldShowDailyFxModal', () => {
  const today = '2026-11-07'
  const base = {
    reminderEnabled: true,
    lastPromptDate: null,
    ratedCurrencyCodes: ['CUP'],
    ratesMap: {},
    today,
    isOwner: true,
    online: true,
  }

  it('shows when reminder on and no rate for today', () => {
    expect(shouldShowDailyFxModal(base)).toBe(true)
  })

  it('hides when rate effective_date is today', () => {
    expect(shouldShowDailyFxModal({
      ...base,
      ratesMap: { CUP: { units_per_base: 800, effective_date: today } },
    })).toBe(false)
  })

  it('hides after Mas tarde same day', () => {
    expect(shouldShowDailyFxModal({ ...base, lastPromptDate: today })).toBe(false)
  })

  it('hides when reminder off', () => {
    expect(shouldShowDailyFxModal({ ...base, reminderEnabled: false })).toBe(false)
  })

  it('hides offline or non-owner or no rated currencies', () => {
    expect(shouldShowDailyFxModal({ ...base, online: false })).toBe(false)
    expect(shouldShowDailyFxModal({ ...base, isOwner: false })).toBe(false)
    expect(shouldShowDailyFxModal({ ...base, ratedCurrencyCodes: [] })).toBe(false)
  })

  it('shows if last rate is from yesterday', () => {
    expect(shouldShowDailyFxModal({
      ...base,
      ratesMap: { CUP: { units_per_base: 800, effective_date: '2026-11-06' } },
    })).toBe(true)
  })
})

describe('hasTodayFxRates', () => {
  const today = '2026-11-07'

  it('true si no hay monedas cotizadas', () => {
    expect(hasTodayFxRates({ ratedCurrencyCodes: [], ratesMap: {}, today })).toBe(true)
  })

  it('false si falta la tasa de hoy', () => {
    expect(hasTodayFxRates({
      ratedCurrencyCodes: ['CUP'],
      ratesMap: { CUP: { units_per_base: 800, effective_date: '2026-11-06' } },
      today,
    })).toBe(false)
  })

  it('true si todas tienen effective_date = hoy', () => {
    expect(hasTodayFxRates({
      ratedCurrencyCodes: ['CUP'],
      ratesMap: { CUP: { units_per_base: 800, effective_date: today } },
      today,
    })).toBe(true)
  })
})

describe('todayLocalIso', () => {
  it('formats YYYY-MM-DD', () => {
    expect(todayLocalIso(new Date(2026, 10, 7))).toBe('2026-11-07')
  })
})
