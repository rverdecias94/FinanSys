import { supabase } from '@/config/supabase'
import { withCrud } from '@/services/notifyWrap'

export async function listAreas(userUuid) {
  if (!userUuid) throw new Error('User UUID is required')
  const { data, error } = await supabase
    .from('inventory_areas')
    .select('*')
    .eq('user_id', userUuid)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createArea({ name, icon, slug, prefix }, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')
  const payload = { name, icon, slug, user_id: userUuid }
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
      .insert({ user_id: userUuid, area_id: area.id, prefix: pref })
    if (perr) throw perr
  }
  return area
}

export async function updateArea(id, { name, icon, slug, prefix }, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')

  // Update area basic info
  const { data, error } = await supabase
    .from('inventory_areas')
    .update({ name, icon, slug })
    .eq('id', id)
    .eq('user_id', userUuid)
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
        user_id: userUuid,
        area_id: id,
        prefix: pref
      }, {
        onConflict: 'user_id, area_id',
        ignoreDuplicates: false
      })

    if (perr) throw perr
  }

  return data
}

export async function getAreaPrefix(areaId, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')
  const { data, error } = await supabase
    .from('inventory_area_prefixes')
    .select('prefix')
    .eq('area_id', areaId)
    .eq('user_id', userUuid)
    .maybeSingle() // Use maybeSingle to avoid error if no row exists

  if (error) throw error
  return data?.prefix || ''
}

export async function deleteArea(id, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')
  const { error } = await supabase
    .from('inventory_areas')
    .delete()
    .eq('id', id)
    .eq('user_id', userUuid)
  if (error) throw error
  return true
}

export async function listFields(areaId, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')
  const { data, error } = await supabase
    .from('inventory_area_fields')
    .select('*')
    .eq('area_id', areaId)
    .eq('user_id', userUuid)
    .order('order', { ascending: true })
  if (error) throw error
  return data
}

export async function addField(areaId, field, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')
  const payload = { ...field, area_id: areaId, user_id: userUuid }
  const { data, error } = await supabase
    .from('inventory_area_fields')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateField(fieldId, field, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')
  const { data, error } = await supabase
    .from('inventory_area_fields')
    .update(field)
    .eq('id', fieldId)
    .eq('user_id', userUuid)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteField(fieldId, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')
  const { error } = await supabase
    .from('inventory_area_fields')
    .delete()
    .eq('id', fieldId)
    .eq('user_id', userUuid)
  if (error) throw error
  return true
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

export async function createItem(areaId, values, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')
  return await withCrud({ action: 'create', table: 'inventory_items' }, async () => {
    const { data: sku, error: skuErr } = await supabase
      .rpc('generate_inventory_sku', { p_user: userUuid, p_area: areaId })
    if (skuErr) throw skuErr
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({ user_id: userUuid, area_id: areaId, values, sku })
      .select()
      .single()
    if (error) throw error
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
    return true
  })
}

export async function getArea(areaId, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')
  const { data, error } = await supabase
    .from('inventory_areas')
    .select('*')
    .eq('id', areaId)
    .eq('user_id', userUuid)
    .single()
  if (error) throw error
  return data
}

export async function validateValuesAgainstFields(values, areaId, userUuid) {
  const fields = await listFields(areaId, userUuid)
  const missing = fields.filter(f => f.required && (values[f.name] === undefined || values[f.name] === null || values[f.name] === ''))
  if (missing.length > 0) {
    return { ok: false, missing: missing.map(m => m.name) }
  }
  return { ok: true }
}
