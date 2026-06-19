import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { getDashboardStats, getRecentActivity, getFinancialDistribution, getYearlySummary } from '@/services/finanzas'
import { useQuery } from '@tanstack/react-query'
import { useCurrency } from '@/context/CurrencyContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  Settings,
  DollarSign,
  Activity,
  Coins,
  PlusCircle,
  ArrowRight
} from 'lucide-react'
import { useChartAnimation } from '@/hooks/useChartAnimation'

// Paleta del donut "Por categoría": ingresos en VERDES y gastos en ROJOS/NARANJAS,
// con un tono distinto por categoría dentro de cada familia. Así el TIPO se
// distingue por familia de color (no solo por tono) y, dentro de un mismo tipo,
// cada categoría tiene su matiz. Colores saturados que leen bien en claro y oscuro.
const INCOME_COLORS = [
  'hsl(160 84% 32%)',
  'hsl(142 71% 38%)',
  'hsl(173 80% 33%)',
  'hsl(122 52% 42%)',
  'hsl(188 72% 36%)',
  'hsl(100 48% 40%)'
]
const EXPENSE_COLORS = [
  'hsl(0 72% 51%)',
  'hsl(14 88% 52%)',
  'hsl(25 95% 50%)',
  'hsl(36 92% 48%)',
  'hsl(348 74% 47%)',
  'hsl(20 68% 42%)'
]

