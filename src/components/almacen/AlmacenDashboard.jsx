/* eslint-disable react/prop-types */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, AlertTriangle, Activity } from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar
} from 'recharts'
import { useChartAnimation } from '@/hooks/useChartAnimation'

export function AlmacenDashboard({ stats, loading }) {
  // El hook va antes de los early-return para no romper las reglas de hooks.
  const chartAnim = useChartAnimation()
  if (loading) return <div className="text-sm text-muted-foreground">Cargando dashboard...</div>
  if (!stats) return null

  const CHART_COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))'
  ]
 
  const getCategoryColor = (index) => {
    if (index < CHART_COLORS.length) return CHART_COLORS[index]
    const hue = (index * 137.508) % 360
    return `hsl(${Math.round(hue)} 70% 55%)`
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalProducts ?? 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Bajo Stock</CardTitle>
          <AlertTriangle className={`h-4 w-4 ${(stats.lowStockCount ?? 0) > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${(stats.lowStockCount ?? 0) > 0 ? 'text-warning' : ''}`}>
            {stats.lowStockCount ?? 0}
          </div>
          <p className="text-xs text-muted-foreground">Productos requieren atención</p>
        </CardContent>
      </Card>

      <Card className="col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Distribución por Categoría</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats.distribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                {...chartAnim}
              >
                {stats.distribution?.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getCategoryColor(index)} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  backgroundColor: 'hsl(var(--card))',
                  color: 'hsl(var(--card-foreground))',
                  border: '1px solid hsl(var(--border))',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.08)'
                }} />
              <Legend verticalAlign="middle" align="right" layout="vertical" iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Tendencia de Movimientos (30 días)</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.movementsTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{fontSize: 12}} 
                tickFormatter={(value) => {
                  if (!value) return ''
                  const [year, month, day] = value.split('-')
                  return `${day}/${month}`
                }}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  backgroundColor: 'hsl(var(--card))',
                  color: 'hsl(var(--card-foreground))',
                  border: '1px solid hsl(var(--border))',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.08)'
                }}
                labelFormatter={(value) => {
                  if (!value) return ''
                  const [year, month, day] = value.split('-')
                  return `${day}/${month}/${year}`
                }} />
              <Legend />
              <Line type="monotone" dataKey="entradas" stroke="hsl(var(--chart-1))" name="Entradas" strokeWidth={2} {...chartAnim} />
              <Line type="monotone" dataKey="salidas" stroke="hsl(var(--chart-5))" name="Salidas" strokeWidth={2} {...chartAnim} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Top 10 Productos por Stock</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={stats.topProducts} margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
              <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 11}} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  backgroundColor: 'hsl(var(--card))',
                  color: 'hsl(var(--card-foreground))',
                  border: '1px solid hsl(var(--border))',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.08)'
                }} />
              <Legend />
              <Bar dataKey="stock" fill="hsl(var(--chart-2))" name="Stock" radius={[0, 4, 4, 0]} barSize={20} {...chartAnim} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
