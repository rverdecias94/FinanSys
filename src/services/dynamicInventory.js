import { supabase } from '@/config/supabase'
import { withCrud } from '@/services/notifyWrap'
import { logAction } from '@/services/auditLogger'
import { exportToExcel } from '@/utils/exportUtils'
import { getEffectiveUserId } from '@/services/team'

export async function listAreas(userUuid, { page, pageSize } = {}) {
  if (!userUuid) throw new Error('User UUID is required')
  const effectiveUserId = getEffectiveUserId(userUuid)
  let q = supabase
    .from('inventory_areas')
    .select('*', { count: 'exact' })
    .eq('user_id', effectiveUserId)
    .order('created_at', { ascending: false })

  if (page && pageSize) {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    q = q.range(from, to)
  }

  const { data, error, count } = await q
  if (error) throw error

  if (page && pageSize) {
    return { data, count }
  }

  return data
}

export async function createArea({ name, icon, slug, prefix }, userUuid, businessId) {
  if (!userUuid) throw new Error('User UUID is required')
  const effectiveUserId = getEffectiveUserId(userUuid, businessId)
  const payload = { name, icon, slug, user_id: effectiveUserId }
  const { data: area, error } = await supabase
    .from('inventory_areas')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  // Create prefix mapping
  if (prefix) {
    const pref = String(prefix).toUpperCase().slice(0, 4)
    const { error: perr } = await supabase
      .from('inventory_area_prefixes')
      .insert({ user_id: effectiveUserId, area_id: area.id, prefix: pref })
    if (perr) throw perr
  }
  await logAction({
    action: 'Crear',
    resource: `Área: ${area.name}`,
    details: { ...area, user_id: undefined }, // sin user_id (UUID) en auditoría
    area: 'Inventario'
  })
  return area
}

export async function updateArea(id, { name, icon, slug, prefix }, userUuid, businessId) {
  if (!userUuid) throw new Error('User UUID is required')
  const effectiveUserId = getEffectiveUserId(userUuid, businessId)

  // Update area basic info
  const { data, error } = await supabase
    .from('inventory_areas')
    .update({ name, icon, slug })
    .eq('id', id)
    .eq('user_id', effectiveUserId)
    .select()
    .single()
  if (error) throw error

  // Update prefix if provided
  if (prefix) {
    const pref = String(prefix).toUpperCase().slice(0, 4)
    // We use upsert to handle both insert (if not existed) and update
    // Note: This might fail if prefix is already taken by another area due to global unique constraint
    const { error: perr } = await supabase
      .from('inventory_area_prefixes')
      .upsert({
        user_id: effectiveUserId,
        area_id: id,
        prefix: pref
      }, {
        onConflict: 'user_id, area_id',
        ignoreDuplicates: false
      })

    if (perr) throw perr
  }

  await logAction({
    action: 'Actualizar',
    resource: `Área: ${data.name}`,
    details: { ...data, user_id: undefined }, // sin user_id (UUID) en auditoría
    area: 'Inventario'
  })

  return data
}

export async function getAreaPrefix(areaId, userUuid, businessId) {
  if (!userUuid) throw new Error('User UUID is required')
  const effectiveUserId = getEffectiveUserId(userUuid, businessId)
  const { data, error } = await supabase
    .from('inventory_area_prefixes')
    .select('prefix')
    .eq('area_id', areaId)
    .eq('user_id', effectiveUserId)
    .maybeSingle() // Use maybeSingle to avoid error if no row exists

  if (error) throw error
  return data?.prefix || ''
}

export async function deleteArea(id, userUuid, businessId) {
  if (!userUuid) throw new Error('User UUID is required')
  const effectiveUserId = getEffectiveUserId(userUuid, businessId)
  const { error } = await supabase
    .from('inventory_areas')
    .delete()
    .eq('id', id)
    .eq('user_id', effectiveUserId)
  if (error) throw error
  await logAction({
    action: 'Eliminar',
    resource: `Área ID: ${id}`,
    details: { id },
    area: 'Inventario'
  })
  return true
}

export async function listFields(areaId, userUuid, businessId) {
  if (!userUuid) throw new Error('User UUID is required')
  const effectiveUserId = getEffectiveUserId(userUuid, businessId)
  const { data, error } = await supabase
    .from('inventory_area_fields')
    .select('*')
    .eq('area_id', areaId)
    .eq('user_id', effectiveUserId)
    .order('order', { ascending: true })
  if (error) throw error
  return data
}

