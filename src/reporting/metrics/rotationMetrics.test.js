import { describe, it, expect } from 'vitest'
import { buildInventoryRotation, periodLengthDays } from './rotationMetrics'

describe('rotationMetrics E7', () => {
  it('calcula COGS / inventario medio cuando hay valoración', () => {
    const [row] = buildInventoryRotation(
      [
        {
          productKey: '1',
          productName: 'Café',
          sku: 'CAF',
          currency: 'USD',
          valueInitial: 100,
          valueFinal: 100,
          valueOut: 50,
          valuationAvailable: true,
        },
      ],
      { periodDays: 30 }
    )
    expect(row.available).toBe(true)
    expect(row.avgInventory).toBe(100)
    expect(row.rotation).toBe(0.5)
    expect(row.daysOfInventory).toBe(60)
  })

  it('devuelve N/D sin unit_cost completo', () => {
    const [row] = buildInventoryRotation([
      {
        productKey: '2',
        productName: 'X',
        valueInitial: null,
        valueFinal: null,
        valueOut: null,
        valuationAvailable: false,
      },
    ])
    expect(row.available).toBe(false)
    expect(row.rotation).toBeNull()
  })

  it('periodLengthDays inclusivo', () => {
    expect(periodLengthDays('2026-01-01', '2026-01-01')).toBe(1)
    expect(periodLengthDays('2026-01-01', '2026-01-31')).toBe(31)
    expect(periodLengthDays(null, '2026-01-01')).toBeNull()
  })
})
