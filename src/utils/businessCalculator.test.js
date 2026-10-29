import { describe, it, expect } from 'vitest'
import { runAffordability, runFx, runMargin, runCollection } from '@/utils/businessCalculator'

describe('businessCalculator', () => {
  it('affordability detects shortfall', () => {
    const out = runAffordability({
      balances: { USD: 100 },
      expenses: [{ label: 'Alquiler', amount: 150, currency: 'USD' }],
    })
    expect(out.ok).toBe(false)
    expect(out.lines[0].after).toBe(-50)
  })

  it('fx converts via units_per_base', () => {
    const out = runFx({
      amount: 10,
      fromCurrency: 'USD',
      toCurrency: 'CUP',
      baseCurrency: 'USD',
      rates: { CUP: { units_per_base: 400 } },
    })
    expect(out.ok).toBe(true)
    expect(out.converted).toBe(4000)
  })

  it('margin computes profit', () => {
    const out = runMargin({ cost: 8, sellPrice: 10, quantity: 5, currency: 'USD' })
    expect(out.unitProfit).toBe(2)
    expect(out.totalProfit).toBe(10)
    expect(out.marginPct).toBe(20)
  })

  it('collection uses percent of overdue', () => {
    const out = runCollection({
      percent: 50,
      currency: 'USD',
      agingByCurrency: { USD: { overdue: 200, total: 300 } },
    })
    expect(out.collectable).toBe(100)
  })

  it('unsupported explains out-of-scope questions', async () => {
    const { runCalculator } = await import('@/utils/businessCalculator')
    const out = runCalculator('unsupported', {
      reason: 'No consulta inventario',
      suggestion: '¿Me alcanzan 100 USD?',
    })
    expect(out.ok).toBe(false)
    expect(out.mode).toBe('unsupported')
    expect(out.message).toMatch(/inventario/i)
  })
})
