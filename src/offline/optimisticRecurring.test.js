import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  applyOptimisticRecurringCreate,
  applyOptimisticRecurringUpdate,
  buildPendingRecurringRow,
  clearOptimisticRecurring,
  findRecurringInCache,
  removeRecurringFromCache,
  serializeRecurringPayload,
} from './optimisticRecurring'

describe('optimisticRecurring', () => {
  let qc

  beforeEach(() => {
    qc = new QueryClient()
  })

  it('serializeRecurringPayload limpia contact pending y montos', () => {
    const out = serializeRecurringPayload({
      type: 'expense',
      amount: '150.50',
      currency: 'USD',
      category: 'Alquiler',
      description: '  Oficina  ',
      frequency: 'monthly',
      next_run: '2026-12-01',
      contact_id: 'pending-abc',
      client_uuid: 'r-1',
    })
    expect(out.description).toBe('Oficina')
    expect(out.amount).toBe(150.5)
    expect(out.contact_id).toBeNull()
    expect(out.client_uuid).toBe('r-1')
  })

  it('create optimista no duplica y clear funciona', () => {
    const key = ['recurring-transactions', 'biz']
    qc.setQueryData(key, [])
    const payload = serializeRecurringPayload({
      type: 'expense',
      amount: 10,
      currency: 'USD',
      category: 'Servicios',
      description: 'Internet',
      frequency: 'monthly',
      next_run: '2026-12-01',
      client_uuid: 'r-2',
    })
    const row = buildPendingRecurringRow(payload, { businessId: 'biz' })
    applyOptimisticRecurringCreate(qc, row)
    applyOptimisticRecurringCreate(qc, row)
    expect(qc.getQueryData(key)).toHaveLength(1)
    clearOptimisticRecurring(qc, 'r-2')
    expect(qc.getQueryData(key)).toHaveLength(0)
  })

  it('update y remove', () => {
    const key = ['recurring-transactions', 'biz']
    qc.setQueryData(key, [{ id: 9, description: 'Viejo', is_active: true }])
    applyOptimisticRecurringUpdate(qc, 9, { description: 'Nuevo', is_active: false })
    expect(findRecurringInCache(qc, 9).description).toBe('Nuevo')
    expect(findRecurringInCache(qc, 9)._pending).toBe(true)
    removeRecurringFromCache(qc, 9)
    expect(findRecurringInCache(qc, 9)).toBeNull()
  })
})
