/* eslint-disable react/prop-types */
import { Loader2, Wallet } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { useCurrency } from '@/context/CurrencyContext'

/**
 * Loader de marca a pantalla completa mientras se resuelven las comprobaciones
 * iniciales (sesión + negocio + suscripción + monedas). Evita que el usuario vea
 * datos parciales o incorrectos durante el arranque. Respeta tema claro/oscuro.
 */
function BrandedLoader() {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-background">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Wallet className="h-6 w-6" />
        </div>
        <span className="text-2xl font-bold tracking-tight text-foreground">Gestia</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Preparando tu negocio…</span>
      </div>
    </div>
  )
}

/**
 * Bloquea el render de la app con BrandedLoader mientras:
 *  - se comprueba la sesión, o
 *  - hay sesión y aún cargan los contextos (negocio/suscripción/monedas).
 * Si no hay sesión (login/signup), renderiza los children normalmente.
 */
export function AppInitializer({ children }) {
  const { session, loading: sessionLoading } = useSession()
  const { loading: businessLoading } = useBusiness()
  const { loading: subscriptionLoading } = useSubscription()
  const { loading: currencyLoading } = useCurrency()

  const initializing = sessionLoading
    || (!!session && (businessLoading || subscriptionLoading || currencyLoading))

  if (initializing) return <BrandedLoader />
  return children
}
