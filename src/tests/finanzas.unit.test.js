import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateBalanceConfig, getBalanceConfig } from '../services/finanzas'
import { supabase } from '@/config/supabase'

// Mock Supabase
vi.mock('@/config/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    }))
  }
}))

describe('Balance Configuration Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updateBalanceConfig calls the secure RPC with correct parameters', async () => {
    const userId = 'user-123'
    const initialUsd = 1000
    const initialCup = 5000
    
    // Mock successful response
    const mockResponse = {
      data: { 
        initial_usd: 1000, initial_cup: 5000, 
        total_usd: 1000, total_cup: 5000 
      },
      error: null
    }
    supabase.rpc.mockResolvedValue(mockResponse)

    const result = await updateBalanceConfig(userId, initialUsd, initialCup)

    expect(supabase.rpc).toHaveBeenCalledWith('update_balance_config_secure', {
      p_new_initial_usd: 1000,
      p_new_initial_cup: 5000
    })
    
    expect(result).toEqual(mockResponse.data)
  })

  it('updateBalanceConfig throws error if RPC fails', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'RPC Error' }
    })

    await expect(updateBalanceConfig('uid', 100, 100)).rejects.toEqual({ message: 'RPC Error' })
  })
})
