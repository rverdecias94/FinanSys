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

function removeAccountRow(old, id) {
  if (!old) return old
  const matcher = (t) => t.id === id
  if (Array.isArray(old.data)) {
    const next = old.data.filter((t) => !matcher(t))
    const removed = old.data.length - next.length
    return { ...old, data: next, count: Math.max(0, Number(old.count || 0) - removed) }
  }
  if (Array.isArray(old.pages)) {
    let removed = 0
    const pages = old.pages.map((p) => {
      const data = (p?.data || []).filter((t) => {
        const hit = matcher(t)
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

/** Quita una cuenta del listado (p. ej. quedó pagada al editar o al abonar). */
export function removeOpenAccountById(queryClient, id, direction) {
  if (id == null) return
  queryClient.setQueriesData(
    {
      predicate: (q) =>
        isOpenAccountsQuery(q)
        && (direction == null || q.queryKey[1] === direction),
    },
    (old) => removeAccountRow(old, id),
  )
  if (direction) {
    queryClient.setQueriesData(
      {
        predicate: (q) =>
          Array.isArray(q.queryKey)
          && q.queryKey[0] === 'open-accounts-count'
          && q.queryKey[1] === direction,
      },
      (old) => (typeof old === 'number' ? Math.max(0, old - 1) : old),
    )
  }
}

/** Aplica un abono optimista: sube paid_amount y marca _pending. */
export function applyOptimisticPayment(queryClient, transactionId, amount) {
  const add = Number(amount) || 0
  let becamePaid = false
  let direction = null
  queryClient.setQueriesData({ predicate: isOpenAccountsQuery }, (old) => {
    if (!old) return old
    const mapRow = (t) => {
      if (t.id !== transactionId) return t
      const total = Number(t.amount) || 0
      const paid = Number(t.paid_amount || 0) + add
      const status = paid >= total ? 'paid' : 'partial'
      if (status === 'paid') {
        becamePaid = true
        direction = t.type === 'income' ? 'receivable' : 'payable'
      }
      return {
        ...t,
        paid_amount: paid,
        status,
        _pending: true,
        _pending_payment: add,
      }
    }
    let next = old
    if (Array.isArray(old.data)) next = { ...old, data: old.data.map(mapRow) }
    else if (Array.isArray(old.pages)) {
      next = { ...old, pages: old.pages.map((p) => ({ ...p, data: (p?.data || []).map(mapRow) })) }
    }
    // Liquidada: ya no es "cuenta abierta".
    if (becamePaid) return removeAccountRow(next, transactionId)
    return next
  })
  if (becamePaid && direction) {
    queryClient.setQueriesData(
      {
        predicate: (q) =>
          Array.isArray(q.queryKey)
          && q.queryKey[0] === 'open-accounts-count'
          && q.queryKey[1] === direction,
      },
      (old) => (typeof old === 'number' ? Math.max(0, old - 1) : old),
    )
  }
}

export function restoreOpenAccountRow(queryClient, id, row) {
  if (!row) return
  queryClient.setQueriesData({ predicate: isOpenAccountsQuery }, (old) =>
    patchAccount(old, (t) => t.id === id, { ...row, _pending: false, _pending_payment: undefined }),
  )
}
