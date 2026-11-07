import { onlineManager } from '@tanstack/react-query'
import { listOpenAccounts, getAgingReport, getDashboardStats, getRecentActivity } from '@/services/finanzas'
import { listProducts, listProductsForSelection, getAlmacenStats, listMovements } from '@/services/almacen'
import { getInventoryAreas } from '@/services/dynamicInventory'
import { LISTING_PAGE_SIZE } from '@/components/common/ResponsiveListing'
import { prefetchFinanceSnapshot } from '@/offline/prefetchFinanceSnapshot'

export { prefetchFinanceSnapshot }

/** Almacén: stats + selección + 1ª página productos/movimientos. */
export async function prefetchWarehouseSnapshot(queryClient, { userId, businessId } = {}) {
  if (!queryClient || !userId || !businessId) return
  if (!onlineManager.isOnline()) return
  const key = businessId || userId
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ['warehouse', 'stats', key],
      queryFn: () => getAlmacenStats(userId, businessId),
    }),
    queryClient.prefetchQuery({
      queryKey: ['warehouse', 'productsSelection', key],
      queryFn: () => listProductsForSelection({ userId, businessId, limit: 5000 }),
    }),
    queryClient.prefetchQuery({
      queryKey: ['warehouse', 'products', key, { search: '', category: 'all' }, 'rl-page', 1, LISTING_PAGE_SIZE],
      queryFn: () => listProducts({ userId, businessId, page: 1, pageSize: LISTING_PAGE_SIZE, search: '', category: 'all' }),
    }),
    queryClient.prefetchQuery({
      queryKey: ['warehouse', 'movements', key, { type: 'all', productId: 'all' }, 'rl-page', 1, LISTING_PAGE_SIZE],
      queryFn: () => listMovements({
        userId,
        businessId,
        page: 1,
        pageSize: LISTING_PAGE_SIZE,
        type: 'all',
        productId: 'all',
      }),
    }),
  ])
}

/** Por cobrar / pagar + antigüedad. */
export async function prefetchAccountsSnapshot(queryClient, { userId, businessId } = {}) {
  if (!queryClient || !userId || !businessId) return
  if (!onlineManager.isOnline()) return
  const scope = businessId || userId
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ['open-accounts', 'receivable', scope, 'rl-page', 1, LISTING_PAGE_SIZE],
      queryFn: () => listOpenAccounts({ direction: 'receivable', page: 1, pageSize: LISTING_PAGE_SIZE, userId, businessId }),
    }),
    queryClient.prefetchQuery({
      queryKey: ['open-accounts', 'payable', scope, 'rl-page', 1, LISTING_PAGE_SIZE],
      queryFn: () => listOpenAccounts({ direction: 'payable', page: 1, pageSize: LISTING_PAGE_SIZE, userId, businessId }),
    }),
    queryClient.prefetchQuery({
      queryKey: ['aging', 'receivable', scope],
      queryFn: () => getAgingReport('receivable'),
    }),
    queryClient.prefetchQuery({
      queryKey: ['aging', 'payable', scope],
      queryFn: () => getAgingReport('payable'),
    }),
  ])
}

/** Inventario: listado de áreas. */
export async function prefetchInventorySnapshot(queryClient, { userId, businessId } = {}) {
  if (!queryClient || !userId || !businessId) return
  if (!onlineManager.isOnline()) return
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ['inventoryAreas', businessId],
      queryFn: () => getInventoryAreas(businessId),
    }),
  ])
}

/** Panel general: stats + actividad reciente. */
export async function prefetchDashboardSnapshot(queryClient, { userId, businessId } = {}) {
  if (!queryClient || !userId || !businessId) return
  if (!onlineManager.isOnline()) return
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'stats', userId, businessId],
      queryFn: () => getDashboardStats(userId, businessId),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'recentActivity', userId, businessId],
      queryFn: () => getRecentActivity(userId, businessId),
    }),
  ])
}

/** Warm-up amplio al tener sesión+negocio online (Sidebar / AppInitializer). */
export async function prefetchCriticalReadSnapshots(queryClient, ctx) {
  if (!onlineManager.isOnline()) return
  await Promise.allSettled([
    prefetchFinanceSnapshot(queryClient, ctx),
    prefetchWarehouseSnapshot(queryClient, ctx),
    prefetchAccountsSnapshot(queryClient, ctx),
    prefetchInventorySnapshot(queryClient, ctx),
    prefetchDashboardSnapshot(queryClient, ctx),
  ])
}
