/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, Crown, Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { getBusinessSettings } from '@/services/businessSettings'
import { getExchangeRates } from '@/services/exchangeRates'
import {
  applySuggestedPrices,
  getLatestInboundFxByProduct,
  listProductsForSelection,
} from '@/services/almacen'
import { normalizeFxSettings } from '@/utils/dailyFxReminder'
import { computeReplacementPricing } from '@/utils/replacementPricing'
import { perPieceFromBox, stockUnitShort } from '@/utils/stockUnit'
import { useFxGate } from '@/context/FxGateContext'
import { toast } from 'sonner'

function planTier(planId) {
  if (planId === 'ultra') return 'elite'
  if (planId === 'premium') return 'negocio'
  return 'inicial'
}

/**
 * Banner + lista de productos PARA VENTA bajo margen de reposición.
 * Solo productos is_for_sale; sugerido siempre en la moneda del producto.
 */
export function ReplacementMarginPanel({ onApplied }) {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { businessCurrencies, formatCurrency } = useCurrency()
  const { subscription } = useSubscription()
  const { ensureTodayFx } = useFxGate()
  const queryClient = useQueryClient()
  const userId = session?.user?.id
  const tier = planTier(subscription?.plan_id)
  const canApply = tier === 'negocio' || tier === 'elite'
  const canBatch = tier === 'elite'

  const [scenarioRate, setScenarioRate] = useState('')
  const [selected, setSelected] = useState(() => new Set())

  const defaultCode = useMemo(
    () => businessCurrencies.find((c) => c.is_default)?.code || 'USD',
    [businessCurrencies]
  )
  const quoteCode = useMemo(() => {
    if (defaultCode !== 'CUP' && businessCurrencies.some((c) => c.code === 'CUP')) return 'CUP'
    return businessCurrencies.find((c) => !c.is_default)?.code || defaultCode
  }, [businessCurrencies, defaultCode])

  const settingsQuery = useQuery({
    queryKey: ['configuracion', 'general-settings', businessId || userId],
    queryFn: () => getBusinessSettings(userId, businessId),
    enabled: !!userId && !!businessId,
  })
  const fxPrefs = normalizeFxSettings(settingsQuery.data?.fx)

  const ratesQuery = useQuery({
    queryKey: ['exchangeRates', userId, businessId],
    queryFn: () => getExchangeRates(userId, businessId),
    enabled: !!userId && !!businessId,
  })

  const productsQuery = useQuery({
    queryKey: ['warehouse', 'productsSelection', businessId || userId],
    queryFn: () => listProductsForSelection({ userId, businessId, limit: 5000 }),
    enabled: !!userId && !!businessId,
  })

  const fxByProductQuery = useQuery({
    queryKey: ['warehouse', 'inboundFx', businessId || userId],
    queryFn: () => getLatestInboundFxByProduct(userId, businessId),
    enabled: !!userId && !!businessId,
  })

  const currentRateLive = Number(ratesQuery.data?.[quoteCode]?.units_per_base)
  const currentRate = useMemo(() => {
    if (canBatch && scenarioRate !== '') {
      const n = Number(scenarioRate)
      if (Number.isFinite(n) && n > 0) return n
    }
    return Number.isFinite(currentRateLive) && currentRateLive > 0 ? currentRateLive : null
  }, [canBatch, scenarioRate, currentRateLive])

  const rows = useMemo(() => {
    const products = productsQuery.data || []
    const fxMap = fxByProductQuery.data || {}
    const out = []
    for (const p of products) {
      if (p.is_for_sale === false) continue
      const margin =
        p.target_margin_pct != null && Number.isFinite(Number(p.target_margin_pct))
          ? Number(p.target_margin_pct)
          : fxPrefs.target_margin_pct
      const productCurrency = p.currency || defaultCode
      const pricing = computeReplacementPricing({
        avgCost: p.avg_cost,
        productCurrency,
        baseCurrency: defaultCode,
        quoteCurrency: quoteCode,
        purchaseRate: fxMap[String(p.id)] ?? null,
        currentRate,
        marginPct: margin,
        unitPrice: p.unit_price,
        isForSale: p.is_for_sale !== false,
      })
      if (!pricing.ok || !pricing.atRisk) continue
      out.push({ product: p, pricing, margin })
    }
    return out.sort((a, b) => (b.pricing.gap || 0) - (a.pricing.gap || 0))
  }, [
    productsQuery.data,
    fxByProductQuery.data,
    fxPrefs.target_margin_pct,
    defaultCode,
    quoteCode,
    currentRate,
  ])

  const applyMutation = useMutation({
    mutationFn: (updates) => applySuggestedPrices(updates, userId, businessId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['warehouse'] })
      setSelected(new Set())
      toast.success(
        data.length === 1
          ? 'Precio actualizado al sugerido de reposición'
          : `${data.length} precios actualizados`
      )
      onApplied?.()
    },
    onError: () => toast.error('No se pudieron aplicar los precios'),
  })

  const applyWithFxGate = async (updates) => {
    // Escenario Élite usa tasa simulada: no exige la de hoy.
    const usingLiveRate = !(canBatch && scenarioRate !== '' && Number(scenarioRate) > 0)
    if (usingLiveRate) {
      try {
        const ok = await ensureTodayFx({ reasonKey: 'replacement_price' })
        if (!ok) return
      } catch {
        return
      }
    }
    applyMutation.mutate(updates)
  }

  if (!userId || !businessId) return null
  if (productsQuery.isLoading || ratesQuery.isLoading) return null

  if (rows.length === 0 && !(canBatch && scenarioRate)) return null

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Card className="border-warning/50">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          {rows.length} producto{rows.length === 1 ? '' : 's'} para venta bajo reposición
        </CardTitle>
        <CardDescription>
          Solo «Se vende». Sugerido en la misma moneda y unidad del producto (unidad o caja). No
          mezcla USD/CUP ni aplica a uso interno.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tier === 'inicial' && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Vista previa del Plan Inicial</p>
            <p className="mt-1 text-muted-foreground">
              Puedes ver qué productos de venta están en riesgo. Pasa a Negocio para aplicar los
              precios sugeridos.
            </p>
            <Button asChild className="mt-3 h-10" size="sm">
              <Link to="/cuenta/plan">Ver planes</Link>
            </Button>
          </div>
        )}

        {canBatch && (
          <div className="grid gap-2 rounded-md border p-3 sm:max-w-sm">
            <Label htmlFor="fx-scenario" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Escenario Élite: simular 1 {defaultCode === 'CUP' ? quoteCode : defaultCode} = ¿cuántos CUP?
            </Label>
            <Input
              id="fx-scenario"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              className="h-11"
              placeholder={String(currentRateLive || '')}
              value={scenarioRate}
              onChange={(e) => setScenarioRate(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Afecta productos cotizados en {quoteCode}. Los que se venden en {defaultCode} usan su
              costo en esa moneda.
            </p>
            {scenarioRate && (
              <Button type="button" variant="ghost" size="sm" className="h-9 justify-start px-0" onClick={() => setScenarioRate('')}>
                Usar tasa real de hoy
              </Button>
            )}
          </div>
        )}

        <ul className="divide-y rounded-md border">
          {rows.map(({ product: p, pricing }) => {
            const id = String(p.id)
            const cur = pricing.currency || p.currency
            const per = stockUnitShort(p.stock_unit)
            const pieceOfSuggested = p.stock_unit === 'box'
              ? perPieceFromBox(pricing.suggested, p.units_per_box)
              : null
            return (
              <li key={id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {canBatch && (
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={selected.has(id)}
                        onChange={() => toggle(id)}
                        aria-label={`Seleccionar ${p.name}`}
                      />
                    )}
                    <span className="font-medium break-words">{p.name}</span>
                    <Badge variant="outline" className="capitalize">Por {per}</Badge>
                    <Badge variant="destructive">En riesgo</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Actual {formatCurrency(p.unit_price, cur)}/{per} · Reposición{' '}
                    {formatCurrency(pricing.replacement, cur)}/{per} · Sugerido{' '}
                    <span className="font-medium text-foreground">
                      {formatCurrency(pricing.suggested, cur)}/{per}
                    </span>
                    {pieceOfSuggested != null && (
                      <> · ≈ {formatCurrency(pieceOfSuggested, cur)}/pieza</>
                    )}
                    {pricing.cupEquivalent != null && cur !== quoteCode && (
                      <> · ≈ {formatCurrency(pricing.cupEquivalent, quoteCode)}/{per} hoy</>
                    )}
                  </p>
                </div>
                {canApply && (
                  <Button
                    size="sm"
                    className="h-10 shrink-0"
                    disabled={applyMutation.isPending}
                    onClick={() =>
                      applyWithFxGate([{ product_id: p.id, unit_price: pricing.suggested }])
                    }
                  >
                    Aplicar {formatCurrency(pricing.suggested, cur)}/{per}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>

        {canBatch && rows.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              variant="outline"
              className="h-11"
              disabled={applyMutation.isPending}
              onClick={() => setSelected(new Set(rows.map((r) => String(r.product.id))))}
            >
              Seleccionar todos
            </Button>
            <Button
              className="h-11 gap-1.5"
              disabled={applyMutation.isPending || selected.size === 0}
              loading={applyMutation.isPending}
              onClick={() => {
                const updates = rows
                  .filter((r) => selected.has(String(r.product.id)))
                  .map((r) => ({ product_id: r.product.id, unit_price: r.pricing.suggested }))
                applyWithFxGate(updates)
              }}
            >
              <Crown className="h-4 w-4" />
              Aplicar seleccionados ({selected.size})
            </Button>
          </div>
        )}

        {tier === 'negocio' && (
          <p className="text-xs text-muted-foreground">
            En Élite puedes aplicar precios en lote y simular escenarios de tasa.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
