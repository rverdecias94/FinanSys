import { supabase } from '@/config/supabase'

/**
 * Logs an action to the audit_logs table if the user is a Premium subscriber.
 * @param {Object} params
 * @param {string} params.action - The action performed (e.g., 'Crear', 'Actualizar', 'Eliminar').
 * @param {string} params.resource - The resource modified (e.g., 'Transacción', 'Producto').
 * @param {Object} params.details - Additional details about the action.
 * @param {string} params.area - The area where the action occurred (e.g., 'Finanzas', 'Almacén', 'Inventario', 'Configuración').
 */
export const logAction = async ({ action, resource, details, area }) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let businessId = user.id
    try {
      const { data: context } = await supabase.rpc('get_user_business_context', { user_uuid: user.id })
      businessId = context?.businessId || user.id
    } catch {
      businessId = user.id
    }

    // Check subscription status
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', businessId)
      .single()

    // Only log for premium users, EXCEPT for some critical configuration changes (like currencies)
    const isCriticalConfig = area === 'Configuración' && resource === 'Moneda';
    if (subscription?.plan_id !== 'premium' && !isCriticalConfig) return

    // Get IP address
    let ip_address = null
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      ip_address = data.ip
    } catch {
      ip_address = null
    }

    const { error } = await supabase.from('audit_logs').insert({
      business_id: businessId,
      actor_id: user.id,
      user_id: user.id,
      user_email: user.email,
      action,
      resource,
      details,
      area,
      ip_address
    })

    if (error) return
  } catch {
    return
  }
}
