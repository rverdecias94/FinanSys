import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { registerMutationDefaults, TX_CREATE_KEY, TX_UPDATE_KEY } from './mutationDefaults'

vi.mock('@/services/finanzas', () => ({
  createTransaction: vi.fn(async () => ({ id: 1 })),
  updateTransaction: vi.fn(async () => ({ id: 2 })),
  registerSale: vi.fn(async () => ({ transaction_id: 3 })),
}))

describe('registerMutationDefaults', () => {
  let queryClient

  beforeEach(() => {
    queryClient = new QueryClient()
    registerMutationDefaults(queryClient)
  })

  it('registra defaults para create y update', () => {
    const createDef = queryClient.getMutationDefaults(TX_CREATE_KEY)
    const updateDef = queryClient.getMutationDefaults(TX_UPDATE_KEY)
    expect(typeof createDef.mutationFn).toBe('function')
    expect(typeof updateDef.mutationFn).toBe('function')
  })

  it('create default llama createTransaction con variables serializables', async () => {
    const { createTransaction } = await import('@/services/finanzas')
    const def = queryClient.getMutationDefaults(TX_CREATE_KEY)
    await def.mutationFn({
      payload: {
        date: '2026-11-05',
        amount: 5,
        currency: 'USD',
        category: 'Ventas',
        description: 'X',
        type: 'income',
        client_uuid: 'abc',
      },
      userId: 'u1',
      businessId: 'b1',
    })
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ client_uuid: 'abc', amount: 5 }),
      'u1',
      'b1',
    )
  })

  it('create default con isSale llama registerSale', async () => {
    const { registerSale } = await import('@/services/finanzas')
    const def = queryClient.getMutationDefaults(TX_CREATE_KEY)
    await def.mutationFn({
      payload: {
        isSale: true,
        date: '2026-11-05',
        category: 'Ventas',
        description: 'Venta',
        product_id: 9,
        qty: 2,
        unit_price: 10,
        client_uuid: 'sale-1',
      },
      userId: 'u1',
      businessId: 'b1',
    })
    expect(registerSale).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Venta' }),
      9,
      2,
      10,
      'sale-1',
    )
  })
})
