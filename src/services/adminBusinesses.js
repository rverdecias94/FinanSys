import { supabase } from '@/config/supabase'

export const CYCLE_LABEL = { monthly: 'Mensual', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual' }

// Etiqueta + clases (tokens) por estado de pago. Verde=al día, ámbar=por vencer,
// rojo=gracia/bloqueado, neutro=gratis.
export const PAYMENT_STATE = {
  ok: { label: 'Al día', cls: 'bg-success/10 text-success' },
  due_soon: { label: 'Por vencer', cls: 'bg-warning/10 text-warning' },
  grace: { label: 'En gracia', cls: 'bg-destructive/10 text-destructive' },
  blocked: { label: 'Bloqueado', cls: 'bg-destructive/10 text-destructive' },
  free: { label: 'Gratis', cls: 'bg-muted text-muted-foreground' }
}

export async function listBusinesses({ search, plan, paymentState, page = 1, pageSize = 5 } = {}) {
  const { data, error } = await supabase.rpc('admin_list_businesses', {
    p_search: search || null,
    p_plan: plan || null,
    p_payment_state: paymentState || null,
    p_page: page,
    p_page_size: pageSize
  })
  if (error) throw error
  return { data: data?.rows || [], count: Number(data?.total || 0) }
}

export async function getBusinessDetail(businessId) {
  const { data, error } = await supabase.rpc('admin_get_business_detail', { p_business_id: businessId })
  if (error) throw error
  return data
}

// Config global de aviso/gracia (días). Solo admin (RPC gated).
export async function getBillingConfig() {
  const { data, error } = await supabase.rpc('admin_get_billing_config')
  if (error) throw error
  return data
}

export async function setBillingConfig({ reminderLeadDays, graceDays }) {
  const { data, error } = await supabase.rpc('admin_set_billing_config', {
    p_reminder_lead_days: Number(reminderLeadDays),
    p_grace_days: Number(graceDays)
  })
  if (error) throw error
  return data
}

export async function setPaymentDate({ businessId, newPeriodEnd }) {
  const { data, error } = await supabase.rpc('admin_set_payment_date', {
    p_business_id: businessId,
    p_new_period_end: newPeriodEnd
  })
  if (error) throw error
  return data
}

export async function adminRecordPayment({
  businessId,
  amount,
  currency = 'USD',
  billingCycle = null,
  periodStart = null,
  periodEnd = null,
  method = null,
  reference = null,
  notes = null
} = {}) {
  const { data, error } = await supabase.rpc('admin_record_payment', {
    p_business_id: businessId,
    p_amount: Number(amount),
    p_currency: currency,
    p_billing_cycle: billingCycle,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_method: method,
    p_reference: reference,
    p_notes: notes,
    p_request_id: null
  })
  if (error) throw error
  return data
}
