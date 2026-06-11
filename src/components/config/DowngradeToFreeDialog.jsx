import { useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCurrency } from '@/context/CurrencyContext'
import { useBusiness } from '@/context/BusinessContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { DowngradeSummaryStep } from '@/components/config/downgrade/DowngradeSummaryStep'
import { DowngradeCurrencyStep } from '@/components/config/downgrade/DowngradeCurrencyStep'
import { DowngradeTeamStep } from '@/components/config/downgrade/DowngradeTeamStep'
import { DowngradeAreasStep } from '@/components/config/downgrade/DowngradeAreasStep'
import { DowngradeFinalStep } from '@/components/config/downgrade/DowngradeFinalStep'
import { useDowngradeWizard } from '@/components/config/downgrade/useDowngradeWizard'

export function DowngradeToFreeDialog({ open, onOpenChange, onSuccess }) {
  const { businessId } = useBusiness()
  const { subscription, refreshSubscription, refreshUsage, refreshPendingPlanRequest } = useSubscription()
  const { businessCurrencies, refreshCurrencies, loading: currenciesLoading } = useCurrency()

  const currentPlan = subscription?.plan_id || 'free'
  const activeCurrencies = useMemo(() => (businessCurrencies || []).filter((c) => c?.business_currency_id != null), [businessCurrencies])

  const {
    loading,
    applying,
    preview,
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
  } = useDowngradeWizard({
    open,
    currentPlan: subscription?.plan_id || 'free',
    businessId,
    activeCurrencies,
    onOpenChange,
    onSuccess,
    refreshSubscription,
    refreshUsage,
    refreshPendingPlanRequest,
    refreshCurrencies
  })

  const content = () => {
    if (currentPlan !== 'premium') {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span>El downgrade solo aplica cuando el plan actual es Premium.</span>
          </div>
        </div>
      )
    }

    if (loading || currenciesLoading || !preview) {
      return (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Cargando información...
        </div>
      )
    }

    if (stepKey === 'summary') {
      return (
        <DowngradeSummaryStep
          preview={preview}
          activeCurrencies={activeCurrencies}
          sortedAreas={sortedAreas}
          areasLimit={areasLimit}
          monthlyTxLimit={monthlyTxLimit}
          productsLimit={productsLimit}
        />
      )
    }

    if (stepKey === 'currency') {
      return (
        <DowngradeCurrencyStep
          activeCurrencies={activeCurrencies}
          keepCurrencyId={keepCurrencyId}
          setKeepCurrencyId={setKeepCurrencyId}
        />
      )
    }

    if (stepKey === 'team') {
      return <DowngradeTeamStep members={members} />
    }

    if (stepKey === 'areas') {
      return (
        <DowngradeAreasStep
          sortedAreas={sortedAreas}
          areasLimit={areasLimit}
          keepAreaIds={keepAreaIds}
          toggleArea={toggleArea}
        />
      )
    }

    return (
      <DowngradeFinalStep
        preview={preview}
        selectedCurrencyCode={selectedCurrency ? (selectedCurrency.code || selectedCurrency.currency_code) : ''}
        selectedAreasLabel={selectedAreas.length ? selectedAreas.map((a) => a.name).join(', ') : ''}
        partnersCount={partnersCount}
        finalConfirm={finalConfirm}
        setFinalConfirm={setFinalConfirm}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Cambiar a Plan Gratuito</DialogTitle>
          <DialogDescription>
            Asistente de downgrade Premium → Gratis
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Paso {Math.min(stepIndex + 1, steps.length)} de {steps.length}: {steps[stepIndex]?.title}
          </div>
          <Badge variant="secondary">{currentPlan}</Badge>
        </div>

        {content()}

        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex w-full items-center justify-between gap-2">
            <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={loading || applying}>
              Cancelar
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={goBack} disabled={stepIndex === 0 || loading || applying}>
                Atrás
              </Button>
              {stepKey === 'final' ? (
                <Button onClick={handleApply} disabled={!canContinue || applying || loading} className="min-w-[160px]">
                  {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Cambiar a Gratuito
                </Button>
              ) : (
                <Button onClick={goNext} disabled={!canContinue || loading || applying}>
                  Continuar
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
