import { describe, it, expect } from 'vitest'
import {
  buildKardexForProduct,
  buildWarehouseStockByProduct,
  movementEffectiveAt,
  formatValuation,
} from './warehouseMetrics'

const mov = (overrides) => ({
  id: 1,
  product_id: 10,
  type: 'in',
  qty: 10,
  unit_cost: 4,
  moved_at: '2026-01-10T12:00:00.000Z',
  products: { name: 'Café', sku: 'CAF-500', currency: 'USD' },
  ...overrides,
})

describe('warehouseMetrics E4', () => {
  it('effectiveAt prefiere moved_at', () => {
    expect(movementEffectiveAt({ moved_at: 'A', created_at: 'B' })).toBe('A')
    expect(movementEffectiveAt({ created_at: 'B' })).toBe('B')
  })

  it('kardex acumula qty y valor con unit_cost; N/D si falta costo', () => {
    const ok = buildKardexForProduct([
      mov({ id: 1, type: 'in', qty: 10, unit_cost: 4, moved_at: '2026-01-01' }),
      mov({ id: 2, type: 'out', qty: 3, unit_cost: 4, moved_at: '2026-01-05' }),
    ], '10')
    expect(ok.finalQty).toBe(7)
    expect(ok.finalValue).toBe(10 * 4 - 3 * 4)
    expect(ok.valuationAvailable).toBe(true)
    expect(ok.rows[1].balanceQty).toBe(7)

    const bad = buildKardexForProduct([
      mov({ id: 1, type: 'in', qty: 10, unit_cost: 4 }),
      mov({ id: 2, type: 'out', qty: 2, unit_cost: null, moved_at: '2026-01-06' }),
    ], '10')
    expect(bad.finalQty).toBe(8)
    expect(bad.finalValue).toBeNull()
    expect(bad.valuationAvailable).toBe(false)
    expect(formatValuation(bad.finalValue, bad.valuationAvailable)).toBe('N/D')
  })

  it('nunca usa avg_cost del producto para valorar', () => {
    const k = buildKardexForProduct([
      mov({
        id: 1,
        type: 'in',
        qty: 5,
        unit_cost: null,
        products: { name: 'X', sku: 'X', currency: 'USD', avg_cost: 99 },
      }),
    ], '10')
    expect(k.finalValue).toBeNull()
    expect(k.valuationAvailable).toBe(false)
  })

  it('stock por período: inicial + entradas − salidas por producto', () => {
    const movements = [
      mov({ id: 1, product_id: 1, type: 'in', qty: 10, unit_cost: 2, moved_at: '2025-12-01' }),
      mov({ id: 2, product_id: 1, type: 'out', qty: 2, unit_cost: 2, moved_at: '2026-01-10' }),
      mov({ id: 3, product_id: 1, type: 'in', qty: 5, unit_cost: 3, moved_at: '2026-01-15' }),
      mov({
        id: 4,
        product_id: 2,
        type: 'in',
        qty: 100,
        unit_cost: 1,
        moved_at: '2026-01-12',
        products: { name: 'Aceite', sku: 'ACE', currency: 'CUP' },
      }),
    ]
    const rows = buildWarehouseStockByProduct(movements, {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.999Z',
    })
    const cafe = rows.find((r) => r.productKey === '1')
    expect(cafe.qtyInitial).toBe(10)
    expect(cafe.qtyIn).toBe(5)
    expect(cafe.qtyOut).toBe(2)
    expect(cafe.qtyFinal).toBe(13)
    expect(cafe.valuationAvailable).toBe(true)

    const aceite = rows.find((r) => r.productKey === '2')
    expect(aceite.qtyInitial).toBe(0)
    expect(aceite.qtyIn).toBe(100)
    // No hay total agregado café+aceite en la API
    expect(rows.every((r) => r.productKey)).toBe(true)
  })
})
