import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateBalanceConfig } from '../services/finanzas'
import { supabase } from '@/config/supabase'

vi.mock('@/services/auditLogger', () => ({
  logAction: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/config/supabase', () => {
  const createTransactionsQuery = (result) => {
    const q = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve) => Promise.resolve(resolve(result)),
    }
    return q
  }

  const createBalancesQuery = (result) => {
    const q = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(result),
    }
    return q
  }

  const from = vi.fn((table) => {
    if (table === 'transactions') {
      return createTransactionsQuery({
        data: [
          { amount: 100, type: 'income' },
          { amount: 50, type: 'expense' },
        ],
        error: null,
      })
    }

    if (table === 'business_balances') {
      return createBalancesQuery({
        data: { user_id: 'b1', currency_code: 'USD', initial_balance: 100, current_balance: 150 },
        error: null,
      })
    }

    return createBalancesQuery({ data: null, error: null })
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
})
