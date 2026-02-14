import { supabase } from '@/config/supabase'
import { withCrud } from '@/services/notifyWrap'

export async function listProducts({ page = 1, pageSize = 10, search = '', category = 'all', stockStatus = 'all', userUuid } = {}) {
  if (!userUuid) throw new Error('User UUID is required for security isolation')

  let q = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('user_id', userUuid)
    .order('name', { ascending: true })

  // Filters
  if (search) {
    q = q.ilike('name', `%${search}%`)
  }

  if (category && category !== 'all') {
    q = q.eq('category', category)
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

export async function getProduct(id, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('user_id', userUuid)
    .single()
  if (error) throw error
  return data
}

export async function createProduct(payload, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')

  return await withCrud({ action: 'create', table: 'products' }, async () => {
    const { data, error } = await supabase
      .from('products')
      .insert({ ...payload, user_id: userUuid })
      .select()
      .single()
    if (error) throw error
    return data
  })
}

export async function updateProduct(id, payload, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')

  return await withCrud({ action: 'update', table: 'products' }, async () => {
    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userUuid)
      .select()
      .single()
    if (error) throw error
    return data
  })
}

export async function deleteProduct(id, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')

  return await withCrud({ action: 'delete', table: 'products' }, async () => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('user_id', userUuid)
    if (error) throw error
    return true
  })
}

export async function registerMovement({ product_id, qty, type, user_id }) {
  if (!user_id) throw new Error('User UUID is required')

  return await withCrud({ action: 'register', table: 'movements' }, async () => {
    const { data: product, error: prodError } = await supabase
      .from('products')
      .select('id, stock')
      .eq('id', product_id)
      .eq('user_id', user_id)
      .single()

    if (prodError || !product) {
      await supabase.from('access_audit_logs').insert({
        user_id: user_id,
        action: 'unauthorized_movement_attempt',
        resource: `product_${product_id}`,
        details: { product_id, qty, type }
      })

      console.error('Security Alert: Attempt to access unauthorized product', { product_id, user_id })
      throw new Error('Access Denied: Product does not belong to user')
    }

    const { data: movement, error: movError } = await supabase
      .from('movements')
      .insert({ product_id, qty, type, user_id })
      .select()
      .single()

    if (movError) throw movError

    const newStock = type === 'in'
      ? Number(product.stock) + Number(qty)
      : Number(product.stock) - Number(qty)

    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', product_id)
      .eq('user_id', user_id)

    if (updateError) throw updateError

    return movement
  })
}

export async function listMovements({ page = 1, pageSize = 10, type = 'all', productId = 'all', startDate = null, endDate = null, userUuid } = {}) {
  if (!userUuid) throw new Error('User UUID is required')

  let q = supabase
    .from('movements')
    .select(`
      *,
      products (name, category)
    `, { count: 'exact' })
    .eq('user_id', userUuid)
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

export async function getAlmacenStats(userUuid) {
  if (!userUuid) throw new Error('User UUID is required')

  // Fetch products and movements in parallel
  const [productsResponse, movementsResponse] = await Promise.all([
    supabase
      .from('products')
      .select('name, stock, min_stock, category')
      .eq('user_id', userUuid),
    supabase
      .from('movements')
      .select('qty, type, created_at')
      .eq('user_id', userUuid)
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
