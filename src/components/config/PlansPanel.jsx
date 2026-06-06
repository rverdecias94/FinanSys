import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSubscription } from '@/context/SubscriptionContext'
import { useBusiness } from '@/context/BusinessContext'
import { Check, Crown, Shield } from 'lucide-react'

export function PlansPanel() {
  const { subscription, loading, updatePlan } = useSubscription()
  const { isOwner } = useBusiness()

  const currentPlan = subscription?.plan_id || 'free'

  const plans = useMemo(
    () => [
      {
        id: 'free',
        title: 'Plan Gratuito',
        subtitle: 'Ideal para empezar',
        icon: <Shield className="h-5 w-5" />,
        highlights: [
          '40 Transacciones / mes',
          '40 Productos',
          '5 Áreas de Inventario',
          '1 Moneda Activa',
          'Reportes Básicos (Solo lectura)',
          'Sin Socios'
        ]
      },
      {
        id: 'premium',
        title: 'Plan Premium',
        subtitle: 'Para operaciones completas',
        icon: <Crown className="h-5 w-5" />,
        highlights: [
          'Transacciones Ilimitadas',
          'Productos Ilimitados',
          'Áreas Ilimitadas',
          'Múltiples Monedas',
          'Reportes Avanzados + Exportación',
          'Hasta 5 Socios',
          'Logs de Auditoría'
        ]
      }
    ],
    []
  )

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Planes</h3>
        <p className="text-sm text-muted-foreground">Compara los planes y revisa el plan actual del negocio.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id
          const isPremium = plan.id === 'premium'
          return (
            <Card key={plan.id} className={isCurrent ? 'border-primary/40 bg-primary/5' : undefined}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <span className={isPremium ? 'text-yellow-600' : 'text-primary'}>{plan.icon}</span>
                      {plan.title}
                      {isCurrent && <Badge className="ml-2">Plan actual</Badge>}
                    </CardTitle>
                    <CardDescription>{plan.subtitle}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 mt-0.5 text-success" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex justify-end">
                  <Button
                    variant={isCurrent ? 'secondary' : isPremium ? 'default' : 'outline'}
                    disabled={loading || !isOwner || isCurrent}
                    onClick={() => updatePlan(plan.id)}
                  >
                    {isCurrent ? 'Plan actual' : isPremium ? 'Actualizar a Premium' : 'Cambiar a Gratuito'}
                  </Button>
                </div>
                {!isOwner && (
                  <p className="text-xs text-muted-foreground">
                    Solo el propietario puede cambiar el plan.
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

