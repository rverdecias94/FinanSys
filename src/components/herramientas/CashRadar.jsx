/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  Loader2,
  Package,
  Radar,
  Wallet,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { getCashRadar } from '@/services/cashRadar'
import { cn } from '@/lib/utils'

const HORIZONS = [
  { days: 15, label: '15 días', eliteOnly: false },
  { days: 30, label: '30 días', eliteOnly: true },
  { days: 60, label: '60 días', eliteOnly: true },
  { days: 90, label: '90 días', eliteOnly: true },
]

function severityStyles(severity) {
  if (severity === 'critical') return 'border-destructive/40 bg-destructive/5'
  if (severity === 'high') return 'border-warning/40 bg-warning/5'
  return 'border-border bg-background'
}

function ActionIcon({ kind }) {
  if (kind === 'collect') return <ArrowUpRight className="h-4 w-4 text-success" />
  if (kind === 'pay') return <ArrowDownRight className="h-4 w-4 text-destructive" />
  if (kind === 'stock') return <Package className="h-4 w-4 text-muted-foreground" />
  return <AlertTriangle className="h-4 w-4 text-destructive" />
}

export function CashRadar({ isElite = false }) {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { businessCurrencies, formatCurrency } = useCurrency()
  const userId = session?.user?.id
  const [horizonDays, setHorizonDays] = useState(isElite ? 30 : 15)
  const [eliteHint, setEliteHint] = useState(null)

  const baseCurrency = useMemo(
    () => businessCurrencies?.find((c) => c.is_default)?.code || businessCurrencies?.[0]?.code || 'USD',
    [businessCurrencies]
  )

  const radarQuery = useQuery({
    queryKey: ['cash-radar', userId, businessId, baseCurrency, horizonDays],
    queryFn: () => getCashRadar({
      userId,
      businessId,
      baseCurrency,
      horizonDays,
    }),
    enabled: !!userId,
    staleTime: 60_000,
  })

  const radar = radarQuery.data
  const chartData = radar?.series || []
  const dip = Boolean(radar?.firstNegativeDay)
  const endTone = !radar
    ? 'text-foreground'
    : radar.endBalance < 0
      ? 'text-destructive'
      : radar.endBalance < radar.startBalance
        ? 'text-warning'
        : 'text-success'

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Radar className="h-4 w-4 shrink-0" />
                Radar de caja
              </CardTitle>
              <CardDescription>
                Proyección con tu saldo, recurrentes y cuentas por cobrar/pagar.
                Sin costos externos: solo los datos de tu negocio.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Horizonte">
              {HORIZONS.map((h) => {
                const locked = h.eliteOnly && !isElite
                const active = horizonDays === h.days && !locked
                return (
                  <Button
                    key={h.days}
                    type="button"
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    className={cn(
                      'h-8 text-xs',
                      locked && 'opacity-70 border-dashed'
                    )}
                    aria-disabled={locked}
                    title={locked ? 'Función del plan Élite' : undefined}
                    onClick={() => {
                      if (locked) {
                        setEliteHint(h.days)
                        return
                      }
                      setEliteHint(null)
                      setHorizonDays(h.days)
                    }}
                  >
                    {h.label}
                    {locked ? <span className="ml-1 text-[10px] font-semibold text-primary">Élite</span> : null}
                  </Button>
                )
              })}
            </div>
          </div>
          {eliteHint != null && !isElite && (
            <p className="rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-foreground">
              La proyección a <strong>{eliteHint} días</strong> es una función del{' '}
              <strong>plan Élite</strong>. Con Negocio puedes ver{' '}
              <strong>15 días</strong>.{' '}
              <Link to="/configuracion" className="font-semibold text-primary underline-offset-2 hover:underline">
                Ver plan Élite
              </Link>
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {radarQuery.isLoading && (
            <div className="flex min-h-[200px] items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Calculando proyección…
            </div>
          )}

          {radarQuery.isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              No se pudo armar el radar.
              <span className="mt-1 block text-muted-foreground">
                {radarQuery.error?.message || 'Revisa tu conexión e intenta de nuevo.'}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => radarQuery.refetch()}
              >
                Reintentar
              </Button>
            </div>
          )}

          {radar && !radarQuery.isLoading && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Caja usable hoy
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold tabular-nums">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    {formatCurrency(radar.startBalance, baseCurrency)}
                  </p>
                  {(radar.openRecvTotal > 0 || radar.openPayTotal > 0) && (
                    <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                      Libro {formatCurrency(radar.ledgerBalance ?? 0, baseCurrency)}
                      {radar.openRecvTotal > 0 ? ` − CxC ${formatCurrency(radar.openRecvTotal, baseCurrency)}` : ''}
                      {radar.openPayTotal > 0 ? ` + CxP ${formatCurrency(radar.openPayTotal, baseCurrency)}` : ''}
                    </p>
                  )}
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    En {horizonDays} días
                  </p>
                  <p className={cn('mt-1 text-lg font-semibold tabular-nums', endTone)}>
                    {formatCurrency(radar.endBalance, baseCurrency)}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Punto más bajo
                  </p>
                  <p className={cn(
                    'mt-1 text-lg font-semibold tabular-nums',
                    radar.minBalance < 0 ? 'text-destructive' : 'text-foreground'
                  )}
                  >
                    {formatCurrency(radar.minBalance, baseCurrency)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-1">
                    <CalendarRange className="h-3 w-3" />
                    {radar.minBalanceDay}
                  </p>
                </div>
              </div>

              {dip && (
                <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <p className="font-medium text-foreground">
                      Atención: la proyección cruza a negativo el {radar.firstNegativeDay}
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Prioriza cobros o revisa pagos programados antes de esa fecha.
                    </p>
                  </div>
                </div>
              )}

              <div className="h-[220px] w-full sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                      minTickGap={28}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      width={56}
                      tickFormatter={(v) => {
                        const n = Number(v)
                        if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`
                        return String(Math.round(n))
                      }}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--card))',
                        fontSize: 12,
                      }}
                      formatter={(value) => [formatCurrency(Number(value) || 0, baseCurrency), 'Saldo']}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.date || label}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="hsl(var(--primary))"
                      fill="url(#radarFill)"
                      strokeWidth={2}
                      isAnimationActive
                      animationDuration={700}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Entradas proyectadas</p>
                  <p className="font-semibold tabular-nums text-success">
                    +{formatCurrency(radar.totalIn, baseCurrency)}
                  </p>
                </div>
                <div className="rounded-lg border px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Salidas proyectadas</p>
                  <p className="font-semibold tabular-nums text-destructive">
                    −{formatCurrency(radar.totalOut, baseCurrency)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Qué atender</h3>
                {radar.actions.length === 0 ? (
                  <p className="text-sm text-muted-foreground rounded-lg border bg-muted/20 px-3 py-3">
                    Sin alertas urgentes en este horizonte. Sigue registrando recurrentes y vencimientos
                    para afinar la proyección.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {radar.actions.slice(0, 8).map((a) => (
                      <li key={a.id}>
                        <Link
                          to={a.href}
                          className={cn(
                            'flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/40',
                            severityStyles(a.severity)
                          )}
                        >
                          <span className="mt-0.5 shrink-0">
                            <ActionIcon kind={a.kind} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-foreground">{a.title}</span>
                            <span className="block text-xs text-muted-foreground">{a.detail}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Modelo orientativo: usa saldo actual, plantillas recurrentes activas y saldos abiertos
                de CxC/CxP según fecha de vencimiento ({radar.eventCount} movimientos programados).
                No sustituye un presupuesto formal ni asesora fiscalmente.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
