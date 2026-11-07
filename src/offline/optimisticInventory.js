// Parches optimistas para listados de ítems de inventario (ResponsiveListing)
// y listado plano de áreas.

const isItemsQuery = (query, areaId) => {
  if (!Array.isArray(query.queryKey) || query.queryKey[0] !== 'inventoryItems') return false
  if (areaId == null) return true
  return query.queryKey[1] === areaId
}

const isAreasQuery = (query) =>
  Array.isArray(query.queryKey) && query.queryKey[0] === 'inventoryAreas'

function prepend(old, row) {
  if (!old) return old
  if (Array.isArray(old.data)) {
    if (old.data.some((it) => it.id === row.id || (row.client_uuid && it.client_uuid === row.client_uuid))) {
      return old
    }
    return { ...old, data: [row, ...old.data], count: Number(old.count || 0) + 1 }
  }
  if (Array.isArray(old.pages)) {
    const pages = old.pages.map((p) => ({ ...p, data: [...(p?.data || [])] }))
    if (pages[0]) {
      const already = pages.some((p) =>
        (p.data || []).some((it) => it.id === row.id || (row.client_uuid && it.client_uuid === row.client_uuid)),
      )
      if (already) return old
      pages[0] = {
        ...pages[0],
        data: [row, ...(pages[0].data || [])],
        count: Number(pages[0].count || 0) + 1,
      }
    }
    return { ...old, pages }
  }
  return old
}

function patch(old, matcher, next) {
  if (!old) return old
  if (Array.isArray(old.data)) {
    return { ...old, data: old.data.map((it) => (matcher(it) ? { ...it, ...next } : it)) }
  }
  if (Array.isArray(old.pages)) {
    return {
      ...old,
      pages: old.pages.map((p) => ({
        ...p,
        data: (p?.data || []).map((it) => (matcher(it) ? { ...it, ...next } : it)),
      })),
    }
  }
  return old
}

function remove(old, matcher) {
  if (!old) return old
  if (Array.isArray(old.data)) {
    const next = old.data.filter((it) => !matcher(it))
    return { ...old, data: next, count: Math.max(0, Number(old.count || 0) - (old.data.length - next.length)) }
  }
  if (Array.isArray(old.pages)) {
    let removed = 0
    const pages = old.pages.map((p) => {
      const data = (p?.data || []).filter((it) => {
        const hit = matcher(it)
        if (hit) removed += 1
        return !hit
      })
      return { ...p, data }
    })
    if (pages[0] && removed) {
      pages[0] = { ...pages[0], count: Math.max(0, Number(old.pages[0]?.count || 0) - removed) }
    }
    return { ...old, pages }
  }
  return old
}

/** Quita File/Blob de values JSONB; deja solo JSON-serializable. */
export function serializeInventoryValues(values = {}) {
  const out = {}
  for (const [key, raw] of Object.entries(values || {})) {
    if (typeof File !== 'undefined' && raw instanceof File) continue
    if (typeof Blob !== 'undefined' && raw instanceof Blob && typeof raw !== 'string') continue
    if (raw instanceof Date) {
      out[key] = raw.toISOString()
      continue
    }
    out[key] = raw
  }
  // Round-trip JSON para garantizar serialización IndexedDB.
  return JSON.parse(JSON.stringify(out))
}

export function inventoryValuesHaveBinary(values = {}) {
  return Object.values(values || {}).some((raw) => {
    if (typeof File !== 'undefined' && raw instanceof File) return true
    if (typeof Blob !== 'undefined' && raw instanceof Blob && typeof raw !== 'string') return true
    return false
  })
}

export function buildPendingInventoryItem({ areaId, values, clientUuid, businessId, userId }) {
  return {
    id: `pending-${clientUuid}`,
    client_uuid: clientUuid,
    area_id: areaId,
    values: values || {},
    sku: 'Pendiente',
    user_id: businessId || userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _pending: true,
  }
}

export function findInventoryItemInCache(queryClient, areaId, id) {
  const entries = queryClient.getQueriesData({
    predicate: (q) => isItemsQuery(q, areaId),
  })
  for (const [, data] of entries) {
    if (Array.isArray(data?.data)) {
      const hit = data.data.find((it) => it.id === id)
      if (hit) return hit
    }
    if (Array.isArray(data?.pages)) {
      for (const page of data.pages) {
        const hit = (page?.data || []).find((it) => it.id === id)
        if (hit) return hit
      }
    }
  }
  return null
}

