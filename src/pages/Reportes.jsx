import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowDownCircle, ArrowUpCircle, File, FileSpreadsheet, FileText, Lock, Package, TrendingDown, TrendingUp } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { getBusinessSettings } from '@/services/businessSettings'
import { notify } from '@/services/notifications'
import { useIsMobile } from '@/hooks/useIsMobile'
import DateRangeFilter from '@/components/common/DateRangeFilter'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PermissionGuard } from '@/components/common/PermissionGuard'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'
import { fetchTransactionsForExport, listTransactions } from '@/services/finanzas'
import { fetchMovementsForExport, listMovements } from '@/services/almacen'
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
  const { businessId } = useBusiness()
  const { canAccessFeature } = useSubscription()
  const isMobile = useIsMobile()
  const userId = session?.user?.id
  const effectiveUserId = businessId || userId

  // Perfil del negocio (logo + identificación) para el membrete de los documentos.
  const businessSettingsQuery = useQuery({
    queryKey: ['businessSettings', userId, businessId],
    queryFn: () => getBusinessSettings(userId, businessId),
    enabled: !!userId && !!businessId,
    staleTime: 1000 * 60 * 5
  })
  const company = businessSettingsQuery.data?.company || null

  // Diferenciación de plan (Fase 1): el free ve la previsualización y puede descargar
  // el PDF con marca de agua (sin logo); el Word/Excel y el documento branded sin marca
  // son Premium. Flags definidos en la tabla `plans` (reports_export/custom_branding/watermark).
  const canExportDocs = canAccessFeature('reports_export')
  const useBranding = canAccessFeature('custom_branding')
  const useWatermark = canAccessFeature('watermark')

  const pdfOptions = () => ({ company, branding: useBranding, watermark: useWatermark })
  const notifyPremiumExport = (what) => {
    notify.info(`Exportar a ${what} es una función Premium`, {
      description: 'Puedes ver el informe en pantalla y descargar el PDF. Pasa a Premium para el documento con tu marca y sin marca de agua.'
    })
  }

  const [dateFilter, setDateFilter] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewReport, setPreviewReport] = useState(null)
  const [filename, setFilename] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  // Contadores por tab (alimentados por ResponsiveListing.onMeta).
  const [financeCount, setFinanceCount] = useState(0)
  const [warehouseCount, setWarehouseCount] = useState(0)
  const [inventoryCount, setInventoryCount] = useState(0)

  const listingsEnabled = !!userId && !!effectiveUserId && !!dateFilter

  const handleFilterChange = (filter) => {
    setDateFilter(filter)
  }

  const fetchInventorySummaryForExport = async () => {
    const pageSize = 50
    const first = await listAreas(effectiveUserId, { page: 1, pageSize })
    const total = Number(first?.count || 0)
    const pages = Math.max(1, Math.ceil(total / pageSize))
    const allAreas = [...(first?.data || [])]

    for (let p = 2; p <= pages; p++) {
      const res = await listAreas(effectiveUserId, { page: p, pageSize })
      allAreas.push(...(res?.data || []))
    }

    const summary = await Promise.all(allAreas.map(async (area) => {
      const { count } = await listItems(area.id, {
        page: 1,
        pageSize: 1,
        startDate: dateFilter?.startDate,
        endDate: dateFilter?.endDate
      }, effectiveUserId)
      return { ...area, itemsCount: count }
    }))

    return summary
  }

  const exportFinanzas = async (type) => {
    const rows = await fetchTransactionsForExport({
      from: dateFilter?.startDate,
      to: dateFilter?.endDate,
      userId,
      businessId
    })

    const data = rows.map(t => ({
      Fecha: t.date ? format(new Date(t.date), 'dd/MM/yyyy') : '',
      Tipo: t.type === 'income' ? 'Ingreso' : 'Gasto',
      Categoría: t.category,
      Monto: `${t.amount} ${t.currency}`,
      Descripción: t.description,
      Método: t.details?.payment_method || '-'
    }))

    if (type === 'pdf') {
      const headers = ['Fecha', 'Tipo', 'Categoría', 'Monto', 'Descripción', 'Método']
      const body = data.map(Object.values)
      await exportToPDF(`Reporte de Finanzas - ${dateFilter?.label}`, headers, body, `finanzas_${dateFilter?.type}`, pdfOptions())
      return
    }

    exportToExcel('Finanzas', data, `finanzas_${dateFilter?.type}`)
  }

  const exportAlmacen = async (type) => {
    const rows = await fetchMovementsForExport({
      startDate: dateFilter?.startDate,
      endDate: dateFilter?.endDate,
      userId,
      businessId
    })

    const data = rows.map(m => ({
      Fecha: m.created_at ? format(new Date(m.created_at), 'dd/MM/yyyy HH:mm') : '',
      Producto: m.products?.name || 'Producto Eliminado',
      Tipo: m.type === 'in' ? 'Entrada' : 'Salida',
      Cantidad: m.qty,
      Categoría: m.products?.category || '-'
    }))

    if (type === 'pdf') {
      const headers = ['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Categoría']
      const body = data.map(Object.values)
      await exportToPDF(`Reporte de Almacén - ${dateFilter?.label}`, headers, body, `almacen_${dateFilter?.type}`, pdfOptions())
      return
    }

    exportToExcel('Movimientos', data, `almacen_${dateFilter?.type}`)
  }

  const exportInventario = async (type) => {
    const summary = await fetchInventorySummaryForExport()
    const data = summary.map(area => ({
      Área: area.name,
      'Ítems Registrados (en periodo)': area.itemsCount,
      'Icono': area.icon
    }))

    if (type === 'pdf') {
      const headers = ['Área', 'Ítems Registrados', 'Icono']
      const body = data.map(Object.values)
      await exportToPDF(`Resumen de Inventario - ${dateFilter?.label}`, headers, body, `inventario_${dateFilter?.type}`, pdfOptions())
      return
    }

    exportToExcel('Inventario', data, `inventario_${dateFilter?.type}`)
  }

  const getPreviousRange = (filter) => {
    const start = new Date(filter.startDate)
    const end = new Date(filter.endDate)
    const durationMs = Math.max(0, end.getTime() - start.getTime())
    const prevEnd = new Date(start.getTime() - 1)
    const prevStart = new Date(prevEnd.getTime() - durationMs)
    return {
      startDate: prevStart.toISOString(),
      endDate: prevEnd.toISOString(),
      label: `Periodo anterior (${filter.label})`
    }
  }

  const handlePreview = async (type) => {
    if (!dateFilter) return
    setPreviewLoading(true)
    try {
      let report = null
      let fname = ''

      if (type === 'finanzas') {
        const rows = await fetchTransactionsForExport({ from: dateFilter.startDate, to: dateFilter.endDate, userId, businessId })
        const prev = getPreviousRange(dateFilter)
        const prevRows = await fetchTransactionsForExport({ from: prev.startDate, to: prev.endDate, userId, businessId })
        report = generateFinanceReport(rows, dateFilter, { comparisonTransactions: prevRows, comparisonLabel: prev.label })
        fname = `informe_finanzas_${dateFilter?.type}`
      } else if (type === 'almacen') {
        const rows = await fetchMovementsForExport({ startDate: dateFilter.startDate, endDate: dateFilter.endDate, userId, businessId })
        report = generateWarehouseReport(rows, dateFilter)
        fname = `informe_almacen_${dateFilter?.type}`
      } else if (type === 'inventario') {
        const summary = await fetchInventorySummaryForExport()
        report = generateInventoryReport(summary, dateFilter)
        fname = `informe_inventario_${dateFilter?.type}`
      } else if (type === 'global') {
        const prev = getPreviousRange(dateFilter)
        const [tx, prevTx, mov, inv] = await Promise.all([
          fetchTransactionsForExport({ from: dateFilter.startDate, to: dateFilter.endDate, userId, businessId }),
          fetchTransactionsForExport({ from: prev.startDate, to: prev.endDate, userId, businessId }),
          fetchMovementsForExport({ startDate: dateFilter.startDate, endDate: dateFilter.endDate, userId, businessId }),
          fetchInventorySummaryForExport()
        ])
        report = generateGlobalReport({ transactions: tx, prevTransactions: prevTx, prevLabel: prev.label, movements: mov, inventorySummary: inv }, dateFilter)
        fname = `informe_global_${dateFilter?.type}`
      } else {
        return
      }

      setPreviewReport(report)
      setFilename(fname)
      setPreviewOpen(true)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleDownloadDOCX = async () => {
    if (!canExportDocs) { notifyPremiumExport('Word'); return }
    await generateDOCX(previewReport, filename, { company })
    setPreviewOpen(false)
  }

  // Construye el resumen de inventario (áreas + nº de ítems en el periodo) para una
  // página, conservando el shape {data,count} que espera ResponsiveListing.
  const fetchInventorySummaryPage = async ({ page, pageSize }) => {
    const res = await listAreas(effectiveUserId, { page, pageSize })
    const areas = res?.data || []
    const summary = await Promise.all(areas.map(async (area) => {
      const { count } = await listItems(area.id, {
        page: 1,
        pageSize: 1,
        startDate: dateFilter?.startDate,
        endDate: dateFilter?.endDate
      }, effectiveUserId)
      return { ...area, itemsCount: count }
    }))
    return { data: summary, count: res?.count || 0 }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Reportes y Resúmenes</h1>
        <p className="text-muted-foreground">Genera y exporta reportes de tus módulos.</p>
      </div>

      <DateRangeFilter onFilterChange={handleFilterChange}>
        <PermissionGuard permission="reports.export" mode="disable">
          <Button
            onClick={() => handlePreview('global')}
            className="bg-blue-600 hover:bg-blue-700 w-full mt-1"
            disabled={!dateFilter || previewLoading}
          >
            <File className={isMobile ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
            Resumen General (DOCX)
          </Button>
        </PermissionGuard>
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
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2">
                <div className="space-y-1 min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    Resumen Financiero
                    <Badge variant="secondary" className="shrink-0">{financeCount}</Badge>
                  </CardTitle>
                  <CardDescription>{dateFilter.label}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <PermissionGuard permission="reports.export" mode="disable">
                    <Button variant="outline" size={isMobile ? 'icon' : 'sm'} onClick={() => handlePreview('finanzas')} disabled={previewLoading}>
                      <FileText className={isMobile ? 'h-4 w-4 text-blue-600' : 'mr-2 h-4 w-4 text-blue-600'} />
                      {isMobile ? <span className="sr-only">Word</span> : 'Word'}
                    </Button>
                  </PermissionGuard>
                  <PermissionGuard permission="reports.export" mode="disable">
                    <Button variant="outline" size={isMobile ? 'icon' : 'sm'} onClick={() => canExportDocs ? exportFinanzas('excel') : notifyPremiumExport('Excel')}>
                      {canExportDocs
                        ? <FileSpreadsheet className={isMobile ? 'h-4 w-4 text-green-600' : 'mr-2 h-4 w-4 text-green-600'} />
                        : <Lock className={isMobile ? 'h-4 w-4 text-muted-foreground' : 'mr-2 h-4 w-4 text-muted-foreground'} />}
                      {isMobile ? <span className="sr-only">Excel</span> : 'Excel'}
                    </Button>
                  </PermissionGuard>
                  <PermissionGuard permission="reports.export" mode="disable">
                    <Button variant="outline" size={isMobile ? 'icon' : 'sm'} onClick={() => exportFinanzas('pdf')}>
                      <FileText className={isMobile ? 'h-4 w-4 text-red-600' : 'mr-2 h-4 w-4 text-red-600'} />
                      {isMobile ? <span className="sr-only">PDF</span> : 'PDF'}
                    </Button>
                  </PermissionGuard>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveListing
                  queryKey={['reportes-finanzas', effectiveUserId, dateFilter]}
                  queryFn={({ page, pageSize }) => listTransactions({
                    from: dateFilter?.startDate,
                    to: dateFilter?.endDate,
                    userId,
                    businessId,
                    page,
                    pageSize
                  })}
                  enabled={listingsEnabled}
                  onMeta={({ count }) => setFinanceCount(count)}
                  getItemKey={(t) => t.id}
                  emptyMessage="No hay transacciones en este periodo."
                  loadingMessage="Cargando transacciones..."
                  renderItem={(t) => (
                    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="flex min-w-0 items-start gap-3 sm:items-center">
                        <div className={`shrink-0 rounded-full p-2 ${t.type === 'income' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                          {t.type === 'income'
                            ? <TrendingUp className="h-4 w-4 text-success" />
                            : <TrendingDown className="h-4 w-4 text-destructive" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium break-words">{t.description || (t.type === 'income' ? 'Ingreso' : 'Gasto')}</div>
                          <div className="text-sm text-muted-foreground">
                            {t.date ? format(new Date(t.date), 'dd/MM/yyyy') : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t pt-3 sm:shrink-0 sm:justify-end sm:gap-4 sm:border-0 sm:pt-0">
                        <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
                          <div className={`whitespace-nowrap font-semibold ${t.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                            {t.type === 'income' ? '+' : '−'} {t.amount} {t.currency}
                          </div>
                          {t.category ? (
                            <Badge variant="outline" className="max-w-full truncate">{t.category}</Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- ALMACEN --- */}
          <TabsContent value="almacen" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2">
                <div className="space-y-1 min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    Movimientos de Almacén
                    <Badge variant="secondary" className="shrink-0">{warehouseCount}</Badge>
                  </CardTitle>
                  <CardDescription>{dateFilter.label}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <PermissionGuard permission="reports.export" mode="disable">
                    <Button variant="outline" size={isMobile ? 'icon' : 'sm'} onClick={() => handlePreview('almacen')} disabled={previewLoading}>
                      <FileText className={isMobile ? 'h-4 w-4 text-blue-600' : 'mr-2 h-4 w-4 text-blue-600'} />
                      {isMobile ? <span className="sr-only">Resumen de Almacén</span> : 'Resumen de Almacén'}
                    </Button>
                  </PermissionGuard>
                  <PermissionGuard permission="reports.export" mode="disable">
                    <Button variant="outline" size={isMobile ? 'icon' : 'sm'} onClick={() => canExportDocs ? exportAlmacen('excel') : notifyPremiumExport('Excel')}>
                      {canExportDocs
                        ? <FileSpreadsheet className={isMobile ? 'h-4 w-4 text-green-600' : 'mr-2 h-4 w-4 text-green-600'} />
                        : <Lock className={isMobile ? 'h-4 w-4 text-muted-foreground' : 'mr-2 h-4 w-4 text-muted-foreground'} />}
                      {isMobile ? <span className="sr-only">Excel</span> : 'Excel'}
                    </Button>
                  </PermissionGuard>
                  <PermissionGuard permission="reports.export" mode="disable">
                    <Button variant="outline" size={isMobile ? 'icon' : 'sm'} onClick={() => exportAlmacen('pdf')}>
                      <FileText className={isMobile ? 'h-4 w-4 text-red-600' : 'mr-2 h-4 w-4 text-red-600'} />
                      {isMobile ? <span className="sr-only">PDF</span> : 'PDF'}
                    </Button>
                  </PermissionGuard>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveListing
                  queryKey={['reportes-almacen', effectiveUserId, dateFilter]}
                  queryFn={({ page, pageSize }) => listMovements({
                    startDate: dateFilter?.startDate,
                    endDate: dateFilter?.endDate,
                    userId,
                    businessId,
                    page,
                    pageSize
                  })}
                  enabled={listingsEnabled}
                  onMeta={({ count }) => setWarehouseCount(count)}
                  getItemKey={(m) => m.id}
                  emptyMessage="No hay movimientos en este periodo."
                  loadingMessage="Cargando movimientos..."
                  renderItem={(m) => (
                    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="flex min-w-0 items-start gap-3 sm:items-center">
                        <div className={`shrink-0 rounded-full p-2 ${m.type === 'in' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                          {m.type === 'in'
                            ? <ArrowDownCircle className="h-4 w-4 text-success" />
                            : <ArrowUpCircle className="h-4 w-4 text-destructive" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium break-words">{m.products?.name || 'Producto Eliminado'}</div>
                          <div className="text-sm text-muted-foreground">
                            {m.created_at ? format(new Date(m.created_at), 'dd/MM/yyyy HH:mm') : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t pt-3 sm:shrink-0 sm:justify-end sm:gap-4 sm:border-0 sm:pt-0">
                        <Badge
                          variant="outline"
                          className={m.type === 'in' ? 'border-success/40 text-success' : 'border-destructive/40 text-destructive'}
                        >
                          {m.type === 'in' ? 'Entrada' : 'Salida'}
                        </Badge>
                        <div className={`whitespace-nowrap font-semibold ${m.type === 'in' ? 'text-success' : 'text-destructive'}`}>
                          {m.type === 'in' ? '+' : '−'}{m.qty}
                        </div>
                      </div>
                    </div>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- INVENTARIO --- */}
          <TabsContent value="inventario" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2">
                <div className="space-y-1 min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    Resumen de Inventario (Activos)
                    <Badge variant="secondary" className="shrink-0">{inventoryCount}</Badge>
                  </CardTitle>
                  <CardDescription>Ítems registrados durante: {dateFilter.label}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <PermissionGuard permission="reports.export" mode="disable">
                    <Button variant="outline" size={isMobile ? 'icon' : 'sm'} onClick={() => handlePreview('inventario')} disabled={previewLoading}>
                      <FileText className={isMobile ? 'h-4 w-4 text-blue-600' : 'mr-2 h-4 w-4 text-blue-600'} />
                      {isMobile ? <span className="sr-only">Resumen de Inventario</span> : 'Resumen de Inventario'}
                    </Button>
                  </PermissionGuard>
                  <PermissionGuard permission="reports.export" mode="disable">
                    <Button variant="outline" size={isMobile ? 'icon' : 'sm'} onClick={() => canExportDocs ? exportInventario('excel') : notifyPremiumExport('Excel')}>
                      {canExportDocs
                        ? <FileSpreadsheet className={isMobile ? 'h-4 w-4 text-green-600' : 'mr-2 h-4 w-4 text-green-600'} />
                        : <Lock className={isMobile ? 'h-4 w-4 text-muted-foreground' : 'mr-2 h-4 w-4 text-muted-foreground'} />}
                      {isMobile ? <span className="sr-only">Excel</span> : 'Excel'}
                    </Button>
                  </PermissionGuard>
                  <PermissionGuard permission="reports.export" mode="disable">
                    <Button variant="outline" size={isMobile ? 'icon' : 'sm'} onClick={() => exportInventario('pdf')}>
                      <FileText className={isMobile ? 'h-4 w-4 text-red-600' : 'mr-2 h-4 w-4 text-red-600'} />
                      {isMobile ? <span className="sr-only">PDF</span> : 'PDF'}
                    </Button>
                  </PermissionGuard>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveListing
                  queryKey={['reportes-inventario', effectiveUserId, dateFilter]}
                  queryFn={fetchInventorySummaryPage}
                  enabled={listingsEnabled}
                  onMeta={({ count }) => setInventoryCount(count)}
                  getItemKey={(area) => area.id}
                  emptyMessage="No hay áreas configuradas."
                  loadingMessage="Cargando inventario..."
                  renderItem={(area) => (
                    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="flex min-w-0 items-start gap-3 sm:items-center">
                        <div className="shrink-0 rounded-full bg-primary/10 p-2">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium break-words">{area.name}</div>
                          <div className="text-sm text-muted-foreground">Ítems registrados en el periodo</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t pt-3 sm:shrink-0 sm:justify-end sm:gap-4 sm:border-0 sm:pt-0">
                        <Badge variant="secondary" className="whitespace-nowrap">{area.itemsCount} ítems</Badge>
                      </div>
                    </div>
                  )}
                />
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

              <DialogFooter className="mt-6 flex-col gap-2 sm:flex-row sm:items-center">
                {!canExportDocs && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground sm:mr-auto">
                    <Lock className="h-3 w-3" />
                    La descarga del informe en Word con tu marca es Premium.
                  </p>
                )}
                <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cerrar</Button>
                <PermissionGuard permission="reports.export" mode="disable">
                  {canExportDocs ? (
                    <Button onClick={handleDownloadDOCX} className="bg-blue-600 hover:bg-blue-700" size={isMobile ? 'icon' : undefined}>
                      <File className={isMobile ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
                      {isMobile ? <span className="sr-only">Descargar Word</span> : 'Descargar Word'}
                    </Button>
                  ) : (
                    <Button onClick={() => notifyPremiumExport('Word')} variant="secondary">
                      <Lock className="mr-2 h-4 w-4" />
                      Word (Premium)
                    </Button>
                  )}
                </PermissionGuard>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Reportes
