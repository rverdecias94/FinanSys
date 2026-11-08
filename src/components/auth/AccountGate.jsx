import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/hooks/useSession'
import { useSubscription } from '@/context/SubscriptionContext'
import { useAccountStatus } from '@/hooks/useAccountStatus'
import { isSystemAdmin } from '@/services/planRequests'

/**
 * Redundancia defensiva dentro del layout: si alguien llega al panel con pago
 * bloqueado, redirige a /pago-atrasado (la vía principal es BillingGate).
 */
export function AccountGate() {
  const { session } = useSession()
  const { paymentState } = useSubscription()
  const accountStatus = useAccountStatus()

  const { data: isAdmin } = useQuery({
    queryKey: ['isSystemAdmin'],
    queryFn: isSystemAdmin,
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  if (isAdmin) return null

  if (accountStatus === 'suspended' || accountStatus === 'deleted') {
    return <Navigate to="/pago-atrasado" replace />
  }

  if (paymentState === 'blocked') {
    return <Navigate to="/pago-atrasado" replace />
  }

  return null
}
