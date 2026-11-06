// Parches optimistas para listados de contactos (ResponsiveListing).

const isContactsQuery = (query) =>
  Array.isArray(query.queryKey) && query.queryKey[0] === 'contacts'

function prepend(old, row) {
  if (!old) return old
  if (Array.isArray(old.data)) {
    if (old.data.some((c) => c.id === row.id || (row.client_uuid && c.client_uuid === row.client_uuid))) {
      return old
    }
    return { ...old, data: [row, ...old.data], count: Number(old.count || 0) + 1 }
  }
  if (Array.isArray(old.pages)) {
    const pages = old.pages.map((p) => ({ ...p, data: [...(p?.data || [])] }))
    if (pages[0]) {
      const already = pages.some((p) =>
        (p.data || []).some((c) => c.id === row.id || (row.client_uuid && c.client_uuid === row.client_uuid)),
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
    return { ...old, data: old.data.map((c) => (matcher(c) ? { ...c, ...next } : c)) }
  }
  if (Array.isArray(old.pages)) {
    return {
      ...old,
      pages: old.pages.map((p) => ({
        ...p,
        data: (p?.data || []).map((c) => (matcher(c) ? { ...c, ...next } : c)),
      })),
    }
  }
  return old
}

function remove(old, matcher) {
  if (!old) return old
  if (Array.isArray(old.data)) {
    const next = old.data.filter((c) => !matcher(c))
    return { ...old, data: next, count: Math.max(0, Number(old.count || 0) - (old.data.length - next.length)) }
  }
  if (Array.isArray(old.pages)) {
    let removed = 0
    const pages = old.pages.map((p) => {
      const data = (p?.data || []).filter((c) => {
        const hit = matcher(c)
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

export function buildPendingContactRow(payload, { userId, businessId }) {
  return {
    id: `pending-${payload.client_uuid}`,
    client_uuid: payload.client_uuid,
    name: payload.name,
    kind: payload.kind || 'cliente',
    phone: payload.phone || null,
    email: payload.email || null,
    notes: payload.notes || null,
    is_active: true,
    user_id: businessId || userId,
    _pending: true,
  }
}

export function findContactInCache(queryClient, id) {
  const entries = queryClient.getQueriesData({ predicate: isContactsQuery })
  for (const [, data] of entries) {
    if (Array.isArray(data?.data)) {
      const hit = data.data.find((c) => c.id === id)
      if (hit) return hit
    }
    if (Array.isArray(data?.pages)) {
      for (const page of data.pages) {
        const hit = (page?.data || []).find((c) => c.id === id)
        if (hit) return hit
      }
    }
  }
  return null
}

export function applyOptimisticContactCreate(queryClient, row) {
  queryClient.setQueriesData({ predicate: isContactsQuery }, (old) => prepend(old, row))
}

export function applyOptimisticContactUpdate(queryClient, id, patchFields) {
  queryClient.setQueriesData(
    { predicate: isContactsQuery },
    (old) => patch(old, (c) => c.id === id, { ...patchFields, _pending: true }),
  )
}

export function restoreContactRow(queryClient, id, row) {
  if (!row) return
  queryClient.setQueriesData(
    { predicate: isContactsQuery },
    (old) => patch(old, (c) => c.id === id, { ...row, _pending: false }),
  )
}

export function clearOptimisticContact(queryClient, clientUuid) {
  if (!clientUuid) return
  const matcher = (c) => c.client_uuid === clientUuid || c.id === `pending-${clientUuid}`
  queryClient.setQueriesData({ predicate: isContactsQuery }, (old) => remove(old, matcher))
}

export function removeContactFromCache(queryClient, id) {
  queryClient.setQueriesData({ predicate: isContactsQuery }, (old) => remove(old, (c) => c.id === id))
}