export async function addField(areaId, field, userUuid, businessId) {
  if (!userUuid) throw new Error('User UUID is required')
  const effectiveUserId = getEffectiveUserId(userUuid, businessId)
  const payload = { ...field, area_id: areaId, user_id: effectiveUserId }
  const { data, error } = await supabase
    .from('inventory_area_fields')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateField(fieldId, field, userUuid, businessId) {
  if (!userUuid) throw new Error('User UUID is required')
  const effectiveUserId = getEffectiveUserId(userUuid, businessId)
  const { data, error } = await supabase
    .from('inventory_area_fields')
    .update(field)
    .eq('id', fieldId)
    .eq('user_id', effectiveUserId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteField(fieldId, userUuid, businessId) {
  if (!userUuid) throw new Error('User UUID is required')
  const effectiveUserId = getEffectiveUserId(userUuid, businessId)
  const { error } = await supabase
    .from('inventory_area_fields')
    .delete()
    .eq('id', fieldId)
    .eq('user_id', effectiveUserId)
  if (error) throw error
  return true
}

// P1.9: renombrar un campo sin huérfanos. La RPC renombra name+label y re-indexa la clave en los
// values de todos los ítems del área, en una transacción (valida inventory.edit + propiedad server-side).
export async function renameInventoryField(fieldId, newName) {
  if (!fieldId) throw new Error('Field ID is required')
  const { data, error } = await supabase
    .rpc('rename_inventory_field', { p_field_id: fieldId, p_new_name: newName })
  if (error) throw error
  return data
}

export async function listItems(areaId, { page = 1, pageSize = 10, startDate = null, endDate = null } = {}, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')
  let q = supabase
    .from('inventory_items')
    .select('*', { count: 'exact' })
    .eq('area_id', areaId)
    .eq('user_id', userUuid)
    .order('created_at', { ascending: false })

  if (startDate) {
    q = q.gte('created_at', startDate)
  }
  if (endDate) {
    q = q.lte('created_at', endDate)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  q = q.range(from, to)

  const { data, count, error } = await q
  if (error) throw error
  return { data, count }
}

export async function getItem(itemId, userUuid, businessId) {
  if (!userUuid) throw new Error('User UUID is required')
  const effectiveUserId = getEffectiveUserId(userUuid, businessId)
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('id', itemId)
    .eq('user_id', effectiveUserId)
    .single()
  if (error) throw error
  return data
}

export async function createItem(areaId, values, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')
  return await withCrud({ action: 'create', table: 'inventory_items' }, async () => {
    // SKU + INSERT atómico en una sola transacción server-side (RPC create_inventory_item):
    // si el INSERT falla, la secuencia del SKU hace rollback -> sin huecos de SKU (P1.8).
    // La RPC valida el permiso inventory.create y que el item pertenece al negocio del llamante.
    const { data, error } = await supabase
      .rpc('create_inventory_item', { p_user: userUuid, p_area: areaId, p_values: values })
    if (error) throw error
    await logAction({
      action: 'Crear',
      resource: `Item Inventario: ${data?.sku}`,
      details: { ...data, user_id: undefined }, // sin user_id (UUID) en auditoría
      area: 'Inventario'
    })
    return data
  })
}

export async function updateItem(itemId, values, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')
  return await withCrud({ action: 'update', table: 'inventory_items' }, async () => {
    const { data, error } = await supabase
      .from('inventory_items')
      .update({ values })
      .eq('id', itemId)
      .eq('user_id', userUuid)
      .select()
      .single()
    if (error) throw error
    await logAction({
      action: 'Actualizar',
      resource: `Item Inventario: ${data.sku}`,
      details: { ...data, user_id: undefined }, // sin user_id (UUID) en auditoría
      area: 'Inventario'
    })
    return data
  })
}

export async function deleteItem(itemId, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')
  return await withCrud({ action: 'delete', table: 'inventory_items' }, async () => {
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userUuid)
    if (error) throw error
    await logAction({
      action: 'Eliminar',
      resource: `Item Inventario ID: ${itemId}`,
      details: { itemId },
      area: 'Inventario'
    })
    return true
  })
}

export async function getArea(areaId, userUuid, businessId) {
  if (!userUuid) throw new Error('User UUID is required')
  const effectiveUserId = getEffectiveUserId(userUuid, businessId)
  const { data, error } = await supabase
    .from('inventory_areas')
    .select('*')
    .eq('id', areaId)
    .eq('user_id', effectiveUserId)
    .single()
  if (error) throw error
  return data
}

export async function validateValuesAgainstFields(values, areaId, userUuid) {
  const fields = await listFields(areaId, userUuid)
  const missing = fields.filter(f => f.required && (values[f.name] === undefined || values[f.name] === null || values[f.name] === ''))

  const invalidNumbers = fields
    .filter(f => f.type === 'number')
    .filter(f => {
      const v = values[f.name]
      if (v === undefined || v === null || v === '') return false
      const n = Number(v)
      return Number.isFinite(n) && n < 1
    })

  if (missing.length > 0 || invalidNumbers.length > 0) {
    return {
      ok: false,
      missing: missing.map(m => m.name),
      invalidNumbers: invalidNumbers.map(f => f.name)
    }
  }

  return { ok: true, missing: [], invalidNumbers: [] }
}

export async function getInventoryAreas(businessId) {
  return listAreas(businessId)
}

export async function getInventoryItems(businessId, areaId, options = {}) {
  if (!areaId || areaId === 'all') {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('user_id', businessId)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) throw error
    return data || []
  }

  const res = await listItems(areaId, options, businessId)
  return res?.data || []
}

export async function createInventoryItem(payload, userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const areaId = payload.area_id
  const values = payload.values || {}
  return createItem(areaId, values, effectiveUserId)
}

export async function updateInventoryItem(itemId, payload, userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const values = payload.values || {}
  return updateItem(itemId, values, effectiveUserId)
}

export async function deleteInventoryItem(itemId, userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  return deleteItem(itemId, effectiveUserId)
}

export async function exportInventoryData(businessId) {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('user_id', businessId)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) throw error
  exportToExcel('Inventario', data || [], `inventario_${new Date().toISOString().slice(0, 10)}`)
}
