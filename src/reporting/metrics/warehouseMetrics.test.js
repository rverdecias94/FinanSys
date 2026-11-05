import { describe, it, expect } from 'vitest'
import {
  buildKardexForProduct,
  buildPeriodKardexForProduct,
  buildWarehouseStockByProduct,
  movementEffectiveAt,
  formatValuation,
  productNameOnly,
  productLabel,
  summarizeWarehouseDataQuality,
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

describe('warehouseMetrics E4 / post-revisión', () => {
  it('effectiveAt prefiere moved_at', () => {
    expect(movementEffectiveAt({ moved_at: 'A', created_at: 'B' })).toBe('A')
    expect(movementEffectiveAt({ created_at: 'B' })).toBe('B')
  })

  it('productName no concatena SKU', () => {
    const m = mov({})
    expect(productNameOnly(m)).toBe('Café')
    expect(productLabel(m)).toBe('Café')
    expect(productNameOnly(m)).not.toMatch(/CAF-500/)
  })

  it('kardex acumula qty y valor con unit_cost; N/D si falta costo', () => {
    const ok = buildKardexForProduct([
      mov({ id: 1, type: 'in', qty: 10, unit_cost: 4, moved_at: '2026-01-01' }),
      mov({ id: 2, type: 'out', qty: 3, unit_cost: 4, moved_at: '2026-01-05' }),
    ], '10')
    expect(ok.finalQty).toBe(7)
    expect(ok.finalValue).toBe(10 * 4 - 3 * 4)
    expect(ok.valuationAvailable).toBe(true)
    expect(ok.productName).toBe('Café')
    expect(ok.sku).toBe('CAF-500')
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

  it('expone document_id / transaction_id sin inventar', () => {
    const k = buildKardexForProduct([
      mov({ id: 7, document_id: 99, transaction_id: 55, type: 'out', qty: 1, unit_cost: 4 }),
    ], '10')
    expect(k.rows[0].documentId).toBe(99)
    expect(k.rows[0].transactionId).toBe(55)
    expect(k.rows[0].sourceRef).toMatch(/Doc 99/)
    expect(k.rows[0].sourceRef).toMatch(/Tx 55/)
  })

  it('detecta saldo negativo', () => {
    const k = buildKardexForProduct([
      mov({ id: 1, type: 'out', qty: 5, unit_cost: 2, moved_at: '2026-01-01' }),
    ], '10')
    expect(k.finalQty).toBe(-5)
    expect(k.negativeBalance).toBe(true)
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

  it('period kardex expone saldo inicial y origen', () => {
    const movements = [
      mov({ id: 1, type: 'in', qty: 10, unit_cost: 2, moved_at: '2025-12-01' }),
      mov({ id: 2, type: 'out', qty: 2, unit_cost: 2, moved_at: '2026-01-10' }),
    ]
    const book = buildPeriodKardexForProduct(movements, '10', {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.999Z',
    })
    expect(book.openingQty).toBe(10)
    expect(book.openingSource).toMatch(/previos/i)
    expect(book.periodRows).toHaveLength(1)
    expect(book.finalQty).toBe(8)
  })

  it('stock por período: inicial + entradas − salidas; flags calidad', () => {
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
      mov({
        id: 5,
        product_id: 3,
        type: 'out',
        qty: 4,
        unit_cost: null,
        moved_at: '2026-01-20',
        products: { name: 'Sin costo', sku: 'SC', currency: 'USD' },
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
    expect(cafe.productName).toBe('Café')
    expect(cafe.productName).not.toMatch(/\(/)
    expect(cafe.openingSource).toBe('movimientos_previos')

    const aceite = rows.find((r) => r.productKey === '2')
    expect(aceite.qtyInitial).toBe(0)
    expect(aceite.openingSource).toBe('sin_historial_previo')

    const sc = rows.find((r) => r.productKey === '3')
    expect(sc.negativeBalance).toBe(true)
    expect(sc.valuationAvailable).toBe(false)

    const q = summarizeWarehouseDataQuality(rows)
    expect(q.total).toBe(3)
    expect(q.negative).toBeGreaterThanOrEqual(1)
    expect(q.missingCost).toBeGreaterThanOrEqual(1)
  })
})
