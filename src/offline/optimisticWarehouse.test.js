import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  applyOptimisticMovementCreate,
  applyOptimisticProductCreate,
  applyOptimisticProductUpdate,
  applyOptimisticStockDelta,
  buildPendingMovementRow,
  buildPendingProductRow,
  clearOptimisticMovement,
  clearOptimisticProduct,
  findProductInCache,
  restoreProductStock,
  serializeProductPayload,
} from './optimisticWarehouse'

describe('optimisticWarehouse', () => {
  let qc

  beforeEach(() => {
    qc = new QueryClient()
  })

  it('serializeProductPayload limpia y serializa', () => {
    const out = serializeProductPayload({
      name: '  Tornillo ',
      category: 'Ferretería',
      unit_price: '1.5',
      stock: 99,
      sku: '  T-1  ',
      client_uuid: 'p-1',
    })
    expect(out.name).toBe('Tornillo')
    expect(out.unit_price).toBe(1.5)
    expect(out.sku).toBe('T-1')
    expect(out.stock).toBe(99)
    expect(out.client_uuid).toBe('p-1')
  })

  it('create producto optimista no duplica y se limpia', () => {
    const key = ['warehouse', 'products', 'biz', { search: '', category: 'all' }, 'rl-page', 1, 5]
    qc.setQueryData(key, { data: [], count: 0 })
    const payload = serializeProductPayload({
      name: 'Caja',
      category: 'Otros',
      unit_price: 5,
      stock: 3,
      client_uuid: 'p-2',
    })
    const row = buildPendingProductRow(payload, { businessId: 'biz' })
    applyOptimisticProductCreate(qc, row)
    applyOptimisticProductCreate(qc, row)
    expect(qc.getQueryData(key).data).toHaveLength(1)
    expect(qc.getQueryData(key).data[0].stock).toBe(3)
    clearOptimisticProduct(qc, 'p-2')
    expect(qc.getQueryData(key).data).toHaveLength(0)
  })

  it('stock delta y restore sobre productsSelection', () => {
    const key = ['warehouse', 'productsSelection', 'biz']
    qc.setQueryData(key, [{ id: 7, name: 'A', stock: 10 }])
    applyOptimisticStockDelta(qc, 7, 'out', 3)
    expect(findProductInCache(qc, 7).stock).toBe(7)
    restoreProductStock(qc, 7, 10)
    expect(findProductInCache(qc, 7).stock).toBe(10)
  })

  it('movimiento pendiente no duplica y se limpia', () => {
    const key = ['warehouse', 'movements', 'biz', { type: 'all', productId: 'all' }, 'rl-page', 1, 5]
    qc.setQueryData(key, { data: [], count: 0 })
    const row = buildPendingMovementRow({
      product: { name: 'A', category: 'X', stock: 12, sku: null, currency: 'USD' },
      productId: 7,
      qty: 2,
      type: 'in',
      clientUuid: 'm-1',
      resultingStock: 12,
      businessId: 'biz',
    })
    applyOptimisticMovementCreate(qc, row)
    applyOptimisticMovementCreate(qc, row)
    expect(qc.getQueryData(key).data).toHaveLength(1)
    clearOptimisticMovement(qc, 'm-1')
    expect(qc.getQueryData(key).data).toHaveLength(0)
  })

  it('product update marca _pending', () => {
    const key = ['warehouse', 'products', 'biz', { search: '', category: 'all' }, 'rl-page', 1, 5]
    qc.setQueryData(key, { data: [{ id: 3, name: 'Viejo', stock: 1 }], count: 1 })
    applyOptimisticProductUpdate(qc, 3, { name: 'Nuevo' })
    expect(findProductInCache(qc, 3).name).toBe('Nuevo')
    expect(findProductInCache(qc, 3)._pending).toBe(true)
  })
})
