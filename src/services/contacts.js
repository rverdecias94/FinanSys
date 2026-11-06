import { supabase } from '@/config/supabase'
import { withCrud } from '@/services/notifyWrap'
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
    .order('created_at', { ascending: false })
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
    const { client_uuid, ...rest } = payload || {}
    const row = {
      ...rest,
      user_id: effectiveUserId,
      client_uuid: client_uuid || null,
    }
    const { data, error } = await supabase
      .from('contacts')
      .insert(row)
      .select()
      .single()
    // Idempotencia outbox: mismo client_uuid → devolver existente.
    if (error) {
      if (error.code === '23505' && client_uuid) {
        const { data: existing, error: fetchErr } = await supabase
          .from('contacts')
          .select('*')
          .eq('user_id', effectiveUserId)
          .eq('client_uuid', client_uuid)
          .maybeSingle()
        if (fetchErr) throw fetchErr
        if (existing) return { ...existing, idempotent: true }
      }
      throw error
    }
    // S4: auditoría (incl. antes/después) vía trigger de BD audit_row_change.
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
    // S4: auditoría (incl. antes/después) vía trigger de BD audit_row_change.
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
    // S4: la baja lógica (is_active true->false) la audita el trigger de BD.
    return data
  })
}
