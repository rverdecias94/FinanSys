import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { useCurrency } from '@/context/CurrencyContext'
import { useBusiness } from '@/context/BusinessContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { useSession } from '@/hooks/useSession'
import { getExchangeRates, upsertExchangeRate, getAllExchangeRateHistory } from '@/services/exchangeRates'
import { CheckCircle2, Globe2, Lock, ArrowLeftRight, TrendingUp } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function RateHistoryChart({ data }) {
  const points = useMemo(
    () => (data || []).map((d) => ({ label: format(parseISO(d.date), 'dd/MM', { locale: es }), rate: d.rate })),
    [data]
  )
  if (points.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Registra la tasa varios días para ver aquí su evolución.
      </p>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={150}>
      <LineChart data={points} margin={{ left: 4, right: 8, top: 6, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={48} domain={['auto', 'auto']} />
        <Tooltip
          contentStyle={{
            borderRadius: '5px',
            backgroundColor: 'hsl(var(--card))',
            color: 'hsl(var(--card-foreground))',
            border: '1px solid hsl(var(--border))',
          }}
          labelStyle={{ color: 'hsl(var(--card-foreground))' }}
        />
        <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function CurrenciesPanel() {
  const { availableCurrencies, businessCurrencies, loading, toggleCurrency } = useCurrency()
  const { isOwner, businessId } = useBusiness()
  const { subscription } = useSubscription()
  const { session } = useSession()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const isFree = (subscription?.plan_id || 'free') !== 'premium'

  const activeSet = useMemo(() => new Set(businessCurrencies.map((c) => c.code)), [businessCurrencies])
  const defaultCode = useMemo(() => businessCurrencies.find((c) => c.is_default)?.code, [businessCurrencies])

  // Monedas activas distintas de la principal: necesitan tipo de cambio para consolidar.
  const ratedCurrencies = useMemo(
    () => businessCurrencies.filter((c) => c.code !== defaultCode),
    [businessCurrencies, defaultCode]
  )

  const ratesQuery = useQuery({
    queryKey: ['exchangeRates', userId, businessId],
    queryFn: () => getExchangeRates(userId, businessId),
    enabled: !!userId && !!businessId,
  })
  const rates = ratesQuery.data || {}

  const historyQuery = useQuery({
    queryKey: ['exchangeRatesHistory', userId, businessId],
    queryFn: () => getAllExchangeRateHistory(userId, businessId),
    enabled: !!userId && !!businessId && ratedCurrencies.length > 0,
  })
  const history = historyQuery.data || {}

  // Fecha de vigencia de la tasa que se está registrando (permite registrar días pasados).
  const [rateDate, setRateDate] = useState(() => new Date())

  // Estado local de los inputs (string), sembrado desde las tasas guardadas.
  const [drafts, setDrafts] = useState({})
  useEffect(() => {
    const seed = {}
    for (const c of ratedCurrencies) {
      seed[c.code] = rates[c.code]?.units_per_base != null ? String(rates[c.code].units_per_base) : ''
    }
    setDrafts(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratesQuery.data, defaultCode, businessCurrencies.length])

  const saveMutation = useMutation({
    mutationFn: ({ currency_code, units_per_base }) =>
      upsertExchangeRate(
        { currency_code, units_per_base, effective_date: format(rateDate, 'yyyy-MM-dd') },
        userId,
        businessId
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchangeRates'] })
      queryClient.invalidateQueries({ queryKey: ['exchangeRatesHistory'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const isToday = format(rateDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="space-y-6">
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

                    <div className="flex items-center gap-2 sm:justify-end">
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
                )
              })
            )}
          </div>

          {!isOwner && (
            <p className="text-xs text-muted-foreground">Solo el propietario puede modificar monedas.</p>
          )}
        </CardContent>
      </Card>

      {/* Tipos de cambio (Fase 5): solo si hay moneda principal y ≥1 moneda extra activa. */}
      {defaultCode && ratedCurrencies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Tipos de cambio
            </CardTitle>
            <CardDescription>
              Define a cuánto está cada moneda respecto a tu moneda principal ({defaultCode}).
              Se usa para el total consolidado del panel y queda guardado con fecha (historial).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Fecha de la tasa (por si registras la de un día pasado) */}
            {isOwner && (
              <div className="flex flex-col gap-1 sm:max-w-[280px]">
                <Label className="text-xs text-muted-foreground">Fecha de la tasa</Label>
                <Calendar value={rateDate} onChange={(d) => setRateDate(d || new Date())} />
                {!isToday && (
                  <p className="text-[11px] text-warning">
                    Estás registrando una tasa con fecha pasada ({format(rateDate, "d 'de' MMMM yyyy", { locale: es })}).
                  </p>
                )}
              </div>
            )}

            {ratedCurrencies.map((c) => {
              const saved = rates[c.code]
              const isSaving = saveMutation.isPending && saveMutation.variables?.currency_code === c.code
              const value = drafts[c.code] ?? ''
              const valid = value !== '' && Number(value) > 0
              return (
                <div key={c.code} className="flex flex-col gap-3 rounded-md border p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex items-center gap-2 whitespace-nowrap pb-2 text-sm">
                      <span className="font-medium">1 {defaultCode}</span>
                      <span className="text-muted-foreground">=</span>
                    </div>
                    <div className="grid gap-1 flex-1 min-w-[140px]">
                      <Label htmlFor={`rate-${c.code}`} className="text-xs text-muted-foreground">
                        {c.code} por cada {defaultCode}
                      </Label>
                      <Input
                        id={`rate-${c.code}`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        placeholder={`Ej. 420`}
                        value={value}
                        disabled={!isOwner}
                        onChange={(e) => setDrafts((d) => ({ ...d, [c.code]: e.target.value }))}
                      />
                    </div>
                    {isOwner && (
                      <Button
                        className="shrink-0"
                        loading={isSaving}
                        disabled={!valid}
                        onClick={() => saveMutation.mutate({ currency_code: c.code, units_per_base: Number(value) })}
                      >
                        Guardar
                      </Button>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {saved?.effective_date
                      ? `Última tasa: ${saved.units_per_base} ${c.code} (${format(parseISO(saved.effective_date), "d 'de' MMMM yyyy", { locale: es })})`
                      : 'Sin tipo de cambio definido — esta moneda no se incluirá en el total consolidado.'}
                  </p>

                  {/* Historial de evolución */}
                  <div className="rounded-md border bg-muted/10 p-2">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Evolución de {c.code} frente a {defaultCode}
                    </div>
                    <RateHistoryChart data={history[c.code]} />
                  </div>
                </div>
              )
            })}

            {!isOwner && (
              <p className="text-xs text-muted-foreground">Solo el propietario puede modificar los tipos de cambio.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
