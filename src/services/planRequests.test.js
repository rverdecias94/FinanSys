import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  approvePlanChangeRequest,
  cancelMyPendingPlanChangeRequest,
  expirePastDueSubscriptions,
  isSystemAdmin,
  listPlanChangeRequests,
  rejectPlanChangeRequest,
  requestPlanChange
} from './planRequests'
import { supabase } from '@/config/supabase'

vi.mock('@/config/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn()
  }
}))

describe('planRequests service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requestPlanChange calls RPC with normalized payload', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: { request_id: 'r1', status: 'pending' }, error: null })

    const result = await requestPlanChange({
      targetPlanId: 'premium',
      requestedMonths: '3',
      contactPhone: '+53',
      paymentMethod: 'efectivo',
      paymentReference: 'abc',
      userNotes: 'nota'
    })

    expect(result).toEqual({ request_id: 'r1', status: 'pending' })
    expect(supabase.rpc).toHaveBeenCalledWith('request_plan_change', {
      target_plan_id: 'premium',
      requested_months: 3,
      billing_cycle: null,
      contact_phone: '+53',
      payment_method: 'efectivo',
      payment_reference: 'abc',
      user_notes: 'nota'
    })
  })

  it('listPlanChangeRequests builds query with filters and pagination', async () => {
    const q = {
      select: vi.fn(),
      order: vi.fn(),
      eq: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      or: vi.fn(),
      range: vi.fn()
    }
    q.select.mockReturnValue(q)
    q.order.mockReturnValue(q)
    q.eq.mockReturnValue(q)
    q.gte.mockReturnValue(q)
    q.lte.mockReturnValue(q)
    q.or.mockReturnValue(q)
    q.range.mockResolvedValue({ data: [{ id: '1' }], count: 1, error: null })
    supabase.from.mockReturnValue(q)

    const result = await listPlanChangeRequests({
      status: 'pending',
      requestedPlanId: 'premium',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-01-31T23:59:59.999Z',
      searchTerm: 'abc',
      page: 2,
      pageSize: 10
    })

    expect(result).toEqual({ data: [{ id: '1' }], count: 1 })
    expect(supabase.from).toHaveBeenCalledWith('plan_change_requests')
    expect(q.select).toHaveBeenCalledWith('*', { count: 'exact' })
    expect(q.eq).toHaveBeenCalledWith('status', 'pending')
    expect(q.eq).toHaveBeenCalledWith('requested_plan_id', 'premium')
    expect(q.gte).toHaveBeenCalledWith('created_at', '2026-01-01T00:00:00.000Z')
    expect(q.lte).toHaveBeenCalledWith('created_at', '2026-01-31T23:59:59.999Z')
    expect(q.range).toHaveBeenCalledWith(10, 19)
  })

  it('isSystemAdmin returns boolean from RPC', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: true, error: null })
    await expect(isSystemAdmin()).resolves.toBe(true)
  })

  it('approve/reject/cancel/expire call expected RPCs', async () => {
    supabase.rpc
      .mockResolvedValueOnce({ data: { status: 'approved' }, error: null })
      .mockResolvedValueOnce({ data: { status: 'rejected' }, error: null })
      .mockResolvedValueOnce({ data: { status: 'cancelled' }, error: null })
      .mockResolvedValueOnce({ data: 2, error: null })

    await approvePlanChangeRequest({ requestId: 'r1', approvedMonths: 2, adminNotes: 'ok' })
    await rejectPlanChangeRequest({ requestId: 'r2', adminNotes: 'no' })
    await cancelMyPendingPlanChangeRequest()
    await expect(expirePastDueSubscriptions()).resolves.toBe(2)

    expect(supabase.rpc).toHaveBeenNthCalledWith(1, 'approve_plan_change_request', {
      request_id: 'r1',
      approved_months: 2,
      admin_notes: 'ok',
      billing_cycle: null
    })
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'reject_plan_change_request', {
      request_id: 'r2',
      admin_notes: 'no'
    })
    expect(supabase.rpc).toHaveBeenNthCalledWith(3, 'cancel_my_pending_plan_change_request')
    expect(supabase.rpc).toHaveBeenNthCalledWith(4, 'expire_past_due_subscriptions')
  })
})

