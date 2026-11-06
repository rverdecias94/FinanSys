// Parches optimistas en las queries de listado de transacciones
// (ResponsiveListing usa claves 'rl-page' / 'rl-infinite').

const isTransactionsQuery = (query) =>
  Array.isArray(query.queryKey) && query.queryKey[0] === 'transactions'

function prependToListingData(old, row) {
  if (!old) return old
  // Desktop (useQuery): { data, count }
  if (Array.isArray(old.data)) {
    // Evitar duplicar si ya está (mismo client_uuid / id pendiente).
    if (old.data.some((t) => t.id === row.id || (row.client_uuid && t.client_uuid === row.client_uuid))) {
      return old
    }
    return {
      ...old,
      data: [row, ...old.data],
      count: Number(old.count || 0) + 1,
    }
  }
  // Móvil (useInfiniteQuery): { pages, pageParams }
  if (Array.isArray(old.pages)) {
    const pages = old.pages.map((p) => ({ ...p, data: [...(p?.data || [])] }))
    if (pages[0]) {
      const already = pages.some((p) =>
        (p.data || []).some((t) => t.id === row.id || (row.client_uuid && t.client_uuid === row.client_uuid)),
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

function patchListingRow(old, matcher, patch) {
  if (!old) return old
  if (Array.isArray(old.data)) {
    return {
      ...old,
      data: old.data.map((t) => (matcher(t) ? { ...t, ...patch } : t)),
    }
  }
  if (Array.isArray(old.pages)) {
    return {
      ...old,
      pages: old.pages.map((p) => ({
        ...p,
        data: (p?.data || []).map((t) => (matcher(t) ? { ...t, ...patch } : t)),
      })),
    }
  }
  return old
}

function removeListingRow(old, matcher) {
  if (!old) return old
  if (Array.isArray(old.data)) {
    const next = old.data.filter((t) => !matcher(t))
    const removed = old.data.length - next.length
    return {
      ...old,
      data: next,
      count: Math.max(0, Number(old.count || 0) - removed),
    }
  }
  if (Array.isArray(old.pages)) {
    let removed = 0
    const pages = old.pages.map((p) => {
      const data = (p?.data || []).filter((t) => {
        const hit = matcher(t)
        if (hit) removed += 1
        return !hit
      })
      return { ...p, data, count: Math.max(0, Number(p.count || 0) - (p === old.pages[0] ? removed : 0)) }
    })
    if (pages[0] && removed) {
      pages[0] = { ...pages[0], count: Math.max(0, Number(old.pages[0]?.count || 0) - removed) }
    }
    return { ...old, pages }
  }
  return old
}

/** Fila optimista para un create offline/online (antes de respuesta del servidor). */
export function buildPendingTransactionRow(payload, { userId, businessId }) {
  const clientUuid = payload.client_uuid
  return {
    id: `pending-${clientUuid}`,
    client_uuid: clientUuid,
    date: payload.date,
    amount: Number(payload.amount) || 0,
    currency: payload.currency,
    category: payload.category,
    description: payload.description,
    type: payload.type,
    status: payload.status || 'paid',
    due_date: payload.due_date || null,
    paid_amount: payload.paid_amount,
    contact_id: payload.contact_id || null,
    user_id: businessId || userId,
    details: {
      payment_method: payload.payment_method || null,
      notes: payload.notes || null,
      attachments: Array.isArray(payload.attachments)
        ? payload.attachments.filter((a) => typeof a === 'string')
        : [],
      ...(payload.isSale ? { sale: true } : {}),
    },
    _pending: true,
  }
}

export function applyOptimisticCreate(queryClient, row) {
  queryClient.setQueriesData({ predicate: isTransactionsQuery }, (old) => prependToListingData(old, row))
}

export function clearOptimisticPending(queryClient, clientUuid) {
  if (!clientUuid) return
  const matcher = (t) => t.client_uuid === clientUuid || t.id === `pending-${clientUuid}`
  queryClient.setQueriesData({ predicate: isTransactionsQuery }, (old) => removeListingRow(old, matcher))
}

export function markOptimisticSynced(queryClient, clientUuid, serverRow) {
  if (!clientUuid || !serverRow) return
  const matcher = (t) => t.client_uuid === clientUuid || t.id === `pending-${clientUuid}`
  queryClient.setQueriesData(
    { predicate: isTransactionsQuery },
    (old) => patchListingRow(old, matcher, { ...serverRow, _pending: false }),
  )
}
