import { supabase } from '@/config/supabase'
import { withCrud } from '@/services/notifyWrap'
import { logAction } from '@/services/auditLogger'
import { getEffectiveUserId } from '@/services/team'

// Servicio de Contactos (clientes/proveedores) — Fase 1 del roadmap contable.
// Mismas convenciones que almacen.js: filtra por el owner efectivo, paginado
// {data,count}, withCrud para toasts y logAction para auditoría.

export async function listContacts({ page = 1, pageSize = 5, search = '', kind = 'all', userId, businessId } = {}) {
  if (!userId) throw new Error('User ID is required')
  const effectiveUserId = getEffectiveUserId(userId, businessId)

  let q = supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('user_id', effectiveUserId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (search) q = q.ilike('name', `%${search}%`)
  // 'cliente'/'proveedor' incluyen también a los marcados como 'ambos'.
  if (kind && kind !== 'all') q = q.or(`kind.eq.${kind},kind.eq.ambos`)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  q = q.range(from, to)

  const { data, count, error } = await q
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

export async function createContact(payload, userId, businessId) {
  if (!userId) throw new Error('User ID is required')

  return withCrud({ action: 'create', table: 'contacts' }, async () => {
    const effectiveUserId = getEffectiveUserId(userId, businessId)
    const { data, error } = await supabase
      .from('contacts')
      .insert({ ...payload, user_id: effectiveUserId })
      .select()
      .single()
    if (error) throw error
    await logAction({
      action: 'Crear',
      resource: `Contacto: ${data.name}`,
      details: { id: data.id, kind: data.kind },
      area: 'Finanzas'
    })
    return data
  })
}

export async function updateContact(id, payload, userId, businessId) {
  if (!userId) throw new Error('User ID is required')

  return withCrud({ action: 'update', table: 'contacts' }, async () => {
    const effectiveUserId = getEffectiveUserId(userId, businessId)
    const { data, error } = await supabase
      .from('contacts')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', effectiveUserId)
      .select()
      .single()
    if (error) throw error
    await logAction({
      action: 'Actualizar',
      resource: `Contacto: ${data.name}`,
      details: { id: data.id, kind: data.kind },
      area: 'Finanzas'
    })
    return data
  })
}

// Baja lógica (soft-delete): en vez de DELETE físico, marca is_active=false.
// Así no se huérfana el historial (transactions.contact_id quedaría en NULL) y el
// contacto deja de aparecer en los listados (listContacts filtra is_active=true).
export async function deleteContact(id, userId, businessId) {
  if (!userId) throw new Error('User ID is required')

  return withCrud({ action: 'delete', table: 'contacts' }, async () => {
    const effectiveUserId = getEffectiveUserId(userId, businessId)
    const { data, error } = await supabase
      .from('contacts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', effectiveUserId)
      .select()
      .single()
    if (error) throw error
    await logAction({
      action: 'Dar de baja',
      resource: `Contacto: ${data.name}`,
      details: { id: data.id, kind: data.kind },
      area: 'Finanzas'
    })
    return data
  })
}
