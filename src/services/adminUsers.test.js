import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listTeamMembers } from './adminUsers'
import { supabase } from '@/config/supabase'

vi.mock('@/config/supabase', () => ({
  supabase: { rpc: vi.fn() }
}))

describe('adminUsers.listTeamMembers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mapea filas y total del RPC', async () => {
    supabase.rpc.mockResolvedValueOnce({
      data: { rows: [{ member_email: 'm@x.com' }], total: 1 },
      error: null
    })
    const res = await listTeamMembers({ search: 'm', status: 'active', page: 2, pageSize: 5 })
    expect(supabase.rpc).toHaveBeenCalledWith('admin_list_team_members', {
      p_business_id: null,
      p_search: 'm',
      p_status: 'active',
      p_page: 2,
      p_page_size: 5
    })
    expect(res).toEqual({ rows: [{ member_email: 'm@x.com' }], total: 1 })
  })
})
