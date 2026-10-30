/* eslint-disable react/prop-types */
import { useSubscription } from '@/context/SubscriptionContext'
import { cn } from '@/lib/utils'

/**
 * Muestra consumo vs límite del plan activo.
 * Formato: "{label}: {usado} / {límite}" o "{label}: Ilimitado".
 */
export function PlanLimitFeedback({ metric, label, currentCount = null, fallbackLimit = null, className }) {
  const { subscription, PLAN_LIMITS, usage } = useSubscription()
  const planId = subscription?.plan_id || 'free'
  const limit = PLAN_LIMITS?.[planId]?.[metric] ?? fallbackLimit

  if (limit == null) return null

  if (limit === Infinity) {
    return (
      <div className={cn('text-xs font-normal text-muted-foreground', className)}>
        {label}: Ilimitado
      </div>
    )
  }

  const used = currentCount != null ? currentCount : (usage?.[metric] ?? 0)

  return (
    <div className={cn('text-xs font-normal text-muted-foreground', className)}>
      {label}: {used} / {limit}
    </div>
  )
}
