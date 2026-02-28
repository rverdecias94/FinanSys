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

    // Check subscription status
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .single()

    // Only log for premium users
    if (subscription?.plan_id !== 'premium') return

    // Get IP address
    let ip_address = null
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      ip_address = data.ip
    } catch (e) {
      console.warn('Failed to get IP address', e)
    }

    const { error } = await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      action,
      resource,
      details,
      area,
      ip_address
    })

    if (error) {
      console.error('Error logging action:', error)
    }

  } catch (err) {
    console.error('Audit log error:', err)
  }
}
