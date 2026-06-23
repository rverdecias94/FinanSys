import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerSale } from '../services/finanzas'
import { supabase } from '@/config/supabase'

// S7 — la venta es atómica server-side (RPC register_sale). Aquí se verifica el
// contrato cliente↔RPC: el payload viaja como jsonb y la línea de venta como params
// numéricos; el monto/moneda/COGS los resuelve la RPC.

vi.mock('@/services/auditLogger', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

const mockState = vi.hoisted(() => ({ rpcResult: { data: { transaction_id: 1, margin: 105 }, error: null } }))

vi.mock('@/config/supabase', () => ({
  supabase: { rpc: vi.fn(() => Promise.resolve(mockState.rpcResult)) },
}))

describe('registerSale (S7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.rpcResult = { data: { transaction_id: 1, margin: 105 }, error: null }
  })

  it('llama a register_sale con el payload y la línea de venta', async () => {
    await registerSale({ description: 'Venta', status: 'paid' }, '5', 3, 50)
    expect(supabase.rpc).toHaveBeenCalledWith('register_sale', {
      p_payload: { description: 'Venta', status: 'paid' },
      p_product_id: 5,
      p_qty: 3,
      p_unit_price: 50,
    })
  })

  it('convierte product_id/qty/precio a número', async () => {
    await registerSale({}, '7', '2', '10.5')
    expect(supabase.rpc.mock.calls[0][1]).toMatchObject({ p_product_id: 7, p_qty: 2, p_unit_price: 10.5 })
  })

  it('payload nulo se envía como objeto vacío', async () => {
    await registerSale(undefined, '7', 1, 10)
    expect(supabase.rpc.mock.calls[0][1].p_payload).toEqual({})
  })

  it('propaga el error de la RPC (p. ej. stock insuficiente)', async () => {
    mockState.rpcResult = { data: null, error: { message: 'Stock insuficiente para la venta' } }
    await expect(registerSale({}, '5', 100, 50)).rejects.toMatchObject({ message: 'Stock insuficiente para la venta' })
  })
})
