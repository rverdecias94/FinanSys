import { supabase } from '@/config/supabase'

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

  const { data, error } = await supabase
    .from('products')
    .insert({ ...payload, user_id: userUuid })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProduct(id, payload, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')

  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userUuid)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteProduct(id, userUuid) {
  if (!userUuid) throw new Error('User UUID is required')

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .eq('user_id', userUuid)
  if (error) throw error
  return true
}

export async function registerMovement({ product_id, qty, type, user_id }) {
  if (!user_id) throw new Error('User UUID is required')

  // 1. Verify ownership and get current stock
  const { data: product, error: prodError } = await supabase
    .from('products')
    .select('id, stock')
    .eq('id', product_id)
    .eq('user_id', user_id)
    .single()

  if (prodError || !product) {
    // Log security attempt to DB
    await supabase.from('access_audit_logs').insert({
      user_id: user_id,
      action: 'unauthorized_movement_attempt',
      resource: `product_${product_id}`,
      details: { product_id, qty, type }
    })

    console.error('Security Alert: Attempt to access unauthorized product', { product_id, user_id })
    throw new Error('Access Denied: Product does not belong to user')
  }

  // 2. Register movement
  const { data: movement, error: movError } = await supabase
    .from('movements')
    .insert({ product_id, qty, type, user_id })
    .select()
    .single()

  if (movError) throw movError

  // 3. Update product stock
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

  const { data: products, error } = await supabase
    .from('products')
    .select('stock, min_stock, category')
    .eq('user_id', userUuid)

  if (error) throw error

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

  return {
    totalProducts,
    lowStockCount,
    distribution: distributionData
  }
}
