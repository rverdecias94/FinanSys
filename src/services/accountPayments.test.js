import { describe, it, expect, vi, beforeEach } from 'vitest'

// S2 (Q2) — registerPayment debe delegar en la RPC atómica register_account_payment
// (no hacer leer-modificar-escribir), y listAccountPayments debe leer el ledger.

vi.mock('@/services/auditLogger', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/services/team', () => ({ getEffectiveUserId: (u, b) => b || u }))
vi.mock('@/services/notifications', () => ({
  notify: { success: vi.fn(), error: vi.fn() },
  getSupabaseErrorMessage: (e) => (e && e.message) || 'error'
}))

const mockState = vi.hoisted(() => ({ rpcName: null, rpcArgs: null, selectEq: null }))

vi.mock('@/config/supabase', () => {
  const q = {
    select: vi.fn(() => q),
    eq: vi.fn((col, val) => { mockState.selectEq = [col, val]; return q }),
    order: vi.fn(() => Promise.resolve({ data: [{ id: 1, amount: 400, method: 'efectivo' }], error: null }))
  }
  return {
    supabase: {
      rpc: vi.fn((name, args) => {
        mockState.rpcName = name
        mockState.rpcArgs = args
        return Promise.resolve({
          data: { id: 29, type: 'income', description: 'X', amount: 1000, paid_amount: 400, status: 'partial' },
          error: null
        })
      }),
      from: vi.fn(() => q)
    }
  }
})

import { registerPayment, listAccountPayments } from '@/services/finanzas'

describe('account payments service (S2)', () => {
  beforeEach(() => {
    mockState.rpcName = null
    mockState.rpcArgs = null
    mockState.selectEq = null
    vi.clearAllMocks()
  })

  it('registerPayment llama a la RPC atómica con los argumentos correctos', async () => {
    const res = await registerPayment(29, 400, 'u1', 'b1', { method: 'efectivo' })
    expect(mockState.rpcName).toBe('register_account_payment')
    expect(mockState.rpcArgs).toMatchObject({ p_transaction_id: 29, p_amount: 400, p_method: 'efectivo' })
    expect(res).toMatchObject({ status: 'partial', paid_amount: 400 })
  })

  it('registerPayment rechaza montos <= 0 sin tocar la BD', async () => {
    await expect(registerPayment(29, 0, 'u1', 'b1')).rejects.toThrow()
    expect(mockState.rpcName).toBeNull() // nunca llamó a la RPC
  })

  it('listAccountPayments consulta el ledger por transaction_id', async () => {
    const rows = await listAccountPayments(29)
    expect(mockState.selectEq).toEqual(['transaction_id', 29])
    expect(rows).toHaveLength(1)
  })

  it('listAccountPayments sin id devuelve []', async () => {
    const rows = await listAccountPayments(null)
    expect(rows).toEqual([])
  })
})
