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
import { canDowngradeToFree, downgradePlanBadgeLabel } from '@/components/config/downgrade/downgradeImpact'

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
    if (!canDowngradeToFree(currentPlan)) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span>El downgrade solo aplica cuando el plan actual es Negocio o Élite.</span>
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
          currentPlan={currentPlan}
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
      <DialogContent className="flex max-h-[min(90dvh,900px)] w-[calc(100%-1.5rem)] max-w-[720px] flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <div className="shrink-0 space-y-3 border-b px-4 pb-3 pt-5 sm:px-6 sm:pt-6">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>Cambiar a Plan Inicial</DialogTitle>
            <DialogDescription>
              Asistente de downgrade a Plan Inicial
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Paso {Math.min(stepIndex + 1, steps.length)} de {steps.length}: {steps[stepIndex]?.title}
            </div>
            <Badge variant="secondary">{downgradePlanBadgeLabel(currentPlan)}</Badge>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          {content()}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t bg-background px-4 py-3 sm:gap-0 sm:px-6 sm:space-x-0">
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={loading || applying}>
              Cancelar
            </Button>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={goBack} disabled={stepIndex === 0 || loading || applying}>
                Atrás
              </Button>
              {stepKey === 'final' ? (
                <Button
                  onClick={handleApply}
                  disabled={!canContinue || applying || loading || !canDowngradeToFree(currentPlan)}
                  className="min-w-[140px]"
                >
                  {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Cambiar a Inicial
                </Button>
              ) : (
                <Button
                  onClick={goNext}
                  disabled={!canContinue || loading || applying || !canDowngradeToFree(currentPlan)}
                >
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
