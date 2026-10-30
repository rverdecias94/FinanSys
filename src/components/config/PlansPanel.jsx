import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useSubscription, isPaidPlanId } from '@/context/SubscriptionContext'
import { useBusiness } from '@/context/BusinessContext'
import { DowngradeToFreeDialog } from '@/components/config/DowngradeToFreeDialog'
import { PaymentHistory } from '@/components/config/PaymentHistory'
import {
  ANNUAL_DISCOUNT_PCT,
  annualMonthlyEquivalent,
  planLabel,
  resolvePlanPrice,
} from '@/lib/plans'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Check, Crown, Info, Loader2, Shield, Send, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

const FEATURE_TIPS = {
  ocr: 'OCR: digitalización de facturas, recibos y comprobantes.',
  copiloto: 'Copiloto IA: asistente inteligente para consultar y analizar la información del negocio.',
  radar: 'Radar de caja: proyección del efectivo. Negocio: 15 días. Élite: 30, 60 y 90 días (+ escenarios).',
  auditoria: 'Auditoría: seguimiento y revisión de operaciones registradas.',
}

function FeatureRow({ text, tipKey }) {
  return (
    <li className="flex items-start gap-2 text-sm min-h-[1.5rem]">
      <Check className="h-4 w-4 mt-0.5 text-success shrink-0" />
      <span className="flex-1 leading-snug">{text}</span>
      {tipKey && FEATURE_TIPS[tipKey] && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="mt-0.5 shrink-0 rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={FEATURE_TIPS[tipKey]}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px] text-xs">
            {FEATURE_TIPS[tipKey]}
          </TooltipContent>
        </Tooltip>
      )}
    </li>
  )
}

