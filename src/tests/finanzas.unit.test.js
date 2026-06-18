import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateBalanceConfig } from '../services/finanzas'
import { supabase } from '@/config/supabase'

vi.mock('@/services/auditLogger', () => ({
  logAction: vi.fn().mockResolvedValue(undefined)
}))

// Estado mutable compartido con el mock (vi.hoisted garantiza que existe antes de los mocks).
// Permite fijar los datos de transacciones por test y capturar el payload del upsert.
const mockState = vi.hoisted(() => ({
  transactions: [
    { amount: 100, type: 'income' },
    { amount: 50, type: 'expense' },
  ],
  lastUpsert: null,
}))

vi.mock('@/config/supabase', () => {
  const createTransactionsQuery = () => {
    const q = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve) => Promise.resolve(resolve({ data: mockState.transactions, error: null })),
    }
    return q
  }

  const createBalancesQuery = () => {
    const q = {
      upsert: vi.fn((payload) => { mockState.lastUpsert = payload; return q }),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { user_id: 'b1', currency_code: 'USD', initial_balance: 100, current_balance: 150 },
        error: null,
      }),
    }
    return q
  }

  const from = vi.fn((table) => {
    if (table === 'transactions') return createTransactionsQuery()
    return createBalancesQuery()
  })

  return {
    supabase: {
      from
    }
  }
})

describe('Balance Configuration Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.transactions = [
      { amount: 100, type: 'income' },
      { amount: 50, type: 'expense' },
    ]
    mockState.lastUpsert = null
  })

  it('updateBalanceConfig returns null when balances is empty', async () => {
    const result = await updateBalanceConfig('u1', 'b1', [])
    expect(result).toBeNull()
  })

  it('updateBalanceConfig upserts business_balances using effective user id', async () => {
    const result = await updateBalanceConfig('u1', 'b1', [{ currency_code: 'USD', initial_balance: 100 }])
    expect(result).toEqual(expect.any(Array))
    expect(supabase.from).toHaveBeenCalledWith('transactions')
    expect(supabase.from).toHaveBeenCalledWith('business_balances')
  })

  // P1.12: el recálculo debe restar SOLO 'expense'. Antes, el `else` contaba cualquier
  // tipo no-income como gasto, distorsionando el balance.
  it('P1.12: current_balance resta solo expense e ignora tipos no income/expense', async () => {
    mockState.transactions = [
      { amount: 100, type: 'income' },
      { amount: 50, type: 'expense' },
      { amount: 999, type: 'transfer' }, // tipo inesperado: NO debe restar como gasto
    ]
    await updateBalanceConfig('u1', 'b1', [{ currency_code: 'USD', initial_balance: 100 }])
    // 100 (inicial) + 100 (income) - 50 (expense) = 150; el 'transfer' (999) se ignora.
    expect(mockState.lastUpsert.current_balance).toBe(150)
  })
})
