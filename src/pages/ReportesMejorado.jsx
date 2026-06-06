import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  FileText, 
  Download, 
  Filter, 
  Calendar,
  TrendingUp,
  Package,
  Archive,
  DollarSign,
  BarChart3,
  PieChart,
  Eye,
  FileSpreadsheet
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { PermissionGuard, usePermissionCheck } from '@/components/common/PermissionGuard'
import { notify } from '@/services/notifications'
import { generateReport, exportReport } from '@/services/reports'

export default function ReportesMejorado() {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { formatCurrency } = useCurrency()
  const { canView, canExport } = usePermissionCheck()

  // Estado local
  const [reportType, setReportType] = useState('general')
  const [dateRange, setDateRange] = useState('month')
  const [format, setFormat] = useState('pdf')
  const [selectedModules, setSelectedModules] = useState(['finanzas', 'warehouse', 'inventory'])
  const [isGenerating, setIsGenerating] = useState(false)

  const userId = session?.user?.id

  // Queries para obtener datos de reportes
  const { data: financialData, isLoading: isLoadingFinancial } = useQuery({
    queryKey: ['financialReport', businessId || userId, dateRange],
    queryFn: () => generateReport('financial', businessId || userId, { dateRange }),
    enabled: !!userId && !!businessId && canView('reports') && selectedModules.includes('finanzas'),
  })

  const { data: warehouseData, isLoading: isLoadingWarehouse } = useQuery({
    queryKey: ['warehouseReport', businessId || userId, dateRange],
    queryFn: () => generateReport('warehouse', businessId || userId, { dateRange }),
    enabled: !!userId && !!businessId && canView('reports') && selectedModules.includes('warehouse'),
  })

  const { data: inventoryData, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['inventoryReport', businessId || userId, dateRange],
    queryFn: () => generateReport('inventory', businessId || userId, { dateRange }),
    enabled: !!userId && !!businessId && canView('reports') && selectedModules.includes('inventory'),
  })

  // Función para exportar reporte
  const handleExportReport = async (type, format) => {
    if (!canExport('reports')) {
      notify.error('No tienes permisos para exportar reportes')
      return
    }

    setIsGenerating(true)
    try {
      const normalizedFormat = format === 'excel' ? 'xlsx' : format
      if (normalizedFormat === 'csv') {
        notify.error('CSV no está disponible por el momento')
        return
      }

      await exportReport(type, businessId || userId, { 
        dateRange, 
        format: normalizedFormat,
        modules: selectedModules 
      })
      notify.success(`Reporte exportado exitosamente en formato ${format.toUpperCase()}`)
    } catch (error) {
      notify.error('Error al exportar el reporte')
    } finally {
      setIsGenerating(false)
    }
  }

  // Función para generar reporte general
  const handleGenerateGeneralReport = async () => {
    setIsGenerating(true)
    try {
      // Lógica para generar reporte general
      notify.success('Reporte general generado exitosamente')
    } catch (error) {
      notify.error('Error al generar el reporte')
    } finally {
      setIsGenerating(false)
    }
  }

  // Si no tiene permisos de visualización, mostrar mensaje
  if (!canView('reports')) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-6 text-center">
          <CardContent>
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Acceso Restringido</h3>
            <p className="text-muted-foreground">
              No tienes permisos para acceder al módulo de Reportes.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          Reportes y Análisis
        </h1>
        
        <div className="flex gap-2">
          <PermissionGuard permission="reports.export">
            <Button 
              variant="outline" 
              onClick={() => handleExportReport('general', format)}
              disabled={isGenerating}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar Todo
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Controles de filtro */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Rango de Fechas</label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="month">Este mes</SelectItem>
                  <SelectItem value="quarter">Este trimestre</SelectItem>
                  <SelectItem value="year">Este año</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Formato de Exportación</label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">Módulos a Incluir</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'finanzas', label: 'Finanzas', icon: <DollarSign className="w-3 h-3" /> },
                  { key: 'warehouse', label: 'Almacén', icon: <Package className="w-3 h-3" /> },
                  { key: 'inventory', label: 'Inventario', icon: <Archive className="w-3 h-3" /> }
                ].map(module => (
                  <Badge
                    key={module.key}
                    variant={selectedModules.includes(module.key) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      if (selectedModules.includes(module.key)) {
                        setSelectedModules(selectedModules.filter(m => m !== module.key))
                      } else {
                        setSelectedModules([...selectedModules, module.key])
                      }
                    }}
                  >
                    {module.icon}
                    <span className="ml-1">{module.label}</span>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={handleGenerateGeneralReport} disabled={isGenerating}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Generar Reporte
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de reportes por módulo */}
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          {selectedModules.includes('finanzas') && <TabsTrigger value="finanzas">Finanzas</TabsTrigger>}
          {selectedModules.includes('warehouse') && <TabsTrigger value="warehouse">Almacén</TabsTrigger>}
          {selectedModules.includes('inventory') && <TabsTrigger value="inventory">Inventario</TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Período Analizado</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">{dateRange}</div>
                <p className="text-xs text-muted-foreground">
                  {selectedModules.length} módulos seleccionados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Estado del Reporte</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Badge variant="default">Visualización Activa</Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  Consultor puede ver todos los datos
                </p>
              </CardContent>
            </Card>

            <PermissionGuard permission="reports.export">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Exportación</CardTitle>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleExportReport('general', format)}
                    disabled={isGenerating}
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-1" />
                    Exportar {format.toUpperCase()}
                  </Button>
                </CardContent>
              </Card>
            </PermissionGuard>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Permisos Actuales</CardTitle>
                <PieChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="w-3 h-3 text-green-600" />
                    <span>Ver reportes: Sí</span>
                  </div>
                  <PermissionGuard permission="reports.export" fallback={
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-3 h-3 text-red-600" />
                      <span>Exportar: No</span>
                    </div>
                  }>
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-3 h-3 text-green-600" />
                      <span>Exportar: Sí</span>
                    </div>
                  </PermissionGuard>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {selectedModules.includes('finanzas') && (
          <TabsContent value="finanzas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Reporte de Finanzas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingFinancial ? (
                  <div className="text-center py-8">Cargando datos financieros...</div>
                ) : financialData ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Total Ingresos</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(financialData.totalIncome || 0)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Total Gastos</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-red-600">
                            {formatCurrency(financialData.totalExpense || 0)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Balance Neto</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className={`text-2xl font-bold ${
                            (financialData.netBalance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(financialData.netBalance || 0)}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    
                    <PermissionGuard permission="reports.export">
                      <div className="flex justify-end">
                        <Button 
                          variant="outline" 
                          onClick={() => handleExportReport('financial', format)}
                          disabled={isGenerating}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Exportar Finanzas
                        </Button>
                      </div>
                    </PermissionGuard>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay datos financieros disponibles para este período
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {selectedModules.includes('warehouse') && (
          <TabsContent value="warehouse" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Reporte de Almacén
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingWarehouse ? (
                  <div className="text-center py-8">Cargando datos de almacén...</div>
                ) : warehouseData ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-4">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Total Productos</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-blue-600">
                            {warehouseData.totalProducts || 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Productos con Bajo Stock</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-orange-600">
                            {warehouseData.lowStockProducts || 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Movimientos del Período</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-purple-600">
                            {warehouseData.totalMovements || 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Valor Total del Inventario</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(warehouseData.totalValue || 0)}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    
                    <PermissionGuard permission="reports.export">
                      <div className="flex justify-end">
                        <Button 
                          variant="outline" 
                          onClick={() => handleExportReport('warehouse', format)}
                          disabled={isGenerating}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Exportar Almacén
                        </Button>
                      </div>
                    </PermissionGuard>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay datos de almacén disponibles para este período
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {selectedModules.includes('inventory') && (
          <TabsContent value="inventory" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="w-5 h-5" />
                  Reporte de Inventario Dinámico
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingInventory ? (
                  <div className="text-center py-8">Cargando datos de inventario...</div>
                ) : inventoryData ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-4">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Total Áreas</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-indigo-600">
                            {inventoryData.totalAreas || 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Total Ítems</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-teal-600">
                            {inventoryData.totalItems || 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Campos Personalizados</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-cyan-600">
                            {inventoryData.totalFields || 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Última Actualización</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-sm text-muted-foreground">
                            {inventoryData.lastUpdate || 'N/A'}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    
                    <PermissionGuard permission="reports.export">
                      <div className="flex justify-end">
                        <Button 
                          variant="outline" 
                          onClick={() => handleExportReport('inventory', format)}
                          disabled={isGenerating}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Exportar Inventario
                        </Button>
                      </div>
                    </PermissionGuard>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay datos de inventario disponibles para este período
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
