import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/config/supabase'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { toast } from 'sonner'
import { logAction } from '@/services/auditLogger'
import { cancelMyPendingPlanChangeRequest, getPendingPlanRequest, requestPlanChange } from '@/services/planRequests'

const SubscriptionContext = createContext({})

export const useSubscription = () => useContext(SubscriptionContext)

export const SubscriptionProvider = ({ children }) => {
  const { session } = useSession()
  const { businessId, isOwner, loading: businessLoading } = useBusiness()
  const [subscription, setSubscription] = useState(null)
  const [pendingPlanRequest, setPendingPlanRequest] = useState(null)
  const [usage, setUsage] = useState({})
  const [loading, setLoading] = useState(true)

  const FALLBACK_PLAN_LIMITS = {
    free: {
      monthly_transactions: 40,
      products: 40,
      areas: 5,
      reports_export: false,
      audit_logs: false,
      partners: 0,
      watermark: true
    },
    premium: {
      monthly_transactions: Infinity,
      products: Infinity,
      areas: Infinity,
      reports_export: true,
      audit_logs: true,
      partners: 5,
      watermark: false
    }
  }

  const [PLAN_LIMITS, setPlanLimits] = useState(FALLBACK_PLAN_LIMITS)

  const normalizePlanLimits = (raw) => {
    const out = { ...FALLBACK_PLAN_LIMITS }
    for (const p of raw || []) {
      if (!p?.id) continue
      const limits = p.limits || {}
      const features = p.features || {}

      const merged = { ...(out[p.id] || {}) }

      for (const [k, v] of Object.entries(limits)) {
        const n = Number(v)
        if (!Number.isFinite(n)) continue
        merged[k] = n < 0 ? Infinity : n
      }

      for (const [k, v] of Object.entries(features)) {
        if (typeof v === 'boolean') merged[k] = v
      }

      out[p.id] = merged
    }
    return out
  }

  const getRemainingUsage = (metricKey) => {
    if (!subscription) return 0
    const plan = PLAN_LIMITS[subscription.plan_id] || PLAN_LIMITS.free
    const limit = plan[metricKey]
    if (limit === Infinity) return Infinity

    // For areas, we don't have usage in usage_metrics, we rely on the component to check current count
    // But for transactions/products we do.
    // If usage[metricKey] is undefined, it's 0.
    return Math.max(0, limit - (usage[metricKey] || 0))
  }

  useEffect(() => {
    if (session?.user && businessId && !businessLoading) {
      fetchSubscription()
      fetchPlanLimits()
      fetchUsage()
      fetchPendingPlanRequest()
    } else if (!session?.user) {
      setLoading(false)
    }
  }, [session, businessId, businessLoading])

  const fetchPlanLimits = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('id, features, limits')
      if (error) return
      setPlanLimits(normalizePlanLimits(data))
    } catch {
      return
    }
  }

  const fetchSubscription = async () => {
    if (!businessId) return

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', businessId) // Use businessId (owner) for subscription
        .single()

      if (error && error.code !== 'PGRST116') {
        setSubscription({ plan_id: 'free', status: 'active' })
        return
      }

      if (!data) {
        // Create default free subscription if none exists
        // Only if we are the owner. If we are a member and owner has no sub, it's weird but we shouldn't create it.
        if (isOwner) {
          const { data: newSub, error: createError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: businessId,
              plan_id: 'free',
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single()

          if (createError) {
            // Fallback a objeto por defecto
            setSubscription({ plan_id: 'free', status: 'active' })
          } else {
            setSubscription(newSub)
            toast.success('Suscripción creada', {
              description: 'Se ha asignado un plan gratuito a tu cuenta.'
            })
          }
        } else {
          // Member viewing owner without sub? Fallback to free limits
          setSubscription({ plan_id: 'free', status: 'active' })
        }
      } else {
        setSubscription(data)
      }
    } catch {
      // Fallback a plan gratuito en caso de error
      setSubscription({ plan_id: 'free', status: 'active' })
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingPlanRequest = async () => {
    if (!businessId) return

    try {
      const request = await getPendingPlanRequest(businessId)
      setPendingPlanRequest(request)
    } catch {
      setPendingPlanRequest(null)
    }
  }

  const fetchUsage = async () => {
    if (!businessId) return

    try {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const startOfMonthStr = startOfMonth.toISOString()

      // Fetch Real Counts from Tables
      const [
        transactionsResult,
        productsResult,
        areasResult
      ] = await Promise.all([
        supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', businessId) // Use businessId
          .gte('date', startOfMonthStr),
        supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', businessId), // Use businessId
        // For inventory areas, count from inventory_areas table
        supabase
          .from('inventory_areas')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', businessId) // Use businessId
      ])

      setUsage({
        monthly_transactions: transactionsResult.count || 0,
        products: productsResult.count || 0,
        areas: areasResult.count || 0
      })
    } catch {
      // Fallback to empty usage on error
      setUsage({
        monthly_transactions: 0,
        products: 0,
        areas: 0
      })
    }
  }

  const checkLimit = (metricKey, currentCountOverride = null) => {
    if (!subscription) return false
    const plan = PLAN_LIMITS[subscription.plan_id] || PLAN_LIMITS.free
    const limit = plan[metricKey]
    const currentUsage = currentCountOverride !== null ? currentCountOverride : (usage[metricKey] || 0)

    if (limit === Infinity) return true

    // Check 80% warning
    if (limit > 0 && currentUsage >= limit * 0.8 && currentUsage < limit) {
      toast.warning(`Has consumido el ${Math.round((currentUsage / limit) * 100)}% de tu límite.`, {
        description: 'Actualiza a Premium para evitar interrupciones.',
        action: {
          label: 'Ver Planes',
          onClick: () => window.location.href = '/configuracion'
        }
      })
    }

    if (currentUsage >= limit) {
      toast.error('Límite del plan alcanzado', {
        description: 'Has alcanzado el límite para tu plan actual. Actualiza a Premium para continuar.',
      })
      return false
    }

    return true
  }

  const updatePlan = async (planId) => {
    if (!isOwner) {
      toast.error('Solo el propietario puede actualizar el plan.')
      return
    }

    if (planId === 'premium') {
      toast.error('El plan Premium requiere aprobación manual.', {
        description: 'Envía una solicitud de Premium para que podamos revisarla.'
      })
      return
    }

    try {
      setLoading(true)

      // Log action before updating (so we capture downgrades from Premium)
      await logAction({
        action: 'Actualizar',
        resource: `Plan de Suscripción: ${planId}`,
        details: { old_plan: subscription?.plan_id, new_plan: planId },
        area: 'Configuración'
      })

      const { error } = await supabase
        .from('subscriptions')
        .update({
          plan_id: planId,
          status: 'active',
          // Clear trial fields if switching plans manually
          trial_start_at: null,
          trial_end_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', businessId)

      if (error) throw error

      // Refresh subscription and usage data
      await fetchSubscription()
      await fetchUsage()
      await fetchPendingPlanRequest()

      toast.success(`Plan actualizado a ${planId === 'premium' ? 'Premium' : 'Gratuito'}`, {
        description: 'Los límites y accesos del plan ya fueron actualizados.',
        duration: 3000
      })
    } catch {
      toast.error('Error al actualizar el plan')
    } finally {
      setLoading(false)
    }
  }

  const activateTrial = async () => {
    await requestPremium()
  }

  const requestPremium = async ({
    requestedMonths = 1,
    contactPhone = '',
    paymentMethod = '',
    paymentReference = '',
    userNotes = ''
  } = {}) => {
    if (!isOwner) {
      toast.error('Solo el propietario puede solicitar Premium.')
      return null
    }

    if (pendingPlanRequest) {
      toast.info('Ya tienes una solicitud Premium pendiente.')
      return pendingPlanRequest
    }

    try {
      setLoading(true)
      const result = await requestPlanChange({
        targetPlanId: 'premium',
        requestedMonths,
        contactPhone,
        paymentMethod,
        paymentReference,
        userNotes
      })

      await fetchPendingPlanRequest()

      toast.success('Solicitud Premium enviada', {
        description: 'Revisaremos tu solicitud y te contactaremos para confirmar la activación.'
      })

      return result
    } catch (error) {
      const msg = error?.message || 'No se pudo enviar la solicitud Premium.'
      toast.error('Error al solicitar Premium', { description: msg })
      return null
    } finally {
      setLoading(false)
    }
  }

  const cancelPendingPremiumRequest = async () => {
    if (!isOwner) {
      toast.error('Solo el propietario puede cancelar la solicitud.')
      return null
    }

    if (!pendingPlanRequest) {
      toast.info('No hay una solicitud pendiente.')
      return null
    }

    try {
      setLoading(true)
      const result = await cancelMyPendingPlanChangeRequest()
      await fetchPendingPlanRequest()
      toast.success('Solicitud cancelada')
      return result
    } catch (error) {
      const msg = error?.message || 'No se pudo cancelar la solicitud.'
      toast.error('Error al cancelar', { description: msg })
      return null
    } finally {
      setLoading(false)
    }
  }

  const recordUsage = async (metricKey) => {
    // We just refetch usage to ensure we have the latest count from DB
    // No need to manually increment usage_metrics table anymore since we count real rows
    setTimeout(() => {
      fetchUsage()
    }, 500) // Small delay to ensure DB write happened
  }

  const canAccessFeature = (featureKey) => {
    if (!subscription) return false
    const plan = PLAN_LIMITS[subscription.plan_id] || PLAN_LIMITS.free
    return plan[featureKey] === true || plan[featureKey] === Infinity || plan[featureKey] > 0
  }

  const getPlanType = () => {
    if (!subscription) return 'free'
    return subscription.plan_id || 'free'
  }

  const isPremium = () => {
    if (!subscription) return false
    if (subscription.plan_id !== 'premium') return false
    if (subscription.status === 'active') return true
    if (subscription.status === 'trial' && subscription.trial_end_at) {
      return new Date(subscription.trial_end_at).getTime() > Date.now()
    }
    return false
  }

  return (
    <SubscriptionContext.Provider value={{
      subscription,
      loading,
      checkLimit,
      recordUsage,
      getRemainingUsage,
      canAccessFeature,
      updatePlan,
      requestPremium,
      cancelPendingPremiumRequest,
      activateTrial, // Keep for backward compatibility
      pendingPlanRequest,
      refreshPendingPlanRequest: fetchPendingPlanRequest,
      getPlanType,
      isPremium,
      PLAN_LIMITS
    }}>
      {children}
    </SubscriptionContext.Provider>
  )
}
