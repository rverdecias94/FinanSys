/* eslint-disable react/prop-types */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { FileText, FileSpreadsheet, Loader2, File, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { usePermissions } from '@/context/PermissionContext'
import DateRangeFilter from '@/components/common/DateRangeFilter'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { listTransactions } from '@/services/finanzas'
import { listMovements } from '@/services/almacen'
import { listAreas, listItems } from '@/services/dynamicInventory'
import { exportToPDF, exportToExcel } from '@/utils/exportUtils'
import { generateDOCX } from '@/utils/docxGenerator'
import { generateFinanceReport, generateWarehouseReport, generateInventoryReport, generateGlobalReport } from '@/utils/narrativeGenerator'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { notify } from '@/services/notifications'
import { InfiniteScrollTrigger } from '@/components/common/InfiniteScrollTrigger'

const ReportPreview = ({ report }) => {
  if (!report) return null;
  return (
    <div className="space-y-6 text-sm font-serif">
      {/* Title */}
      <div className="text-center space-y-2 pb-4 border-b">
        <h2 className="text-2xl font-bold uppercase tracking-wide">{report.title}</h2>
        {report.metadata && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-left max-w-2xl mx-auto text-xs text-muted-foreground">
            {report.metadata.map((m, i) => (
              <div key={i} className="flex justify-between md:justify-start gap-2">
                <span className="font-bold min-w-[120px]">{m.label}:</span>
                <span>{m.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sections */}
      {report.sections.map((section, idx) => (
        <div key={idx} className="space-y-3">
          {section.title && (
            <h3 className={`${section.type === 'header_section' ? 'text-xl font-bold text-center mt-8 border-b-2 border-black pb-2' : 'text-lg font-bold text-primary mt-4'}`}>
              {section.title}
            </h3>
          )}

          {(!section.type || section.type === 'paragraph') && (
            <p className="text-justify leading-relaxed whitespace-pre-wrap">{section.content}</p>
          )}

          {section.type === 'table' && (
            <div className="overflow-x-auto my-4 border rounded-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    {section.headers.map((h, i) => <th key={i} className="px-3 py-2 text-center font-bold border-b">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      {row.map((cell, j) => (
                        <td key={j} className={`px-3 py-2 text-center`}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {section.notes && <p className="text-xs text-muted-foreground p-2 italic bg-gray-50 border-t">{section.notes}</p>}
            </div>
          )}

          {section.type === 'list' && (
            <ul className="list-disc pl-5 space-y-1 marker:text-gray-400">
              {section.items.map((item, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

const Reportes = () => {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { canAccessFeature, subscription, activateTrial } = useSubscription()
  const userId = session?.user?.id
  const [dateFilter, setDateFilter] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewReport, setPreviewReport] = useState(null)
  const [filename, setFilename] = useState('')

  // Pagination states
  const [finanzasPage, setFinanzasPage] = useState(1)
  const [finanzasPageSize, setFinanzasPageSize] = useState(5)
  const [almacenPage, setAlmacenPage] = useState(1)
  const [almacenPageSize, setAlmacenPageSize] = useState(5)
  const [inventarioPage, setInventarioPage] = useState(1)
  const [inventarioPageSize, setInventarioPageSize] = useState(5)
  const [finanzasMobileCount, setFinanzasMobileCount] = useState(15)
  const [almacenMobileCount, setAlmacenMobileCount] = useState(15)
  const [inventarioMobileCount, setInventarioMobileCount] = useState(15)

  const { hasPermission } = usePermissions()
  const hasExportPermission = hasPermission('reports.export')
  // We remove the explicit plan check here for UI display purposes
  // The backend/hook should handle the actual restriction if needed, 
  // but the user wants to hide plan-specific messages for team members.
  // Assuming 'canAccessFeature' checks plan.

  const [trialConfirmOpen, setTrialConfirmOpen] = useState(false)

  const handleExport = (type, fn) => {
    if (hasExportPermission) {
      fn(type)
    } else {
      notify.error('No tienes permisos para exportar reportes.')
    }
  }

  // Finanzas Query
  const { data: transactions = [], isLoading: loadingFinanzas } = useQuery({
    queryKey: ['reportes-finanzas', dateFilter, userId, businessId],
    queryFn: () => listTransactions({
      from: dateFilter?.startDate,
      to: dateFilter?.endDate,
      userId,
      businessId,
      limit: 1000 // Limit for report preview/export
    }),
    enabled: !!userId && !!businessId && !!dateFilter
  })

  // Almacén Query
  const { data: movementsData, isLoading: loadingAlmacen } = useQuery({
    queryKey: ['reportes-almacen', dateFilter, userId, businessId],
    queryFn: () => listMovements({
      startDate: dateFilter?.startDate,
      endDate: dateFilter?.endDate,
      userId,
      businessId,
      pageSize: 1000
    }),
    enabled: !!userId && !!businessId && !!dateFilter
  })
  const movements = movementsData?.data || []

  // Inventario Query (Areas + Item Counts)
  const { data: inventorySummary = [], isLoading: loadingInventario } = useQuery({
    queryKey: ['reportes-inventario', dateFilter, userId, businessId],
    queryFn: async () => {
      const areas = await listAreas(userId, businessId)
      const summaryPromises = areas.map(async (area) => {
        const { count } = await listItems(area.id, {
          page: 1,
          pageSize: 1,
          startDate: dateFilter?.startDate,
          endDate: dateFilter?.endDate
        }, userId, businessId)
        return {
          ...area,
          itemsCount: count
        }
      })
      return Promise.all(summaryPromises)
    },
    enabled: !!userId && !!businessId && !!dateFilter
  })

  const handleFilterChange = (filter) => {
    setDateFilter(filter)
    setFinanzasPage(1)
    setAlmacenPage(1)
    setInventarioPage(1)
    setFinanzasMobileCount(15)
    setAlmacenMobileCount(15)
    setInventarioMobileCount(15)
  }

  // Derived paginated data
  const paginatedFinanzas = transactions.slice((finanzasPage - 1) * finanzasPageSize, finanzasPage * finanzasPageSize)
  const finanzasTotalPages = Math.ceil(transactions.length / finanzasPageSize)

  const paginatedAlmacen = movements.slice((almacenPage - 1) * almacenPageSize, almacenPage * almacenPageSize)
  const almacenTotalPages = Math.ceil(movements.length / almacenPageSize)

  const paginatedInventario = inventorySummary.slice((inventarioPage - 1) * inventarioPageSize, inventarioPage * inventarioPageSize)
  const inventarioTotalPages = Math.ceil(inventorySummary.length / inventarioPageSize)

  // --- Export Handlers ---

  const exportFinanzas = (type) => {
    const data = transactions.map(t => ({
      Fecha: format(new Date(t.date), 'dd/MM/yyyy'),
      Tipo: t.type === 'income' ? 'Ingreso' : 'Gasto',
      Categoría: t.category,
      Monto: `${t.amount} ${t.currency}`,
      Descripción: t.description,
      Método: t.details?.payment_method || '-'
    }))

    if (type === 'pdf') {
      const headers = ['Fecha', 'Tipo', 'Categoría', 'Monto', 'Descripción', 'Método']
      const rows = data.map(Object.values)
      exportToPDF(`Reporte de Finanzas - ${dateFilter?.label}`, headers, rows, `finanzas_${dateFilter?.type}`)
    } else {
      exportToExcel('Finanzas', data, `finanzas_${dateFilter?.type}`)
    }
  }

  const exportAlmacen = (type) => {
    const data = movements.map(m => ({
      Fecha: format(new Date(m.created_at), 'dd/MM/yyyy HH:mm'),
      Producto: m.products?.name || 'Producto Eliminado',
      Tipo: m.type === 'in' ? 'Entrada' : 'Salida',
      Cantidad: m.qty,
      Categoría: m.products?.category || '-'
    }))

    if (type === 'pdf') {
      const headers = ['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Categoría']
      const rows = data.map(Object.values)
      exportToPDF(`Reporte de Almacén - ${dateFilter?.label}`, headers, rows, `almacen_${dateFilter?.type}`)
    } else {
      exportToExcel('Movimientos', data, `almacen_${dateFilter?.type}`)
    }
  }

  const exportInventario = (type) => {
    const data = inventorySummary.map(area => ({
      Área: area.name,
      'Ítems Registrados (en periodo)': area.itemsCount,
      'Icono': area.icon
    }))

    if (type === 'pdf') {
      const headers = ['Área', 'Ítems Registrados', 'Icono']
      const rows = data.map(Object.values)
      exportToPDF(`Resumen de Inventario - ${dateFilter?.label}`, headers, rows, `inventario_${dateFilter?.type}`)
    } else {
      exportToExcel('Inventario', data, `inventario_${dateFilter?.type}`)
    }
  }

  const handlePreview = (type) => {
    let report = null
    let fname = ''

    switch (type) {
      case 'finanzas':
        report = generateFinanceReport(transactions, dateFilter)
        fname = `informe_finanzas_${dateFilter?.type}`
        break
      case 'almacen':
        report = generateWarehouseReport(movements, dateFilter)
        fname = `informe_almacen_${dateFilter?.type}`
        break
      case 'inventario':
        report = generateInventoryReport(inventorySummary, dateFilter)
        fname = `informe_inventario_${dateFilter?.type}`
        break
      case 'global':
        report = generateGlobalReport({ transactions, movements, inventorySummary }, dateFilter)
        fname = `informe_global_${dateFilter?.type}`
        break
      default:
        return
    }

    setPreviewReport(report)
    setFilename(fname)
    setPreviewOpen(true)
  }

  const handleDownloadDOCX = () => {
    generateDOCX(previewReport, filename)
    setPreviewOpen(false)
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          Reportes y Resúmenes
        </h1>
        <p className="text-muted-foreground">Genera y exporta reportes de tus módulos.</p>
      </div>

      <DateRangeFilter onFilterChange={handleFilterChange} />
      {hasExportPermission && (
        <div className="flex w-full sm:justify-end">
          <Button
            onClick={() => handleExport('docx', () => handlePreview('global'))}
            className="w-full sm:w-auto bg-primary hover:bg-accent hover:text-accent-foreground"
          >
            <File className="mr-2 h-4 w-4" />
            Resumen General (DOCX)
          </Button>
        </div>
      )}

      {dateFilter && (
        <Tabs defaultValue="finanzas" className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:w-6/12">
            <TabsTrigger
              value="finanzas"
              className="px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >Finanzas</TabsTrigger>
            <TabsTrigger
              value="almacen"
              className="px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >Almacén</TabsTrigger>
            <TabsTrigger
              value="inventario"
              className="px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >Inventario</TabsTrigger>
          </TabsList>

          {/* --- FINANZAS --- */}
          <TabsContent value="finanzas" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle>Resumen Financiero</CardTitle>
                  <CardDescription>{dateFilter.label}</CardDescription>
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                  <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => handlePreview('finanzas')}>
                    <FileText className="mr-2 h-4 w-4 text-blue-600" />
                    Resumen
                  </Button>
                  {hasExportPermission && (
                    <>
                      <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => handleExport('excel', exportFinanzas)}>
                        <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                        Excel
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => handleExport('pdf', exportFinanzas)}>
                        <FileText className="mr-2 h-4 w-4 text-red-600" />
                        PDF
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingFinanzas ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : transactions.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">No hay transacciones en este periodo.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="sm:hidden space-y-3">
                      {transactions.slice(0, finanzasMobileCount).map((t) => (
                        <Card key={t.id}>
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <CardTitle className="text-base">{t.category}</CardTitle>
                                <div className="text-xs text-muted-foreground">{format(new Date(t.date), 'dd/MM/yyyy')}</div>
                              </div>
                              <div className={`text-sm font-semibold ${t.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                                {t.type === 'income' ? '+' : '-'}{t.amount} {t.currency}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {t.type === 'income' ? 'Ingreso' : 'Gasto'}
                            </div>
                          </CardHeader>
                        </Card>
                      ))}
                      {finanzasMobileCount < transactions.length && (
                        <InfiniteScrollTrigger
                          onLoadMore={() => setFinanzasMobileCount((c) => Math.min(c + 15, transactions.length))}
                        />
                      )}
                    </div>

                    <div className="hidden sm:block rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedFinanzas.map((t) => (
                            <TableRow key={t.id}>
                              <TableCell>{format(new Date(t.date), 'dd/MM/yyyy')}</TableCell>
                              <TableCell className="capitalize">{t.type === 'income' ? 'Ingreso' : 'Gasto'}</TableCell>
                              <TableCell>{t.category}</TableCell>
                              <TableCell className={`text-right font-medium ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                {t.type === 'income' ? '+' : '-'}{t.amount} {t.currency}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="hidden sm:flex flex-col sm:flex-row items-center justify-between gap-4 p-4 text-sm text-muted-foreground border-t">
                        <div className="flex items-center gap-2">
                          <span>Filas por página:</span>
                          <Select
                            value={finanzasPageSize.toString()}
                            onValueChange={(v) => {
                              setFinanzasPageSize(Number(v))
                              setFinanzasPage(1)
                            }}
                          >
                            <SelectTrigger className="w-[70px] h-8">
                              <SelectValue placeholder="5" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5</SelectItem>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="20">20</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-4">
                          <span>
                            Página {finanzasPage} de {finanzasTotalPages || 1}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setFinanzasPage(Math.max(1, finanzasPage - 1))}
                              disabled={finanzasPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setFinanzasPage(Math.min(finanzasTotalPages, finanzasPage + 1))}
                              disabled={finanzasPage >= finanzasTotalPages}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- ALMACEN --- */}
          <TabsContent value="almacen" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle>Movimientos de Almacén</CardTitle>
                  <CardDescription>{dateFilter.label}</CardDescription>
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                  <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => handlePreview('almacen')}>
                    <FileText className="mr-2 h-4 w-4 text-blue-600" />
                    Resumen
                  </Button>
                  {hasExportPermission && (
                    <>
                      <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => handleExport('excel', exportAlmacen)}>
                        <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                        Excel
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => handleExport('pdf', exportAlmacen)}>
                        <FileText className="mr-2 h-4 w-4 text-red-600" />
                        PDF
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingAlmacen ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : movements.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">No hay movimientos en este periodo.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="sm:hidden space-y-3">
                      {movements.slice(0, almacenMobileCount).map((m) => (
                        <Card key={m.id}>
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <CardTitle className="text-base">{m.products?.name || 'Desconocido'}</CardTitle>
                                <div className="text-xs text-muted-foreground">{format(new Date(m.created_at), 'dd/MM/yyyy HH:mm')}</div>
                              </div>
                              <div className={`text-xs px-2 py-1 rounded-full ${m.type === 'in' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                                {m.type === 'in' ? 'Entrada' : 'Salida'}
                              </div>
                            </div>
                            <div className="text-sm font-semibold text-foreground text-right">
                              {m.qty}
                            </div>
                          </CardHeader>
                        </Card>
                      ))}
                      {almacenMobileCount < movements.length && (
                        <InfiniteScrollTrigger
                          onLoadMore={() => setAlmacenMobileCount((c) => Math.min(c + 15, movements.length))}
                        />
                      )}
                    </div>

                    <div className="hidden sm:block rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedAlmacen.map((m) => (
                            <TableRow key={m.id}>
                              <TableCell>{format(new Date(m.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                              <TableCell>{m.products?.name || 'Desconocido'}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs ${m.type === 'in' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                  {m.type === 'in' ? 'Entrada' : 'Salida'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">{m.qty}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="hidden sm:flex flex-col sm:flex-row items-center justify-between gap-4 p-4 text-sm text-muted-foreground border-t">
                        <div className="flex items-center gap-2">
                          <span>Filas por página:</span>
                          <Select
                            value={almacenPageSize.toString()}
                            onValueChange={(v) => {
                              setAlmacenPageSize(Number(v))
                              setAlmacenPage(1)
                            }}
                          >
                            <SelectTrigger className="w-[70px] h-8">
                              <SelectValue placeholder="5" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5</SelectItem>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="20">20</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-4">
                          <span>
                            Página {almacenPage} de {almacenTotalPages || 1}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setAlmacenPage(Math.max(1, almacenPage - 1))}
                              disabled={almacenPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setAlmacenPage(Math.min(almacenTotalPages, almacenPage + 1))}
                              disabled={almacenPage >= almacenTotalPages}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- INVENTARIO --- */}
          <TabsContent value="inventario" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle>Resumen de Inventario (Activos)</CardTitle>
                  <CardDescription> {dateFilter.label}</CardDescription>
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                  <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => handlePreview('inventario')}>
                    <FileText className="mr-2 h-4 w-4 text-blue-600" />
                    Resumen
                  </Button>
                  {hasExportPermission && (
                    <>
                      <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => handleExport('excel', exportInventario)}>
                        <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                        Excel
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => handleExport('pdf', exportInventario)}>
                        <FileText className="mr-2 h-4 w-4 text-red-600" />
                        PDF
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingInventario ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : inventorySummary.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">No hay áreas configuradas.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="sm:hidden space-y-3">
                      {inventorySummary.slice(0, inventarioMobileCount).map((area) => (
                        <Card key={area.id}>
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-3">
                              <CardTitle className="text-base">{area.name}</CardTitle>
                              <div className="text-sm font-semibold">{area.itemsCount}</div>
                            </div>
                          </CardHeader>
                        </Card>
                      ))}
                      {inventarioMobileCount < inventorySummary.length && (
                        <InfiniteScrollTrigger
                          onLoadMore={() => setInventarioMobileCount((c) => Math.min(c + 15, inventorySummary.length))}
                        />
                      )}
                    </div>

                    <div className="hidden sm:block rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Área</TableHead>
                            <TableHead>Ítems Registrados (Periodo)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedInventario.map((area) => (
                            <TableRow key={area.id}>
                              <TableCell className="font-medium">{area.name}</TableCell>
                              <TableCell>{area.itemsCount}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="hidden sm:flex flex-col sm:flex-row items-center justify-between gap-4 p-4 text-sm text-muted-foreground border-t">
                        <div className="flex items-center gap-2">
                          <span>Filas por página:</span>
                          <Select
                            value={inventarioPageSize.toString()}
                            onValueChange={(v) => {
                              setInventarioPageSize(Number(v))
                              setInventarioPage(1)
                            }}
                          >
                            <SelectTrigger className="w-[70px] h-8">
                              <SelectValue placeholder="5" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5</SelectItem>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="20">20</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-4">
                          <span>
                            Página {inventarioPage} de {inventarioTotalPages || 1}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setInventarioPage(Math.max(1, inventarioPage - 1))}
                              disabled={inventarioPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setInventarioPage(Math.min(inventarioTotalPages, inventarioPage + 1))}
                              disabled={inventarioPage >= inventarioTotalPages}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[800px] max-h-[80vh] overflow-y-auto">
          {previewReport && (
            <>
              <DialogHeader>
                <DialogTitle>Previsualización del Informe</DialogTitle>
                <DialogDescription>
                  Revisa el contenido antes de generar el documento Word.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 p-8 border rounded-md bg-white shadow-sm text-black">
                <ReportPreview report={previewReport} />
              </div>

              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancelar</Button>
                {hasExportPermission && (
                  <Button
                    onClick={() => handleDownloadDOCX()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <File className="mr-2 h-4 w-4" />
                    Descargar DOCX
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={trialConfirmOpen}
        onOpenChange={setTrialConfirmOpen}
        title="Activar prueba gratuita"
        description="¿Deseas activar tu prueba gratuita de 3 días del plan Premium?"
        confirmText="Activar prueba"
        cancelText="Cancelar"
        onConfirm={() => {
          activateTrial()
          setTrialConfirmOpen(false)
        }}
      />
    </div>
  )
}

export default Reportes
