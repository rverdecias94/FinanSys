import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { getDashboardStats, getRecentActivity, getFinancialDistribution, getYearlySummary } from '@/services/finanzas'
import { useQuery } from '@tanstack/react-query'
import { useCurrency } from '@/context/CurrencyContext'
import { PermissionModeToggle } from '@/components/common/PermissionModeToggle'
import { DashboardPermissions } from '@/components/dashboard/DashboardPermissions'
import { usePermissionMode } from '@/context/PermissionModeContext'
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
  TrendingUp,
  TrendingDown,
  Package,
  Settings,
  DollarSign,
  Activity,
  ChartArea
} from 'lucide-react'

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))'
]

export default function Dashboard() {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { businessCurrencies, formatCurrency, loading: currencyLoading } = useCurrency()
  const { permissionModeEnabled } = usePermissionMode()
  const [summaryFilter, setSummaryFilter] = useState('ALL')

  // Filtros para el gráfico de distribución
  const [distTypeFilter, setDistTypeFilter] = useState('all')
  const [distCurrencyFilter, setDistCurrencyFilter] = useState('')

  // Nuevos filtros para el gráfico de barras
  const [barTypeFilter, setBarTypeFilter] = useState('all')
  const [barCurrencyFilter, setBarCurrencyFilter] = useState('')

  // Set default filters when currencies load
  useEffect(() => {
    if (businessCurrencies.length > 0 && !distCurrencyFilter) {
      const defaultCurr = businessCurrencies.find(c => c.is_default) || businessCurrencies[0]
      setDistCurrencyFilter(defaultCurr.code)
      setBarCurrencyFilter(defaultCurr.code)
    }
  }, [businessCurrencies, distCurrencyFilter])

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
    queryKey: ['dashboard', 'distribution', { userId, businessId, distTypeFilter, distCurrencyFilter }],
    queryFn: () => getFinancialDistribution(userId, businessId, distTypeFilter, distCurrencyFilter),
    enabled: !!userId && !!businessId && !!distCurrencyFilter,
    ...dashboardQueryOptions
  })

  const yearlySummaryQuery = useQuery({
    queryKey: ['dashboard', 'yearlySummary', { userId, businessId, currentYear, barCurrencyFilter }],
    queryFn: () => getYearlySummary(userId, businessId, currentYear, barCurrencyFilter),
    enabled: !!userId && !!businessId && !!barCurrencyFilter,
    ...dashboardQueryOptions
  })

  const stats = statsQuery.data || { balance: {}, income: { current: {}, change: {} }, expense: { current: {}, change: {} } }
  const recentActivityCount = recentActivityQuery.data?.length ?? 0
  const financialDistribution = financialDistributionQuery.data ?? []
  const yearData = yearlySummaryQuery.data ?? {}

  const loading = statsQuery.isLoading
    || recentActivityQuery.isLoading
    || currencyLoading

  const hasError = statsQuery.isError
    || recentActivityQuery.isError

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

      // data structure: { income: { USD: 100, CUP: 200 }, expense: ... }
      // But getYearlySummary already filters by currency if provided.
      // If we filtered by currency in the query, we just sum up whatever is there (which should be just that currency)
      // or access by key.

      // Let's check getYearlySummary implementation again.
      // It returns { 1: { income: { USD: 100 }, ... } }

      const targetCurrency = barCurrencyFilter

      if (barTypeFilter === 'all' || barTypeFilter === 'income') {
        ingresos = data.income?.[targetCurrency] || 0
      }

      if (barTypeFilter === 'all' || barTypeFilter === 'expense') {
        gastos = data.expense?.[targetCurrency] || 0
      }

      return {
        name: monthNames[month - 1],
        ingresos,
        gastos
      }
    })
  }, [barCurrencyFilter, barTypeFilter, monthNames, summaryFilter, yearData])

  const formatPercentage = (val) => {
    if (val === null || val === undefined) return null
    const sign = val >= 0 ? '+' : ''
    return `${sign}${val.toFixed(1)}%`
  }

  const getPieColor = (entry, index) => {
    const baseIndex = entry.type === 'income' ? 0 : 4
    return CHART_COLORS[(baseIndex + index) % CHART_COLORS.length]
  }

  const quickLinks = [
    {
      title: 'Finanzas',
      icon: <DollarSign className="h-8 w-8 mb-2 text-primary" />,
      description: 'Gestiona ingresos y egresos',
      to: '/finanzas',
      color: 'bg-card hover:bg-accent/10 border-border'
    },
    {
      title: 'Almacén',
      icon: <Package className="h-8 w-8 mb-2 text-primary" />,
      description: 'Control de inventario',
      to: '/almacen',
      color: 'bg-card hover:bg-accent/10 border-border'
    },
    {
      title: 'Configuración',
      icon: <Settings className="h-8 w-8 mb-2 text-primary" />,
      description: 'Ajustes del sistema',
      to: '/configuracion',
      color: 'bg-card hover:bg-accent/10 border-border'
    },
  ]

  // Evitar recarga visual completa del panel; mostrar contenido con datos disponibles

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ChartArea className="w-8 h-8 text-primary" />
            </div>
            Panel General
          </h1>
          <p className="text-muted-foreground">Bienvenido al sistema de gestión contable.</p>
        </div>
        <div className="flex items-center gap-4">
          <PermissionModeToggle compact />
        </div>
      </div>

      {/* Permission Dashboard - Solo visible cuando el modo está activado */}
      {permissionModeEnabled && (
        <div className="mb-6">
          <DashboardPermissions />
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-2 grid-cols-2 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm font-medium">
              Balance Actual
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {businessCurrencies.map(curr => (
                <div key={curr.code} className="flex items-baseline gap-2">
                  <span className="text-xl sm:text-2xl font-bold">
                    {formatCurrency(stats.balance[curr.code] || 0, curr.code)}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">{curr.code}</span>
                </div>
              ))}
              {businessCurrencies.length === 0 && <span className="text-sm text-muted-foreground">Sin monedas configuradas</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Disponible
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ingresos del mes
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {businessCurrencies.map(curr => (
                <div key={curr.code} className="flex items-baseline gap-2">
                  <span className="text-lg sm:text-xl font-bold text-success">
                    {formatCurrency(stats.income.current[curr.code] || 0, curr.code)}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">{curr.code}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-2 flex flex-col">
              {businessCurrencies.map(curr => {
                const change = stats.income.change[curr.code]
                if (change === null || change === undefined) return null
                return (
                  <span key={curr.code}>{formatPercentage(change)} ({curr.code})</span>
                )
              })}
              {Object.values(stats.income.change).every(v => v === null) && 'Sin datos previos'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Gastos del mes
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {businessCurrencies.map(curr => (
                <div key={curr.code} className="flex items-baseline gap-2">
                  <span className="text-lg sm:text-xl font-bold text-destructive">
                    {formatCurrency(stats.expense.current[curr.code] || 0, curr.code)}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">{curr.code}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-2 flex flex-col">
              {businessCurrencies.map(curr => {
                const change = stats.expense.change[curr.code]
                if (change === null || change === undefined) return null
                return (
                  <span key={curr.code}>{formatPercentage(change)} ({curr.code})</span>
                )
              })}
              {Object.values(stats.expense.change).every(v => v === null) && 'Sin datos previos'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Beneficios Netos
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {businessCurrencies.map(curr => {
                const net = (stats.income.current[curr.code] || 0) - (stats.expense.current[curr.code] || 0)
                return (
                  <div key={curr.code} className="flex items-baseline gap-2">
                    <span className={`text-lg sm:text-xl font-bold ${net >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(net, curr.code)}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">{curr.code}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Movimientos del último mes
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{recentActivityCount}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Operaciones registradas (30 días)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Links */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Accesos Rápidos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickLinks.map((link) => (
            <Link key={link.to} to={link.to}>
              <Card className={`transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] cursor-pointer h-full ${link.color}`}>
                <CardHeader>
                  <div className="flex flex-col items-center text-center">
                    {link.icon}
                    <CardTitle className="text-lg">{link.title}</CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="md:col-span-2 lg:col-span-4">
          <CardHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Resumen Financiero</CardTitle>
                  <CardDescription>
                    Comparativa de ingresos vs gastos
                  </CardDescription>
                </div>
                <Select value={summaryFilter} onValueChange={setSummaryFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Periodo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Año Completo</SelectItem>
                    <SelectItem value="Q1">Primer Trimestre</SelectItem>
                    <SelectItem value="Q2">Segundo Trimestre</SelectItem>
                    <SelectItem value="Q3">Tercer Trimestre</SelectItem>
                    <SelectItem value="Q4">Cuarto Trimestre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtros para el gráfico de barras */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo</label>
                  <Select value={barTypeFilter} onValueChange={setBarTypeFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="income">Ingresos</SelectItem>
                      <SelectItem value="expense">Gastos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Moneda</label>
                  <Select value={barCurrencyFilter} onValueChange={setBarCurrencyFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Seleccionar moneda" />
                    </SelectTrigger>
                    <SelectContent>
                      {businessCurrencies.map(curr => (
                        <SelectItem key={curr.code} value={curr.code}>{curr.code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={financialData} margin={{ left: 12, right: 24, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                  tickFormatter={(value) => formatCurrency(value, barCurrencyFilter)}
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
                  formatter={(value) => formatCurrency(value, barCurrencyFilter)}
                />
                <Legend />
                {(barTypeFilter === 'all' || barTypeFilter === 'income') && (
                  <Bar dataKey="ingresos" name="Ingresos" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                )}
                {(barTypeFilter === 'all' || barTypeFilter === 'expense') && (
                  <Bar dataKey="gastos" name="Gastos" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-3">
          <CardHeader>
            <div className="space-y-4">
              <div>
                <CardTitle>Distribución Financiera</CardTitle>
                <CardDescription>
                  Ingresos y Gastos por categoría
                </CardDescription>
              </div>

              {/* Filtros para el gráfico de distribución */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo</label>
                  <Select value={distTypeFilter} onValueChange={setDistTypeFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="income">Ingresos</SelectItem>
                      <SelectItem value="expense">Gastos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Moneda</label>
                  <Select value={distCurrencyFilter} onValueChange={setDistCurrencyFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Seleccionar moneda" />
                    </SelectTrigger>
                    <SelectContent>
                      {businessCurrencies.map(curr => (
                        <SelectItem key={curr.code} value={curr.code}>{curr.code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {financialDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={financialDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {financialDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getPieColor(entry, index)} />
                    ))}
                  </Pie>
                  <Legend
                    formatter={(value, entry) => `${entry.payload.name} (${entry.payload.type === 'income' ? 'Ingreso' : 'Gasto'})`}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[350px] items-center justify-center text-muted-foreground">
                No hay datos para la combinación seleccionada
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
