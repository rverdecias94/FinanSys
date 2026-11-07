// Parches optimistas para plantillas de recurrentes (array plano en React Query).

const isRecurringQuery = (query) =>
  Array.isArray(query.queryKey) && query.queryKey[0] === 'recurring-transactions'

export function serializeRecurringPayload(payload = {}) {
  const contactId = payload.contact_id
  const cleanContact =
    contactId != null && contactId !== '' && !String(contactId).startsWith('pending-')
      ? Number(contactId)
      : null

  const out = {
    type: payload.type === 'income' ? 'income' : 'expense',
    amount: Number(payload.amount),
    currency: payload.currency || 'USD',
    category: payload.category || null,
    description: typeof payload.description === 'string' ? payload.description.trim() : payload.description,
    payment_method: payload.payment_method || null,
    contact_id: Number.isFinite(cleanContact) ? cleanContact : null,
    status: payload.status === 'pending' ? 'pending' : 'paid',
    frequency: payload.frequency || 'monthly',
    next_run: payload.next_run || null,
    end_date: payload.end_date || null,
    notes: payload.notes || null,
    is_active: payload.is_active !== false,
    client_uuid: payload.client_uuid || null,
  }
  return JSON.parse(JSON.stringify(out))
}

export function buildPendingRecurringRow(payload, { userId, businessId, contactName = null } = {}) {
  return {
    id: `pending-${payload.client_uuid}`,
    client_uuid: payload.client_uuid,
    ...payload,
    user_id: businessId || userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_generated_at: null,
    _pending: true,
    contact: contactName ? { id: payload.contact_id, name: contactName } : null,
  }
}

export function findRecurringInCache(queryClient, id) {
  const entries = queryClient.getQueriesData({ predicate: isRecurringQuery })
  for (const [, data] of entries) {
    if (!Array.isArray(data)) continue
    const hit = data.find((r) => String(r.id) === String(id))
    if (hit) return hit
  }
  return null
}

export function applyOptimisticRecurringCreate(queryClient, row) {
  queryClient.setQueriesData({ predicate: isRecurringQuery }, (old) => {
    if (!Array.isArray(old)) return old
    if (old.some((r) => r.id === row.id || (row.client_uuid && r.client_uuid === row.client_uuid))) {
      return old
    }
    return [row, ...old]
  })
}

export function applyOptimisticRecurringUpdate(queryClient, id, patchFields) {
  queryClient.setQueriesData({ predicate: isRecurringQuery }, (old) => {
    if (!Array.isArray(old)) return old
    return old.map((r) => (
      String(r.id) === String(id) ? { ...r, ...patchFields, _pending: true } : r
    ))
  })
}

export function restoreRecurringRow(queryClient, id, row) {
  if (!row) return
  queryClient.setQueriesData({ predicate: isRecurringQuery }, (old) => {
    if (!Array.isArray(old)) return old
    return old.map((r) => (String(r.id) === String(id) ? { ...row, _pending: false } : r))
  })
}

export function clearOptimisticRecurring(queryClient, clientUuid) {
  if (!clientUuid) return
  queryClient.setQueriesData({ predicate: isRecurringQuery }, (old) => {
    if (!Array.isArray(old)) return old
    return old.filter((r) => r.client_uuid !== clientUuid && r.id !== `pending-${clientUuid}`)
  })
}

export function removeRecurringFromCache(queryClient, id) {
  queryClient.setQueriesData({ predicate: isRecurringQuery }, (old) => {
    if (!Array.isArray(old)) return old
    return old.filter((r) => String(r.id) !== String(id))
  })
}
