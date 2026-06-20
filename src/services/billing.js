import { supabase } from '@/config/supabase'

// Estado efectivo de facturación del negocio (Fase 1 backend):
// { plan_id, status, payment_state: 'ok'|'due_soon'|'grace'|'blocked'|'free',
//   current_period_end, grace_until, days_until_due, billing_cycle, lead_days, grace_days }
export async function getEffectivePlanState(businessId) {
  if (!businessId) return null
  const { data, error } = await supabase.rpc('get_effective_plan_state', {
    target_business_id: businessId
  })
  if (error) throw error
  return data
}
