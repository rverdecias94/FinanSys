import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  applyOptimisticAgingDelta,
  applyOptimisticDashboardStats,
  applyOptimisticFilteredTotals,
} from './optimisticTotals'

describe('optimisticTotals', () => {
  let qc
  beforeEach(() => {
    qc = new QueryClient()
  })

  it('suma ingresos en filteredTotals', () => {
    qc.setQueryData(['filteredTotals', { x: 1 }], { income: { USD: 10 }, expense: {} })
    applyOptimisticFilteredTotals(qc, { type: 'income', amount: 5, currency: 'USD' })
    expect(qc.getQueryData(['filteredTotals', { x: 1 }]).income.USD).toBe(15)
  })

  it('actualiza dashboard stats balance e income', () => {
    qc.setQueryData(['dashboard', 'stats', 'u', 'b'], {
      balance: { USD: 100 },
      income: { current: { USD: 40 }, change: {} },
      expense: { current: {}, change: {} },
    })
    applyOptimisticDashboardStats(qc, { type: 'income', amount: 20, currency: 'USD' })
    const s = qc.getQueryData(['dashboard', 'stats', 'u', 'b'])
    expect(s.income.current.USD).toBe(60)
    expect(s.balance.USD).toBe(120)
  })

  it('ajusta aging not_due', () => {
    qc.setQueryData(['aging', 'receivable', 'b'], [{
      currency: 'CUP', not_due: 1000, d_1_30: 0, d_31_60: 0, d_61_90: 0, d_over_90: 0, total: 1000, cnt: 1,
    }])
    applyOptimisticAgingDelta(qc, 'receivable', { currency: 'CUP', deltaRemaining: -400 })
    const row = qc.getQueryData(['aging', 'receivable', 'b'])[0]
    expect(row.not_due).toBe(600)
    expect(row.total).toBe(600)
  })
})
