import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { getPeriodLock } from '@/services/finanzas'
import { isDateInClosedPeriod } from '@/utils/periodLock'

/**
 * Candado de cierre de período del negocio actual.
 * @returns {{ closedThrough: string|null, isDateLocked: (date) => boolean, isLoading: boolean }}
 */
export function usePeriodLock() {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const userId = session?.user?.id

  const query = useQuery({
    queryKey: ['period-lock', businessId || userId],
    queryFn: () => getPeriodLock(userId, businessId),
    enabled: !!userId,
    staleTime: 30_000,
  })

  const closedThrough = query.data?.closed_through || null

  return {
    closedThrough,
    isLoading: query.isLoading,
    isDateLocked: (date) => isDateInClosedPeriod(date, closedThrough),
  }
}
