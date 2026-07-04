import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, FileText, Layers, Lock, Package, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
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
import { PermissionGuard, usePermissionCheck } from '@/components/common/PermissionGuard'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'
import { ExportButton } from '@/components/common/ExportButton'
import { ReportPreview } from '@/components/reportes/ReportPreview'
import { fetchTransactionsForExport, listTransactions, getAgingReport, getFilteredTotals, getBalanceConfig } from '@/services/finanzas'
import { AgingPanel } from '@/components/finanzas/AgingPanel'
import { CashFlowPanel } from '@/components/finanzas/CashFlowPanel'
import { PositionPanel } from '@/components/finanzas/PositionPanel'
import { agingToExportRows } from '@/utils/aging'
import { buildCashFlow, buildPosition, cashFlowToExportRows, positionToExportRows } from '@/utils/financials'
import { fetchMovementsForExport, listMovements } from '@/services/almacen'
import { listAreas, listItems } from '@/services/dynamicInventory'
import { generateFinanceReport, generateWarehouseReport, generateInventoryReport, generateGlobalReport } from '@/utils/narrativeGenerator'

// Carga diferida de las utilidades de exportación (jspdf/xlsx/docx ~1.5MB): no entran
// en el arranque; se descargan solo al exportar (ver vite.config manualChunks). Si la
// descarga del chunk falla (p. ej. sin conexión la primera vez), avisamos al usuario
// en vez de fallar en silencio.
const loadExportUtils = async () => {
  try { return await import('@/utils/exportUtils') }
  catch { notify.error('No se pudo cargar el módulo de exportación. Revisa tu conexión e inténtalo de nuevo.'); return null }
}
const exportToPDF = async (...args) => { const m = await loadExportUtils(); return m?.exportToPDF(...args) }
const exportToExcel = async (...args) => { const m = await loadExportUtils(); return m?.exportToExcel(...args) }
const generateDOCX = async (...args) => {
  let mod
  try { mod = await import('@/utils/docxGenerator') }
  catch { notify.error('No se pudo cargar el módulo de exportación. Revisa tu conexión e inténtalo de nuevo.'); return }
  return mod.generateDOCX(...args)
}

