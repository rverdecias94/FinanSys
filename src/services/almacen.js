import { supabase } from '@/config/supabase'
import { withCrud } from '@/services/notifyWrap'
import { logAction } from '@/services/auditLogger'
import { getEffectiveUserId, validateResourceAccess } from '@/services/team'
import { exportToExcel } from '@/utils/exportUtils'

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
    .order('name', { ascending: true })

  // Filters
  if (search) {
    q = q.ilike('name', `%${search}%`)
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
    .select('id, name, stock, category')
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

    const { data, error } = await supabase
      .from('products')
      .insert({ ...payload, user_id: effectiveUserId }) // Crear con el owner_id efectivo
      .select()
      .single()
    if (error) throw error
    await logAction({
      action: 'Crear',
      resource: `Producto: ${data.name}`,
      details: data,
      area: 'Almacén'
    })
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
    await logAction({
      action: 'Actualizar',
      resource: `Producto: ${data.name}`,
      details: data,
      area: 'Almacén'
    })
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
    await logAction({
      action: 'Eliminar',
      resource: `Producto ID: ${id}`,
      details: { id },
      area: 'Almacén'
    })
    return true
  })
}

export async function registerMovement({ product_id, qty, type, userId, businessId }) {
  if (!userId) throw new Error('User ID is required')

  return await withCrud({ action: 'register', table: 'movements' }, async () => {
    const effectiveUserId = getEffectiveUserUuid(userId, businessId);

    // Primero validar que el producto pertenece al contexto de negocio
    const hasAccess = await validateResourceAccess('product', product_id, userId, businessId);
    if (!hasAccess) {
      await supabase.from('access_audit_logs').insert({
        user_id: userId,
        action: 'unauthorized_movement_attempt',
        resource: `product_${product_id}`,
        details: { product_id, qty, type, reason: 'product_not_in_business_context' }
      });

      throw new Error('Access Denied: Product does not belong to user\'s business context');
    }

    const { data: product, error: prodError } = await supabase
      .from('products')
      .select('id, stock, name')
      .eq('id', product_id)
      .eq('user_id', effectiveUserId) // Asegurar que es del owner efectivo
      .single()

    if (prodError || !product) {
      await supabase.from('access_audit_logs').insert({
        user_id: userId,
        action: 'unauthorized_movement_attempt',
        resource: `product_${product_id}`,
        details: { product_id, qty, type, reason: 'product_not_found_in_context' }
      });

      throw new Error('Access Denied: Product does not belong to user\'s business context');
    }

    const newStock = type === 'in'
      ? Number(product.stock) + Number(qty)
      : Number(product.stock) - Number(qty)

    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', product_id)
      .eq('user_id', effectiveUserId) // Solo actualizar del owner efectivo

    if (updateError) throw updateError

    const { data: movement, error: movError } = await supabase
      .from('movements')
      .insert({ product_id, qty, type, user_id: effectiveUserId }) // Registrar con owner_id efectivo
      .select(`
        *,
        products (name, category, stock)
      `)
      .single()

    if (movError) throw movError

    await logAction({
      action: 'Movimiento',
      resource: `Producto: ${product.name}`,
      details: {
        product_id,
        product_name: product.name,
        qty,
        type,
        new_stock: newStock
      },
      area: 'Almacén'
    })

    return { ...movement, resulting_stock: newStock }
  })
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
    category: p.category,
    unit_price: p.unit_price,
    stock: p.stock,
    min_stock: p.min_stock,
    currency: p.currency,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }))

  exportToExcel('Productos', rows, `productos_${new Date().toISOString().slice(0, 10)}`)
}

export async function listMovements({ page = 1, pageSize = 10, type = 'all', productId = 'all', startDate = null, endDate = null, userId, businessId } = {}) {
  if (!userId) throw new Error('User ID is required')

  const effectiveUserId = getEffectiveUserUuid(userId, businessId);

  let q = supabase
    .from('movements')
    .select(`
      *,
      products (name, category)
    `, { count: 'exact' })
    .eq('user_id', effectiveUserId) // Filtrar por owner_id efectivo
    .order('created_at', { ascending: false })

  // Filters
  if (type && type !== 'all') {
    q = q.eq('type', type)
  }

  if (productId && productId !== 'all') {
    q = q.eq('product_id', productId)
  }

  if (startDate) {
    q = q.gte('created_at', startDate)
  }

  if (endDate) {
    q = q.lte('created_at', endDate)
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
