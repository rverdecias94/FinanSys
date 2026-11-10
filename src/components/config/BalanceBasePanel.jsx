import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { getBalanceConfig, updateBalanceConfig } from '@/services/finanzas'
import { BalanceBaseSection } from '@/components/config/general/BalanceBaseSection'

function toDecimalInput(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return String(n)
}

/**
 * Moneda principal + saldos de apertura (vive en /cuenta/monedas).
 */
export function BalanceBasePanel() {
  const { session } = useSession()
  const { businessId, isOwner } = useBusiness()
  const { businessCurrencies, setMainCurrency, toggleCurrency } = useCurrency()
  const effectiveId = businessId || session?.user?.id

  // Solo monedas activas del negocio (no el catálogo completo).
  const activeCodes = useMemo(() => {
    const fromBusiness = (businessCurrencies || []).map((c) => c.code).filter(Boolean)
    return fromBusiness.length > 0 ? fromBusiness : ['USD']
  }, [businessCurrencies])

  const balanceQuery = useQuery({
    queryKey: ['configuracion', 'balances', effectiveId],
    queryFn: () => getBalanceConfig(session?.user?.id, businessId),
    enabled: !!session?.user?.id && !!effectiveId,
    staleTime: 10_000,
  })

  const balances = useMemo(() => {
    const rows = Array.isArray(balanceQuery.data) ? balanceQuery.data : []
    const map = {}
    for (const r of rows) map[r.currency_code] = r
    return map
  }, [balanceQuery.data])

  const defaultCurrency = useMemo(
    () => businessCurrencies.find((c) => c.is_default)?.code || 'USD',
    [businessCurrencies],
  )

  const [mainCurrency, setMainCurrencyLocal] = useState(defaultCurrency)
  const [initialBalances, setInitialBalances] = useState({})

  useEffect(() => {
    setMainCurrencyLocal(defaultCurrency)
  }, [defaultCurrency])

  useEffect(() => {
    setInitialBalances((prev) => {
      const next = { ...prev }
      for (const code of activeCodes) {
        if (balances[code]?.initial_balance !== undefined) {
          next[code] = toDecimalInput(balances[code].initial_balance)
        } else if (next[code] === undefined) {
          next[code] = ''
        }
      }
      return next
    })
  }, [balances, activeCodes])

  const handleSaveBaseCurrency = async () => {
    if (!isOwner) return
    try {
      const isActive = businessCurrencies.some((c) => c.code === mainCurrency)
      if (!isActive) await toggleCurrency(mainCurrency, true)
      await setMainCurrency(mainCurrency)
      toast.success('Moneda principal actualizada')
    } catch {
      toast.error('No se pudo actualizar la moneda principal')
    }
  }

  const handleUpdateBalances = async () => {
    if (!session?.user?.id || !isOwner) return
    const payload = activeCodes
      .map((code) => {
        const raw = initialBalances[code]
        const n = Number(raw)
        if (!Number.isFinite(n)) return null
        return { currency_code: code, initial_balance: n }
      })
      .filter(Boolean)

    if (payload.length === 0) {
      toast.error('Ingresa al menos un saldo inicial válido')
      return
    }

    try {
      await updateBalanceConfig(session.user.id, businessId, payload)
      await balanceQuery.refetch()
      toast.success('Balance inicial actualizado')
    } catch {
      toast.error('Error al actualizar el balance')
    }
  }

  return (
    <BalanceBaseSection
      isOwner={isOwner}
      mainCurrency={mainCurrency}
      onChangeMainCurrency={setMainCurrencyLocal}
      currencyCodes={activeCodes}
      initialBalances={initialBalances}
      onChangeInitialBalance={(code, value) =>
        setInitialBalances((prev) => ({ ...prev, [code]: value }))
      }
      currentBalances={Object.fromEntries(
        activeCodes.map((code) => [code, toDecimalInput(balances[code]?.current_balance ?? 0)]),
      )}
      onSaveBaseCurrency={handleSaveBaseCurrency}
      onUpdateBalances={handleUpdateBalances}
      isRefreshing={balanceQuery.isFetching}
    />
  )
}
