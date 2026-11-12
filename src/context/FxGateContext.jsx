/* eslint-disable react/prop-types */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getBusinessSettings } from '@/services/businessSettings'
import { getExchangeRates } from '@/services/exchangeRates'
import {
  FX_REQUIRED_REASONS,
  hasTodayFxRates,
  normalizeFxSettings,
  todayLocalIso,
} from '@/utils/dailyFxReminder'
import { DailyFxRateModal } from '@/components/config/DailyFxRateModal'
import { fxCupPromptCurrencies, fxCupStorageCodesForCheck } from '@/utils/fxPrompt'

const FxGateContext = createContext(null)

/**
 * Soft: modal al entrar (postergable).
 * Hard: ensureTodayFx() abre el mismo modal sin "Más tarde" si falta la tasa de hoy.
 */
export function FxGateProvider({ children }) {
  const { session } = useSession()
  const { businessId, isOwner } = useBusiness()
  const { businessCurrencies } = useCurrency()
  const online = useOnlineStatus()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const defaultCode = useMemo(
    () => businessCurrencies.find((c) => c.is_default)?.code,
    [businessCurrencies]
  )
  const ratedCurrencyCodes = useMemo(() => {
    const active = businessCurrencies.map((c) => c.code).filter(Boolean)
    const prompts = fxCupPromptCurrencies(defaultCode, active)
    return fxCupStorageCodesForCheck(prompts, defaultCode)
  }, [businessCurrencies, defaultCode])

  const settingsQuery = useQuery({
    queryKey: ['configuracion', 'general-settings', businessId || userId],
    queryFn: () => getBusinessSettings(userId, businessId),
    enabled: !!userId && !!businessId && online,
    staleTime: 30_000,
  })

  const ratesQuery = useQuery({
    queryKey: ['exchangeRates', userId, businessId],
    queryFn: () => getExchangeRates(userId, businessId),
    enabled: !!userId && !!businessId && online && ratedCurrencyCodes.length > 0,
    staleTime: 15_000,
  })

  const fx = normalizeFxSettings(settingsQuery.data?.fx)
  const rates = ratesQuery.data || {}
  const today = todayLocalIso()

  const hasToday = hasTodayFxRates({
    ratedCurrencyCodes,
    ratesMap: rates,
    today,
  })

  const [requiredGate, setRequiredGate] = useState(null) // { reason, resolve }
  const pendingRef = useRef(null)

  const clearRequired = useCallback((ok) => {
    const pending = pendingRef.current
    pendingRef.current = null
    setRequiredGate(null)
    if (pending?.resolve) pending.resolve(ok)
  }, [])

  const ensureTodayFx = useCallback(
    async ({ reasonKey = 'warehouse_in', reason } = {}) => {
      if (!ratedCurrencyCodes.length) return true
      if (!online) {
        toast.error('Sin conexión no se puede comprobar la tasa de hoy. Inténtalo en línea.')
        throw new Error('FX_OFFLINE')
      }

      const fresh = await queryClient.fetchQuery({
        queryKey: ['exchangeRates', userId, businessId],
        queryFn: () => getExchangeRates(userId, businessId),
      })

      if (
        hasTodayFxRates({
          ratedCurrencyCodes,
          ratesMap: fresh || {},
          today: todayLocalIso(),
        })
      ) {
        return true
      }

      if (!isOwner) {
        toast.error(
          'Falta la tasa de hoy. Pídele al titular del negocio que la registre antes de continuar.'
        )
        throw new Error('FX_OWNER_REQUIRED')
      }

      const message = reason || FX_REQUIRED_REASONS[reasonKey] || FX_REQUIRED_REASONS.warehouse_in

      return new Promise((resolve) => {
        pendingRef.current = { resolve }
        setRequiredGate({ reason: message })
      })
    },
    [ratedCurrencyCodes, online, queryClient, userId, businessId, isOwner]
  )

  const value = useMemo(
    () => ({
      ensureTodayFx,
      hasTodayFx: hasToday,
      ratedCurrencyCodes,
      fxSettings: fx,
      ratesLoading: ratesQuery.isLoading || settingsQuery.isLoading,
    }),
    [ensureTodayFx, hasToday, ratedCurrencyCodes, fx, ratesQuery.isLoading, settingsQuery.isLoading]
  )

  return (
    <FxGateContext.Provider value={value}>
      {children}
      <DailyFxRateModal
        requiredGate={requiredGate}
        onRequiredSatisfied={() => clearRequired(true)}
        onRequiredAbandoned={() => clearRequired(false)}
      />
    </FxGateContext.Provider>
  )
}

export function useFxGate() {
  const ctx = useContext(FxGateContext)
  // Fuera del provider (tests / pantallas sueltas): no bloquear.
  if (!ctx) {
    return {
      ensureTodayFx: async () => true,
      hasTodayFx: true,
      ratedCurrencyCodes: [],
      fxSettings: normalizeFxSettings(null),
      ratesLoading: false,
    }
  }
  return ctx
}