export default function Dashboard() {
  const chartAnim = useChartAnimation()
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { businessCurrencies, formatCurrency } = useCurrency()

  // Filtros del panel
  const [summaryFilter, setSummaryFilter] = useState('ALL')
  const [barTypeFilter, setBarTypeFilter] = useState('all')
  const [distTypeFilter, setDistTypeFilter] = useState('all')
  // Moneda única del panel (P3.8): gobierna balance, tarjetas y gráficas.
  // Antes cada tarjeta apilaba N monedas y cada gráfica tenía su propio selector.
  const [panelCurrency, setPanelCurrency] = useState('')

  // Selecciona la moneda principal en cuanto cargan las monedas del negocio.
  useEffect(() => {
    if (businessCurrencies.length > 0 && !panelCurrency) {
      const defaultCurr = businessCurrencies.find(c => c.is_default) || businessCurrencies[0]
      setPanelCurrency(defaultCurr.code)
    }
  }, [businessCurrencies, panelCurrency])

  const userId = session?.user?.id
  const currentYear = useMemo(() => new Date().getFullYear(), [])

  const dashboardQueryOptions = useMemo(() => ({
    enabled: !!userId && !!businessId,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
    retry: 1
  }), [userId, businessId])

  const statsQuery = useQuery({
    queryKey: ['dashboard', 'stats', userId, businessId],
    queryFn: () => getDashboardStats(userId, businessId),
    ...dashboardQueryOptions
  })

  const recentActivityQuery = useQuery({
    queryKey: ['dashboard', 'recentActivity', userId, businessId],
    queryFn: () => getRecentActivity(userId, businessId),
    ...dashboardQueryOptions
  })

  const financialDistributionQuery = useQuery({
    queryKey: ['dashboard', 'distribution', { userId, businessId, distTypeFilter, panelCurrency }],
    queryFn: () => getFinancialDistribution(userId, businessId, distTypeFilter, panelCurrency),
    enabled: !!userId && !!businessId && !!panelCurrency,
    ...dashboardQueryOptions
  })

  const yearlySummaryQuery = useQuery({
    queryKey: ['dashboard', 'yearlySummary', { userId, businessId, currentYear, panelCurrency }],
    queryFn: () => getYearlySummary(userId, businessId, currentYear, panelCurrency),
    enabled: !!userId && !!businessId && !!panelCurrency,
    ...dashboardQueryOptions
  })

  const stats = statsQuery.data || { balance: {}, income: { current: {}, change: {} }, expense: { current: {}, change: {} }}
  const recentActivityCount = recentActivityQuery.data?.length ?? 0
  const financialDistribution = financialDistributionQuery.data ?? []
  const yearData = yearlySummaryQuery.data ?? {}

  const monthNames = useMemo(() => (["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]), [])

  const financialData = useMemo(() => {
    if (!yearData || Object.keys(yearData).length === 0) return []

    let monthsToInclude = []
    if (summaryFilter === 'Q1') monthsToInclude = [1, 2, 3]
    else if (summaryFilter === 'Q2') monthsToInclude = [4, 5, 6]
    else if (summaryFilter === 'Q3') monthsToInclude = [7, 8, 9]
    else if (summaryFilter === 'Q4') monthsToInclude = [10, 11, 12]
    else monthsToInclude = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

    return monthsToInclude.map(month => {
      const data = yearData[month]
      if (!data) return { name: monthNames[month - 1], ingresos: 0, gastos: 0 }

      let ingresos = 0
      let gastos = 0

      if (barTypeFilter === 'all' || barTypeFilter === 'income') {
        ingresos = data.income?.[panelCurrency] || 0
      }
      if (barTypeFilter === 'all' || barTypeFilter === 'expense') {
        gastos = data.expense?.[panelCurrency] || 0
      }

      return { name: monthNames[month - 1], ingresos, gastos }
    })
  }, [panelCurrency, barTypeFilter, monthNames, summaryFilter, yearData])

  const formatPercentage = (val) => {
    if (val === null || val === undefined) return null
    const sign = val >= 0 ? '+' : ''
    return `${sign}${val.toFixed(1)}%`
  }

  // Agrupa ingresos primero y luego gastos, y asigna un tono por categoría:
  // verdes a los ingresos, rojos/naranjas a los gastos. Resultado: el donut
  // muestra un arco verde (ingresos) y un arco cálido (gastos) bien diferenciados.
  const coloredDistribution = useMemo(() => {
    let inc = 0
    let exp = 0
    return [...financialDistribution]
      .sort((a, b) => (a.type === b.type ? b.value - a.value : a.type === 'income' ? -1 : 1))
      .map(d => {
        const isIncome = d.type === 'income'
        const ramp = isIncome ? INCOME_COLORS : EXPENSE_COLORS
        const i = isIncome ? inc++ : exp++
        return { ...d, fill: ramp[i % ramp.length] }
      })
  }, [financialDistribution])

  // --- Datos derivados de la moneda del panel ---
  const currentBalance = stats.balance[panelCurrency] || 0
  const incomeMonth = stats.income.current[panelCurrency] || 0
  const expenseMonth = stats.expense.current[panelCurrency] || 0
  const netMonth = incomeMonth - expenseMonth
  const incomeChange = stats.income.change[panelCurrency]
  const expenseChange = stats.expense.change[panelCurrency]
  const otherBalances = businessCurrencies.filter(c => c.code !== panelCurrency)

  // ¿Hay actividad real? Si no, mostramos el onboarding guiado (empty state).
  const hasData = recentActivityCount > 0 || businessCurrencies.some(c =>
    (stats.balance[c.code] || 0) !== 0 ||
    (stats.income.current[c.code] || 0) !== 0 ||
    (stats.expense.current[c.code] || 0) !== 0
  )
  const ready = statsQuery.isSuccess && recentActivityQuery.isSuccess
  const showOnboarding = ready && !hasData

  const quickLinks = [
    { title: 'Finanzas', icon: <DollarSign className="h-7 w-7 mb-2 text-primary" />, description: 'Ingresos y gastos', to: '/finanzas' },
    { title: 'Almacén', icon: <Package className="h-7 w-7 mb-2 text-primary" />, description: 'Control de inventario', to: '/almacen' },
    { title: 'Configuración', icon: <Settings className="h-7 w-7 mb-2 text-primary" />, description: 'Ajustes del sistema', to: '/configuracion' },
  ]

  const onboardingSteps = [
    { n: 1, title: 'Elige tu moneda principal', hint: 'Ir a Configuración', to: '/configuracion', active: true },
    { n: 2, title: 'Registra tu primer ingreso o gasto', hint: 'Nuevo movimiento', to: '/finanzas', active: true },
    { n: 3, title: 'Vuelve aquí y mira cómo vas', hint: 'Tu balance y resultado del mes', to: null, active: false },
  ]

  return (
    <div className="space-y-8">
      {/* Encabezado: saludo en lenguaje llano + selector de moneda del panel */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">¿Cómo va tu negocio?</h1>
          <p className="text-muted-foreground">Tu resumen financiero de un vistazo.</p>
        </div>
        {!showOnboarding && businessCurrencies.length > 1 && (
          <div className="flex items-center gap-2 shrink-0">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <Select value={panelCurrency} onValueChange={setPanelCurrency}>
              <SelectTrigger className="h-10 w-[130px]">
                <SelectValue placeholder="Moneda" />
              </SelectTrigger>
              <SelectContent>
                {businessCurrencies.map(curr => (
                  <SelectItem key={curr.code} value={curr.code}>{curr.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {showOnboarding ? (
        /* ---------- Estado de primer uso (empty state guiado) ---------- */
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Empieza en 3 pasos</CardTitle>
              <CardDescription>Configura tu negocio y en menos de 5 minutos verás cómo vas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {onboardingSteps.map(step => {
                const inner = (
                  <div className={`flex items-center gap-3 rounded-lg border p-3 ${step.active ? 'hover:bg-accent/40 transition-colors' : ''}`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${step.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {step.n}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{step.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        {step.hint}
                        {step.active && <ArrowRight className="h-3 w-3" />}
                      </p>
                    </div>
                  </div>
                )
                return step.to ? (
                  <Link key={step.n} to={step.to} className="block">{inner}</Link>
                ) : (
                  <div key={step.n}>{inner}</div>
                )
              })}
            </CardContent>
          </Card>

          <div>
            <h2 className="text-lg font-semibold mb-3">Accesos rápidos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {quickLinks.map((link) => (
                <Link key={link.to} to={link.to}>
                  <Card className="transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex flex-col items-center text-center">
                        {link.icon}
                        <CardTitle className="text-base">{link.title}</CardTitle>
                        <CardDescription>{link.description}</CardDescription>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* ---------- Panel con datos ---------- */
        <>
          {/* Tarjeta héroe: el dinero disponible (la respuesta a "¿cómo voy?") */}
          <Card className="bg-primary text-primary-foreground shadow-md border-0">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center gap-2 text-primary-foreground/80">
                <Wallet className="h-4 w-4" />
                <span className="text-sm font-medium">Tu dinero disponible</span>
              </div>
              {businessCurrencies.length === 0 ? (
                <p className="mt-2 text-sm text-primary-foreground/80">Sin monedas configuradas</p>
              ) : (
                <>
                  <p className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                    {formatCurrency(currentBalance, panelCurrency)}
                  </p>
                  {otherBalances.length > 0 && (
                    <p className="mt-2 text-xs text-primary-foreground/80">
                      {otherBalances.map(c => `${formatCurrency(stats.balance[c.code] || 0, c.code)}`).join('  ·  ')}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Tres tarjetas de apoyo: entró, salió, resultado del mes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Entró este mes</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold text-success">
                  +{formatCurrency(incomeMonth, panelCurrency)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {incomeChange === null || incomeChange === undefined
                    ? 'Sin datos del mes anterior'
                    : `${formatPercentage(incomeChange)} vs mes anterior`}
                </p>
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Salió este mes</CardTitle>
                <ArrowDownRight className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold text-destructive">
                  −{formatCurrency(expenseMonth, panelCurrency)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {expenseChange === null || expenseChange === undefined
                    ? 'Sin datos del mes anterior'
                    : `${formatPercentage(expenseChange)} vs mes anterior`}
                </p>
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Resultado del mes</CardTitle>
                {netMonth > 0
                  ? <TrendingUp className="h-4 w-4 text-success" />
                  : netMonth < 0
                    ? <TrendingDown className="h-4 w-4 text-destructive" />
                    : <Minus className="h-4 w-4 text-muted-foreground" />}
              </CardHeader>
              <CardContent>
                <div className={`text-xl sm:text-2xl font-bold ${netMonth > 0 ? 'text-success' : netMonth < 0 ? 'text-destructive' : ''}`}>
                  {netMonth > 0 ? '+' : netMonth < 0 ? '−' : ''}{formatCurrency(Math.abs(netMonth), panelCurrency)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {netMonth > 0 ? 'Vas ganando' : netMonth < 0 ? 'Vas en números rojos' : 'En equilibrio'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Resumen de actividad (reemplaza la 5ª tarjeta) */}
          <Link to="/finanzas" className="block">
            <div className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-accent/40">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Activity className="h-4 w-4" />
                <span><span className="font-semibold text-foreground">{recentActivityCount}</span> operaciones registradas este mes</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>

          {/* Accesos rápidos */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Accesos rápidos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {quickLinks.map((link) => (
                <Link key={link.to} to={link.to}>
                  <Card className="transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex flex-col items-center text-center">
                        {link.icon}
                        <CardTitle className="text-base">{link.title}</CardTitle>
                        <CardDescription>{link.description}</CardDescription>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {/* Gráficas (secundarias) */}
          <div className="grid gap-6 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Ingresos vs gastos</CardTitle>
                    <CardDescription>Comparativa mensual ({panelCurrency || '—'})</CardDescription>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select value={barTypeFilter} onValueChange={setBarTypeFilter}>
                      <SelectTrigger className="h-9 w-full sm:w-[120px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="income">Ingresos</SelectItem>
                        <SelectItem value="expense">Gastos</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={summaryFilter} onValueChange={setSummaryFilter}>
                      <SelectTrigger className="h-9 w-full sm:w-[150px] text-xs">
                        <SelectValue placeholder="Periodo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Año completo</SelectItem>
                        <SelectItem value="Q1">Primer trimestre</SelectItem>
                        <SelectItem value="Q2">Segundo trimestre</SelectItem>
                        <SelectItem value="Q3">Tercer trimestre</SelectItem>
                        <SelectItem value="Q4">Cuarto trimestre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-2 sm:pl-5">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={financialData} margin={{ left: 12, right: 16, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={64}
                      tickFormatter={(value) => formatCurrency(value, panelCurrency)}
                    />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{
                        borderRadius: '8px',
                        backgroundColor: 'hsl(var(--card))',
                        color: 'hsl(var(--card-foreground))',
                        border: '1px solid hsl(var(--border))',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.08)'
                      }}
                      formatter={(value) => formatCurrency(value, panelCurrency)}
                    />
                    <Legend />
                    {(barTypeFilter === 'all' || barTypeFilter === 'income') && (
                      <Bar dataKey="ingresos" name="Ingresos" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} {...chartAnim} />
                    )}
                    {(barTypeFilter === 'all' || barTypeFilter === 'expense') && (
                      <Bar dataKey="gastos" name="Gastos" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} {...chartAnim} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Por categoría</CardTitle>
                    <CardDescription>Este mes · {panelCurrency || '—'}</CardDescription>
                  </div>
                  <Select value={distTypeFilter} onValueChange={setDistTypeFilter}>
                    <SelectTrigger className="h-9 w-full sm:w-[120px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="income">Ingresos</SelectItem>
                      <SelectItem value="expense">Gastos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {coloredDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={coloredDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={2}
                        dataKey="value"
                        {...chartAnim}
                      >
                        {coloredDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          backgroundColor: 'hsl(var(--card))',
                          color: 'hsl(var(--card-foreground))',
                          border: '1px solid hsl(var(--border))',
                          boxShadow: '0 8px 30px rgba(0,0,0,0.08)'
                        }}
                        formatter={(value, name, item) => [formatCurrency(value, panelCurrency), item?.payload?.name]}
                      />
                      <Legend
                        formatter={(value, entry) => `${entry.payload.name} (${entry.payload.type === 'income' ? 'Ingreso' : 'Gasto'})`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[320px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                    <PlusCircle className="h-8 w-8 opacity-50" />
                    <p className="text-sm">Sin movimientos este mes<br />para esta selección</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
