import { startOfMonth, endOfMonth } from 'date-fns'
import { getFilteredTotals, listTransactions } from '@/services/finanzas'
import { LISTING_PAGE_SIZE } from '@/components/common/ResponsiveListing'
import { buildFinanceDateKey } from '@/offline/cacheMeta'
import { onlineManager } from '@tanstack/react-query'

/**
 * Prefetch del período por defecto (mes en curso) para que IndexedDB tenga
 * una copia real aunque el usuario no mueva filtros. Solo online.
 */
export async function prefetchFinanceSnapshot(queryClient, {
  userId,
  businessId,
  currencyFilter = 'all',
  categoryFilter = 'all',
} = {}) {
  if (!queryClient || !userId || !businessId) return
  if (!onlineManager.isOnline()) return

  const now = new Date()
  const startDate = startOfMonth(now).toISOString()
  const endDate = endOfMonth(now).toISOString()
  const dateFilter = { type: 'month', startDate, endDate }
  const dateKey = buildFinanceDateKey(dateFilter)

  const totalsKey = ['filteredTotals', {
    userId: businessId || userId,
    currency: currencyFilter,
    category: categoryFilter,
    dateKey,
  }]
  const listKey = [
    'transactions',
    { userId, businessId, currencyFilter, categoryFilter, dateKey },
    'rl-page',
    1,
    LISTING_PAGE_SIZE,
  ]

  const from = startDate
  const to = endDate
  const currency = currencyFilter !== 'all' ? currencyFilter : undefined
  const category = categoryFilter !== 'all' ? categoryFilter : undefined

  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: totalsKey,
      queryFn: () => getFilteredTotals({
        userId,
        businessId,
        currency,
        category,
        from,
        to,
      }),
    }),
    queryClient.prefetchQuery({
      queryKey: listKey,
      queryFn: () => listTransactions({
        userId,
        businessId,
        page: 1,
        pageSize: LISTING_PAGE_SIZE,
        currency,
        category,
        from,
        to,
      }),
    }),
  ])
}
