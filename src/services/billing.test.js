import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getMyPayments } from './billing'
import { supabase } from '@/config/supabase'

vi.mock('@/config/supabase', () => ({ supabase: { rpc: vi.fn() } }))

describe('billing.getMyPayments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mapea filas y total del RPC get_my_payments', async () => {
    supabase.rpc.mockResolvedValueOnce({
      data: { rows: [{ id: 1, amount: 50 }], total: 1 },
      error: null
    })
    const res = await getMyPayments({ businessId: 'biz-1', page: 1, pageSize: 10 })
    expect(supabase.rpc).toHaveBeenCalledWith('get_my_payments', {
      p_business_id: 'biz-1',
      p_page: 1,
      p_page_size: 10
    })
    expect(res).toEqual({ data: [{ id: 1, amount: 50 }], count: 1 })
  })
})
