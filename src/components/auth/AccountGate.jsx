import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/hooks/useSession'
import { useSubscription } from '@/context/SubscriptionContext'
import { useBusiness } from '@/context/BusinessContext'
import { useAccountStatus } from '@/hooks/useAccountStatus'
import { isSystemAdmin } from '@/services/planRequests'
import { AccountBlockedDialog } from '@/components/auth/AccountBlockedDialog'

// Gate de acceso (Pagos Premium · Fase 3). Muestra un overlay bloqueante cuando:
//  - la cuenta está suspendida/eliminada por el admin, o
//  - el Premium venció y pasó el periodo de gracia (payment_state 'blocked').
// El owner puede pasar a Gratis desde el modal; los miembros solo ven el aviso.
// Falla ABIERTO: ante estado desconocido (offline/cargando) no bloquea. Los
// administradores del sistema nunca se bloquean (necesitan gestionar).
export function AccountGate() {
  const { session } = useSession()
  const { paymentState } = useSubscription()
  const { isOwner } = useBusiness()
  const accountStatus = useAccountStatus()

  const { data: isAdmin } = useQuery({
    queryKey: ['isSystemAdmin'],
    queryFn: isSystemAdmin,
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
    retry: false
  })

  if (isAdmin) return null

  if (accountStatus === 'suspended' || accountStatus === 'deleted') {
    return <AccountBlockedDialog mode="account" accountStatus={accountStatus} />
  }

  if (paymentState === 'blocked') {
    return <AccountBlockedDialog mode={isOwner ? 'owner' : 'member'} />
  }

  return null
}
