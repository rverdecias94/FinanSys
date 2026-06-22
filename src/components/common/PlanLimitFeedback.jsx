/* eslint-disable react/prop-types */
import { useSubscription } from '@/context/SubscriptionContext'
import { cn } from '@/lib/utils'

/**
 * Feedback de límites de la cuenta gratuita, reutilizable en cualquier área.
 * Muestra "{label} restantes: {restantes} / {límite}" SOLO para cuentas free
 * (premium es ilimitado en estas métricas → no renderiza nada).
 *
 * @param {string} metric - clave del límite en PLAN_LIMITS (ej. 'monthly_transactions', 'products', 'areas')
 * @param {string} label - etiqueta visible (ej. 'Transacciones', 'Productos', 'Áreas')
 * @param {number|null} currentCount - conteo actual en pantalla; si se provee, se
 *        usa para calcular lo restante (más exacto que el usage del contexto).
 * @param {number|null} fallbackLimit - límite por defecto si PLAN_LIMITS no lo define.
 * @param {string} className - clases extra de posicionamiento.
 */
export function PlanLimitFeedback({ metric, label, currentCount = null, fallbackLimit = null, className }) {
  const { subscription, PLAN_LIMITS, getRemainingUsage } = useSubscription()
  const plan = subscription?.plan_id || 'free'

  // Solo aplica a cuentas free.
  if (plan !== 'free') return null

  const limit = PLAN_LIMITS?.[plan]?.[metric] ?? fallbackLimit
  if (limit == null || limit === Infinity) return null

  const remaining = currentCount != null
    ? Math.max(0, limit - currentCount)
    : getRemainingUsage(metric)

  return (
    <div className={cn('text-xs font-normal text-muted-foreground', className)}>
      {label} restantes: {remaining} / {limit}
    </div>
  )
}
