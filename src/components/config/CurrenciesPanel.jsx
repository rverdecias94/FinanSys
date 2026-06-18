import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrency } from '@/context/CurrencyContext'
import { useBusiness } from '@/context/BusinessContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { CheckCircle2, Globe2, Lock } from 'lucide-react'

export function CurrenciesPanel() {
  const { availableCurrencies, businessCurrencies, loading, toggleCurrency, setMainCurrency } = useCurrency()
  const { isOwner } = useBusiness()
  const { subscription } = useSubscription()

  const isFree = (subscription?.plan_id || 'free') !== 'premium'

  const activeSet = useMemo(() => new Set(businessCurrencies.map((c) => c.code)), [businessCurrencies])
  const defaultCode = useMemo(() => businessCurrencies.find((c) => c.is_default)?.code, [businessCurrencies])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe2 className="h-5 w-5" />
          Monedas
        </CardTitle>
        <CardDescription>
          Activa monedas, define la moneda principal y respeta los límites del plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isFree && (
          <div className="flex items-start gap-2 rounded-md border bg-muted/20 p-3 text-sm">
            <Lock className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="font-medium">Plan Gratuito</p>
              <p className="text-muted-foreground">Solo puedes tener 1 moneda activa.</p>
            </div>
          </div>
        )}

        <div className="grid gap-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Cargando monedas...</div>
          ) : (
            availableCurrencies.map((curr) => {
              const isActive = activeSet.has(curr.code)
              const isDefault = defaultCode === curr.code
              return (
                <div key={curr.code} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{curr.code}</span>
                      <span className="text-sm text-muted-foreground truncate">{curr.name}</span>
                      {isDefault && (
                        <Badge variant="secondary" className="ml-2">Principal</Badge>
                      )}
                    </div>
                    {isActive && (
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        <span>Activa</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 justify-between sm:justify-end">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0} className="inline-flex">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!isOwner || !isActive || isDefault}
                              onClick={() => setMainCurrency(curr.code)}
                            >
                              Hacer principal
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="end" className="max-w-[240px]">
                          La moneda principal es la que se conserva si bajas de plan. También puedes definirla en «General».
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`activar-${curr.code}`} className="text-xs text-muted-foreground">
                        Activar
                      </Label>
                      <Switch
                        id={`activar-${curr.code}`}
                        checked={isActive}
                        disabled={!isOwner}
                        onCheckedChange={(checked) => toggleCurrency(curr.code, checked)}
                      />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {!isOwner && (
          <p className="text-xs text-muted-foreground">Solo el propietario puede modificar monedas.</p>
        )}
      </CardContent>
    </Card>
  )
}

