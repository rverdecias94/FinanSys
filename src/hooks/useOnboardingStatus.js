import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { getBusinessSettings } from '@/services/businessSettings'
import { readLocalCache, writeLocalCache } from '@/offline/localCache'

const cacheKeyFor = (businessId) => (businessId ? `onboarding:done:${businessId}` : null)

/**
 * Determina si el OWNER de una cuenta nueva necesita completar la configuración
 * inicial mínima: nombre comercial (business_settings.company.tradeName) +
 * moneda principal (business_currencies.is_default).
 *
 * - Solo aplica a propietarios (isOwner). Los miembros usan el negocio del dueño
 *   y NUNCA ven el asistente.
 * - **Caché local (localStorage):** si en ESTE dispositivo ya se completó el
 *   onboarding, se devuelve `needsOnboarding=false` de inmediato mientras la BD
 *   verifica en segundo plano (evita el parpadeo del wizard al recargar). Si la
 *   BD contradice el flag, el efecto lo corrige y el render se actualiza. En un
 *   dispositivo nuevo (sin flag) siempre se comprueba contra la BD.
 * - Falla "abierto": ante carga o error → needsOnboarding=false (no bloquear).
 *
 * @returns {{ needsOnboarding: boolean, loading: boolean }}
 */
export function useOnboardingStatus() {
  const { session } = useSession()
  const { businessId, isOwner } = useBusiness()
  const { businessCurrencies, loading: currenciesLoading } = useCurrency()

  const enabled = !!session?.user?.id && !!businessId && isOwner
  const cacheKey = cacheKeyFor(businessId)

  const settingsQuery = useQuery({
    queryKey: ['onboarding', 'business-settings', businessId],
    queryFn: () => getBusinessSettings(session?.user?.id, businessId),
    enabled,
    staleTime: 30 * 1000,
    retry: false
  })

  const resolved = enabled && !currenciesLoading && settingsQuery.isSuccess
  const tradeName = settingsQuery.data?.company?.tradeName
  const hasMainCurrency = (businessCurrencies || []).some((c) => c.is_default)
  const dbNeedsOnboarding = !tradeName?.trim() || !hasMainCurrency

  // Persistir el resultado verificado contra BD en localStorage (por negocio).
  useEffect(() => {
    if (!cacheKey || !resolved) return
    writeLocalCache(cacheKey, !dbNeedsOnboarding)
  }, [cacheKey, resolved, dbNeedsOnboarding])

  if (!enabled) return { needsOnboarding: false, loading: false }

  // Verificado contra BD: fuente de verdad.
  if (resolved) return { needsOnboarding: dbNeedsOnboarding, loading: false }

  // Aún verificando: usar el flag local de este dispositivo para evitar parpadeo.
  if (cacheKey && readLocalCache(cacheKey) === true) {
    return { needsOnboarding: false, loading: false }
  }

  return { needsOnboarding: false, loading: true }
}
