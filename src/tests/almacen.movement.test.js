import { describe, it, expect, vi, beforeEach } from 'vitest'

// A1 — movimiento rápido crea comprobante automático vía create_and_post_quick_movement.
// Se verifica el contrato cliente↔RPC (WAC sigue en servidor).

vi.mock('@/services/notifyWrap', () => ({ withCrud: (_meta, fn) => fn() }))
vi.mock('@/services/auditLogger', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/services/team', () => ({
  getEffectiveUserId: (u, b) => b || u,
  validateResourceAccess: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/utils/exportUtils', () => ({ exportToExcel: vi.fn() }))
vi.mock('@/services/exchangeRates', () => ({
  getRateForDate: vi.fn().mockResolvedValue(800),
}))

const mockState = vi.hoisted(() => ({
  rpcArgs: null,
  rpcResult: {
    data: {
      name: 'Prod',
      new_stock: 10,
      unit_cost: 10,
      document_id: 99,
      doc_number: 'QIN-2026-000001',
      movements: [{ name: 'Prod', new_stock: 10, unit_cost: 10 }]
    },
    error: null
  },
}))

vi.mock('@/config/supabase', () => ({
  supabase: {
    rpc: vi.fn((fn, args) => { mockState.rpcArgs = { fn, args }; return Promise.resolve(mockState.rpcResult) }),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}))

import { registerMovement, generateProductSku, createWarehouseDocument } from '../services/almacen'

describe('registerMovement — comprobante rápido (A1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.rpcArgs = null
    mockState.rpcResult = {
      data: {
        name: 'Prod',
        new_stock: 10,
        unit_cost: 10,
        document_id: 99,
        doc_number: 'QIN-2026-000001',
        movements: [{ name: 'Prod', new_stock: 10, unit_cost: 10 }]
      },
      error: null
    }
  })

  it('entrada con costo llama create_and_post_quick_movement con p_unit_cost y sella FX', async () => {
    const res = await registerMovement({ product_id: '5', qty: 10, type: 'in', unit_cost: '10', userId: 'u1' })
    expect(mockState.rpcArgs.fn).toBe('create_and_post_quick_movement')
    expect(mockState.rpcArgs.args).toMatchObject({
      p_product_id: 5,
      p_qty: 10,
      p_type: 'in',
      p_unit_cost: 10,
      p_fx_units_per_base: 800,
    })
    expect(res.document_id).toBe(99)
    expect(res.doc_number).toBe('QIN-2026-000001')
  })

  it('salida ignora el costo (p_unit_cost null aunque se pase)', async () => {
    await registerMovement({ product_id: '5', qty: 3, type: 'out', unit_cost: '99', userId: 'u1' })
    expect(mockState.rpcArgs.args.p_unit_cost).toBeNull()
    expect(mockState.rpcArgs.args.p_fx_units_per_base).toBeNull()
  })

  it('entrada sin costo pasa p_unit_cost null', async () => {
    await registerMovement({ product_id: '5', qty: 10, type: 'in', unit_cost: '', userId: 'u1' })
    expect(mockState.rpcArgs.args.p_unit_cost).toBeNull()
  })

  it('entrada respeta fx_units_per_base explícito', async () => {
    await registerMovement({
      product_id: '5',
      qty: 10,
      type: 'in',
      unit_cost: '10',
      userId: 'u1',
      fx_units_per_base: 1000,
    })
    expect(mockState.rpcArgs.args.p_fx_units_per_base).toBe(1000)
  })

  it('exige userId', async () => {
    await expect(registerMovement({ product_id: '5', qty: 1, type: 'in' })).rejects.toThrow('User ID is required')
  })
})

describe('generateProductSku', () => {
  it('genera prefijo a partir del nombre', () => {
    const sku = generateProductSku('Café molido')
    expect(sku).toMatch(/^[A-Z]{3,4}-\d{4}$/)
  })
})

describe('createWarehouseDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.rpcArgs = null
    mockState.rpcResult = {
      data: { document_id: 1, doc_number: 'REC-2026-000001', status: 'draft', doc_type: 'receipt' },
      error: null
    }
  })

  it('llama create_warehouse_document con líneas', async () => {
    await createWarehouseDocument({
      docType: 'receipt',
      lines: [{ product_id: 5, qty: 2, unit_cost: 3 }],
      partnerName: 'Proveedor X',
      autoPost: false
    })
    expect(mockState.rpcArgs.fn).toBe('create_warehouse_document')
    expect(mockState.rpcArgs.args.p_doc_type).toBe('receipt')
    expect(mockState.rpcArgs.args.p_partner_name).toBe('Proveedor X')
  })
})
