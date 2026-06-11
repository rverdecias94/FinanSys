import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getDowngradePreview, applyDowngradeToFree } from '@/services/downgrade'
import { getInventoryAreas } from '@/services/dynamicInventory'
import { getTeamMembers } from '@/services/team'
import { getSupabaseErrorMessage } from '@/services/notifications'
import { clampNonNegativeInt } from '@/components/config/downgrade/downgradeUtils'

export function useDowngradeWizard({
  open,
  currentPlan,
  businessId,
  activeCurrencies,
  onOpenChange,
  onSuccess,
  refreshSubscription,
  refreshUsage,
  refreshPendingPlanRequest,
  refreshCurrencies
}) {
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [preview, setPreview] = useState(null)
  const [areas, setAreas] = useState([])
  const [members, setMembers] = useState([])

  const [stepIndex, setStepIndex] = useState(0)
  const [keepCurrencyId, setKeepCurrencyId] = useState(null)
  const [keepAreaIds, setKeepAreaIds] = useState([])
  const [finalConfirm, setFinalConfirm] = useState(false)

  const sortedAreas = useMemo(() => {
    const list = Array.isArray(areas) ? [...areas] : []
    list.sort((a, b) => {
      const da = new Date(a.created_at || 0).getTime()
      const db = new Date(b.created_at || 0).getTime()
      if (da !== db) return da - db
      return Number(a.id) - Number(b.id)
    })
    return list
  }, [areas])

  const freeLimits = preview?.free_limits || {}
  const areasLimit = clampNonNegativeInt(freeLimits.areas, 5)
  const monthlyTxLimit = clampNonNegativeInt(freeLimits.monthly_transactions, 40)
  const productsLimit = clampNonNegativeInt(freeLimits.products, 40)

  const usage = preview?.usage || {}
  const partnersCount = clampNonNegativeInt(usage.partners, 0)
  const needsCurrencyChoice = activeCurrencies.length > 1
  const needsAreaChoice = sortedAreas.length > areasLimit
  const needsTeamInfo = partnersCount > 0

  const steps = useMemo(() => {
    const s = [{ key: 'summary', title: 'Resumen' }]
    if (needsCurrencyChoice) s.push({ key: 'currency', title: 'Moneda principal' })
    if (needsTeamInfo) s.push({ key: 'team', title: 'Equipo' })
    if (needsAreaChoice) s.push({ key: 'areas', title: 'Áreas editables' })
    s.push({ key: 'final', title: 'Confirmación' })
    return s
  }, [needsCurrencyChoice, needsTeamInfo, needsAreaChoice])

  const stepKey = steps[stepIndex]?.key || 'summary'

  const selectedCurrency = useMemo(() => {
    if (!keepCurrencyId) return null
    return activeCurrencies.find((c) => c.business_currency_id === keepCurrencyId) || null
  }, [activeCurrencies, keepCurrencyId])

  const selectedAreas = useMemo(() => {
    const byId = new Map(sortedAreas.map((a) => [Number(a.id), a]))
    return (keepAreaIds || []).map((id) => byId.get(Number(id))).filter(Boolean)
  }, [sortedAreas, keepAreaIds])

  const canContinue = useMemo(() => {
    if (stepKey === 'currency') return !!keepCurrencyId
    if (stepKey === 'areas') {
      if (sortedAreas.length === 0) return true
      return keepAreaIds.length > 0 && keepAreaIds.length <= areasLimit
    }
    if (stepKey === 'final') return finalConfirm && !!keepCurrencyId
    return true
  }, [stepKey, keepCurrencyId, keepAreaIds.length, areasLimit, finalConfirm, sortedAreas.length])

  const loadAll = useCallback(async () => {
    if (!open) return
    if (currentPlan !== 'premium') {
      setPreview(null)
      return
    }

    setLoading(true)
    try {
      const [p, invAreas, team] = await Promise.all([
        getDowngradePreview(),
        businessId ? getInventoryAreas(businessId) : Promise.resolve([]),
        businessId ? getTeamMembers(businessId) : Promise.resolve([])
      ])
      setPreview(p)
      setAreas(invAreas || [])
      setMembers(team || [])

      const defaultCurrency = activeCurrencies.find((c) => c.is_default) || activeCurrencies[0]
      setKeepCurrencyId(defaultCurrency?.business_currency_id || null)
    } catch (err) {
      const msg = getSupabaseErrorMessage(err)
      toast.error('No se pudo preparar el downgrade', { description: msg })
    } finally {
      setLoading(false)
    }
  }, [open, currentPlan, businessId, activeCurrencies])

  useEffect(() => {
    if (!open) return
    setStepIndex(0)
    setFinalConfirm(false)
    setKeepAreaIds([])
  }, [open])

  useEffect(() => {
    if (!open) return
    loadAll()
  }, [open, loadAll])

  useEffect(() => {
    if (!open) return
    if (!preview) return
    if (!keepCurrencyId && activeCurrencies.length > 0) {
      const defaultCurrency = activeCurrencies.find((c) => c.is_default) || activeCurrencies[0]
      setKeepCurrencyId(defaultCurrency?.business_currency_id || null)
    }
  }, [open, preview, activeCurrencies, keepCurrencyId])

  useEffect(() => {
    if (!open) return
    if (!sortedAreas.length) return
    if (keepAreaIds.length) return

    const initial = (sortedAreas.length <= areasLimit ? sortedAreas : sortedAreas.slice(0, areasLimit)).map((a) => Number(a.id))
    setKeepAreaIds(initial)
  }, [open, sortedAreas, areasLimit, keepAreaIds.length])

  const toggleArea = (id) => {
    const n = Number(id)
    setKeepAreaIds((prev) => {
      const exists = prev.includes(n)
      if (exists) return prev.filter((x) => x !== n)
      if (prev.length >= areasLimit) return prev
      return [...prev, n]
    })
  }

  const goNext = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1))
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0))

  const handleApply = async () => {
    if (!finalConfirm) return
    if (!keepCurrencyId) return

    setApplying(true)
    try {
      await applyDowngradeToFree({ keepCurrencyId, keepAreaIds })

      await Promise.all([
        refreshSubscription?.(),
        refreshUsage?.(),
        refreshPendingPlanRequest?.(),
        refreshCurrencies?.()
      ])

      toast.success('Plan actualizado a Gratuito', {
        description: 'Se aplicaron tus selecciones y los límites del plan.'
      })

      onOpenChange?.(false)
      onSuccess?.()
    } catch (err) {
      const msg = getSupabaseErrorMessage(err)
      toast.error('No se pudo aplicar el downgrade', { description: msg })
    } finally {
      setApplying(false)
    }
  }

  return {
    loading,
    applying,
    preview,
    freeLimits,
    areasLimit,
    monthlyTxLimit,
    productsLimit,
    members,
    sortedAreas,
    stepIndex,
    steps,
    stepKey,
    keepCurrencyId,
    setKeepCurrencyId,
    keepAreaIds,
    toggleArea,
    finalConfirm,
    setFinalConfirm,
    selectedCurrency,
    selectedAreas,
    partnersCount,
    canContinue,
    goNext,
    goBack,
    handleApply
  }
}
