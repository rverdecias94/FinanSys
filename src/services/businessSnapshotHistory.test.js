import { describe, it, expect } from 'vitest'
import { formatYearHistory } from './businessSnapshotHistory'

describe('formatYearHistory', () => {
  it('arma 12 meses y YTD hasta el mes indicado', () => {
    const monthly = {
      2: { income: { USD: 500, CUP: 1000 }, expense: { USD: 50 } },
      10: { income: { USD: 200 }, expense: {} },
    }
    const out = formatYearHistory(2026, monthly, { throughMonth: 10 })
    expect(out.by_month).toHaveLength(12)
    expect(out.by_month[1].period).toBe('2026-02')
    expect(out.by_month[1].income_by_currency.USD).toBe(500)
    expect(out.by_month[1].has_activity).toBe(true)
    expect(out.by_month[0].has_activity).toBe(false)
    expect(out.ytd.income_by_currency.USD).toBe(700)
    expect(out.year_totals.income_by_currency.USD).toBe(700)
    expect(out.glossary.income).toMatch(/facturación/i)
  })
})
