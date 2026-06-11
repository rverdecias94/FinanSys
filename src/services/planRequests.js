import { supabase } from '@/config/supabase'

export async function requestPlanChange({
  targetPlanId = 'premium',
  requestedMonths = 1,
  contactPhone = '',
  paymentMethod = '',
  paymentReference = '',
  userNotes = ''
} = {}) {
  const { data, error } = await supabase.rpc('request_plan_change', {
    target_plan_id: targetPlanId,
    requested_months: Number(requestedMonths) || 1,
    contact_phone: contactPhone,
    payment_method: paymentMethod,
    payment_reference: paymentReference,
    user_notes: userNotes
  })

  if (error) throw error
  return data
}

export async function getPendingPlanRequest(businessId) {
  if (!businessId) return null

  const { data, error } = await supabase
    .from('plan_change_requests')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function cancelMyPendingPlanChangeRequest() {
  const { data, error } = await supabase.rpc('cancel_my_pending_plan_change_request')
  if (error) throw error
  return data
}

export async function isSystemAdmin() {
  const { data, error } = await supabase.rpc('is_system_admin')
  if (error) throw error
  return !!data
}

export async function listPlanChangeRequests({
  status,
  requestedPlanId,
  startDate,
  endDate,
  searchTerm,
  page = 1,
  pageSize = 10
} = {}) {
  const from = Math.max(0, (Number(page) - 1) * Number(pageSize))
  const to = from + Math.max(0, Number(pageSize) - 1)

  let query = supabase
    .from('plan_change_requests')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (status && status !== 'all') query = query.eq('status', status)
  if (requestedPlanId && requestedPlanId !== 'all') query = query.eq('requested_plan_id', requestedPlanId)

  if (startDate) query = query.gte('created_at', startDate)
  if (endDate) query = query.lte('created_at', endDate)

  const term = (searchTerm || '').trim()
  if (term) {
    const t = term.replace(/%/g, '')
    query = query.or(
      `contact_email.ilike.%${t}%,contact_phone.ilike.%${t}%,payment_reference.ilike.%${t}%,business_id::text.ilike.%${t}%`
    )
  }

  const { data, count, error } = await query.range(from, to)
  if (error) throw error
  return { data: data || [], count: Number(count || 0) }
}

export async function approvePlanChangeRequest({ requestId, approvedMonths, adminNotes } = {}) {
  const { data, error } = await supabase.rpc('approve_plan_change_request', {
    request_id: requestId,
    approved_months: approvedMonths == null ? null : Number(approvedMonths),
    admin_notes: adminNotes || null
  })
  if (error) throw error
  return data
}

export async function rejectPlanChangeRequest({ requestId, adminNotes } = {}) {
  const { data, error } = await supabase.rpc('reject_plan_change_request', {
    request_id: requestId,
    admin_notes: adminNotes || null
  })
  if (error) throw error
  return data
}

export async function adminSetBusinessPlan({
  targetBusinessId,
  targetPlanId,
  months,
  adminNotes
} = {}) {
  const { data, error } = await supabase.rpc('admin_set_business_plan', {
    target_business_id: targetBusinessId,
    target_plan_id: targetPlanId,
    months: months == null ? null : Number(months),
    admin_notes: adminNotes || null
  })
  if (error) throw error
  return data
}

export async function expirePastDueSubscriptions() {
  const { data, error } = await supabase.rpc('expire_past_due_subscriptions')
  if (error) throw error
  return Number(data || 0)
}
