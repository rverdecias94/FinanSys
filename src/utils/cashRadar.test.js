import { describe, expect, it } from 'vitest'
import {
  buildCashRadar,
  expandRecurringOccurrences,
  scheduleOpenAccounts,
} from '@/utils/cashRadar'

describe('cashRadar', () => {
  const today = new Date(2026, 9, 28) // 28 oct 2026

  it('expande recurrentes mensuales dentro del horizonte', () => {
    const occ = expandRecurringOccurrences(
      {
        id: 1,
        is_active: true,
        type: 'expense',
        amount: 100,
        currency: 'USD',
        description: 'Alquiler',
        frequency: 'monthly',
        next_run: '2026-11-01',
      },
      today,
      new Date(2026, 11, 28), // +60d approx
    )
    expect(occ.length).toBeGreaterThanOrEqual(1)
    expect(occ[0].date).toBe('2026-11-01')
    expect(occ[0].amount).toBe(100)
  })

  it('pone CxC vencidas en el día de inicio', () => {
    const scheduled = scheduleOpenAccounts(
      [{
        id: 9,
        amount: 800,
        paid_amount: 0,
        currency: 'USD',
        due_date: '2026-10-01',
        contact: { name: 'Cliente A' },
        description: 'Factura',
      }],
      today,
      'receivable',
    )
    expect(scheduled).toHaveLength(1)
    expect(scheduled[0].date).toBe('2026-10-28')
    expect(scheduled[0].overdue).toBe(true)
    expect(scheduled[0].type).toBe('income')
  })

  it('proyecta saldo y detecta primer día negativo', () => {
    const radar = buildCashRadar({
      today,
      baseCurrency: 'USD',
      horizonDays: 30,
      balances: { USD: 50 },
      recurring: [{
        id: 1,
        is_active: true,
        type: 'expense',
        amount: 200,
        currency: 'USD',
        description: 'Nómina',
        frequency: 'monthly',
        next_run: '2026-10-30',
      }],
      receivables: [],
      payables: [],
      lowStock: [{ id: 3, name: 'Tortillas', stock: 2, min_stock: 20 }],
    })

    expect(radar.startBalance).toBe(50)
    expect(radar.firstNegativeDay).toBe('2026-10-30')
    expect(radar.endBalance).toBe(-150)
    expect(radar.actions.some((a) => a.kind === 'cash')).toBe(true)
    expect(radar.actions.some((a) => a.kind === 'stock')).toBe(true)
    expect(radar.series).toHaveLength(31)
  })

  it('no cuenta dos veces CxC pendiente ya metida en el ledger', () => {
    // Ledger 1000 incluye CxC pendiente 800; caja usable = 200
    const radar = buildCashRadar({
      today,
      baseCurrency: 'USD',
      horizonDays: 30,
      balances: { USD: 1000 },
      recurring: [],
      receivables: [{
        id: 1,
        amount: 800,
        paid_amount: 0,
        currency: 'USD',
        due_date: '2026-11-10',
        contact: { name: 'Cliente' },
      }],
      payables: [],
      lowStock: [],
    })
    expect(radar.startBalance).toBe(200)
    expect(radar.series.find((s) => s.date === '2026-11-10')?.balance).toBe(1000)
    expect(radar.openRecvTotal).toBe(800)
  })
})
