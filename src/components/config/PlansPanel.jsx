import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useSubscription } from '@/context/SubscriptionContext'
import { useBusiness } from '@/context/BusinessContext'
import { DowngradeToFreeDialog } from '@/components/config/DowngradeToFreeDialog'
import { PaymentHistory } from '@/components/config/PaymentHistory'
import { Check, Crown, Loader2, Shield, Send } from 'lucide-react'

export function PlansPanel() {
  const { subscription, loading, requestPremium, cancelPendingPremiumRequest, pendingPlanRequest, PLAN_LIMITS, nextPaymentDate, billingCycle, paymentState, pricing } = useSubscription()
  const { isOwner } = useBusiness()

  const premiumPricing = pricing?.premium || {}
  const cycleOptions = [
    { id: 'monthly', label: 'Mensual', price: premiumPricing.monthly ?? 10, suffix: '/mes' },
    { id: 'semiannual', label: 'Semestral', price: premiumPricing.semiannual ?? 57, suffix: '/6 meses', save: premiumPricing.semiannual_discount_pct ?? 5 },
    { id: 'annual', label: 'Anual', price: premiumPricing.annual ?? 102, suffix: '/año', save: premiumPricing.annual_discount_pct ?? 15 }
  ]

  const cycleLabel = (cycle) => ({ monthly: 'Mensual', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual' }[cycle] || 'Mensual')
  const formatDate = (value) => {
    try {
      return new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch {
      return ''
    }
  }
  const [requestOpen, setRequestOpen] = useState(false)
  const [downgradeOpen, setDowngradeOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [submittingRequest, setSubmittingRequest] = useState(false)
  const [requestForm, setRequestForm] = useState({
    billingCycle: 'monthly',
    contactPhone: '',
    paymentMethod: 'transferencia',
    paymentReference: '',
    userNotes: ''
  })

  const currentPlan = subscription?.plan_id || 'free'

  const plans = useMemo(() => {
    const free = PLAN_LIMITS?.free || {}
    const premium = PLAN_LIMITS?.premium || {}

    const txFree = Number.isFinite(free.monthly_transactions) ? free.monthly_transactions : 40
    const prodFree = Number.isFinite(free.products) ? free.products : 40
    const areasFree = Number.isFinite(free.areas) ? free.areas : 5
    const partnersFree = Number.isFinite(free.partners) ? free.partners : 0

    const partnersPremium = premium.partners === Infinity ? 'Ilimitados' : (Number.isFinite(premium.partners) ? premium.partners : 5)

    return [
      {
        id: 'free',
        title: 'Plan Gratuito',
        subtitle: 'Ideal para empezar',
        icon: <Shield className="h-5 w-5" />,
        highlights: [
          `${txFree} Transacciones / mes`,
          `${prodFree} Productos`,
          `${areasFree} Áreas de Inventario`,
          '1 Moneda Activa',
          'Reportes Básicos (Solo lectura)',
          partnersFree ? `Hasta ${partnersFree} miembros de equipo` : 'Sin miembros de equipo'
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
          `Hasta ${partnersPremium} miembros de equipo`,
          'Bitácora de actividad'
        ]
      }
    ]
  }, [PLAN_LIMITS])

  // Mostrar siempre el plan activo del negocio como la primera tarjeta.
  const orderedPlans = useMemo(
    () => [...plans].sort((a, b) => (b.id === currentPlan ? 1 : 0) - (a.id === currentPlan ? 1 : 0)),
    [plans, currentPlan]
  )

  const handleRequestPremium = async () => {
    setSubmittingRequest(true)
    const result = await requestPremium({
      billingCycle: requestForm.billingCycle,
      contactPhone: requestForm.contactPhone,
      paymentMethod: requestForm.paymentMethod,
      paymentReference: requestForm.paymentReference,
      userNotes: requestForm.userNotes
    })
    setSubmittingRequest(false)
    if (result) setRequestOpen(false)
  }

  const handlePlanAction = (planId) => {
    if (planId === 'premium') {
      setRequestOpen(true)
      return
    }
    setDowngradeOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Planes</h3>
        <p className="text-sm text-muted-foreground">Compara los planes y revisa el plan actual del negocio.</p>
      </div>

      {pendingPlanRequest && (
        <div className="rounded-md border bg-muted/30 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium">Solicitud Premium pendiente</div>
              <p className="text-sm text-muted-foreground">
                Enviada el {new Date(pendingPlanRequest.created_at).toLocaleDateString('es-ES')}. Revisaremos la solicitud y te contactaremos para confirmar la activación.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Pendiente</Badge>
              {isOwner && (
                <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)} disabled={loading}>
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {orderedPlans.map((plan) => {
          const isCurrent = currentPlan === plan.id
          const isPremium = plan.id === 'premium'
          const hasPendingPremium = isPremium && pendingPlanRequest
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

                {isCurrent && isPremium && nextPaymentDate && (
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Ciclo de pago</span>
                      <span className="font-medium">{cycleLabel(billingCycle)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Próximo pago</span>
                      <span className={`font-medium ${paymentState === 'grace' ? 'text-destructive' : paymentState === 'due_soon' ? 'text-warning' : ''}`}>
                        {formatDate(nextPaymentDate)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    variant={isCurrent ? 'secondary' : isPremium ? 'default' : 'outline'}
                    disabled={loading || !isOwner || isCurrent || hasPendingPremium}
                    onClick={() => handlePlanAction(plan.id)}
                  >
                    {isCurrent ? 'Plan actual' : hasPendingPremium ? 'Solicitud pendiente' : isPremium ? 'Solicitar Premium' : 'Cambiar a Gratuito'}
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

      <PaymentHistory alwaysShow={currentPlan === 'premium'} />

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Solicitar Premium</DialogTitle>
            <DialogDescription>
              Enviaremos tu solicitud para revisarla manualmente. La activación se confirma después del acuerdo o pago fuera de la aplicación.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Ciclo de pago</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {cycleOptions.map((c) => {
                  const selected = requestForm.billingCycle === c.id
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setRequestForm(prev => ({ ...prev, billingCycle: c.id }))}
                      aria-pressed={selected}
                      className={`relative flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors ${selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent'}`}
                    >
                      <span className="text-sm font-medium">{c.label}</span>
                      <span className="text-lg font-bold leading-none">
                        ${c.price}
                        <span className="text-xs font-normal text-muted-foreground"> {c.suffix}</span>
                      </span>
                      {c.save ? (
                        <span className="mt-1 text-xs font-semibold text-success">Ahorra {c.save}%</span>
                      ) : (
                        <span className="mt-1 select-none text-xs text-transparent">.</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Teléfono o WhatsApp</Label>
              <Input
                value={requestForm.contactPhone}
                onChange={(event) => setRequestForm(prev => ({ ...prev, contactPhone: event.target.value }))}
                placeholder="+53..."
              />
            </div>

            <div className="grid gap-2">
              <Label>Método acordado</Label>
              <Select
                value={requestForm.paymentMethod}
                onValueChange={(value) => setRequestForm(prev => ({ ...prev, paymentMethod: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transferencia">Transferencia nacional</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="acuerdo">Acuerdo comercial</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Referencia o nota de pago</Label>
              <Input
                value={requestForm.paymentReference}
                onChange={(event) => setRequestForm(prev => ({ ...prev, paymentReference: event.target.value }))}
                placeholder="Referencia, comprobante o detalle"
              />
            </div>

            <div className="grid gap-2">
              <Label>Notas adicionales</Label>
              <Textarea
                value={requestForm.userNotes}
                onChange={(event) => setRequestForm(prev => ({ ...prev, userNotes: event.target.value }))}
                placeholder="Cualquier detalle que ayude a revisar la solicitud"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRequestOpen(false)} disabled={submittingRequest}>
              Cancelar
            </Button>
            <Button onClick={handleRequestPremium} disabled={submittingRequest}>
              {submittingRequest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Enviar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {downgradeOpen && (
        <DowngradeToFreeDialog
          open={downgradeOpen}
          onOpenChange={setDowngradeOpen}
          onSuccess={() => {
            setDowngradeOpen(false)
          }}
        />
      )}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar solicitud Premium"
        description="Se cancelará la solicitud pendiente. Si quieres Premium después, tendrás que enviar una nueva solicitud."
        confirmText="Cancelar solicitud"
        cancelText="Volver"
        tone="destructive"
        loading={loading}
        onConfirm={async () => {
          await cancelPendingPremiumRequest()
          setCancelOpen(false)
        }}
      />
    </div>
  )
}
