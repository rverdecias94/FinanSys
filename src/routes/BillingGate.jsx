import { Navigate, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/hooks/useSession'
import { useSubscription } from '@/context/SubscriptionContext'
import { useAccountStatus } from '@/hooks/useAccountStatus'
import { isSystemAdmin } from '@/services/planRequests'
import { PageContentSkeleton } from '@/components/common/pageSkeletons'

/**
 * Impide entrar al panel (SidebarLayout) si el pago está bloqueado o la cuenta
 * suspendida. Redirige a /pago-atrasado. Falla abierto si el estado aún no
 * está resuelto (offline / cargando) — igual que AccountGate histórico.
 */
export default function BillingGate() {
  const { session } = useSession()
  const { paymentState, loading: subLoading } = useSubscription()
  const accountStatus = useAccountStatus()

  const { data: isAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ['isSystemAdmin'],
    queryFn: isSystemAdmin,
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  if (subLoading || adminLoading) {
    return <PageContentSkeleton />
  }

  if (isAdmin) return <Outlet />

  if (accountStatus === 'suspended' || accountStatus === 'deleted') {
    return <Navigate to="/pago-atrasado" replace />
  }

  if (paymentState === 'blocked') {
    return <Navigate to="/pago-atrasado" replace />
  }

  return <Outlet />
}
