import { describe, it, expect, vi, beforeEach } from 'vitest'

// S6 — el costo unitario (WAC) se sella server-side; aquí se verifica el contrato
// cliente↔RPC de registerMovement: la entrada con costo pasa p_unit_cost, la salida
// lo ignora (la RPC sella el COGS sola) y la entrada sin costo pasa null.

vi.mock('@/services/notifyWrap', () => ({ withCrud: (_meta, fn) => fn() }))
vi.mock('@/services/auditLogger', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/services/team', () => ({
  getEffectiveUserId: (u, b) => b || u,
  validateResourceAccess: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/utils/exportUtils', () => ({ exportToExcel: vi.fn() }))

const mockState = vi.hoisted(() => ({
  rpcArgs: null,
  rpcResult: { data: { name: 'Prod', new_stock: 10, unit_cost: 10 }, error: null },
}))

vi.mock('@/config/supabase', () => ({
  supabase: {
    rpc: vi.fn((fn, args) => { mockState.rpcArgs = { fn, args }; return Promise.resolve(mockState.rpcResult) }),
  },
}))

import { registerMovement } from '../services/almacen'

describe('registerMovement — costo unitario (S6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.rpcArgs = null
    mockState.rpcResult = { data: { name: 'Prod', new_stock: 10, unit_cost: 10 }, error: null }
  })

  it('entrada con costo llama register_stock_movement con p_unit_cost', async () => {
    await registerMovement({ product_id: '5', qty: 10, type: 'in', unit_cost: '10', userId: 'u1' })
    expect(mockState.rpcArgs.fn).toBe('register_stock_movement')
    expect(mockState.rpcArgs.args).toMatchObject({ p_product_id: 5, p_qty: 10, p_type: 'in', p_unit_cost: 10 })
  })

  it('salida ignora el costo (p_unit_cost null aunque se pase)', async () => {
    await registerMovement({ product_id: '5', qty: 3, type: 'out', unit_cost: '99', userId: 'u1' })
    expect(mockState.rpcArgs.args.p_unit_cost).toBeNull()
  })

  it('entrada sin costo pasa p_unit_cost null', async () => {
    await registerMovement({ product_id: '5', qty: 10, type: 'in', unit_cost: '', userId: 'u1' })
    expect(mockState.rpcArgs.args.p_unit_cost).toBeNull()
  })

  it('exige userId', async () => {
    await expect(registerMovement({ product_id: '5', qty: 1, type: 'in' })).rejects.toThrow('User ID is required')
  })
})