export function PlansPanel() {
  const {
    subscription,
    loading,
    requestPremium,
    cancelPendingPremiumRequest,
    pendingPlanRequest,
    PLAN_LIMITS,
    nextPaymentDate,
    billingCycle,
    paymentState,
    pricing,
  } = useSubscription()
  const { isOwner } = useBusiness()

  const [billingPeriod, setBillingPeriod] = useState('monthly')
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestTarget, setRequestTarget] = useState('premium')
  const [downgradeOpen, setDowngradeOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [submittingRequest, setSubmittingRequest] = useState(false)
  const [requestForm, setRequestForm] = useState({
    billingCycle: 'monthly',
    contactName: '',
    contactPhone: '',
    paymentMethod: 'transferencia',
  })

  const currentPlan = subscription?.plan_id || 'free'
  const isAnnual = billingPeriod === 'annual'

  const priceFor = (planId) => {
    const row = pricing?.[planId] || {}
    const monthly = resolvePlanPrice(row, 'monthly', planId)
    const annual = resolvePlanPrice(row, 'annual', planId)
    return { monthly, annual, equiv: annualMonthlyEquivalent(monthly) }
  }

  const cycleLabel = (cycle) => ({ monthly: 'Mensual', annual: 'Anual' }[cycle] || 'Mensual')
  const formatDate = (value) => {
    try {
      return new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch {
      return ''
    }
  }

  const plans = useMemo(() => {
    const free = PLAN_LIMITS?.free || {}
    const premium = PLAN_LIMITS?.premium || {}
    const ultra = PLAN_LIMITS?.ultra || {}

    const n = (obj, key, fallback) => (Number.isFinite(obj[key]) ? obj[key] : fallback)
    const partnersOf = (obj, fallback) => (
      obj.partners === Infinity ? 'Ilimitados' : (Number.isFinite(obj.partners) ? obj.partners : fallback)
    )

    const txFree = n(free, 'monthly_transactions', 150)
    const prodFree = n(free, 'products', 50)
    const areasFree = n(free, 'areas', 1)
    const currFree = n(free, 'currencies', 1)

    const txPrem = n(premium, 'monthly_transactions', 1500)
    const prodPrem = n(premium, 'products', 200)
    const areasPrem = n(premium, 'areas', 10)
    const currPrem = premium.currencies === Infinity ? null : n(premium, 'currencies', null)
    const partnersPrem = partnersOf(premium, 5)
    const docPrem = n(premium, 'ai_doc_pages', 20)
    const calcPrem = n(premium, 'ai_calc_queries', 15)

    const partnersUltra = partnersOf(ultra, 10)
    const docUltra = n(ultra, 'ai_doc_pages', 100)
    const calcUltra = n(ultra, 'ai_calc_queries', 50)

    // Mismo orden de filas en los 3 planes para comparar en vertical
    return [
      {
        id: 'free',
        title: 'Plan Inicial',
        subtitle: 'Ideal para emprendedores que están comenzando',
        icon: <Shield className="h-5 w-5" />,
        highlights: [
          { text: `${currFree} moneda activa` },
          { text: `${txFree.toLocaleString('es-ES')} transacciones / mes` },
          { text: `${prodFree} productos` },
          { text: `${areasFree} área de inventario` },
          { text: 'Sin miembros adicionales de equipo' },
          { text: 'Sin procesamiento OCR', tipKey: 'ocr' },
          { text: 'Sin acceso al Copiloto IA', tipKey: 'copiloto' },
          { text: 'Sin Radar de caja', tipKey: 'radar' },
          { text: 'Reportes básicos' },
        ],
      },
      {
        id: 'premium',
        title: 'Plan Negocio',
        subtitle: 'Más capacidad y control para tu negocio',
        icon: <Crown className="h-5 w-5" />,
        highlights: [
          { text: currPrem == null ? 'Monedas ilimitadas' : `${currPrem} monedas activas` },
          { text: `${txPrem.toLocaleString('es-ES')} transacciones / mes` },
          { text: `${prodPrem} productos` },
          { text: `${areasPrem} áreas de inventario` },
          { text: `Hasta ${partnersPrem} miembros de equipo` },
          { text: `${docPrem} páginas OCR / mes`, tipKey: 'ocr' },
          { text: `${calcPrem} consultas Copiloto IA / mes`, tipKey: 'copiloto' },
          { text: 'Radar de caja a 15 días (30/60/90 en Élite)', tipKey: 'radar' },
          { text: 'Reportes avanzados y auditoría', tipKey: 'auditoria' },
        ],
      },
      {
        id: 'ultra',
        title: 'Plan Élite',
        subtitle: 'Sin límites operativos + Copiloto completo',
        icon: <Sparkles className="h-5 w-5" />,
        highlights: [
          { text: 'Monedas ilimitadas' },
          { text: 'Transacciones ilimitadas' },
          { text: 'Productos ilimitados' },
          { text: 'Áreas de inventario ilimitadas' },
          { text: `Hasta ${partnersUltra} miembros de equipo` },
          { text: `${docUltra} páginas OCR / mes`, tipKey: 'ocr' },
          { text: `${calcUltra} consultas Copiloto IA / mes`, tipKey: 'copiloto' },
          { text: 'Radar de caja 30/60/90 + escenarios', tipKey: 'radar' },
          { text: 'Reportes avanzados y auditoría', tipKey: 'auditoria' },
        ],
      },
    ]
  }, [PLAN_LIMITS])

  // Orden comercial fijo: Inicial → Negocio → Élite (nunca reordenar por plan actual)
  const orderedPlans = useMemo(() => {
    const order = { free: 0, premium: 1, ultra: 2 }
    return [...plans].sort((a, b) => (order[a.id] ?? 99) - (order[b.id] ?? 99))
  }, [plans])

  const openRequest = (planId) => {
    setRequestTarget(planId)
    setRequestForm((prev) => ({
      ...prev,
      billingCycle: billingPeriod,
      contactName: '',
      contactPhone: '',
      paymentMethod: 'transferencia',
    }))
    setRequestOpen(true)
  }

  const handleRequestPlan = async () => {
    const name = requestForm.contactName.trim()
    const phone = requestForm.contactPhone.trim()
    if (!name) {
      toast.error('Indica el nombre del cliente')
      return
    }
    if (!phone) {
      toast.error('Indica el teléfono o WhatsApp')
      return
    }
    if (!requestForm.paymentMethod) {
      toast.error('Elige la forma de pago')
      return
    }

    setSubmittingRequest(true)
    const result = await requestPremium({
      targetPlanId: requestTarget,
      billingCycle: requestForm.billingCycle,
      contactName: name,
      contactPhone: phone,
      paymentMethod: requestForm.paymentMethod,
    })
    setSubmittingRequest(false)
    if (result) setRequestOpen(false)
  }

  const handlePlanAction = (planId) => {
    if (isPaidPlanId(planId)) {
      openRequest(planId)
      return
    }
    setDowngradeOpen(true)
  }

  const planActionLabel = (plan, isCurrent, hasPending) => {
    if (isCurrent) return 'Plan actual'
    if (hasPending) return 'Solicitud pendiente'
    if (isPaidPlanId(plan.id)) return `Solicitar ${planLabel(plan.id)}`
    return 'Cambiar a Inicial'
  }

  const requestPrice = priceFor(requestTarget)

  const billingCurrency = pricing?.premium?.currency || pricing?.ultra?.currency || 'USD'

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Planes</h3>
        <p className="text-sm text-muted-foreground">
          Compara Inicial, Negocio y Élite. Precios en {billingCurrency}; el pago se confirma fuera de la app.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="inline-flex items-center gap-3 rounded-full border border-border bg-background px-4 py-2 shadow-sm">
          <span className={`text-sm font-semibold ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
            Mensual
          </span>
          <Switch
            checked={isAnnual}
            onCheckedChange={(checked) => setBillingPeriod(checked ? 'annual' : 'monthly')}
            aria-label="Alternar pago anual"
            className="border border-border data-[state=unchecked]:bg-muted-foreground/35 data-[state=checked]:bg-primary"
          />
          <span className={`text-sm font-semibold ${isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
            Anual
          </span>
          <Badge variant="secondary" className="ml-1 bg-success/15 text-success border-success/30">
            Ahorra {ANNUAL_DISCOUNT_PCT}%
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground text-center max-w-sm">
          En anual ves el equivalente mensual; se factura el total del año con descuento.
        </p>
      </div>

      {pendingPlanRequest && (
        <div className="rounded-md border bg-muted/30 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium">
                Solicitud {planLabel(pendingPlanRequest.requested_plan_id)} pendiente
              </div>
              <p className="text-sm text-muted-foreground">
                Enviada el {new Date(pendingPlanRequest.created_at).toLocaleDateString('es-ES')}.
                Revisaremos la solicitud y te contactaremos para confirmar la activación.
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

      <div className="grid gap-4 items-stretch lg:grid-cols-3">
        {orderedPlans.map((plan) => {
          const isCurrent = currentPlan === plan.id
          const paid = isPaidPlanId(plan.id)
          const hasPending = paid && pendingPlanRequest
          const prices = priceFor(plan.id)
          const showBilling = isCurrent && paid && nextPaymentDate

          return (
            <Card key={plan.id} className={`flex flex-col ${isCurrent ? 'border-primary/40 bg-primary/5' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      <span className={paid ? 'text-yellow-600' : 'text-primary'}>{plan.icon}</span>
                      {plan.title}
                      {isCurrent && <Badge className="ml-1">Plan actual</Badge>}
                    </CardTitle>
                    <CardDescription>{plan.subtitle}</CardDescription>
                  </div>
                </div>
                <div className="pt-3 min-h-[4.5rem]">
                  {paid ? (
                    <div className="space-y-1.5">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-3xl font-bold tracking-tight">
                          ${isAnnual ? prices.equiv : prices.monthly}
                        </span>
                        <span className="text-sm text-muted-foreground">{billingCurrency}/mes</span>
                      </div>
                      {isAnnual ? (
                        <p className="text-sm font-semibold text-foreground">
                          Factura anual:{' '}
                          <span className="text-success">${prices.annual} {billingCurrency}</span>
                          <span className="font-medium text-muted-foreground"> /año</span>
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold tracking-tight">$0</span>
                        <span className="text-sm text-muted-foreground">{billingCurrency}/mes</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4 pt-0">
                <ul className="space-y-2 flex-1">
                  {plan.highlights.map((h) => (
                    <FeatureRow key={h.text} text={h.text} tipKey={h.tipKey} />
                  ))}
                </ul>

                <div className="mt-auto space-y-3">
                  <div className="min-h-[3.25rem]">
                    {showBilling ? (
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
                    ) : null}
                  </div>

                  <div className="flex justify-stretch sm:justify-end">
                    <Button
                      className="w-full sm:w-auto"
                      variant={isCurrent ? 'secondary' : paid ? 'default' : 'outline'}
                      disabled={loading || !isOwner || isCurrent || hasPending}
                      onClick={() => handlePlanAction(plan.id)}
                    >
                      {planActionLabel(plan, isCurrent, hasPending)}
                    </Button>
                  </div>
                  {!isOwner && (
                    <p className="text-xs text-muted-foreground">
                      Solo el propietario puede cambiar el plan.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <PaymentHistory alwaysShow={isPaidPlanId(currentPlan)} />

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitar {planLabel(requestTarget)}</DialogTitle>
            <DialogDescription>
              Completa tus datos de contacto y la forma de pago. Activamos el plan tras confirmar el acuerdo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Ciclo de pago</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  {
                    id: 'monthly',
                    label: 'Mensual',
                    price: requestPrice.monthly,
                    suffix: '/mes',
                  },
                  {
                    id: 'annual',
                    label: 'Anual',
                    price: requestPrice.annual,
                    suffix: '/año',
                    save: ANNUAL_DISCOUNT_PCT,
                    hint: `Equiv. $${requestPrice.equiv}/mes`,
                  },
                ].map((c) => {
                  const selected = requestForm.billingCycle === c.id
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setRequestForm((prev) => ({ ...prev, billingCycle: c.id }))}
                      aria-pressed={selected}
                      className={`relative flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors ${selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent'}`}
                    >
                      <span className="text-sm font-medium">{c.label}</span>
                      <span className="text-lg font-bold leading-none">
                        ${c.price}
                        <span className="text-xs font-normal text-muted-foreground"> {c.suffix}</span>
                      </span>
                      {c.save ? (
                        <span className="mt-1 text-xs font-semibold text-success">
                          Ahorra {c.save}% · {c.hint}
                        </span>
                      ) : (
                        <span className="mt-1 select-none text-xs text-transparent">.</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="plan-contact-name">Nombre del cliente</Label>
              <Input
                id="plan-contact-name"
                value={requestForm.contactName}
                onChange={(event) => setRequestForm((prev) => ({ ...prev, contactName: event.target.value }))}
                placeholder="Nombre y apellidos o negocio"
                autoComplete="name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="plan-contact-phone">Teléfono o WhatsApp</Label>
              <Input
                id="plan-contact-phone"
                value={requestForm.contactPhone}
                onChange={(event) => setRequestForm((prev) => ({ ...prev, contactPhone: event.target.value }))}
                placeholder="+53..."
                autoComplete="tel"
              />
            </div>

            <div className="grid gap-2">
              <Label>Forma de pago</Label>
              <Select
                value={requestForm.paymentMethod}
                onValueChange={(value) => setRequestForm((prev) => ({ ...prev, paymentMethod: value }))}
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
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRequestOpen(false)} disabled={submittingRequest}>
              Cancelar
            </Button>
            <Button onClick={handleRequestPlan} disabled={submittingRequest}>
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
        title="Cancelar solicitud de plan"
        description="Se cancelará la solicitud pendiente. Si quieres Negocio o Élite después, tendrás que enviar una nueva solicitud."
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
    </TooltipProvider>
  )
}
