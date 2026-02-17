/* eslint-disable react/prop-types */
import { useSubscription } from '@/context/SubscriptionContext'
import { Button } from '@/components/ui/button'
import { Lock, Crown } from 'lucide-react'
import { toast } from 'sonner'

export const SubscriptionGuard = ({
  children,
  feature,
  fallback = null,
  showUpgrade = true
}) => {
  const { canAccessFeature, isPremium } = useSubscription()

  const hasAccess = canAccessFeature(feature)

  if (hasAccess) {
    return children
  }

  if (fallback) {
    return fallback
  }

  return (
    <div className="relative">
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-lg">
        <div className="text-center p-4">
          <Lock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-3">
            Esta función requiere un plan Premium
          </p>
          {showUpgrade && (
            <Button
              size="sm"
              onClick={() => {
                toast.info('Actualización requerida', {
                  description: 'Navegando a la página de configuración para actualizar tu plan.'
                })
                window.location.href = '/configuracion'
              }}
              className="gap-2"
            >
              <Crown className="h-4 w-4" />
              Actualizar a Premium
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export const useSubscriptionRestriction = () => {
  const { checkLimit, recordUsage, getRemainingUsage, isPremium, getPlanType } = useSubscription()

  const checkFeatureAccess = (feature, currentCount = null) => {
    return checkLimit(feature, currentCount)
  }

  const recordFeatureUsage = (feature) => {
    recordUsage(feature)
  }

  const getFeatureLimit = (feature) => {
    return getRemainingUsage(feature)
  }

  return {
    checkFeatureAccess,
    recordFeatureUsage,
    getFeatureLimit,
    isPremium: isPremium(),
    planType: getPlanType()
  }
}