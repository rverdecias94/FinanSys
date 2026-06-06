import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { FileText, FileSpreadsheet, Loader2, File } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import DateRangeFilter from '@/components/common/DateRangeFilter'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { listTransactions } from '@/services/finanzas'
import { listMovements } from '@/services/almacen'
import { listAreas, listItems } from '@/services/dynamicInventory'
import { exportToPDF, exportToExcel } from '@/utils/exportUtils'
import { generateDOCX } from '@/utils/docxGenerator'
import { generateFinanceReport, generateWarehouseReport, generateInventoryReport, generateGlobalReport } from '@/utils/narrativeGenerator'

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
                        <td key={j} className={`px-3 py-2 ${isNaN(cell.replace(/[^0-9.-]+/g, "")) ? 'text-left' : 'text-right'}`}>
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
  const userId = session?.user?.id
  const [dateFilter, setDateFilter] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewReport, setPreviewReport] = useState(null)
  const [filename, setFilename] = useState('')

  // Finanzas Query
  const { data: transactions = [], isLoading: loadingFinanzas } = useQuery({
    queryKey: ['reportes-finanzas', dateFilter, userId],
    queryFn: () => listTransactions({
      from: dateFilter?.startDate,
      to: dateFilter?.endDate,
      userId,
      limit: 1000 // Limit for report preview/export
    }),
    enabled: !!userId && !!dateFilter
  })

  // Almacén Query
  const { data: movementsData, isLoading: loadingAlmacen } = useQuery({
    queryKey: ['reportes-almacen', dateFilter, userId],
    queryFn: () => listMovements({
      startDate: dateFilter?.startDate,
      endDate: dateFilter?.endDate,
      userUuid: userId,
      pageSize: 1000
    }),
    enabled: !!userId && !!dateFilter
  })
  const movements = movementsData?.data || []

  // Inventario Query (Areas + Item Counts)
  const { data: inventorySummary = [], isLoading: loadingInventario } = useQuery({
    queryKey: ['reportes-inventario', dateFilter, userId],
    queryFn: async () => {
      const areas = await listAreas(userId)
      const summaryPromises = areas.map(async (area) => {
        const { count } = await listItems(area.id, {
          page: 1,
          pageSize: 1,
          startDate: dateFilter?.startDate,
          endDate: dateFilter?.endDate
        }, userId)
        return {
          ...area,
          itemsCount: count
        }
      })
      return Promise.all(summaryPromises)
    },
    enabled: !!userId && !!dateFilter
  })

  const handleFilterChange = (filter) => {
    setDateFilter(filter)
  }

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
    <div className="space-y-6 p-6 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Reportes y Resúmenes</h1>
        <p className="text-muted-foreground">Genera y exporta reportes de tus módulos.</p>
      </div>

      <DateRangeFilter onFilterChange={handleFilterChange}>
        <Button onClick={() => handlePreview('global')} className="bg-blue-600 hover:bg-blue-700">
          <File className="mr-2 h-4 w-4" />
          Resumen General (DOCX)
        </Button>
      </DateRangeFilter>

      {dateFilter && (
        <Tabs defaultValue="finanzas" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="finanzas">Finanzas</TabsTrigger>
            <TabsTrigger value="almacen">Almacén</TabsTrigger>
            <TabsTrigger value="inventario">Inventario</TabsTrigger>
          </TabsList>

          {/* --- FINANZAS --- */}
          <TabsContent value="finanzas" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle>Resumen Financiero</CardTitle>
                  <CardDescription>{dateFilter.label}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handlePreview('finanzas')}>
                    <FileText className="mr-2 h-4 w-4 text-blue-600" />
                    Resumen de Finanzas
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportFinanzas('excel')}>
                    <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportFinanzas('pdf')}>
                    <FileText className="mr-2 h-4 w-4 text-red-600" />
                    PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingFinanzas ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : transactions.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">No hay transacciones en este periodo.</div>
                ) : (
                  <div className="rounded-md border">
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
                        {transactions.slice(0, 5).map((t) => (
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
                    {transactions.length > 5 && (
                      <div className="p-2 text-center text-xs text-muted-foreground bg-muted/50">
                        Mostrando 5 de {transactions.length} registros. Exporta para ver todo.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- ALMACEN --- */}
          <TabsContent value="almacen" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle>Movimientos de Almacén</CardTitle>
                  <CardDescription>{dateFilter.label}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handlePreview('almacen')}>
                    <FileText className="mr-2 h-4 w-4 text-blue-600" />
                    Resumen de Almacén
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportAlmacen('excel')}>
                    <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportAlmacen('pdf')}>
                    <FileText className="mr-2 h-4 w-4 text-red-600" />
                    PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAlmacen ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : movements.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">No hay movimientos en este periodo.</div>
                ) : (
                  <div className="rounded-md border">
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
                        {movements.slice(0, 5).map((m) => (
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
                    {movements.length > 5 && (
                      <div className="p-2 text-center text-xs text-muted-foreground bg-muted/50">
                        Mostrando 5 de {movements.length} registros. Exporta para ver todo.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- INVENTARIO --- */}
          <TabsContent value="inventario" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle>Resumen de Inventario (Activos)</CardTitle>
                  <CardDescription>Ítems registrados durante: {dateFilter.label}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handlePreview('inventario')}>
                    <FileText className="mr-2 h-4 w-4 text-blue-600" />
                    Resumen de Inventario
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportInventario('excel')}>
                    <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportInventario('pdf')}>
                    <FileText className="mr-2 h-4 w-4 text-red-600" />
                    PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingInventario ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : inventorySummary.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">No hay áreas configuradas.</div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Área</TableHead>
                          <TableHead>Ítems Registrados (Periodo)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inventorySummary.map((area) => (
                          <TableRow key={area.id}>
                            <TableCell className="font-medium">{area.name}</TableCell>
                            <TableCell>{area.itemsCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
                <Button onClick={handleDownloadDOCX} className="bg-blue-600 hover:bg-blue-700">
                  <File className="mr-2 h-4 w-4" />
                  Descargar DOCX
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Reportes
