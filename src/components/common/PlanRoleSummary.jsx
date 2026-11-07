/* eslint-disable react/prop-types */
import { Crown, Shield, Sparkles, Coins } from 'lucide-react'
import { useSubscription } from '@/context/SubscriptionContext'
import { useBusiness } from '@/context/BusinessContext'
import { planDisplayName } from '@/lib/plans'
import { cn } from '@/lib/utils'

function PlanIcon({ planId, className }) {
  if (planId === 'ultra') return <Sparkles className={className} aria-hidden="true" />
  if (planId === 'premium') return <Crown className={className} aria-hidden="true" />
  return <Coins className={className} aria-hidden="true" />
}

/**
 * Resumen compacto: plan comercial + rol (Propietario o nombre del rol del miembro).
 * Pensado para cabeceras y pie del sidebar — sin añadir entradas de menú.
 */
export function PlanRoleSummary({ className, compact = false }) {
  const { subscription } = useSubscription()
  const { isOwner, roleName } = useBusiness()
  const planId = subscription?.plan_id || 'free'
  const plan = planDisplayName(planId)
  const role = isOwner ? 'Propietario' : (roleName || 'Miembro')

  if (compact) {
    return (
      <div
        className={cn(
          'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground',
          className
        )}
        title={`${plan} · ${role}`}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5 text-foreground">
          <PlanIcon planId={planId} className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">{plan}</span>
        </span>
        <span className="text-muted-foreground/60" aria-hidden="true">·</span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{role}</span>
        </span>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 text-xs font-semibold">
        <PlanIcon planId={planId} className="h-3.5 w-3.5 text-primary" />
        {plan}
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Shield className="h-3.5 w-3.5" aria-hidden="true" />
        {role}
      </span>
    </div>
  )
}
