import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  registerMutationDefaults,
  TX_CREATE_KEY,
  TX_UPDATE_KEY,
  CONTACT_CREATE_KEY,
  PAYMENT_CREATE_KEY,
} from './mutationDefaults'

vi.mock('@/services/finanzas', () => ({
  createTransaction: vi.fn(async () => ({ id: 1 })),
  updateTransaction: vi.fn(async () => ({ id: 2 })),
  registerSale: vi.fn(async () => ({ transaction_id: 3 })),
  registerPayment: vi.fn(async () => ({ id: 4, paid_amount: 10 })),
}))

vi.mock('@/services/contacts', () => ({
  createContact: vi.fn(async () => ({ id: 10 })),
  updateContact: vi.fn(async () => ({ id: 11 })),
  deleteContact: vi.fn(async () => ({ id: 12 })),
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

  it('contact create y payment create usan defaults', async () => {
    const { createContact } = await import('@/services/contacts')
    const { registerPayment } = await import('@/services/finanzas')

    await queryClient.getMutationDefaults(CONTACT_CREATE_KEY).mutationFn({
      payload: { name: 'Casa', kind: 'cliente', client_uuid: 'c1' },
      userId: 'u1',
      businessId: 'b1',
    })
    expect(createContact).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Casa', client_uuid: 'c1' }),
      'u1',
      'b1',
    )

    await queryClient.getMutationDefaults(PAYMENT_CREATE_KEY).mutationFn({
      transactionId: 7,
      amount: 15,
      userId: 'u1',
      businessId: 'b1',
      client_uuid: 'pay-1',
    })
    expect(registerPayment).toHaveBeenCalledWith(
      7,
      15,
      'u1',
      'b1',
      expect.objectContaining({ clientUuid: 'pay-1' }),
    )
  })
})
