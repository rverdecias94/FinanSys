import { supabase } from '@/config/supabase'
import { getDashboardStats, getAgingReport } from '@/services/finanzas'
import { getAlmacenStats } from '@/services/almacen'
import { listAuditLogs } from '@/services/auditLogs'
import { listAreas } from '@/services/dynamicInventory'
import { getEffectiveUserId } from '@/services/team'
import { agingOverdue } from '@/utils/aging'

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Snapshot del negocio armado en el cliente (mismos servicios que la UI).
 * Evita fallos de schema cache en la Edge al consultar products.
 */
export async function buildClientBusinessSnapshot({ userId, businessId }) {
  const sources = []
  const snapshot = {
    generated_at: new Date().toISOString(),
    owner_id: businessId || userId,
    built_on: 'client',
  }

  const now = new Date()
  const ownerId = getEffectiveUserId(userId, businessId)

  // Finanzas + CxC/CxP
  try {
    const [stats, agingRecv, agingPay] = await Promise.all([
      getDashboardStats(userId, businessId),
      getAgingReport('receivable').catch(() => []),
      getAgingReport('payable').catch(() => []),
    ])
    snapshot.balances = stats?.balance || {}
    snapshot.month = {
      period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      income_by_currency: stats?.income?.current || {},
      expense_by_currency: stats?.expense?.current || {},
    }
    snapshot.accounts_receivable = (agingRecv || []).map((r) => ({
      currency: r.currency,
      total: num(r.total),
      overdue: agingOverdue(r),
      not_due: num(r.not_due),
    }))
    snapshot.accounts_payable = (agingPay || []).map((r) => ({
      currency: r.currency,
      total: num(r.total),
      overdue: agingOverdue(r),
      not_due: num(r.not_due),
    }))
    sources.push('finanzas', 'cxc', 'cxp', 'reportes')
    snapshot.permissions = { ...(snapshot.permissions || {}), finanzas: true }
  } catch (err) {
    snapshot.finanzas_error = err?.message || 'No se pudo leer finanzas'
    snapshot.permissions = { ...(snapshot.permissions || {}), finanzas: false }
  }

  // Almacén (mismas columnas que usa la UI: sin avg_cost)
  try {
    const [wh, productsRes] = await Promise.all([
      getAlmacenStats(userId, businessId),
      supabase
        .from('products')
        .select('name, stock, min_stock, category')
        .eq('user_id', ownerId)
        .limit(500),
    ])
    const list = productsRes.error ? [] : (productsRes.data || [])
    const lowStock = list
      .filter((p) => num(p.stock) <= num(p.min_stock || 5))
      .sort((a, b) => num(a.stock) - num(b.stock))
      .slice(0, 15)
      .map((p) => ({
        name: p.name,
        stock: num(p.stock),
        min_stock: num(p.min_stock || 5),
        category: p.category,
      }))

    snapshot.warehouse = {
      total_products: wh.totalProducts ?? list.length,
      low_stock_count: wh.lowStockCount ?? lowStock.length,
      low_stock: lowStock,
      top_by_stock: (wh.topProducts || []).map((p) => ({
        name: p.name,
        stock: num(p.stock),
      })),
      distribution: wh.distribution || [],
    }
    sources.push('almacen')
    snapshot.permissions = { ...(snapshot.permissions || {}), warehouse: true }
  } catch (err) {
    snapshot.warehouse = { error: err?.message || 'No se pudo leer almacén' }
    snapshot.permissions = { ...(snapshot.permissions || {}), warehouse: false }
  }

  // Inventario dinámico (áreas)
  try {
    const areas = await listAreas(userId)
    const list = Array.isArray(areas) ? areas : (areas?.data || [])
    snapshot.inventory_areas = {
      count: list.length,
      names: list.slice(0, 20).map((a) => a.name),
    }
    sources.push('inventario')
    snapshot.permissions = { ...(snapshot.permissions || {}), inventory: true }
  } catch (err) {
    snapshot.inventory_areas = { note: err?.message || 'Áreas no disponibles' }
    snapshot.permissions = { ...(snapshot.permissions || {}), inventory: false }
  }

  // Auditoría
  try {
    const { data: logs } = await listAuditLogs({
      businessId: businessId || userId,
      page: 1,
      pageSize: 12,
    })
    snapshot.recent_audit = (logs || []).map((l) => ({
      action: l.action,
      resource: l.resource,
      area: l.area,
      user: l.user_email,
      at: l.created_at,
    }))
    sources.push('bitacora')
    snapshot.permissions = { ...(snapshot.permissions || {}), logs: true }
  } catch (err) {
    snapshot.recent_audit = []
    snapshot.bitacora_error = err?.message
    snapshot.permissions = { ...(snapshot.permissions || {}), logs: false }
  }

  return { snapshot, sources: [...new Set(sources)] }
}
