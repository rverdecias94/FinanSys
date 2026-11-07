import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  registerMutationDefaults,
  TX_CREATE_KEY,
  TX_UPDATE_KEY,
  CONTACT_CREATE_KEY,
  PAYMENT_CREATE_KEY,
  INV_ITEM_CREATE_KEY,
  INV_ITEM_UPDATE_KEY,
  INV_AREA_CREATE_KEY,
  INV_AREA_UPDATE_KEY,
  WH_MOVEMENT_CREATE_KEY,
  PRODUCT_CREATE_KEY,
  PRODUCT_UPDATE_KEY,
  RECURRING_CREATE_KEY,
  RECURRING_TOGGLE_KEY,
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

vi.mock('@/services/dynamicInventory', () => ({
  createItem: vi.fn(async () => ({ id: 20, sku: 'ELEC-0001' })),
  updateItem: vi.fn(async () => ({ id: 21 })),
  deleteItem: vi.fn(async () => true),
  createArea: vi.fn(async () => ({ id: 5, name: 'Taller' })),
  updateArea: vi.fn(async () => ({ id: 5, name: 'Oficina' })),
}))

vi.mock('@/services/almacen', () => ({
  registerMovement: vi.fn(async () => ({ product_id: 7, resulting_stock: 12 })),
  createProduct: vi.fn(async () => ({ id: 8, name: 'Caja' })),
  updateProduct: vi.fn(async () => ({ id: 7, name: 'Tornillo' })),
}))

vi.mock('@/services/recurringTransactions', () => ({
  createRecurringTransaction: vi.fn(async () => ({ id: 30 })),
  updateRecurringTransaction: vi.fn(async () => ({ id: 31 })),
  deleteRecurringTransaction: vi.fn(async () => true),
  setRecurringActive: vi.fn(async () => ({ id: 31, is_active: false })),
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

  it('inventory item create/update y area update usan defaults', async () => {
    const { createItem, updateItem, updateArea } = await import('@/services/dynamicInventory')

    await queryClient.getMutationDefaults(INV_ITEM_CREATE_KEY).mutationFn({
      areaId: 3,
      values: { Nombre: 'Laptop' },
      userId: 'u1',
      businessId: 'b1',
      client_uuid: 'inv-1',
    })
    expect(createItem).toHaveBeenCalledWith(
      3,
      { Nombre: 'Laptop' },
      'b1',
      'inv-1',
    )

    await queryClient.getMutationDefaults(INV_ITEM_UPDATE_KEY).mutationFn({
      id: 9,
      values: { Nombre: 'PC' },
      userId: 'u1',
      businessId: 'b1',
    })
    expect(updateItem).toHaveBeenCalledWith(9, { Nombre: 'PC' }, 'b1')

    await queryClient.getMutationDefaults(INV_AREA_UPDATE_KEY).mutationFn({
      id: 5,
      payload: { name: ' Oficina ', icon: 'Home', slug: '', prefix: 'ELEC' },
      userId: 'u1',
      businessId: 'b1',
    })
    expect(updateArea).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ name: 'Oficina', icon: 'Home', prefix: 'ELEC' }),
      'u1',
      'b1',
    )

    const { createArea } = await import('@/services/dynamicInventory')
    await queryClient.getMutationDefaults(INV_AREA_CREATE_KEY).mutationFn({
      payload: {
        name: 'Taller',
        icon: 'Wrench',
        domain_type: 'equipment',
        template_id: 'equip_basic',
        client_uuid: 'area-1',
      },
      userId: 'u1',
      businessId: 'b1',
    })
    expect(createArea).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Taller',
        client_uuid: 'area-1',
        template_id: 'equip_basic',
      }),
      'u1',
      'b1',
    )
  })

  it('warehouse movement create y product create/update usan defaults', async () => {
    const { registerMovement, createProduct, updateProduct } = await import('@/services/almacen')

    await queryClient.getMutationDefaults(WH_MOVEMENT_CREATE_KEY).mutationFn({
      product_id: 7,
      qty: 2,
      type: 'in',
      unit_cost: 1.5,
      userId: 'u1',
      client_uuid: 'mov-1',
    })
    expect(registerMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: 7,
        qty: 2,
        type: 'in',
        client_uuid: 'mov-1',
      }),
    )

    await queryClient.getMutationDefaults(PRODUCT_CREATE_KEY).mutationFn({
      payload: { name: 'Caja', category: 'Otros', unit_price: 5, stock: 3, client_uuid: 'prod-1' },
      userId: 'u1',
      businessId: 'b1',
    })
    expect(createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Caja', stock: 3, client_uuid: 'prod-1' }),
      'u1',
      'b1',
    )

    await queryClient.getMutationDefaults(PRODUCT_UPDATE_KEY).mutationFn({
      id: 7,
      payload: { name: ' Tornillo ', category: 'Ferretería', unit_price: 2, stock: 99 },
      userId: 'u1',
      businessId: 'b1',
    })
    expect(updateProduct).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ name: 'Tornillo', unit_price: 2 }),
      'u1',
      'b1',
    )
    expect(updateProduct.mock.calls[0][1].stock).toBeUndefined()
    expect(updateProduct.mock.calls[0][1].client_uuid).toBeUndefined()
  })

  it('recurring create y toggle usan defaults', async () => {
    const { createRecurringTransaction, setRecurringActive } = await import('@/services/recurringTransactions')

    await queryClient.getMutationDefaults(RECURRING_CREATE_KEY).mutationFn({
      payload: {
        type: 'expense',
        amount: 100,
        currency: 'USD',
        category: 'Alquiler',
        description: 'Local',
        frequency: 'monthly',
        next_run: '2026-12-01',
        client_uuid: 'rec-1',
      },
      userId: 'u1',
      businessId: 'b1',
    })
    expect(createRecurringTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Local', client_uuid: 'rec-1' }),
      'u1',
      'b1',
    )

    await queryClient.getMutationDefaults(RECURRING_TOGGLE_KEY).mutationFn({
      id: 31,
      is_active: false,
      userId: 'u1',
      businessId: 'b1',
    })
    expect(setRecurringActive).toHaveBeenCalledWith(31, false, 'u1', 'b1')
  })
})

