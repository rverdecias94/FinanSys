import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  applyOptimisticCreate,
  applyOptimisticUpdate,
  buildOptimisticUpdatePatch,
  buildPendingTransactionRow,
  findTransactionInCache,
  restoreTransactionRow,
} from './optimisticTransactions'

describe('optimisticTransactions', () => {
  let queryClient

  beforeEach(() => {
    queryClient = new QueryClient()
  })

  it('buildPendingTransactionRow calcula monto de venta', () => {
    const row = buildPendingTransactionRow(
      {
        client_uuid: 'u1',
        isSale: true,
        qty: 2,
        unit_price: 10.5,
        currency: 'USD',
        category: 'Ventas',
        description: 'Venta offline',
        date: '2026-11-06',
      },
      { userId: 'a', businessId: 'b' },
    )
    expect(row.amount).toBe(21)
    expect(row.type).toBe('income')
    expect(row._pending).toBe(true)
    expect(row.details.sale).toBe(true)
  })

  it('applyOptimisticUpdate marca _pending y restore revierte', () => {
    const key = ['transactions', { userId: 'a' }, 'rl-page', 1, 5]
    queryClient.setQueryData(key, {
      data: [{ id: 7, description: 'Antes', amount: 1, currency: 'USD' }],
      count: 1,
    })

    const previous = findTransactionInCache(queryClient, 7)
    const patch = buildOptimisticUpdatePatch(
      { description: 'Después', amount: 99, currency: 'USD', category: 'Ventas', type: 'expense', date: '2026-11-06' },
      previous,
    )
    applyOptimisticUpdate(queryClient, 7, patch)

    const mid = findTransactionInCache(queryClient, 7)
    expect(mid.description).toBe('Después')
    expect(mid.amount).toBe(99)
    expect(mid._pending).toBe(true)

    restoreTransactionRow(queryClient, 7, previous)
    const back = findTransactionInCache(queryClient, 7)
    expect(back.description).toBe('Antes')
    expect(back._pending).toBe(false)
  })

  it('applyOptimisticCreate antepone la fila', () => {
    const key = ['transactions', { userId: 'a' }, 'rl-page', 1, 5]
    queryClient.setQueryData(key, { data: [{ id: 1, description: 'Vieja' }], count: 1 })
    const row = buildPendingTransactionRow(
      {
        client_uuid: 'abc',
        amount: 5,
        currency: 'CUP',
        category: 'Otros',
        description: 'Nueva',
        type: 'expense',
        date: '2026-11-06',
      },
      { userId: 'a', businessId: 'b' },
    )
    applyOptimisticCreate(queryClient, row)
    const data = queryClient.getQueryData(key)
    expect(data.data[0].id).toBe('pending-abc')
    expect(data.count).toBe(2)
  })
})
