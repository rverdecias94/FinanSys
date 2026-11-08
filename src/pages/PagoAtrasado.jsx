import { useState } from 'react'
import { AlertTriangle, ArrowDownCircle, LogOut, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import BrandLogo from '@/components/BrandLogo'
import { supabase } from '@/config/supabase'
import { useSession } from '@/hooks/useSession'
import { useSubscription } from '@/context/SubscriptionContext'
import { useBusiness } from '@/context/BusinessContext'
import { useAccountStatus } from '@/hooks/useAccountStatus'
import { isSystemAdmin } from '@/services/planRequests'
import { DowngradeToFreeDialog } from '@/components/config/DowngradeToFreeDialog'
import { planDisplayName } from '@/lib/plans'

/**
 * Ruta auxiliar (sin sidebar): plan de pago vencido / cuenta suspendida.
 * El usuario autenticado NO entra al panel hasta regularizar o bajar a Inicial.
 */
export default function PagoAtrasado() {
  const navigate = useNavigate()
  const { session, loading: sessionLoading } = useSession()
  const { paymentState, refreshSubscription, loading: subLoading } = useSubscription()
  const { isOwner } = useBusiness()
  const accountStatus = useAccountStatus()
  const [downgradeOpen, setDowngradeOpen] = useState(false)

  const { data: isAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ['isSystemAdmin'],
    queryFn: isSystemAdmin,
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  // Si ya no está bloqueado (p. ej. admin registró pago), volver al panel.
  const accountBlocked = accountStatus === 'suspended' || accountStatus === 'deleted'
  const paymentBlocked = paymentState === 'blocked'
  const stillBlocked = accountBlocked || paymentBlocked

  if (!sessionLoading && !session) {
    navigate('/login', { replace: true })
    return null
  }

  if (isAdmin) {
    navigate('/', { replace: true })
    return null
  }

  if (!sessionLoading && !subLoading && !adminLoading && session && !stillBlocked) {
    navigate('/', { replace: true })
    return null
  }

  if (sessionLoading || subLoading || adminLoading || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    )
  }

  let title = 'Acceso no disponible'
  let desc = 'Contacta al administrador.'
  let mode = 'owner'

  if (accountBlocked) {
    mode = 'account'
    title = accountStatus === 'deleted' ? 'Cuenta eliminada' : 'Cuenta suspendida'
    desc = 'Un administrador suspendió el acceso a esta cuenta. Contáctalo para más información.'
  } else if (!isOwner) {
    mode = 'member'
    title = 'Pago del negocio pendiente'
    desc = `El plan de pago del negocio venció y el periodo de gracia terminó. Pide al propietario o al administrador que regularice el pago para restaurar el acceso del equipo.`
  } else {
    mode = 'owner'
    title = 'Tu plan de pago ha vencido'
    desc = `No registramos el pago a tiempo y el periodo de gracia terminó. Para continuar con ${planDisplayName('premium')} o ${planDisplayName('ultra')}, contacta al administrador y regulariza el pago. También puedes pasar al ${planDisplayName('free')} y seguir con las funciones básicas (algunos datos quedarán limitados).`
  }

  return (
    <>
      {!downgradeOpen && (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
          <div className="mb-8">
            <BrandLogo className="h-10 w-auto object-contain" />
          </div>
          <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-lg sm:p-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
            </div>
            <h1 className="text-lg font-semibold text-foreground sm:text-xl">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>

            <div className="mt-6 flex flex-col gap-2">
              {mode === 'owner' && (
                <Button onClick={() => setDowngradeOpen(true)} className="h-11 w-full">
                  <ArrowDownCircle className="mr-2 h-4 w-4" />
                  Cambiar a {planDisplayName('free')}
                </Button>
              )}
              <Button variant="outline" onClick={handleLogout} className="h-11 w-full">
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      )}

      {mode === 'owner' && downgradeOpen && (
        <DowngradeToFreeDialog
          open={downgradeOpen}
          onOpenChange={setDowngradeOpen}
          onSuccess={async () => {
            setDowngradeOpen(false)
            await refreshSubscription()
            navigate('/', { replace: true })
          }}
        />
      )}
    </>
  )
}
