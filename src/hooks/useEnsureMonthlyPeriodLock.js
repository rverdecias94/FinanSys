import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getBusinessSettings } from '@/services/businessSettings'
import { getPeriodLock, setPeriodLock } from '@/services/finanzas'
import { nextAutoClosedThrough, normalizePeriodLockSettings } from '@/utils/periodLockRules'

/**
 * Si el negocio tiene cierre mensual, avanza closed_through al entrar al panel
 * (una vez por sesión / cambio de negocio).
 */
export function useEnsureMonthlyPeriodLock() {
  const { session } = useSession()
  const { businessId, isOwner } = useBusiness()
  const online = useOnlineStatus()
  const qc = useQueryClient()
  const userId = session?.user?.id
  const ranKey = useRef('')

  const settingsQuery = useQuery({
    queryKey: ['configuracion', 'general-settings', businessId || userId],
    queryFn: () => getBusinessSettings(userId, businessId),
    enabled: !!userId && !!businessId && isOwner && online,
    staleTime: 30_000,
  })

  const lockQuery = useQuery({
    queryKey: ['period-lock', businessId || userId],
    queryFn: () => getPeriodLock(userId, businessId),
    enabled: !!userId && isOwner && online,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!isOwner || !online || !userId || !businessId) return
    if (settingsQuery.isLoading || lockQuery.isLoading) return

    const settings = normalizePeriodLockSettings(settingsQuery.data?.period)
    if (settings.mode !== 'monthly') return

    const next = nextAutoClosedThrough({
      settings,
      currentClosedThrough: lockQuery.data?.closed_through || null,
    })
    if (!next) return

    const key = `${businessId}:${next}`
    if (ranKey.current === key) return
    ranKey.current = key

    let cancelled = false
    ;(async () => {
      try {
        await setPeriodLock(next, userId)
        if (cancelled) return
        qc.invalidateQueries({ queryKey: ['period-lock'] })
      } catch {
        ranKey.current = ''
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    isOwner,
    online,
    userId,
    businessId,
    settingsQuery.data,
    settingsQuery.isLoading,
    lockQuery.data,
    lockQuery.isLoading,
    qc,
  ])
}
