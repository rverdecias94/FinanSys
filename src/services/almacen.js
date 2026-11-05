import { supabase } from '@/config/supabase'
import { withCrud } from '@/services/notifyWrap'
import { logAction } from '@/services/auditLogger'
import { getEffectiveUserId, validateResourceAccess } from '@/services/team'

/**
 * Función auxiliar para obtener el userUuid efectivo
 * Si el usuario es miembro de equipo, usa el businessId (owner_id)
 * Si es owner, usa su propio ID
 */
function getEffectiveUserUuid(userId, businessId) {
  return getEffectiveUserId(userId, businessId);
}

export async function listProducts({ page = 1, pageSize = 10, search = '', category = 'all', stockStatus = 'all', userId, businessId } = {}) {
  if (!userId) throw new Error('User ID is required for security isolation')

  // Obtener el ID efectivo para filtrar (owner_id si es miembro, su propio ID si es owner)
  const effectiveUserId = getEffectiveUserUuid(userId, businessId);

  let q = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('user_id', effectiveUserId) // Filtrar por el owner_id efectivo
    // Lo recién creado primero (created_at); name como desempate estable.
    .order('created_at', { ascending: false })
    .order('name', { ascending: true })

  // Filters (nombre, SKU o código de barras)
  if (search) {
    const term = `%${search}%`
    q = q.or(`name.ilike.${term},sku.ilike.${term},barcode.ilike.${term}`)
  }

  if (category && category !== 'all') {
    q = q.eq('category', category)
  }

  // Stock status filter
  if (stockStatus && stockStatus !== 'all') {
    if (stockStatus === 'low') {
      q = q.lte('stock', supabase.raw('COALESCE(min_stock, 5)'))
    } else if (stockStatus === 'out') {
      q = q.eq('stock', 0)
    } else if (stockStatus === 'in') {
      q = q.gt('stock', 0)
    }
  }

  // Pagination
  if (page && pageSize) {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    q = q.range(from, to)
  }

  const { data, count, error } = await q
  if (error) throw error
  return { data, count }
}

