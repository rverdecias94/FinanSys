import { describe, it, expect, vi, beforeEach } from 'vitest'
import { inviteMember, acceptPendingInvitations } from './team'
import { supabase } from '@/config/supabase'

vi.mock('@/services/auditLogger', () => ({
  logAction: vi.fn().mockResolvedValue(undefined)
}))

// Mock Supabase
vi.mock('@/config/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { name: 'Consultor' }, error: null })
    }))
  }
}))

describe('Team Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { name: 'Consultor' }, error: null })
    }))
  })

  describe('inviteMember', () => {
    it('should throw error if email is not available', async () => {
      // Mock checkEmailAvailability to return false (via rpc)
      supabase.rpc.mockResolvedValueOnce({ data: false, error: null })

      await expect(inviteMember({
        email: 'taken@example.com',
        role_id: 'role-123',
        owner_id: 'owner-123'
      })).rejects.toThrow('El correo electrónico no está disponible')
    })

    it('should create invitation if email is available', async () => {
      // Mock checkEmailAvailability to return true
      supabase.rpc.mockResolvedValueOnce({ data: true, error: null })

      // Mock insert response
      const mockInvite = {
        id: 'invite-123',
        member_email: 'new@example.com',
        status: 'pending'
      }

      const selectMock = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: mockInvite, error: null })
      })

      const insertMock = vi.fn().mockReturnValue({ select: selectMock })

      supabase.from.mockReturnValue({
        insert: insertMock
      })

      const result = await inviteMember({
        email: 'new@example.com',
        role_id: 'role-123',
        owner_id: 'owner-123'
      })

      expect(result).toEqual(mockInvite)
      expect(supabase.from).toHaveBeenCalledWith('team_members')
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
        member_email: 'new@example.com',
        status: 'pending'
      }))
    })
  })

  describe('acceptPendingInvitations', () => {
    it('should accept pending invitations via RPC', async () => {
      supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
      supabase.rpc
        .mockResolvedValueOnce({ data: true, error: null })
        .mockResolvedValueOnce({ data: { businessId: 'owner-1', isOwner: false, roleId: 'role-1', permissions: ['finanzas.view'] }, error: null })

      const result = await acceptPendingInvitations('test@example.com')

      expect(result).toEqual(expect.objectContaining({ businessId: 'owner-1', isOwner: false }))
      expect(supabase.rpc).toHaveBeenNthCalledWith(1, 'accept_invitation_for_current_user', { email_input: 'test@example.com' })
      expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'get_user_business_context', { user_uuid: 'user-1' })
    })

    it('should return null if RPC returns false', async () => {
      supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
      supabase.rpc.mockResolvedValueOnce({ data: false, error: null })

      const result = await acceptPendingInvitations('test@example.com')
      expect(result).toBeNull()
    })
  })
})
