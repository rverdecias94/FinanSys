import { getDashboardStats, listOpenAccounts } from '@/services/finanzas'
import { listRecurringTransactions } from '@/services/recurringTransactions'
import { supabase } from '@/config/supabase'
import { getEffectiveUserId } from '@/services/team'
import { buildCashRadar } from '@/utils/cashRadar'

async function listAllOpenAccounts(direction, userId, businessId) {
  const pageSize = 100
  let page = 1
  const rows = []
  // Tope razonable: 500 cuentas abiertas
  while (page <= 5) {
    const res = await listOpenAccounts({
      direction,
      page,
      pageSize,
      userId,
      businessId,
    })
    rows.push(...(res.data || []))
    if (rows.length >= (res.count || 0) || (res.data || []).length < pageSize) break
    page += 1
  }
  return rows
}

async function listLowStockProducts(userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const { data, error } = await supabase
    .from('products')
    .select('id, name, stock, min_stock, category')
    .eq('user_id', effectiveUserId)
    .limit(300)
  if (error) throw error
  return (data || [])
    .filter((p) => Number(p.stock) <= Number(p.min_stock ?? 5))
    .sort((a, b) => Number(a.stock) - Number(b.stock))
    .slice(0, 15)
}

/**
 * Carga datos del negocio y arma el Radar Ultra (proyección de caja).
 * Sin APIs de pago ni modelos externos.
 */
export async function getCashRadar({
  userId,
  businessId,
  baseCurrency = 'USD',
  horizonDays = 30,
} = {}) {
  if (!userId) throw new Error('Se requiere sesión')

  const [stats, recurring, receivables, payables, lowStock] = await Promise.all([
    getDashboardStats(userId, businessId),
    listRecurringTransactions({ userId, businessId }).catch(() => []),
    listAllOpenAccounts('receivable', userId, businessId).catch(() => []),
    listAllOpenAccounts('payable', userId, businessId).catch(() => []),
    listLowStockProducts(userId, businessId).catch(() => []),
  ])

  return buildCashRadar({
    balances: stats?.balance || {},
    baseCurrency,
    horizonDays,
    recurring: (recurring || []).filter((r) => r.is_active !== false),
    receivables,
    payables,
    lowStock,
  })
}
