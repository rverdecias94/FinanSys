// Parches optimistas para productos y movimientos de almacén (ResponsiveListing).

const isProductsQuery = (query) =>
  Array.isArray(query.queryKey)
  && query.queryKey[0] === 'warehouse'
  && (query.queryKey[1] === 'products' || query.queryKey[1] === 'productsSelection')

const isMovementsQuery = (query) =>
  Array.isArray(query.queryKey)
  && query.queryKey[0] === 'warehouse'
  && query.queryKey[1] === 'movements'

function prependListing(old, row) {
  if (!old) return old
  if (Array.isArray(old.data)) {
    if (old.data.some((m) => m.id === row.id || (row.client_uuid && m.client_uuid === row.client_uuid))) {
      return old
    }
    return { ...old, data: [row, ...old.data], count: Number(old.count || 0) + 1 }
  }
  if (Array.isArray(old.pages)) {
    const pages = old.pages.map((p) => ({ ...p, data: [...(p?.data || [])] }))
    if (pages[0]) {
      const already = pages.some((p) =>
        (p.data || []).some((m) => m.id === row.id || (row.client_uuid && m.client_uuid === row.client_uuid)),
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

function mapProducts(old, mapFn) {
  if (!old) return old
  // productsSelection: array plano
  if (Array.isArray(old) && !Object.prototype.hasOwnProperty.call(old, 'data')) {
    return old.map(mapFn)
  }
  if (Array.isArray(old.data)) {
    return { ...old, data: old.data.map(mapFn) }
  }
  if (Array.isArray(old.pages)) {
    return {
      ...old,
      pages: old.pages.map((p) => ({
        ...p,
        data: (p?.data || []).map(mapFn),
      })),
    }
  }
  return old
}

function findRow(old, productId) {
  if (!old) return null
  if (Array.isArray(old) && !Object.prototype.hasOwnProperty.call(old, 'data')) {
    return old.find((p) => String(p.id) === String(productId))
  }
  if (Array.isArray(old?.data)) return old.data.find((p) => String(p.id) === String(productId))
  if (Array.isArray(old?.pages)) {
    for (const page of old.pages) {
      const hit = (page?.data || []).find((p) => String(p.id) === String(productId))
      if (hit) return hit
    }
  }
  return null
}

export function serializeProductPayload(payload = {}) {
  const stockUnit = payload.stock_unit === 'box' ? 'box' : 'unit'
  let unitsPerBox = null
  if (stockUnit === 'box' && payload.units_per_box != null && payload.units_per_box !== '') {
    const n = Number(payload.units_per_box)
    unitsPerBox = Number.isFinite(n) && n > 0 ? n : null
  }
  const out = {
    name: typeof payload.name === 'string' ? payload.name.trim() : payload.name,
    category: payload.category || null,
    unit_price: payload.unit_price != null ? Number(payload.unit_price) : payload.unit_price,
    currency: payload.currency || 'USD',
    is_for_sale: payload.is_for_sale !== false,
    stock_unit: stockUnit,
    units_per_box: unitsPerBox,
    stock: payload.stock != null && payload.stock !== '' ? Number(payload.stock) : 0,
    min_stock: payload.min_stock != null ? Number(payload.min_stock) : payload.min_stock,
    max_stock: payload.max_stock === '' || payload.max_stock == null ? null : Number(payload.max_stock),
    sku: typeof payload.sku === 'string' ? (payload.sku.trim() || null) : (payload.sku || null),
    barcode: typeof payload.barcode === 'string' ? (payload.barcode.trim() || null) : (payload.barcode || null),
    track_lot: !!payload.track_lot,
    track_serial: !!payload.track_serial,
    track_expiry: !!payload.track_expiry,
    issue_strategy: payload.issue_strategy || 'none',
    client_uuid: payload.client_uuid || null,
  }
  return JSON.parse(JSON.stringify(out))
}

export function buildPendingProductRow(payload, { userId, businessId } = {}) {
  return {
    id: `pending-${payload.client_uuid}`,
    client_uuid: payload.client_uuid,
    name: payload.name,
    category: payload.category,
    unit_price: payload.unit_price,
    currency: payload.currency || 'USD',
    is_for_sale: payload.is_for_sale !== false,
    stock_unit: payload.stock_unit === 'box' ? 'box' : 'unit',
    units_per_box: payload.units_per_box ?? null,
    stock: Number(payload.stock) || 0,
    min_stock: payload.min_stock ?? 5,
    max_stock: payload.max_stock ?? null,
    sku: payload.sku || null,
    barcode: payload.barcode || null,
    track_lot: !!payload.track_lot,
    track_serial: !!payload.track_serial,
    track_expiry: !!payload.track_expiry,
    issue_strategy: payload.issue_strategy || 'none',
    user_id: businessId || userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _pending: true,
  }
}

function prependProduct(old, row) {
  if (!old) return old
  if (Array.isArray(old) && !Object.prototype.hasOwnProperty.call(old, 'data')) {
    if (old.some((p) => p.id === row.id || (row.client_uuid && p.client_uuid === row.client_uuid))) {
      return old
    }
    return [row, ...old]
  }
  if (Array.isArray(old.data)) {
    if (old.data.some((p) => p.id === row.id || (row.client_uuid && p.client_uuid === row.client_uuid))) {
      return old
    }
    return { ...old, data: [row, ...old.data], count: Number(old.count || 0) + 1 }
  }
  if (Array.isArray(old.pages)) {
    const pages = old.pages.map((p) => ({ ...p, data: [...(p?.data || [])] }))
    if (pages[0]) {
      const already = pages.some((p) =>
        (p.data || []).some((x) => x.id === row.id || (row.client_uuid && x.client_uuid === row.client_uuid)),
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

export function applyOptimisticProductCreate(queryClient, row) {
  queryClient.setQueriesData({ predicate: isProductsQuery }, (old) => prependProduct(old, row))
}

export function clearOptimisticProduct(queryClient, clientUuid) {
  if (!clientUuid) return
  const matcher = (p) => p.client_uuid === clientUuid || p.id === `pending-${clientUuid}`
  queryClient.setQueriesData({ predicate: isProductsQuery }, (old) => {
    if (!old) return old
    if (Array.isArray(old) && !Object.prototype.hasOwnProperty.call(old, 'data')) {
      return old.filter((p) => !matcher(p))
    }
    if (Array.isArray(old.data)) {
      const next = old.data.filter((p) => !matcher(p))
      return { ...old, data: next, count: Math.max(0, Number(old.count || 0) - (old.data.length - next.length)) }
    }
    if (Array.isArray(old.pages)) {
      let removed = 0
      const pages = old.pages.map((p) => {
        const data = (p?.data || []).filter((x) => {
          const hit = matcher(x)
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
  })
}

export function findProductInCache(queryClient, id) {
  const entries = queryClient.getQueriesData({ predicate: isProductsQuery })
  for (const [, data] of entries) {
    const hit = findRow(data, id)
    if (hit) return hit
  }
  return null
}

/**
 * Parchea producto en caché. `pending: true` solo cuando la mutación queda en outbox
 * (offline / red caída). Online no debe mostrar "Por sincronizar".
 */
export function applyOptimisticProductUpdate(queryClient, id, patchFields, { pending = false } = {}) {
  queryClient.setQueriesData(
    { predicate: isProductsQuery },
    (old) => mapProducts(old, (p) => (
      String(p.id) === String(id)
        ? { ...p, ...patchFields, _pending: pending ? true : false }
        : p
    )),
  )
}

/** Quita la marca de pendiente tras confirmación del servidor. */
export function clearProductPendingFlag(queryClient, id) {
  queryClient.setQueriesData(
    { predicate: isProductsQuery },
    (old) => mapProducts(old, (p) => (
      String(p.id) === String(id) ? { ...p, _pending: false } : p
    )),
  )
}

export function restoreProductRow(queryClient, id, row) {
  if (!row) return
  queryClient.setQueriesData(
    { predicate: isProductsQuery },
    (old) => mapProducts(old, (p) => (
      String(p.id) === String(id) ? { ...row, _pending: false } : p
    )),
  )
}

export function applyOptimisticStockDelta(queryClient, productId, type, qty) {
  const delta = type === 'in' ? Number(qty) : -Number(qty)
  queryClient.setQueriesData(
    { predicate: isProductsQuery },
    (old) => mapProducts(old, (p) => (
      String(p.id) === String(productId)
        ? { ...p, stock: Math.max(0, Number(p.stock || 0) + delta) }
        : p
    )),
  )
}

export function restoreProductStock(queryClient, productId, previousStock) {
  if (previousStock == null) return
  queryClient.setQueriesData(
    { predicate: isProductsQuery },
    (old) => mapProducts(old, (p) => (
      String(p.id) === String(productId) ? { ...p, stock: previousStock } : p
    )),
  )
}

export function buildPendingMovementRow({
  product,
  productId,
  qty,
  type,
  clientUuid,
  unitCost,
  resultingStock,
  businessId,
  userId,
}) {
  return {
    id: `pending-${clientUuid}`,
    client_uuid: clientUuid,
    product_id: Number(productId),
    qty: Number(qty),
    type,
    unit_cost: unitCost ?? null,
    resulting_stock: resultingStock,
    user_id: businessId || userId,
    created_at: new Date().toISOString(),
    _pending: true,
    products: product
      ? {
          name: product.name,
          category: product.category,
          stock: resultingStock,
          sku: product.sku,
          currency: product.currency,
        }
      : { name: 'Producto', stock: resultingStock },
  }
}

export function applyOptimisticMovementCreate(queryClient, row) {
  queryClient.setQueriesData(
    { predicate: isMovementsQuery },
    (old) => prependListing(old, row),
  )
}

export function clearOptimisticMovement(queryClient, clientUuid) {
  if (!clientUuid) return
  const matcher = (m) => m.client_uuid === clientUuid || m.id === `pending-${clientUuid}`
  queryClient.setQueriesData(
    { predicate: isMovementsQuery },
    (old) => {
      if (!old) return old
      if (Array.isArray(old.data)) {
        const next = old.data.filter((m) => !matcher(m))
        return { ...old, data: next, count: Math.max(0, Number(old.count || 0) - (old.data.length - next.length)) }
      }
      if (Array.isArray(old.pages)) {
        let removed = 0
        const pages = old.pages.map((p) => {
          const data = (p?.data || []).filter((m) => {
            const hit = matcher(m)
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
    },
  )
}
