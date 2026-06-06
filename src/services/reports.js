import { exportToExcel, exportToPDF } from '@/utils/exportUtils'
import { listTransactions } from '@/services/finanzas'
import { listProducts, listMovements } from '@/services/almacen'
import { supabase } from '@/config/supabase'

function getDateRange(dateRange) {
  const now = new Date()

  if (dateRange === 'year') {
    const from = new Date(now.getFullYear(), 0, 1)
    const to = new Date(now.getFullYear() + 1, 0, 1)
    return { from: from.toISOString(), to: to.toISOString() }
  }

  if (dateRange === 'quarter') {
    const q = Math.floor(now.getMonth() / 3)
    const from = new Date(now.getFullYear(), q * 3, 1)
    const to = new Date(now.getFullYear(), q * 3 + 3, 1)
    return { from: from.toISOString(), to: to.toISOString() }
  }

  if (dateRange === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return { from: from.toISOString(), to: to.toISOString() }
  }

  if (dateRange === 'week') {
    const day = (now.getDay() + 6) % 7
    const from = new Date(now)
    from.setDate(now.getDate() - day)
    from.setHours(0, 0, 0, 0)
    const to = new Date(from)
    to.setDate(from.getDate() + 7)
    return { from: from.toISOString(), to: to.toISOString() }
  }

  return { from: null, to: null }
}

async function getCurrentUserId() {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}

export async function generateReport(type, businessId, { dateRange = 'month' } = {}) {
  const userId = await getCurrentUserId()
  if (!userId || !businessId) return null

  const { from, to } = getDateRange(dateRange)

  if (type === 'financial') {
    const res = await listTransactions({
      from,
      to,
      category: 'all',
      type: 'all',
      currency: 'all',
      userId,
      businessId,
      page: 1,
      pageSize: 200,
    })
    return res?.data || []
  }

  if (type === 'warehouse') {
    const [products, movements] = await Promise.all([
      listProducts({ page: 1, pageSize: 200, userId, businessId }),
      listMovements({ page: 1, pageSize: 200, startDate: from, endDate: to, userId, businessId })
    ])
    return {
      products: products?.data || [],
      movements: movements?.data || [],
    }
  }

  if (type === 'inventory') {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('user_id', businessId)
      .limit(500)

    if (error) throw error
    return data || []
  }

  return null
}

export async function exportReport(type, businessId, { dateRange = 'month', format = 'pdf' } = {}) {
  const data = await generateReport(type, businessId, { dateRange })
  if (!data) return

  const filename = `reporte_${type}_${dateRange}_${new Date().toISOString().slice(0, 10)}`

  if (type === 'financial') {
    const rows = data
    if (format === 'xlsx') {
      exportToExcel('Finanzas', rows, filename)
      return
    }

    const headers = ['Fecha', 'Tipo', 'Categoría', 'Monto', 'Moneda', 'Descripción']
    const body = rows.map(r => [
      r.date ? new Date(r.date).toLocaleString() : '',
      r.type,
      r.category,
      r.amount,
      r.currency,
      r.description || ''
    ])
    exportToPDF('Reporte Financiero', headers, body, filename)
    return
  }

  if (type === 'warehouse') {
    const payload = data
    const products = payload?.products || []
    const movements = payload?.movements || []

    if (format === 'xlsx') {
      exportToExcel('Productos', products, `${filename}_productos`)
      exportToExcel('Movimientos', movements, `${filename}_movimientos`)
      return
    }

    exportToPDF(
      'Reporte de Productos',
      ['Nombre', 'Categoría', 'Precio', 'Stock', 'Moneda'],
      products.map(p => [p.name, p.category, p.unit_price, p.stock, p.currency]),
      `${filename}_productos`
    )

    exportToPDF(
      'Reporte de Movimientos',
      ['Fecha', 'Producto', 'Tipo', 'Cantidad'],
      movements.map(m => [m.created_at ? new Date(m.created_at).toLocaleString() : '', m.product_id, m.type, m.qty]),
      `${filename}_movimientos`
    )

    return
  }

  if (type === 'inventory') {
    const rows = data
    if (format === 'xlsx') {
      exportToExcel('Inventario', rows, filename)
      return
    }

    const headers = ['ID', 'Área', 'SKU', 'Valores']
    const body = rows.map(r => [r.id, r.area_id, r.sku || '', JSON.stringify(r.values || {})])
    exportToPDF('Reporte de Inventario', headers, body, filename)
  }
}

