// Parches optimistas para listados de cuentas abiertas (abonos offline).

const isOpenAccountsQuery = (query) =>
  Array.isArray(query.queryKey) && query.queryKey[0] === 'open-accounts'

function patchAccount(old, matcher, next) {
  if (!old) return old
  if (Array.isArray(old.data)) {
    return { ...old, data: old.data.map((t) => (matcher(t) ? { ...t, ...next } : t)) }
  }
  if (Array.isArray(old.pages)) {
    return {
      ...old,
      pages: old.pages.map((p) => ({
        ...p,
        data: (p?.data || []).map((t) => (matcher(t) ? { ...t, ...next } : t)),
      })),
    }
  }
  return old
}

export function findOpenAccountInCache(queryClient, id) {
  const entries = queryClient.getQueriesData({ predicate: isOpenAccountsQuery })
  for (const [, data] of entries) {
    if (Array.isArray(data?.data)) {
      const hit = data.data.find((t) => t.id === id)
      if (hit) return hit
    }
    if (Array.isArray(data?.pages)) {
      for (const page of data.pages) {
        const hit = (page?.data || []).find((t) => t.id === id)
        if (hit) return hit
      }
    }
  }
  return null
}

/** Aplica un abono optimista: sube paid_amount y marca _pending. */
export function applyOptimisticPayment(queryClient, transactionId, amount) {
  const add = Number(amount) || 0
  queryClient.setQueriesData({ predicate: isOpenAccountsQuery }, (old) => {
    if (!old) return old
    const mapRow = (t) => {
      if (t.id !== transactionId) return t
      const total = Number(t.amount) || 0
      const paid = Number(t.paid_amount || 0) + add
      const status = paid >= total ? 'paid' : 'partial'
      return {
        ...t,
        paid_amount: paid,
        status,
        _pending: true,
        _pending_payment: add,
      }
    }
    if (Array.isArray(old.data)) return { ...old, data: old.data.map(mapRow) }
    if (Array.isArray(old.pages)) {
      return { ...old, pages: old.pages.map((p) => ({ ...p, data: (p?.data || []).map(mapRow) })) }
    }
    return old
  })
}

export function restoreOpenAccountRow(queryClient, id, row) {
  if (!row) return
  queryClient.setQueriesData({ predicate: isOpenAccountsQuery }, (old) =>
    patchAccount(old, (t) => t.id === id, { ...row, _pending: false, _pending_payment: undefined }),
  )
}
