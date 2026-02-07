import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/hooks/useSession'
import { getDashboardStats, getRecentActivity, getFinancialDistribution, getYearlySummary } from '@/services/finanzas'
import { useQuery } from '@tanstack/react-query'
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

const COLORS_INCOME = ['#22c55e', '#16a34a', '#15803d', '#14532d', '#4ade80', '#86efac']
const COLORS_EXPENSE = ['#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#f87171', '#fca5a5']

export default function Dashboard() {
  const { session } = useSession()
  const [summaryFilter, setSummaryFilter] = useState('ALL')

  // Filtros para el gráfico de distribución
  const [distTypeFilter, setDistTypeFilter] = useState('all')
  const [distCurrencyFilter, setDistCurrencyFilter] = useState('USD')

  // Nuevos filtros para el gráfico de barras
  const [barTypeFilter, setBarTypeFilter] = useState('all')
  const [barCurrencyFilter, setBarCurrencyFilter] = useState('USD')

  const userId = session?.user?.id
  const currentYear = useMemo(() => new Date().getFullYear(), [])
  const defaultStats = useMemo(() => ({
    balance: { usd: 0, cup: 0 },
    income: { current: { usd: 0, cup: 0 }, change: { usd: null, cup: null } },
    expense: { current: { usd: 0, cup: 0 }, change: { usd: null, cup: null } }
  }), [])

  const dashboardQueryOptions = useMemo(() => ({
    enabled: !!userId,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: 1
  }), [userId])

  const statsQuery = useQuery({
    queryKey: ['dashboard', 'stats', userId],
    queryFn: () => getDashboardStats(userId),
    ...dashboardQueryOptions
  })

  const recentActivityQuery = useQuery({
    queryKey: ['dashboard', 'recentActivity', userId],
    queryFn: () => getRecentActivity(userId),
    ...dashboardQueryOptions
  })

  const financialDistributionQuery = useQuery({
    queryKey: ['dashboard', 'distribution', { userId, distTypeFilter, distCurrencyFilter }],
    queryFn: () => getFinancialDistribution(userId, distTypeFilter, distCurrencyFilter),
    ...dashboardQueryOptions
  })

  const yearlySummaryQuery = useQuery({
    queryKey: ['dashboard', 'yearlySummary', { userId, currentYear, barCurrencyFilter }],
    queryFn: () => getYearlySummary(userId, currentYear, barCurrencyFilter),
    ...dashboardQueryOptions
  })

  const stats = statsQuery.data ?? defaultStats
  const recentActivityCount = recentActivityQuery.data?.length ?? 0
  const financialDistribution = financialDistributionQuery.data ?? []
  const yearData = yearlySummaryQuery.data ?? {}

  const loading = statsQuery.isLoading
    || recentActivityQuery.isLoading
    || financialDistributionQuery.isLoading
    || yearlySummaryQuery.isLoading

  const hasError = statsQuery.isError
    || recentActivityQuery.isError
    || financialDistributionQuery.isError
    || yearlySummaryQuery.isError

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

      let ingresos = 0
      let gastos = 0

      if (barTypeFilter === 'all' || barTypeFilter === 'income') {
        ingresos = barCurrencyFilter === 'USD' ? (data?.income?.USD || 0) : (data?.income?.CUP || 0)
      }

      if (barTypeFilter === 'all' || barTypeFilter === 'expense') {
        gastos = barCurrencyFilter === 'USD' ? (data?.expense?.USD || 0) : (data?.expense?.CUP || 0)
      }

      return {
        name: monthNames[month - 1],
        ingresos,
        gastos
      }
    })
  }, [barCurrencyFilter, barTypeFilter, monthNames, summaryFilter, yearData])

  const formatMoney = (val) => {
    return new Intl.NumberFormat('en-US').format(val)
  }

  const formatPercentage = (val) => {
    if (val === null || val === undefined) return null
    const sign = val >= 0 ? '+' : ''
    return `${sign}${val.toFixed(1)}%`
  }

  const getPieColor = (entry, index) => {
    if (entry.type === 'income') {
      return COLORS_INCOME[index % COLORS_INCOME.length]
    }
    return COLORS_EXPENSE[index % COLORS_EXPENSE.length]
  }

  const quickLinks = [
    {
      title: 'Finanzas',
      icon: <DollarSign className="h-8 w-8 mb-2 text-primary" />,
      description: 'Gestiona ingresos y egresos',
      to: '/finanzas',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200'
    },
    {
      title: 'Almacén',
      icon: <Package className="h-8 w-8 mb-2 text-primary" />,
      description: 'Control de inventario',
      to: '/almacen',
      color: 'bg-green-50 hover:bg-green-100 border-green-200'
    },
    {
      title: 'Configuración',
      icon: <Settings className="h-8 w-8 mb-2 text-primary" />,
      description: 'Ajustes del sistema',
      to: '/configuracion',
      color: 'bg-slate-50 hover:bg-slate-100 border-slate-200'
    },
  ]

  if (loading) {
    return <div className="flex justify-center items-center min-h-[60vh]">Cargando datos del panel...</div>
  }

  if (hasError) {
    return <div className="flex justify-center items-center min-h-[60vh]">No se pudieron cargar los datos del panel.</div>
  }

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

      </div>

      {/* Stats Cards */}
      <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm font-medium">
              Balance Total
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-bold">{formatMoney(stats.balance.usd)}</span>
                <span className="text-xs font-medium text-muted-foreground">USD</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg sm:text-xl font-semibold text-muted-foreground">{formatMoney(stats.balance.cup)}</span>
                <span className="text-xs font-medium text-muted-foreground">CUP</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Disponible
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ingresos
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-bold text-green-600">{formatMoney(stats.income.current.usd, 'USD')}</span>
                <span className="text-xs font-medium text-muted-foreground">USD</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg sm:text-xl font-semibold text-green-600/80">{formatMoney(stats.income.current.cup, 'CUP')}</span>
                <span className="text-xs font-medium text-muted-foreground">CUP</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {stats.income.change.usd !== null ? (
                <span>{formatPercentage(stats.income.change.usd)} (USD)</span>
              ) : null}
              {stats.income.change.usd !== null && stats.income.change.cup !== null ? ' / ' : ''}
              {stats.income.change.cup !== null ? (
                <span>{formatPercentage(stats.income.change.cup)} (CUP)</span>
              ) : null}
              {stats.income.change.usd === null && stats.income.change.cup === null ? 'Sin datos mes anterior' : ' respecto al mes pasado'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Gastos
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-bold text-red-600">{formatMoney(stats.expense.current.usd, 'USD')}</span>
                <span className="text-xs font-medium text-muted-foreground">USD</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg sm:text-xl font-semibold text-red-600/80">{formatMoney(stats.expense.current.cup, 'CUP')}</span>
                <span className="text-xs font-medium text-muted-foreground">CUP</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {stats.expense.change.usd !== null ? (
                <span>{formatPercentage(stats.expense.change.usd)} (USD)</span>
              ) : null}
              {stats.expense.change.usd !== null && stats.expense.change.cup !== null ? ' / ' : ''}
              {stats.expense.change.cup !== null ? (
                <span>{formatPercentage(stats.expense.change.cup)} (CUP)</span>
              ) : null}
              {stats.expense.change.usd === null && stats.expense.change.cup === null ? 'Sin datos mes anterior' : ' respecto al mes pasado'}
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
              <Card className={`transition-all hover:shadow-md cursor-pointer h-full ${link.color}`}>
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
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="CUP">CUP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={financialData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${barCurrencyFilter} ${value.toLocaleString()}`}
                />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => formatMoney(value, barCurrencyFilter)}
                />
                <Legend />
                {(barTypeFilter === 'all' || barTypeFilter === 'income') && (
                  <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                )}
                {(barTypeFilter === 'all' || barTypeFilter === 'expense') && (
                  <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
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
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="CUP">CUP</SelectItem>
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
                No hay datos para la combinación seleccionada ({distTypeFilter === 'all' ? 'Todos' : distTypeFilter === 'income' ? 'Ingresos' : 'Gastos'} en {distCurrencyFilter})
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
