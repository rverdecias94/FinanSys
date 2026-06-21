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

// Historial de pagos del negocio del usuario (Fase 7). Paginado {data,count}
// para ResponsiveListing. La RLS de `payments` garantiza la visibilidad correcta
// (owner / miembro activo / admin); businessId lo aporta BusinessContext.
export async function getMyPayments({ businessId = null, page = 1, pageSize = 5 } = {}) {
  const { data, error } = await supabase.rpc('get_my_payments', {
    p_business_id: businessId || null,
    p_page: page,
    p_page_size: pageSize
  })
  if (error) throw error
  return { data: data?.rows || [], count: Number(data?.total || 0) }
}