const Reportes = () => {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { canAccessFeature } = useSubscription()
  const { formatCurrency } = useCurrency()
  const { canView } = usePermissionCheck()
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

  // Antigüedad de saldos (Q10): foto "a hoy" (no depende del filtro de fechas).
  // Solo visible/consultable con finanzas.view (la RPC también lo exige server-side).
  const [agingTab, setAgingTab] = useState('receivable')
  const canViewFinanzas = canView('finanzas')
  const { data: aging = [], isLoading: agingLoading } = useQuery({
    queryKey: ['aging', agingTab, effectiveUserId],
    queryFn: () => getAgingReport(agingTab),
    enabled: !!userId && !!effectiveUserId && canViewFinanzas
  })

  const exportAging = (type) => {
    const income = agingTab === 'receivable'
    const rows = agingToExportRows(aging)
    const fname = income ? 'antiguedad_por_cobrar' : 'antiguedad_por_pagar'
    const titleBase = income ? 'Por cobrar' : 'Por pagar'
    if (type === 'pdf') {
      const headers = ['Moneda', 'Por vencer', '1-30', '31-60', '61-90', '+90', 'Vencido', 'Total']
      const body = rows.map((r) => [
        r.Moneda, r['Por vencer'], r['1-30 días'], r['31-60 días'],
        r['61-90 días'], r['Más de 90 días'], r['Vencido total'], r.Total
      ].map(String))
      exportToPDF(`Antigüedad de saldos - ${titleBase}`, headers, body, fname, pdfOptions())
      return
    }
    exportToExcel(`Antiguedad ${income ? 'CxC' : 'CxP'}`, rows, fname)
  }

  // Flujo de Efectivo (Q5): entradas/salidas/neto por moneda del período del filtro.
  const { data: cashTotals, isLoading: cashLoading } = useQuery({
    queryKey: ['cashflow', effectiveUserId, dateFilter?.startDate, dateFilter?.endDate],
    queryFn: () => getFilteredTotals({ from: dateFilter?.startDate, to: dateFilter?.endDate, userId, businessId }),
    enabled: listingsEnabled && canViewFinanzas
  })
  const cashFlow = buildCashFlow(cashTotals)

  // Posición (Q5): saldo (business_balances, devengado) + por cobrar/pagar (aging) →
  // caja real. Las queries de aging recv/pay comparten caché con el Card de Antigüedad.
  const { data: balances = [] } = useQuery({
    queryKey: ['balanceConfig', effectiveUserId],
    queryFn: () => getBalanceConfig(userId, businessId),
    enabled: !!userId && !!effectiveUserId && canViewFinanzas
  })
  const { data: posReceivable = [], isLoading: recvLoading } = useQuery({
    queryKey: ['aging', 'receivable', effectiveUserId],
    queryFn: () => getAgingReport('receivable'),
    enabled: !!userId && !!effectiveUserId && canViewFinanzas
  })
  const { data: posPayable = [], isLoading: payLoading } = useQuery({
    queryKey: ['aging', 'payable', effectiveUserId],
    queryFn: () => getAgingReport('payable'),
    enabled: !!userId && !!effectiveUserId && canViewFinanzas
  })
  const position = buildPosition(balances, posReceivable, posPayable)
  const positionLoading = recvLoading || payLoading

  const exportCashFlow = (type) => {
    const rows = cashFlowToExportRows(cashFlow)
    const fname = 'flujo_efectivo'
    const label = dateFilter?.label ? ` - ${dateFilter.label}` : ''
    if (type === 'pdf') {
      const headers = ['Moneda', 'Entradas', 'Salidas', 'Flujo neto']
      const body = rows.map((r) => [r.Moneda, r.Entradas, r.Salidas, r['Flujo neto']].map(String))
      exportToPDF(`Flujo de Efectivo${label}`, headers, body, fname, pdfOptions())
      return
    }
    exportToExcel('Flujo de Efectivo', rows, fname)
  }

  const exportPosition = (type) => {
    const rows = positionToExportRows(position)
    const fname = 'posicion'
    if (type === 'pdf') {
      const headers = ['Moneda', 'Saldo registrado', 'Por cobrar', 'Por pagar', 'Caja real hoy']
      const body = rows.map((r) => [r.Moneda, r['Saldo registrado'], r['Por cobrar'], r['Por pagar'], r['Caja real hoy']].map(String))
      exportToPDF('Posición (a hoy)', headers, body, fname, pdfOptions())
      return
    }
    exportToExcel('Posicion', rows, fname)
  }

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
    const totalItems = summary.reduce((sum, a) => sum + (a.itemsCount || 0), 0)
    const data = summary
      .slice()
      .sort((a, b) => (b.itemsCount || 0) - (a.itemsCount || 0))
      .map(area => ({
        Área: area.name,
        'Ítems Registrados (en periodo)': area.itemsCount ?? 0,
        'Participación': totalItems > 0 ? `${(((area.itemsCount || 0) / totalItems) * 100).toFixed(1)}%` : '0.0%'
      }))

    if (type === 'pdf') {
      const headers = ['Área', 'Ítems Registrados', 'Participación']
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
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Reportes y Resúmenes</h1>
        <p className="text-muted-foreground">Genera y exporta reportes de tus módulos.</p>
      </div>

      <DateRangeFilter onFilterChange={handleFilterChange}>
        <PermissionGuard permission="reports.export" mode="disable">
          <Button
            onClick={() => handlePreview('global')}
            className="bg-blue-600 text-white hover:bg-blue-700 w-full mt-1"
            disabled={!dateFilter || previewLoading}
          >
            <FileText className={isMobile ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
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
                    <ExportButton format="word" disabled={previewLoading} onClick={() => handlePreview('finanzas')} />
                  </PermissionGuard>
                  <PermissionGuard permission="reports.export" mode="disable">
                    <ExportButton format="excel" locked={!canExportDocs} onClick={() => canExportDocs ? exportFinanzas('excel') : notifyPremiumExport('Excel')} />
                  </PermissionGuard>
                  <PermissionGuard permission="reports.export" mode="disable">
                    <ExportButton format="pdf" onClick={() => exportFinanzas('pdf')} />
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
                    <ExportButton format="word" label="Resumen de Almacén" disabled={previewLoading} onClick={() => handlePreview('almacen')} />
                  </PermissionGuard>
                  <PermissionGuard permission="reports.export" mode="disable">
                    <ExportButton format="excel" locked={!canExportDocs} onClick={() => canExportDocs ? exportAlmacen('excel') : notifyPremiumExport('Excel')} />
                  </PermissionGuard>
                  <PermissionGuard permission="reports.export" mode="disable">
                    <ExportButton format="pdf" onClick={() => exportAlmacen('pdf')} />
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
                    <ExportButton format="word" label="Resumen de Inventario" disabled={previewLoading} onClick={() => handlePreview('inventario')} />
                  </PermissionGuard>
                  <PermissionGuard permission="reports.export" mode="disable">
                    <ExportButton format="excel" locked={!canExportDocs} onClick={() => canExportDocs ? exportInventario('excel') : notifyPremiumExport('Excel')} />
                  </PermissionGuard>
                  <PermissionGuard permission="reports.export" mode="disable">
                    <ExportButton format="pdf" onClick={() => exportInventario('pdf')} />
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
                        <Badge variant="secondary" className="whitespace-nowrap">{area.itemsCount ?? 0} ítems</Badge>
                      </div>
                    </div>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Flujo de Efectivo (Q5): entradas/salidas del período del filtro, por moneda. */}
      {canViewFinanzas && (
        <Card>
          <CardHeader className="pb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 min-w-0">
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-primary" />
                Flujo de Efectivo
              </CardTitle>
              <CardDescription>{dateFilter?.label ? `Entradas y salidas · ${dateFilter.label}` : 'Selecciona un período arriba'}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <PermissionGuard permission="reports.export" mode="disable">
                <ExportButton format="excel" locked={!canExportDocs} onClick={() => canExportDocs ? exportCashFlow('excel') : notifyPremiumExport('Excel')} />
              </PermissionGuard>
              <PermissionGuard permission="reports.export" mode="disable">
                <ExportButton format="pdf" onClick={() => exportCashFlow('pdf')} />
              </PermissionGuard>
            </div>
          </CardHeader>
          <CardContent>
            <CashFlowPanel
              rows={cashFlow}
              loading={cashLoading}
              formatCurrency={formatCurrency}
              emptyMessage={dateFilter ? 'No hay movimientos en el período seleccionado.' : 'Selecciona un período arriba para ver el flujo.'}
            />
          </CardContent>
        </Card>
      )}

      {/* Posición simplificada (Q5): foto a hoy, saldo + caja real (saldo − CxC + CxP). */}
      {canViewFinanzas && (
        <Card>
          <CardHeader className="pb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 min-w-0">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Posición
              </CardTitle>
              <CardDescription>Tu caja real hoy y de qué se compone, por moneda.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <PermissionGuard permission="reports.export" mode="disable">
                <ExportButton format="excel" locked={!canExportDocs} onClick={() => canExportDocs ? exportPosition('excel') : notifyPremiumExport('Excel')} />
              </PermissionGuard>
              <PermissionGuard permission="reports.export" mode="disable">
                <ExportButton format="pdf" onClick={() => exportPosition('pdf')} />
              </PermissionGuard>
            </div>
          </CardHeader>
          <CardContent>
            <PositionPanel rows={position} loading={positionLoading} formatCurrency={formatCurrency} />
          </CardContent>
        </Card>
      )}

      {/* Antigüedad de saldos (Q10): independiente del filtro de fechas (foto a hoy). */}
      {canViewFinanzas && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Antigüedad de saldos
            </CardTitle>
            <CardDescription>Cuentas pendientes clasificadas por vencimiento, a la fecha de hoy.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={agingTab} onValueChange={setAgingTab}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
                  <TabsTrigger value="receivable">Por cobrar</TabsTrigger>
                  <TabsTrigger value="payable">Por pagar</TabsTrigger>
                </TabsList>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <PermissionGuard permission="reports.export" mode="disable">
                    <ExportButton format="excel" locked={!canExportDocs} onClick={() => canExportDocs ? exportAging('excel') : notifyPremiumExport('Excel')} />
                  </PermissionGuard>
                  <PermissionGuard permission="reports.export" mode="disable">
                    <ExportButton format="pdf" onClick={() => exportAging('pdf')} />
                  </PermissionGuard>
                </div>
              </div>
              <TabsContent value="receivable" className="mt-4">
                <AgingPanel rows={aging} loading={agingLoading} formatCurrency={formatCurrency} income emptyMessage="No hay cuentas por cobrar pendientes." />
              </TabsContent>
              <TabsContent value="payable" className="mt-4">
                <AgingPanel rows={aging} loading={agingLoading} formatCurrency={formatCurrency} income={false} emptyMessage="No hay cuentas por pagar pendientes." />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Modal de previsualización: el cierre (X) vive arriba a la derecha (lo aporta
          DialogContent). Abajo, un único botón de descarga a ancho completo en móvil. */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] max-w-[800px] overflow-y-auto p-4 sm:p-6">
          {previewReport && (
            <>
              <DialogHeader className="pr-8 text-left">
                <DialogTitle>Previsualización del Informe</DialogTitle>
                <DialogDescription>
                  Así se verá el documento que descargarás en Word.
                </DialogDescription>
              </DialogHeader>

              {/* min-w-0: el DialogContent es un grid; sin esto, la "hoja" (grid item con
                  min-width:auto) se estira al min-content de una tabla ancha y desbordaba
                  el modal (se recortaba). Con min-w-0 la hoja cabe y la tabla hace scroll
                  interno en su propio recuadro. */}
              <div className="mt-2 min-w-0 rounded-md border bg-white p-4 text-black shadow-sm sm:p-8">
                <ReportPreview report={previewReport} company={company} />
              </div>

              <DialogFooter className="mt-4 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                {!canExportDocs && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground sm:mr-auto">
                    <Lock className="h-3 w-3 shrink-0" />
                    La descarga en Word con tu marca es Premium.
                  </p>
                )}
                <PermissionGuard permission="reports.export" mode="disable">
                  {canExportDocs ? (
                    <Button onClick={handleDownloadDOCX} className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto">
                      <FileText className="mr-2 h-4 w-4" />
                      Descargar Word
                    </Button>
                  ) : (
                    <Button onClick={() => notifyPremiumExport('Word')} variant="secondary" className="w-full sm:w-auto">
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