export function applyOptimisticItemCreate(queryClient, areaId, row) {
  queryClient.setQueriesData(
    { predicate: (q) => isItemsQuery(q, areaId) },
    (old) => prepend(old, row),
  )
}

export function applyOptimisticItemUpdate(queryClient, areaId, id, values) {
  queryClient.setQueriesData(
    { predicate: (q) => isItemsQuery(q, areaId) },
    (old) => patch(old, (it) => it.id === id, { values, _pending: true, updated_at: new Date().toISOString() }),
  )
  // Detalle de ítem (InventarioItem) si está abierto.
  queryClient.setQueriesData(
    {
      predicate: (q) =>
        Array.isArray(q.queryKey)
        && q.queryKey[0] === 'inventoryItem'
        && String(q.queryKey[1]) === String(id),
    },
    (old) => (old ? { ...old, values, _pending: true } : old),
  )
}

export function restoreInventoryItem(queryClient, areaId, id, row) {
  if (!row) return
  queryClient.setQueriesData(
    { predicate: (q) => isItemsQuery(q, areaId) },
    (old) => patch(old, (it) => it.id === id, { ...row, _pending: false }),
  )
}

export function clearOptimisticItem(queryClient, areaId, clientUuid) {
  if (!clientUuid) return
  const matcher = (it) => it.client_uuid === clientUuid || it.id === `pending-${clientUuid}`
  queryClient.setQueriesData(
    { predicate: (q) => isItemsQuery(q, areaId) },
    (old) => remove(old, matcher),
  )
}

export function removeInventoryItemFromCache(queryClient, areaId, id) {
  queryClient.setQueriesData(
    { predicate: (q) => isItemsQuery(q, areaId) },
    (old) => remove(old, (it) => it.id === id),
  )
}

export function buildPendingAreaRow({
  name,
  icon,
  slug,
  prefix,
  domain_type,
  template_id,
  clientUuid,
  businessId,
  userId,
}) {
  return {
    id: `pending-${clientUuid}`,
    client_uuid: clientUuid,
    name,
    icon: icon || 'Home',
    slug: slug || null,
    prefix: prefix || null,
    domain_type: domain_type || 'custom',
    template_id: template_id || 'custom_blank',
    user_id: businessId || userId,
    created_at: new Date().toISOString(),
    _pending: true,
  }
}

export function applyOptimisticAreaCreate(queryClient, row) {
  queryClient.setQueriesData(
    { predicate: isAreasQuery },
    (old) => {
      if (!Array.isArray(old)) return [row]
      if (old.some((a) => a.id === row.id || (row.client_uuid && a.client_uuid === row.client_uuid))) {
        return old
      }
      return [row, ...old]
    },
  )
}

export function clearOptimisticArea(queryClient, clientUuid) {
  if (!clientUuid) return
  queryClient.setQueriesData(
    { predicate: isAreasQuery },
    (old) => {
      if (!Array.isArray(old)) return old
      return old.filter((a) => a.client_uuid !== clientUuid && a.id !== `pending-${clientUuid}`)
    },
  )
}

export function applyOptimisticAreaUpdate(queryClient, id, patchFields) {
  queryClient.setQueriesData(
    { predicate: isAreasQuery },
    (old) => {
      if (!Array.isArray(old)) return old
      return old.map((a) => (a.id === id ? { ...a, ...patchFields, _pending: true } : a))
    },
  )
}

export function restoreAreaRow(queryClient, id, row) {
  if (!row) return
  queryClient.setQueriesData(
    { predicate: isAreasQuery },
    (old) => {
      if (!Array.isArray(old)) return old
      return old.map((a) => (a.id === id ? { ...row, _pending: false } : a))
    },
  )
}

export function findAreaInCache(queryClient, id) {
  const entries = queryClient.getQueriesData({ predicate: isAreasQuery })
  for (const [, data] of entries) {
    if (Array.isArray(data)) {
      const hit = data.find((a) => a.id === id)
      if (hit) return hit
    }
  }
  return null
}