export async function listProductsForSelection({ userId, businessId, limit = 5000 } = {}) {
  if (!userId) throw new Error('User ID is required for security isolation')

  const effectiveUserId = getEffectiveUserUuid(userId, businessId)

  let q = supabase
    .from('products')
    .select('id, name, stock, category, currency, unit_price, sku, barcode, avg_cost, min_stock, max_stock, track_lot, track_serial, track_expiry, issue_strategy')
    .eq('user_id', effectiveUserId)
    .order('name', { ascending: true })

  if (limit) q = q.limit(limit)

  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function getProduct(id, userId, businessId) {
  if (!userId) throw new Error('User ID is required')

  const effectiveUserId = getEffectiveUserUuid(userId, businessId);

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('user_id', effectiveUserId) // Verificar que pertenece al owner efectivo
    .single()
  if (error) throw error
  return data
}

export async function createProduct(payload, userId, businessId) {
  if (!userId) throw new Error('User ID is required')

  return await withCrud({ action: 'create', table: 'products' }, async () => {
    const effectiveUserId = getEffectiveUserUuid(userId, businessId);
    const initialStock = Number(payload?.stock) || 0

    // Crear siempre en 0 y, si hay stock inicial, registrar una entrada atómica.
    // Así el historial de movimientos refleja la apertura (no un stock "mágico").
    const { data, error } = await supabase
      .from('products')
      .insert({ ...payload, stock: 0, user_id: effectiveUserId })
      .select()
      .single()
    if (error) throw error

    if (initialStock > 0) {
      try {
        const moved = await registerMovement({
          product_id: data.id,
          qty: initialStock,
          type: 'in',
          userId
        })
        return { ...data, stock: moved?.resulting_stock ?? initialStock }
      } catch (moveErr) {
        // Sin permiso warehouse.move: deja el stock en el producto sin movimiento.
        const { data: updated, error: updErr } = await supabase
          .from('products')
          .update({ stock: initialStock })
          .eq('id', data.id)
          .eq('user_id', effectiveUserId)
          .select()
          .single()
        if (updErr) throw moveErr
        return updated || { ...data, stock: initialStock }
      }
    }

    // S4: auditoría (incl. antes/después) vía trigger de BD audit_row_change.
    return data
  })
}

export async function updateProduct(id, payload, userId, businessId) {
  if (!userId) throw new Error('User ID is required')

  return await withCrud({ action: 'update', table: 'products' }, async () => {
    const effectiveUserId = getEffectiveUserUuid(userId, businessId);

    // Primero validar que el producto pertenece al usuario efectivo
    const hasAccess = await validateResourceAccess('product', id, userId, businessId);
    if (!hasAccess) {
      throw new Error('Access Denied: Product does not belong to user\'s business context');
    }

    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .eq('user_id', effectiveUserId) // Asegurar que solo actualiza del owner efectivo
      .select()
      .single()
    if (error) throw error
    // S4: auditoría (incl. antes/después) vía trigger de BD audit_row_change.
    return data
  })
}

export async function deleteProduct(id, userId, businessId) {
  if (!userId) throw new Error('User ID is required')

  return await withCrud({ action: 'delete', table: 'products' }, async () => {
    const effectiveUserId = getEffectiveUserUuid(userId, businessId);

    // Primero validar acceso
    const hasAccess = await validateResourceAccess('product', id, userId, businessId);
    if (!hasAccess) {
      throw new Error('Access Denied: Product does not belong to user\'s business context');
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('user_id', effectiveUserId) // Solo borrar del owner efectivo
    if (error) throw error
    // S4: auditoría (incl. antes/después) vía trigger de BD audit_row_change.
    return true
  })
}

export async function registerMovement({ product_id, qty, type, unit_cost, userId, notes }) {
  if (!userId) throw new Error('User ID is required')

  // A1: movimiento rápido crea comprobante automático + postea (WAC intacto server-side).
  const cost = (unit_cost === '' || unit_cost === null || unit_cost === undefined) ? null : Number(unit_cost)

  return await withCrud({ action: 'register', table: 'movements' }, async () => {
    const { data, error } = await supabase.rpc('create_and_post_quick_movement', {
      p_product_id: Number(product_id),
      p_qty: Number(qty),
      p_type: type,
      p_unit_cost: type === 'in' ? cost : null,
      p_notes: notes || null
    })

    if (error) throw error

    const move = Array.isArray(data?.movements) ? data.movements[0] : null
    const name = data?.name || move?.name
    const newStock = data?.new_stock ?? move?.new_stock
    const sealedCost = data?.unit_cost ?? move?.unit_cost ?? null

    await logAction({
      action: 'Movimiento',
      resource: `Producto: ${name}`,
      details: {
        product_id,
        product_name: name,
        qty,
        type,
        unit_cost: sealedCost,
        new_stock: newStock,
        document_id: data?.document_id,
        doc_number: data?.doc_number
      },
      area: 'Almacén'
    })

    return {
      product_id,
      qty,
      type,
      resulting_stock: newStock,
      name,
      unit_cost: sealedCost,
      document_id: data?.document_id,
      doc_number: data?.doc_number
    }
  })
}

export async function listWarehouseDocuments({
  page = 1,
  pageSize = 10,
  status = 'all',
  docType = 'all',
  userId,
  businessId
} = {}) {
  if (!userId) throw new Error('User ID is required')
  const effectiveUserId = getEffectiveUserUuid(userId, businessId)

  let q = supabase
    .from('warehouse_documents')
    .select('*', { count: 'exact' })
    .eq('user_id', effectiveUserId)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') q = q.eq('status', status)
  if (docType && docType !== 'all') q = q.eq('doc_type', docType)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  q = q.range(from, to)

  const { data, count, error } = await q
  if (error) throw error
  return { data, count }
}

export async function getWarehouseDocument(id, userId, businessId) {
  if (!userId) throw new Error('User ID is required')
  const effectiveUserId = getEffectiveUserUuid(userId, businessId)

  const { data: doc, error } = await supabase
    .from('warehouse_documents')
    .select('*')
    .eq('id', id)
    .eq('user_id', effectiveUserId)
    .single()
  if (error) throw error

  const { data: lines, error: lerr } = await supabase
    .from('warehouse_document_lines')
    .select('*, products(name, sku)')
    .eq('document_id', id)
    .order('id')
  if (lerr) throw lerr

  return { ...doc, lines: lines || [] }
}

export async function createWarehouseDocument({
  docType,
  lines,
  partnerName,
  reasonCode,
  notes,
  sourceRef,
  requireApproval = false,
  autoPost = false
}) {
  const { data, error } = await supabase.rpc('create_warehouse_document', {
    p_doc_type: docType,
    p_lines: lines,
    p_partner_name: partnerName || null,
    p_reason_code: reasonCode || null,
    p_notes: notes || null,
    p_source_ref: sourceRef || null,
    p_require_approval: requireApproval
  })
  if (error) throw error

  if (autoPost && data?.status === 'draft' && data?.document_id) {
    const posted = await postWarehouseDocument(data.document_id)
    return { ...data, posted }
  }
  return data
}

export async function postWarehouseDocument(documentId) {
  const { data, error } = await supabase.rpc('post_warehouse_document', {
    p_doc_id: Number(documentId)
  })
  if (error) throw error
  return data
}

export async function reverseWarehouseDocument(documentId, notes) {
  const { data, error } = await supabase.rpc('reverse_warehouse_document', {
    p_doc_id: Number(documentId),
    p_notes: notes || null
  })
  if (error) throw error
  return data
}

export async function approveWarehouseDocument(documentId) {
  const { data, error } = await supabase.rpc('approve_warehouse_document', {
    p_doc_id: Number(documentId)
  })
  if (error) throw error
  return data
}

export async function createCountAdjustment({
  productId,
  systemQty,
  countedQty,
  notes,
  autoPost = true,
  approvalThreshold = 5
}) {
  const { data, error } = await supabase.rpc('create_count_adjustment', {
    p_product_id: Number(productId),
    p_system_qty: Number(systemQty),
    p_counted_qty: Number(countedQty),
    p_notes: notes || null,
    p_auto_post: autoPost,
    p_approval_threshold: approvalThreshold
  })
  if (error) throw error
  return data
}

export async function listReasonCodes(userId, businessId) {
  if (!userId) throw new Error('User ID is required')
  const effectiveUserId = getEffectiveUserUuid(userId, businessId)
  await supabase.rpc('ensure_warehouse_reason_codes')
  const { data, error } = await supabase
    .from('warehouse_reason_codes')
    .select('*')
    .eq('user_id', effectiveUserId)
    .eq('is_active', true)
    .order('label')
  if (error) throw error
  return data || []
}

export async function listWarehouses(userId, businessId) {
  if (!userId) throw new Error('User ID is required')
  const effectiveUserId = getEffectiveUserUuid(userId, businessId)
  await supabase.rpc('ensure_default_warehouse')
  const { data, error } = await supabase
    .from('warehouses')
    .select('*')
    .eq('user_id', effectiveUserId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('name')
  if (error) throw error
  return data || []
}

export async function createWarehouse({ name, userId, businessId }) {
  if (!userId) throw new Error('User ID is required')
  const effectiveUserId = getEffectiveUserUuid(userId, businessId)
  const { data, error } = await supabase
    .from('warehouses')
    .insert({ user_id: effectiveUserId, name, is_default: false })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listWarehouseLocations(warehouseId, userId, businessId) {
  if (!userId) throw new Error('User ID is required')
  const effectiveUserId = getEffectiveUserUuid(userId, businessId)
  let q = supabase
    .from('warehouse_locations')
    .select('*')
    .eq('user_id', effectiveUserId)
    .eq('is_active', true)
    .order('code')
  if (warehouseId) q = q.eq('warehouse_id', warehouseId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createWarehouseLocation({ warehouseId, code, name, zoneText, userId, businessId }) {
  if (!userId) throw new Error('User ID is required')
  const effectiveUserId = getEffectiveUserUuid(userId, businessId)
  const { data, error } = await supabase
    .from('warehouse_locations')
    .insert({
      warehouse_id: warehouseId,
      user_id: effectiveUserId,
      code: String(code || '').trim().toUpperCase(),
      name: name || null,
      zone_text: zoneText || null
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listStockBalances({ productId, userId, businessId } = {}) {
  if (!userId) throw new Error('User ID is required')
  const effectiveUserId = getEffectiveUserUuid(userId, businessId)
  let q = supabase
    .from('stock_balances')
    .select('*, warehouses(name), warehouse_locations(code, name)')
    .eq('user_id', effectiveUserId)
    .gt('qty', 0)
  if (productId) q = q.eq('product_id', productId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function suggestIssueLot(productId, qty = 1) {
  const { data, error } = await supabase.rpc('suggest_issue_lot', {
    p_product_id: Number(productId),
    p_qty: Number(qty)
  })
  if (error) throw error
  return data
}

export async function getProductAvailability(productId) {
  const { data, error } = await supabase.rpc('get_product_availability', {
    p_product_id: Number(productId)
  })
  if (error) throw error
  return data
}

export async function reserveStock({ productId, qty, sourceRef, notes }) {
  const { data, error } = await supabase.rpc('reserve_stock', {
    p_product_id: Number(productId),
    p_qty: Number(qty),
    p_source_ref: sourceRef || null,
    p_notes: notes || null
  })
  if (error) throw error
  return data
}

export async function getWarehouseKpis() {
  const { data, error } = await supabase.rpc('get_warehouse_kpis')
  if (error) throw error
  return data
}

export async function listReorderAlerts() {
  const { data, error } = await supabase.rpc('list_reorder_alerts')
  if (error) throw error
  return data || []
}

export async function listWarehouseTasks({ status = 'open', userId, businessId } = {}) {
  if (!userId) throw new Error('User ID is required')
  const effectiveUserId = getEffectiveUserUuid(userId, businessId)
  let q = supabase
    .from('warehouse_tasks')
    .select('*, products(name, sku)')
    .eq('user_id', effectiveUserId)
    .order('created_at', { ascending: false })
  if (status && status !== 'all') {
    if (status === 'open') q = q.in('status', ['open', 'in_progress'])
    else q = q.eq('status', status)
  }
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createWarehouseTask(payload, userId, businessId) {
  if (!userId) throw new Error('User ID is required')
  const effectiveUserId = getEffectiveUserUuid(userId, businessId)
  const { data, error } = await supabase
    .from('warehouse_tasks')
    .insert({ ...payload, user_id: effectiveUserId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function completeWarehouseTask(taskId, userId, businessId) {
  if (!userId) throw new Error('User ID is required')
  const effectiveUserId = getEffectiveUserUuid(userId, businessId)
  const { data, error } = await supabase
    .from('warehouse_tasks')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('user_id', effectiveUserId)
    .select()
    .single()
  if (error) throw error
  return data
}

export function generateProductSku(name) {
  const base = String(name || 'PRD')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase() || 'PRD'
  const seq = String(Date.now()).slice(-4)
  return `${base}-${seq}`
}

export async function recordMovement(movementData, userId, businessId) {
  const productId = movementData.product_id || movementData.product?.id
  const qty = movementData.qty
  const type = movementData.type

  return registerMovement({ product_id: productId, qty, type, userId, businessId })
}

export async function exportProducts(businessId) {
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData?.user?.id
  if (!userId || !businessId) throw new Error('User ID and business ID are required')

  const { data } = await listProducts({ page: 1, pageSize: 5000, userId, businessId })
  const rows = (data || []).map(p => ({
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    category: p.category,
    unit_price: p.unit_price,
    stock: p.stock,
    min_stock: p.min_stock,
    max_stock: p.max_stock,
    currency: p.currency,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }))

  // Carga diferida: la librería de exportación (~1.5MB) no entra en el arranque.
  const { exportToExcel } = await import('@/utils/exportUtils')
  exportToExcel('Productos', rows, `productos_${new Date().toISOString().slice(0, 10)}`)
}

export async function listMovements({
  page = 1,
  pageSize = 10,
  type = 'all',
  productId = 'all',
  startDate = null,
  endDate = null,
  userId,
  businessId,
  /** E4: 'created_at' (default, listados UI) | 'effective' (moved_at con fallback created_at, filtrado en cliente tras ampliar ventana). */
  dateMode = 'created_at',
  ascending = false,
} = {}) {
  if (!userId) throw new Error('User ID is required')

  const effectiveUserId = getEffectiveUserUuid(userId, businessId);

  let q = supabase
    .from('movements')
    .select(`
      *,
      products (name, category, stock, sku, currency)
    `, { count: 'exact' })
    .eq('user_id', effectiveUserId) // Filtrar por owner_id efectivo
    .order('created_at', { ascending: !!ascending })

  // Filters
  if (type && type !== 'all') {
    q = q.eq('type', type)
  }

  if (productId && productId !== 'all') {
    q = q.eq('product_id', productId)
  }

  // dateMode created_at: filtro SQL clásico. effective: se filtra en fetchMovementsForReporting.
  if (dateMode === 'created_at') {
    if (startDate) {
      q = q.gte('created_at', startDate)
    }
    if (endDate) {
      q = q.lte('created_at', endDate)
    }
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  q = q.range(from, to)

  const { data, count, error } = await q
  if (error) throw error
  return { data, count }
}

export async function fetchMovementsForExport({ type = 'all', productId = 'all', startDate = null, endDate = null, userId, businessId } = {}) {
  const pageSize = 1000
  const first = await listMovements({ page: 1, pageSize, type, productId, startDate, endDate, userId, businessId })
  const initialRows = first?.data || []
  const count = Number(first?.count || 0)

  if (!count || initialRows.length === 0) return []

  const totalPages = Math.ceil(count / pageSize)
  if (totalPages <= 1) return initialRows

  const rows = [...initialRows]
  for (let page = 2; page <= totalPages; page++) {
    const res = await listMovements({ page, pageSize, type, productId, startDate, endDate, userId, businessId })
    rows.push(...(res?.data || []))
  }

  return rows
}

/**
 * E4 — Movimientos para existencias/Kardex.
 * scope 'through_end': todos hasta endDate (fecha efectiva) para saldo inicial + período.
 * scope 'period': solo dentro de [startDate, endDate] por fecha efectiva.
 * No inventa costos: trae unit_cost tal cual (puede ser null).
 */
export async function fetchMovementsForReporting({
  type = 'all',
  productId = 'all',
  startDate = null,
  endDate = null,
  userId,
  businessId,
  scope = 'through_end',
} = {}) {
  const pageSize = 1000
  // Sin filtro SQL de fechas (dateMode effective): paginamos todo el historial del negocio
  // (o producto) y filtramos por moved_at||created_at en cliente. Aceptable para PYME.
  const first = await listMovements({
    page: 1,
    pageSize,
    type,
    productId,
    userId,
    businessId,
    dateMode: 'effective',
    ascending: true,
  })
  const initialRows = first?.data || []
  const count = Number(first?.count || 0)
  let rows = [...initialRows]
  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize))
  for (let page = 2; page <= totalPages; page++) {
    const res = await listMovements({
      page,
      pageSize,
      type,
      productId,
      userId,
      businessId,
      dateMode: 'effective',
      ascending: true,
    })
    rows.push(...(res?.data || []))
  }

  const effectiveAt = (m) => m?.moved_at || m?.created_at
  const fromT = startDate ? new Date(startDate).getTime() : null
  const toT = endDate ? new Date(endDate).getTime() : null

  rows = rows.filter((m) => {
    const t = new Date(effectiveAt(m) || 0).getTime()
    if (!Number.isFinite(t)) return false
    if (scope === 'period') {
      if (fromT != null && t < fromT) return false
      if (toT != null && t > toT) return false
      return true
    }
    // through_end: todo hasta endDate (incluye previo al start para saldo inicial)
    if (toT != null && t > toT) return false
    return true
  })

  return rows
}

export async function getProductCategories() {
  const { data, error } = await supabase
    .from('product_categories')
    .select('name')
    .order('name')

  if (error || !data || data.length === 0) {
    // Return default categories if none found (or on error)
    return [
      { name: 'Alimentos' },
      { name: 'Bebidas' },
      { name: 'Electrónica' },
      { name: 'Ferretería' },
      { name: 'Oficina' },
      { name: 'Aseo' },
      { name: 'Ropa' },
      { name: 'Medicamentos' },
      { name: 'Otros' }
    ]
  }
  return data
}

export async function getAlmacenStats(userId, businessId) {
  if (!userId) throw new Error('User ID is required')

  const effectiveUserId = getEffectiveUserUuid(userId, businessId);

  // Fetch products and movements in parallel
  const [productsResponse, movementsResponse] = await Promise.all([
    supabase
      .from('products')
      .select('name, stock, min_stock, category')
      .eq('user_id', effectiveUserId), // Filtrar por owner_id efectivo
    supabase
      .from('movements')
      .select('qty, type, created_at')
      .eq('user_id', effectiveUserId) // Filtrar por owner_id efectivo
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
  ])

  if (productsResponse.error) throw productsResponse.error
  if (movementsResponse.error) throw movementsResponse.error

  const products = productsResponse.data || []
  const movements = movementsResponse.data || []

  const totalProducts = products.length
  const lowStockCount = products.filter(p => p.stock <= (p.min_stock || 5)).length

  const distribution = {}
  products.forEach(p => {
    if (!distribution[p.category]) distribution[p.category] = 0
    distribution[p.category]++
  })

  const distributionData = Object.entries(distribution).map(([name, value]) => ({
    name,
    value
  }))

  // Top 10 Products by Stock
  const topProducts = [...products]
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 10)
    .map(p => ({ name: p.name, stock: p.stock }))

  // Movements Trend (Last 30 Days)
  const trendMap = {}
  // Initialize last 30 days
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    trendMap[dateStr] = { date: dateStr, entradas: 0, salidas: 0 }
  }

  movements.forEach(m => {
    const dateStr = m.created_at.split('T')[0]
    if (trendMap[dateStr]) {
      if (m.type === 'in') {
        trendMap[dateStr].entradas += Number(m.qty)
      } else {
        trendMap[dateStr].salidas += Number(m.qty)
      }
    }
  })

  const movementsTrend = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date))

  return {
    totalProducts,
    lowStockCount,
    distribution: distributionData,
    topProducts,
    movementsTrend
  }
}
