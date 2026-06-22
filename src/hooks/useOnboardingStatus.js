import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { getBusinessSettings } from '@/services/businessSettings'

/**
 * Determina si el OWNER de una cuenta nueva necesita completar la configuración
 * inicial mínima: nombre comercial (business_settings.company.tradeName) +
 * moneda principal (business_currencies.is_default).
 *
 * - Solo aplica a propietarios (isOwner). Los miembros usan el negocio del dueño
 *   y NUNCA ven el asistente.
 * - Falla "abierto": ante carga o error → needsOnboarding=false (no bloquear la
 *   app por un problema de red).
 *
 * @returns {{ needsOnboarding: boolean, loading: boolean }}
 */
export function useOnboardingStatus() {
  const { session } = useSession()
  const { businessId, isOwner } = useBusiness()
  const { businessCurrencies, loading: currenciesLoading } = useCurrency()

  const enabled = !!session?.user?.id && !!businessId && isOwner

  const settingsQuery = useQuery({
    queryKey: ['onboarding', 'business-settings', businessId],
    queryFn: () => getBusinessSettings(session?.user?.id, businessId),
    enabled,
    staleTime: 30 * 1000,
    retry: false
  })

  if (!enabled) return { needsOnboarding: false, loading: false }
  if (currenciesLoading || settingsQuery.isLoading || !settingsQuery.isSuccess) {
    return { needsOnboarding: false, loading: true }
  }

  const tradeName = settingsQuery.data?.company?.tradeName
  const hasMainCurrency = (businessCurrencies || []).some((c) => c.is_default)
  const needsOnboarding = !tradeName?.trim() || !hasMainCurrency

  return { needsOnboarding, loading: false }
}
