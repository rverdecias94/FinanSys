/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Calculator } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { getDashboardStats, getAgingReport } from '@/services/finanzas'
import { getExchangeRates } from '@/services/exchangeRates'
import { runCalculator } from '@/utils/businessCalculator'
import { agingOverdue } from '@/utils/aging'
import { ExampleChips } from '@/components/herramientas/ExampleChips'

const MODES = [
  { id: 'affordability', label: '¿Me alcanza?' },
  { id: 'fx', label: 'Conversión FX' },
  { id: 'margin', label: 'Margen' },
  { id: 'collection', label: 'Cobro CxC' },
]

function roundMoney(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.round(v * 100) / 100
}

/** Escenarios deterministas (sin IA / sin cupo). */
export function BusinessCalculator() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { businessCurrencies, formatCurrency } = useCurrency()
  const userId = session?.user?.id

  const baseCurrency = useMemo(
    () => businessCurrencies?.find((c) => c.is_default)?.code || businessCurrencies?.[0]?.code || 'USD',
    [businessCurrencies]
  )

  const [mode, setMode] = useState('affordability')
  const [result, setResult] = useState(null)

  const [expenseLabel, setExpenseLabel] = useState('Pago')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCurrency, setExpenseCurrency] = useState(baseCurrency)

  const [fxAmount, setFxAmount] = useState('')
  const [fxFrom, setFxFrom] = useState(baseCurrency)
  const [fxTo, setFxTo] = useState('CUP')

  const [cost, setCost] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [qty, setQty] = useState('1')
  const [marginCurrency, setMarginCurrency] = useState(baseCurrency)

  const [collectPct, setCollectPct] = useState('50')
  const [collectCurrency, setCollectCurrency] = useState(baseCurrency)

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats', userId, businessId],
    queryFn: () => getDashboardStats(userId, businessId),
    enabled: !!userId,
  })

  const agingQuery = useQuery({
    queryKey: ['aging', 'receivable', businessId || userId],
    queryFn: () => getAgingReport('receivable'),
    enabled: !!userId,
  })

  const ratesQuery = useQuery({
    queryKey: ['exchange-rates', userId, businessId],
    queryFn: () => getExchangeRates(userId, businessId),
    enabled: !!userId,
  })

  const currencyOptions = useMemo(() => {
    const codes = (businessCurrencies || []).map((c) => c.code).filter(Boolean)
    return [...new Set([baseCurrency, 'CUP', 'USD', 'EUR', 'MXN', ...codes])]
  }, [businessCurrencies, baseCurrency])

  const balances = useMemo(() => statsQuery.data?.balance || {}, [statsQuery.data])
  const rates = useMemo(() => ratesQuery.data || {}, [ratesQuery.data])

  const agingByCurrency = useMemo(() => {
    const map = {}
    for (const row of agingQuery.data || []) {
      const code = (row.currency || baseCurrency).toUpperCase()
      map[code] = {
        overdue: agingOverdue(row),
        total: Number(row.total) || 0,
      }
    }
    return map
  }, [agingQuery.data, baseCurrency])

  const cashUsd = roundMoney(balances.USD ?? balances[baseCurrency] ?? 0)
  const cashBase = roundMoney(balances[baseCurrency] ?? 0)
  const rentSample = roundMoney(Math.max(50, Math.min(500, cashUsd * 0.1 || 200)))
  const payrollSample = roundMoney(Math.max(100, Math.min(800, cashUsd * 0.25 || 400)))
  const overdueUsd = roundMoney(agingByCurrency.USD?.overdue || agingByCurrency[baseCurrency]?.overdue || 0)
  const hasCupRate = Number(rates.CUP?.units_per_base || rates.CUP) > 0

  const context = useMemo(() => ({
    balances,
    rates,
    baseCurrency,
    agingByCurrency,
    currencies: currencyOptions,
  }), [balances, rates, baseCurrency, agingByCurrency, currencyOptions])

  const modeExamples = useMemo(() => ({
    affordability: [
      {
        id: 'af-rent',
        label: `Alquiler ${rentSample} USD`,
        apply: () => {
          setExpenseLabel('Alquiler')
          setExpenseAmount(String(rentSample))
          setExpenseCurrency('USD')
        },
      },
      {
        id: 'af-pay',
        label: `Nómina ${payrollSample} USD`,
        apply: () => {
          setExpenseLabel('Nómina')
          setExpenseAmount(String(payrollSample))
          setExpenseCurrency('USD')
        },
      },
      {
        id: 'af-half',
        label: cashUsd > 0 ? `Mitad de mi caja (${roundMoney(cashUsd / 2)} USD)` : 'Pago 100 USD',
        apply: () => {
          setExpenseLabel('Pago')
          setExpenseAmount(String(cashUsd > 0 ? roundMoney(cashUsd / 2) : 100))
          setExpenseCurrency('USD')
        },
      },
    ],
    fx: [
      {
        id: 'fx-100',
        label: hasCupRate ? '100 USD → CUP' : `100 ${baseCurrency} → USD`,
        apply: () => {
          setFxAmount('100')
          setFxFrom(hasCupRate ? 'USD' : baseCurrency)
          setFxTo(hasCupRate ? 'CUP' : 'USD')
        },
      },
      {
        id: 'fx-50',
        label: hasCupRate ? '50 USD → CUP' : `50 USD → ${baseCurrency}`,
        apply: () => {
          setFxAmount('50')
          setFxFrom('USD')
          setFxTo(hasCupRate ? 'CUP' : baseCurrency)
        },
      },
      {
        id: 'fx-cash',
        label: cashBase > 0 ? `Todo mi saldo ${baseCurrency} → USD` : '25 USD → CUP',
        apply: () => {
          if (cashBase > 0 && baseCurrency !== 'USD') {
            setFxAmount(String(cashBase))
            setFxFrom(baseCurrency)
            setFxTo('USD')
          } else {
            setFxAmount('25')
            setFxFrom('USD')
            setFxTo(hasCupRate ? 'CUP' : baseCurrency)
          }
        },
      },
    ],
    margin: [
      {
        id: 'mg-retail',
        label: 'Costo 8 · Venta 12 · 10 u.',
        apply: () => {
          setCost('8')
          setSellPrice('12')
          setQty('10')
          setMarginCurrency('USD')
        },
      },
      {
        id: 'mg-service',
        label: 'Costo 20 · Venta 45 · 1 u.',
        apply: () => {
          setCost('20')
          setSellPrice('45')
          setQty('1')
          setMarginCurrency('USD')
        },
      },
      {
        id: 'mg-tight',
        label: 'Costo 9.5 · Venta 10 · 50 u.',
        apply: () => {
          setCost('9.5')
          setSellPrice('10')
          setQty('50')
          setMarginCurrency('USD')
        },
      },
    ],
    collection: [
      {
        id: 'cx-50',
        label: 'Cobrar 50% de lo vencido',
        apply: () => {
          setCollectPct('50')
          setCollectCurrency(overdueUsd > 0 || balances.USD != null ? 'USD' : baseCurrency)
        },
      },
      {
        id: 'cx-100',
        label: 'Cobrar 100% de lo vencido',
        apply: () => {
          setCollectPct('100')
          setCollectCurrency(overdueUsd > 0 || balances.USD != null ? 'USD' : baseCurrency)
        },
      },
      {
        id: 'cx-25',
        label: 'Cobrar 25% esta semana',
        apply: () => {
          setCollectPct('25')
          setCollectCurrency(overdueUsd > 0 || balances.USD != null ? 'USD' : baseCurrency)
        },
      },
    ],
  }), [rentSample, payrollSample, cashUsd, cashBase, hasCupRate, baseCurrency, overdueUsd, balances.USD])

  const runMode = (m, params) => {
    const out = runCalculator(m, params, context)
    setResult(out)
    setMode(m)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Escenarios
          </CardTitle>
          <CardDescription>
            Cálculos rápidos con tus saldos y tasas. No gasta cupo de IA. Para preguntas libres usa el Asistente.
          </CardDescription>
        </CardHeader>
        {(cashUsd > 0 || cashBase > 0) && (
          <CardContent className="pt-0">
            <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Tu caja ahora: {formatCurrency(cashBase, baseCurrency)}
              {baseCurrency !== 'USD' && balances.USD != null ? ` · ${formatCurrency(cashUsd, 'USD')}` : ''}
              {overdueUsd > 0 ? ` · CxC vencida ≈ ${formatCurrency(overdueUsd, 'USD')}` : ''}
            </p>
          </CardContent>
        )}
      </Card>

      <Tabs value={mode} onValueChange={setMode}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
          {MODES.map((m) => (
            <TabsTrigger key={m.id} value={m.id} className="text-xs sm:text-sm">{m.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="affordability" className="mt-4 space-y-3">
          <ExampleChips
            label="Rellena con un ejemplo (según tu caja)"
            examples={modeExamples.affordability}
            onSelect={(ex) => ex.apply?.()}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Concepto</Label>
              <Input value={expenseLabel} onChange={(e) => setExpenseLabel(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Monto</Label>
              <Input type="number" inputMode="decimal" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select value={expenseCurrency} onValueChange={setExpenseCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => runMode('affordability', {
              expenses: [{ label: expenseLabel || 'Gasto', amount: expenseAmount, currency: expenseCurrency }],
            })}
          >
            Calcular
          </Button>
        </TabsContent>

        <TabsContent value="fx" className="mt-4 space-y-3">
          <ExampleChips
            label="Rellena con un ejemplo"
            examples={modeExamples.fx}
            onSelect={(ex) => ex.apply?.()}
          />
          {!hasCupRate && (
            <p className="text-xs text-muted-foreground">
              Tip: configura la tasa CUP en Configuración → Monedas para conversiones USD↔CUP.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Monto</Label>
              <Input type="number" inputMode="decimal" value={fxAmount} onChange={(e) => setFxAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>De</Label>
              <Select value={fxFrom} onValueChange={setFxFrom}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>A</Label>
              <Select value={fxTo} onValueChange={setFxTo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="button" onClick={() => runMode('fx', { amount: fxAmount, fromCurrency: fxFrom, toCurrency: fxTo })}>
            Convertir
          </Button>
        </TabsContent>

        <TabsContent value="margin" className="mt-4 space-y-3">
          <ExampleChips
            label="Rellena con un ejemplo"
            examples={modeExamples.margin}
            onSelect={(ex) => ex.apply?.()}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label>Costo unitario</Label>
              <Input type="number" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Precio venta</Label>
              <Input type="number" inputMode="decimal" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cantidad</Label>
              <Input type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select value={marginCurrency} onValueChange={setMarginCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="button" onClick={() => runMode('margin', { cost, sellPrice, quantity: qty, currency: marginCurrency })}>
            Calcular margen
          </Button>
        </TabsContent>

        <TabsContent value="collection" className="mt-4 space-y-3">
          <ExampleChips
            label="Rellena con un ejemplo"
            examples={modeExamples.collection}
            onSelect={(ex) => ex.apply?.()}
          />
          {overdueUsd <= 0 && (
            <p className="text-xs text-muted-foreground">
              Ahora no hay CxC vencida en USD (o es 0). El resultado puede ser 0; igual puedes probar el %.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>% de lo vencido a cobrar</Label>
              <Input type="number" inputMode="decimal" value={collectPct} onChange={(e) => setCollectPct(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select value={collectCurrency} onValueChange={setCollectCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="button" onClick={() => runMode('collection', { percent: collectPct, currency: collectCurrency })}>
            Simular cobro
          </Button>
        </TabsContent>
      </Tabs>

      {result && (
        <Card className={result.ok === false ? 'border-destructive/40' : 'border-success/40'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{result.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {result.mode === 'affordability' && (result.lines || []).map((line, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                <span>{line.label}</span>
                <span className={line.ok ? 'text-success' : 'text-destructive'}>
                  −{formatCurrency(line.amount, line.currency)} → queda {formatCurrency(line.after, line.currency)}
                </span>
              </div>
            ))}
            {result.mode === 'fx' && result.ok && (
              <p>
                {formatCurrency(result.amount, result.fromCurrency)} = <strong>{formatCurrency(result.converted, result.toCurrency)}</strong>
                <span className="text-muted-foreground"> (tasa {Number(result.rate).toFixed(6)})</span>
              </p>
            )}
            {result.mode === 'fx' && !result.ok && <p className="text-destructive">{result.message}</p>}
            {result.mode === 'margin' && (
              <ul className="space-y-1">
                <li>Ganancia unitaria: <strong className={result.unitProfit >= 0 ? 'text-success' : 'text-destructive'}>{formatCurrency(result.unitProfit, result.currency)}</strong></li>
                <li>Margen: <strong>{Number(result.marginPct).toFixed(1)}%</strong></li>
                <li>Ganancia total ({result.quantity} u.): <strong>{formatCurrency(result.totalProfit, result.currency)}</strong></li>
              </ul>
            )}
            {result.mode === 'collection' && (
              <div className="space-y-3">
                <p>
                  De {formatCurrency(result.overdue, result.currency)} vencido, cobrando {result.percent}% entrarían{' '}
                  <strong className="text-success">{formatCurrency(result.collectable, result.currency)}</strong>.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => navigate('/cuentas')}>
                  Ir a Por cobrar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
