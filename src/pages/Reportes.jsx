import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  BarChart3,
  ChevronDown,
  ClipboardList,
  FileText,
  Layers,
  Loader2,
  Lock,
  Package,
  TrendingDown,
  TrendingUp,
  Warehouse,
  Wallet,
} from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { getBusinessSettings } from '@/services/businessSettings'
import { notify } from '@/services/notifications'
import DateRangeFilter from '@/components/common/DateRangeFilter'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PermissionGuard, usePermissionCheck } from '@/components/common/PermissionGuard'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'
import { ExportMenu } from '@/components/common/ExportMenu'
import { SectionSwitcher } from '@/components/navigation/SectionSwitcher'
import { ReportPreview } from '@/components/reportes/ReportPreview'
import { ReportTypeCard } from '@/components/reportes/ReportTypeCard'
import { fetchTransactionsForExport, listTransactions, getAgingReport, getFilteredTotals, getBalanceConfig, fetchSettledCashSources, listOpenAccounts } from '@/services/finanzas'
import { AgingPanel } from '@/components/finanzas/AgingPanel'
import { CashFlowPanel } from '@/components/finanzas/CashFlowPanel'
import { PositionPanel } from '@/components/finanzas/PositionPanel'
import { agingToExportRows } from '@/utils/aging'
import { buildCashFlow, buildPosition, cashFlowToExportRows, positionToExportRows } from '@/utils/financials'
import { buildSettledCashFlow, cashFlowRowsToExport, CASH_BASIS_LABELS, buildOpenAccountRows, openAccountsToExportRows } from '@/reporting/metrics'
import { fetchMovementsForExport, fetchMovementsForReporting, listMovements } from '@/services/almacen'
import { listAreas, listItems } from '@/services/dynamicInventory'
import { buildReport } from '@/reporting/templates'
import { toLegacyReportShape } from '@/reporting/documentModel'
import { listAllAuditLogs } from '@/services/auditLogs'
import { saveReportInstance, registerReportExport } from '@/services/reportInstances'
import { OfflineBlockedPanel } from '@/components/common/OfflineBlockedPanel'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

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
  const online = useOnlineStatus()
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
  const [previewDocument, setPreviewDocument] = useState(null)
  const [issuedPublicId, setIssuedPublicId] = useState(null)
  const [issuedInstanceId, setIssuedInstanceId] = useState(null)
  const [filename, setFilename] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [issuing, setIssuing] = useState(false)
  /** E2: 'recorded' = transacciones del período; 'settled' = caja liquidada (abonos + contado). */
  const [cashBasis, setCashBasis] = useState('recorded')
  const [showAdvancedReports, setShowAdvancedReports] = useState(false)
  const [detailTab, setDetailTab] = useState('finanzas')

  // Contadores por tab (alimentados por ResponsiveListing.onMeta).
  const [financeCount, setFinanceCount] = useState(0)
  const [warehouseCount, setWarehouseCount] = useState(0)
  const [inventoryCount, setInventoryCount] = useState(0)

  const listingsEnabled = !!userId && !!effectiveUserId && !!dateFilter

  // Antigüedad de saldos (Q10): foto "a hoy" (no depende del filtro de fechas).
  // Solo visible/consultable con finanzas.view (la RPC también lo exige server-side).
  const [agingTab, setAgingTab] = useState('receivable')
  const canViewFinanzas = canView('finanzas')
  const canViewLogs = canView('logs')
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

  // Flujo registrado (Q5/E2): entradas/salidas por fecha de transacción (cualquier status).
  const { data: cashTotals, isLoading: recordedLoading } = useQuery({
    queryKey: ['cashflow', 'recorded', effectiveUserId, dateFilter?.startDate, dateFilter?.endDate],
    queryFn: () => getFilteredTotals({ from: dateFilter?.startDate, to: dateFilter?.endDate, userId, businessId }),
    enabled: listingsEnabled && canViewFinanzas
  })
  const recordedFlow = buildCashFlow(cashTotals)

  // Flujo liquidado (E2): abonos por paid_at + altas al contado sin ledger.
  const { data: settledSources, isLoading: settledLoading } = useQuery({
    queryKey: ['cashflow', 'settled', effectiveUserId, dateFilter?.startDate, dateFilter?.endDate],
    queryFn: () => fetchSettledCashSources({ from: dateFilter?.startDate, to: dateFilter?.endDate, userId, businessId }),
    enabled: listingsEnabled && canViewFinanzas && cashBasis === 'settled'
  })
  const settledFlow = settledSources
    ? buildSettledCashFlow(settledSources)
    : []
  const cashFlow = cashBasis === 'settled' ? settledFlow : recordedFlow
  const cashLoading = cashBasis === 'settled' ? settledLoading : recordedLoading
  const cashLabels = CASH_BASIS_LABELS[cashBasis] || CASH_BASIS_LABELS.recorded

  // Detalle CxC/CxP abiertas (E2) para export — no mezcla monedas.
  const { data: openRecvPage } = useQuery({
    queryKey: ['openAccounts', 'receivable', effectiveUserId],
    queryFn: () => listOpenAccounts({ direction: 'receivable', page: 1, pageSize: 100, userId, businessId }),
    enabled: !!userId && !!effectiveUserId && canViewFinanzas
  })
  const { data: openPayPage } = useQuery({
    queryKey: ['openAccounts', 'payable', effectiveUserId],
    queryFn: () => listOpenAccounts({ direction: 'payable', page: 1, pageSize: 100, userId, businessId }),
    enabled: !!userId && !!effectiveUserId && canViewFinanzas
  })
  const openReceivableRows = buildOpenAccountRows(openRecvPage?.data || [], 'receivable')
  const openPayableRows = buildOpenAccountRows(openPayPage?.data || [], 'payable')

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
    const labeled = cashFlowRowsToExport(cashFlow, cashBasis)
    // Compat: si alguien espera las claves antiguas en recorded, cashFlowToExportRows sigue existiendo.
    const rows = cashBasis === 'recorded' ? cashFlowToExportRows(cashFlow) : labeled
    const fname = cashBasis === 'settled' ? 'flujo_liquidado' : 'flujo_registrado'
    const title = cashLabels.title
    const label = dateFilter?.label ? ` - ${dateFilter.label}` : ''
    if (type === 'pdf') {
      const headers = Object.keys(rows[0] || { Moneda: '', A: '', B: '', C: '' })
      const body = rows.map((r) => headers.map((h) => String(r[h] ?? '')))
      exportToPDF(`${title}${label}`, headers, body, fname, pdfOptions())
      return
    }
    exportToExcel(title, rows, fname)
  }

  const exportOpenAccounts = (direction, type) => {
    const rows = openAccountsToExportRows(
      direction === 'payable' ? openPayableRows : openReceivableRows
    )
    const title = direction === 'payable' ? 'Cuentas por pagar (detalle)' : 'Cuentas por cobrar (detalle)'
    const fname = direction === 'payable' ? 'cxp_detalle' : 'cxc_detalle'
    if (type === 'pdf') {
      const headers = rows[0] ? Object.keys(rows[0]) : ['Moneda', 'Contacto', 'Saldo abierto']
      const body = rows.map((r) => headers.map((h) => String(r[h] ?? '')))
      exportToPDF(title, headers, body, fname, pdfOptions())
      return
    }
    exportToExcel(title, rows, fname)
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
    const domainLabel = {
      merchandise: 'Mercancía / listas',
      supplies: 'Suministros',
      fixed_asset: 'Activos y equipos',
      tool: 'Herramientas',
      custom: 'Personalizado'
    }
    const summary = await fetchInventorySummaryForExport()
    const totalItems = summary.reduce((sum, a) => sum + (a.itemsCount || 0), 0)
    const data = summary
      .slice()
      .sort((a, b) => (b.itemsCount || 0) - (a.itemsCount || 0))
      .map(area => ({
        Área: area.name,
        Tipo: domainLabel[area.domain_type] || 'Personalizado',
        'Ítems registrados': area.itemsCount ?? 0,
        Participación: totalItems > 0 ? `${(((area.itemsCount || 0) / totalItems) * 100).toFixed(1)}%` : '0.0%'
      }))

    if (type === 'pdf') {
      const headers = ['Área', 'Tipo', 'Ítems registrados', 'Participación']
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
      let doc = null
      let fname = ''
      const companyPayload = company
      const common = { dateFilter, company: companyPayload }
      const asDoc = { asLegacy: false }

      if (type === 'finanzas') {
        const rows = await fetchTransactionsForExport({ from: dateFilter.startDate, to: dateFilter.endDate, userId, businessId })
        const prev = getPreviousRange(dateFilter)
        const prevRows = await fetchTransactionsForExport({ from: prev.startDate, to: prev.endDate, userId, businessId })
        doc = buildReport('finanzas', {
          ...common,
          transactions: rows,
          comparison: { comparisonTransactions: prevRows, comparisonLabel: prev.label },
        }, asDoc)
        fname = `informe_finanzas_${dateFilter?.type}`
      } else if (type === 'almacen' || type === 'kardex') {
        // E4: historial hasta fin de período (saldo inicial + Kardex); valoración solo unit_cost.
        const rows = await fetchMovementsForReporting({
          startDate: dateFilter.startDate,
          endDate: dateFilter.endDate,
          userId,
          businessId,
          scope: 'through_end',
        })
        doc = buildReport(type, { ...common, movements: rows }, asDoc)
        fname = type === 'kardex' ? `informe_kardex_${dateFilter?.type}` : `informe_almacen_${dateFilter?.type}`
      } else if (type === 'inventario') {
        const summary = await fetchInventorySummaryForExport()
        doc = buildReport('inventario', { ...common, inventorySummary: summary }, asDoc)
        fname = `informe_inventario_${dateFilter?.type}`
      } else if (type === 'executive') {
        const [tx, mov, inv] = await Promise.all([
          fetchTransactionsForExport({ from: dateFilter.startDate, to: dateFilter.endDate, userId, businessId }),
          fetchMovementsForExport({ startDate: dateFilter.startDate, endDate: dateFilter.endDate, userId, businessId }),
          fetchInventorySummaryForExport(),
        ])
        doc = buildReport('executive', {
          ...common,
          transactions: tx,
          movements: mov,
          inventorySummary: inv,
          openReceivableCount: openReceivableRows.length,
          openPayableCount: openPayableRows.length,
        }, asDoc)
        fname = `informe_ejecutivo_${dateFilter?.type}`
      } else if (type === 'audit') {
        if (!canViewLogs) {
          notify.error('No tienes permiso para ver auditoría (logs.view).')
          return
        }
        if (!businessId) {
          notify.error('No se pudo resolver el negocio para auditoría.')
          return
        }
        const logsRes = await listAllAuditLogs({
          businessId,
          startDate: dateFilter.startDate,
          endDate: dateFilter.endDate,
        })
        doc = buildReport('audit', { ...common, auditLogs: logsRes?.data || [] }, asDoc)
        fname = `informe_auditoria_${dateFilter?.type}`
      } else if (type === 'reconcile') {
        // E7: venta–stock–cobro + rotación valorizada. Pagos del período + paid_amount como respaldo.
        const [tx, mov, settled] = await Promise.all([
          fetchTransactionsForExport({ from: dateFilter.startDate, to: dateFilter.endDate, userId, businessId }),
          fetchMovementsForReporting({
            startDate: dateFilter.startDate,
            endDate: dateFilter.endDate,
            userId,
            businessId,
            scope: 'through_end',
          }),
          fetchSettledCashSources({ from: dateFilter.startDate, to: dateFilter.endDate, userId, businessId }),
        ])
        doc = buildReport('reconcile', {
          ...common,
          transactions: tx,
          movements: mov,
          payments: settled?.payments || [],
        }, asDoc)
        fname = `informe_conciliacion_${dateFilter?.type}`
      } else if (type === 'global') {
        const prev = getPreviousRange(dateFilter)
        const [tx, prevTx, mov, inv] = await Promise.all([
          fetchTransactionsForExport({ from: dateFilter.startDate, to: dateFilter.endDate, userId, businessId }),
          fetchTransactionsForExport({ from: prev.startDate, to: prev.endDate, userId, businessId }),
          fetchMovementsForExport({ startDate: dateFilter.startDate, endDate: dateFilter.endDate, userId, businessId }),
          fetchInventorySummaryForExport()
        ])
        doc = buildReport('global', {
          ...common,
          transactions: tx,
          prevTransactions: prevTx,
          prevLabel: prev.label,
          movements: mov,
          inventorySummary: inv,
        }, asDoc)
        fname = `informe_global_${dateFilter?.type}`
      } else {
        return
      }

      setPreviewDocument(doc)
      setPreviewReport(toLegacyReportShape(doc))
      setIssuedPublicId(null)
      setIssuedInstanceId(null)
      setFilename(fname)
      setPreviewOpen(true)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleDownloadDOCX = async () => {
    if (!canExportDocs) { notifyPremiumExport('Word'); return }
    await generateDOCX(previewReport, filename, { company })
    if (issuedInstanceId && previewDocument) {
      try {
        const { hashReportDocument } = await import('@/services/reportInstances')
        const contentHash = await hashReportDocument(previewDocument)
        await registerReportExport({
          instanceId: issuedInstanceId,
          format: 'docx',
          contentHash,
          userId,
          businessId,
        })
      } catch { /* la descarga no depende del registro de export */ }
    }
    setPreviewOpen(false)
  }

  const handleIssueReport = async () => {
    if (!canExportDocs) { notifyPremiumExport('emitir informes'); return }
    if (!previewDocument) return
    setIssuing(true)
    try {
      const saved = await saveReportInstance({
        document: previewDocument,
        status: 'issued',
        company,
        templateCode: previewDocument.type,
        userId,
        businessId,
      })
      setIssuedPublicId(saved.public_id)
      setIssuedInstanceId(saved.id)
      const stamped = saved.document || { ...previewDocument, id: saved.public_id }
      setPreviewDocument(stamped)
      setPreviewReport(toLegacyReportShape(stamped))
      await registerReportExport({
        instanceId: saved.id,
        format: 'json',
        contentHash: saved.content_hash,
        userId,
        businessId,
      })
      notify.success(`Informe emitido: ${saved.public_id}`)
    } catch (err) {
      notify.error(err?.message || 'No se pudo emitir el informe. ¿Aplicaste la migración E6?')
    } finally {
      setIssuing(false)
    }
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

  const reportsDisabled = !dateFilter || previewLoading || !online

  const detailSections = [
    ...(canViewFinanzas ? [{ value: 'finanzas', label: 'Finanzas', icon: Wallet }] : []),
    { value: 'almacen', label: 'Almacén', icon: Warehouse },
    { value: 'inventario', label: 'Inventario', icon: Layers },
    ...(canViewFinanzas ? [{ value: 'aging', label: 'Antigüedad', icon: ClipboardList }] : []),
  ]
  const activeDetailTab = detailSections.some((s) => s.value === detailTab)
    ? detailTab
    : (detailSections[0]?.value || 'almacen')

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Cabecera */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="shrink-0 rounded-lg bg-primary/10 p-2">
            <BarChart3 className="h-7 w-7 text-primary sm:h-8 sm:w-8" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Reportes y resúmenes</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Elige el período, genera el documento y revisa el panorama. El detalle por módulo queda debajo.
            </p>
          </div>
        </div>
        {previewLoading && (
          <div className="inline-flex h-10 items-center gap-2 self-start rounded-full border bg-muted/40 px-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Preparando informe…
          </div>
        )}
      </div>

      {!online ? (
        <OfflineBlockedPanel
          title="Reportes necesitan internet"
          description="Los resúmenes e informes se arman con datos frescos del servidor y exportación. Sin conexión no se generan ni se emiten, para evitar números a medias o archivos incompletos. Reconecta e inténtalo de nuevo."
        />
      ) : (
      <>
      {/* 1. Período — sin botones de documento mezclados */}
      <section className="space-y-2" aria-labelledby="reportes-periodo">
        <h2 id="reportes-periodo" className="text-sm font-medium text-foreground">
          1. Período
        </h2>
        <DateRangeFilter onFilterChange={handleFilterChange} className="w-full sm:w-full" />
      </section>

      {/* 2. Generar documento — camino principal primero */}
      <section className="space-y-3" aria-labelledby="reportes-generar">
        <div className="space-y-1">
          <h2 id="reportes-generar" className="text-sm font-medium text-foreground">
            2. Generar informe
          </h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {dateFilter
              ? `Período activo: ${dateFilter.label}. Se abre una vista previa; luego puedes emitir o descargar Word.`
              : 'Selecciona un período para habilitar los informes.'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <PermissionGuard permission="reports.export" mode="disable">
            <ReportTypeCard
              featured
              icon={FileText}
              title="Resumen general"
              description="Finanzas, almacén e inventario en un solo documento."
              disabled={reportsDisabled}
              onClick={() => handlePreview('global')}
            />
          </PermissionGuard>
          <PermissionGuard permission="reports.export" mode="disable">
            <ReportTypeCard
              icon={BarChart3}
              title="Ejecutivo"
              description="KPIs y excepciones del período, sin todo el detalle."
              disabled={reportsDisabled}
              onClick={() => handlePreview('executive')}
            />
          </PermissionGuard>
          <PermissionGuard permission="reports.export" mode="disable">
            <ReportTypeCard
              icon={Wallet}
              title="Financiero de gestión"
              description="Entradas y salidas registradas por moneda."
              disabled={reportsDisabled}
              onClick={() => handlePreview('finanzas')}
            />
          </PermissionGuard>
          <PermissionGuard permission="reports.export" mode="disable">
            <ReportTypeCard
              icon={Warehouse}
              title="Existencias"
              description="Saldo por producto; valoración si hay unit_cost."
              disabled={reportsDisabled}
              onClick={() => handlePreview('almacen')}
            />
          </PermissionGuard>
          <PermissionGuard permission="reports.export" mode="disable">
            <ReportTypeCard
              icon={Layers}
              title="Kardex"
              description="Libro de movimientos por producto hasta la fecha de corte."
              disabled={reportsDisabled}
              onClick={() => handlePreview('kardex')}
            />
          </PermissionGuard>
          <PermissionGuard permission="reports.export" mode="disable">
            <ReportTypeCard
              icon={Package}
              title="Inventario por áreas"
              description="Conteos de equipos, suministros y listas (no mercancía de venta)."
              disabled={reportsDisabled}
              onClick={() => handlePreview('inventario')}
            />
          </PermissionGuard>
        </div>

        <div className="rounded-xl border bg-muted/20 p-2 sm:p-3">
          <button
            type="button"
            className="flex h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-sm font-medium transition-colors hover:bg-muted/60 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setShowAdvancedReports((v) => !v)}
            aria-expanded={showAdvancedReports}
          >
            <span>Informes avanzados</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${showAdvancedReports ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          {showAdvancedReports && (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <PermissionGuard permission="reports.export" mode="disable">
                <ReportTypeCard
                  icon={ArrowLeftRight}
                  title="Conciliación venta–stock–cobro"
                  description="¿Se entregó, se registró y se cobró? + rotación valorizada."
                  disabled={reportsDisabled}
                  onClick={() => handlePreview('reconcile')}
                />
              </PermissionGuard>
              {canViewLogs ? (
                <PermissionGuard permission="reports.export" mode="disable">
                  <ReportTypeCard
                    icon={ClipboardList}
                    title="Auditoría"
                    description="Quién, qué, cuándo y antes/después hasta la fecha de corte."
                    disabled={reportsDisabled}
                    onClick={() => handlePreview('audit')}
                  />
                </PermissionGuard>
              ) : (
                <p className="flex items-center gap-2 self-center px-1 text-xs text-muted-foreground sm:col-span-1">
                  <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Auditoría requiere permiso de logs.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 3. Panorama + 4. Detalle — solo con período */}
      {dateFilter && (
        <>
          {canViewFinanzas && (
            <section className="space-y-3" aria-labelledby="reportes-panorama">
              <div className="space-y-1">
                <h2 id="reportes-panorama" className="text-sm font-medium text-foreground">
                  3. Panorama
                </h2>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Flujo del período y posición de caja (foto a hoy), sin mezclar monedas.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card className="min-w-0 overflow-hidden">
                  <CardHeader className="space-y-3 pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                          <ArrowLeftRight className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                          <span className="min-w-0 break-words">{cashLabels.title}</span>
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                          {cashLabels.description} · {dateFilter.label}
                        </CardDescription>
                      </div>
                      <PermissionGuard permission="reports.export" mode="disable">
                        <ExportMenu
                          options={[
                            {
                              format: 'excel',
                              locked: !canExportDocs,
                              onClick: () => (canExportDocs ? exportCashFlow('excel') : notifyPremiumExport('Excel')),
                            },
                            { format: 'pdf', onClick: () => exportCashFlow('pdf') },
                          ]}
                        />
                      </PermissionGuard>
                    </div>
                    <div
                      role="group"
                      aria-label="Base del flujo"
                      className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-1"
                    >
                      <Button
                        type="button"
                        size="sm"
                        variant={cashBasis === 'recorded' ? 'default' : 'ghost'}
                        className="h-10"
                        onClick={() => setCashBasis('recorded')}
                      >
                        Registrado
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={cashBasis === 'settled' ? 'default' : 'ghost'}
                        className="h-10"
                        onClick={() => setCashBasis('settled')}
                      >
                        Liquidado
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CashFlowPanel
                      rows={cashFlow}
                      loading={cashLoading}
                      formatCurrency={formatCurrency}
                      netLabel={cashLabels.net}
                      inflowLabel={cashLabels.inflow}
                      outflowLabel={cashLabels.outflow}
                      emptyMessage="No hay movimientos en el período seleccionado."
                    />
                  </CardContent>
                </Card>

                <Card className="min-w-0 overflow-hidden">
                  <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <Wallet className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                        Posición
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        Caja real hoy y de qué se compone, por moneda.
                      </CardDescription>
                    </div>
                    <PermissionGuard permission="reports.export" mode="disable">
                      <ExportMenu
                        options={[
                          {
                            format: 'excel',
                            locked: !canExportDocs,
                            onClick: () => (canExportDocs ? exportPosition('excel') : notifyPremiumExport('Excel')),
                          },
                          { format: 'pdf', onClick: () => exportPosition('pdf') },
                        ]}
                      />
                    </PermissionGuard>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <PositionPanel rows={position} loading={positionLoading} formatCurrency={formatCurrency} />
                  </CardContent>
                </Card>
              </div>
            </section>
          )}

          <section className="space-y-3" aria-labelledby="reportes-detalle">
            <div className="space-y-1">
              <h2 id="reportes-detalle" className="text-sm font-medium text-foreground">
                4. Detalle por módulo
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Lista del período y exportaciones rápidas. Antigüedad es foto a hoy.
              </p>
            </div>

            <Tabs value={activeDetailTab} onValueChange={setDetailTab} className="w-full">
              <SectionSwitcher
                value={activeDetailTab}
                onValueChange={setDetailTab}
                options={detailSections}
                label="Módulo"
              />

              <TabsContent value="finanzas" className="mt-3 space-y-4">
                <Card className="min-w-0 overflow-hidden">
                  <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
                        Movimientos financieros
                        <Badge variant="secondary" className="shrink-0">{financeCount}</Badge>
                      </CardTitle>
                      <CardDescription>{dateFilter.label}</CardDescription>
                    </div>
                    <PermissionGuard permission="reports.export" mode="disable">
                      <ExportMenu
                        disabled={previewLoading}
                        options={[
                          { format: 'word', onClick: () => handlePreview('finanzas'), disabled: previewLoading },
                          {
                            format: 'excel',
                            locked: !canExportDocs,
                            onClick: () => (canExportDocs ? exportFinanzas('excel') : notifyPremiumExport('Excel')),
                          },
                          { format: 'pdf', onClick: () => exportFinanzas('pdf') },
                        ]}
                      />
                    </PermissionGuard>
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

              <TabsContent value="almacen" className="mt-3 space-y-4">
                <Card className="min-w-0 overflow-hidden">
                  <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
                        Movimientos de almacén
                        <Badge variant="secondary" className="shrink-0">{warehouseCount}</Badge>
                      </CardTitle>
                      <CardDescription>{dateFilter.label}</CardDescription>
                    </div>
                    <PermissionGuard permission="reports.export" mode="disable">
                      <ExportMenu
                        disabled={previewLoading}
                        options={[
                          { format: 'word', label: 'Existencias', onClick: () => handlePreview('almacen'), disabled: previewLoading },
                          { format: 'word', label: 'Kardex', onClick: () => handlePreview('kardex'), disabled: previewLoading },
                          {
                            format: 'excel',
                            locked: !canExportDocs,
                            onClick: () => (canExportDocs ? exportAlmacen('excel') : notifyPremiumExport('Excel')),
                          },
                          { format: 'pdf', onClick: () => exportAlmacen('pdf') },
                        ]}
                      />
                    </PermissionGuard>
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

              <TabsContent value="inventario" className="mt-3 space-y-4">
                <Card className="min-w-0 overflow-hidden">
                  <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
                        Inventario por áreas
                        <Badge variant="secondary" className="shrink-0">{inventoryCount}</Badge>
                      </CardTitle>
                      <CardDescription>
                        Equipos, suministros y listas. La mercancía de venta está en Almacén · {dateFilter.label}
                      </CardDescription>
                    </div>
                    <PermissionGuard permission="reports.export" mode="disable">
                      <ExportMenu
                        disabled={previewLoading}
                        options={[
                          { format: 'word', label: 'Resumen', onClick: () => handlePreview('inventario'), disabled: previewLoading },
                          {
                            format: 'excel',
                            locked: !canExportDocs,
                            onClick: () => (canExportDocs ? exportInventario('excel') : notifyPremiumExport('Excel')),
                          },
                          { format: 'pdf', onClick: () => exportInventario('pdf') },
                        ]}
                      />
                    </PermissionGuard>
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
                      renderItem={(area) => {
                        const tipo = ({
                          merchandise: 'Mercancía / listas',
                          supplies: 'Suministros',
                          fixed_asset: 'Activos',
                          tool: 'Herramientas',
                          custom: 'Personalizado'
                        })[area.domain_type] || 'Personalizado'
                        return (
                          <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <div className="flex min-w-0 items-start gap-3 sm:items-center">
                              <div className="shrink-0 rounded-full bg-primary/10 p-2">
                                <Package className="h-4 w-4 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium break-words">{area.name}</div>
                                <div className="text-sm text-muted-foreground">{tipo} · ítems en el periodo</div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 border-t pt-3 sm:shrink-0 sm:justify-end sm:gap-4 sm:border-0 sm:pt-0">
                              <Badge variant="outline" className="whitespace-nowrap">{tipo}</Badge>
                              <Badge variant="secondary" className="whitespace-nowrap">{area.itemsCount ?? 0} ítems</Badge>
                            </div>
                          </div>
                        )
                      }}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {canViewFinanzas && (
                <TabsContent value="aging" className="mt-3 space-y-4">
                  <Card className="min-w-0 overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <Layers className="h-5 w-5 text-primary" aria-hidden />
                        Antigüedad de saldos
                      </CardTitle>
                      <CardDescription>Cuentas pendientes por vencimiento (foto a hoy, no usa el período).</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Tabs value={agingTab} onValueChange={setAgingTab}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <TabsList className="grid h-auto w-full grid-cols-2 p-1 sm:w-auto sm:inline-flex">
                            <TabsTrigger value="receivable" className="h-10">Por cobrar</TabsTrigger>
                            <TabsTrigger value="payable" className="h-10">Por pagar</TabsTrigger>
                          </TabsList>
                          <PermissionGuard permission="reports.export" mode="disable">
                            <ExportMenu
                              options={[
                                {
                                  format: 'excel',
                                  label: 'Detalle',
                                  locked: !canExportDocs,
                                  onClick: () => (canExportDocs
                                    ? exportOpenAccounts(agingTab === 'payable' ? 'payable' : 'receivable', 'excel')
                                    : notifyPremiumExport('Excel')),
                                },
                                {
                                  format: 'excel',
                                  label: 'Antigüedad',
                                  locked: !canExportDocs,
                                  onClick: () => (canExportDocs ? exportAging('excel') : notifyPremiumExport('Excel')),
                                },
                                { format: 'pdf', onClick: () => exportAging('pdf') },
                              ]}
                            />
                          </PermissionGuard>
                        </div>
                        <TabsContent value="receivable" className="mt-4">
                          <AgingPanel rows={aging} loading={agingLoading} formatCurrency={formatCurrency} income emptyMessage="No hay cuentas por cobrar pendientes." />
                          {openReceivableRows.length > 0 && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {openReceivableRows.length} cuenta{openReceivableRows.length === 1 ? '' : 's'} abierta{openReceivableRows.length === 1 ? '' : 's'} (exporta «Detalle» para contacto y saldo).
                            </p>
                          )}
                        </TabsContent>
                        <TabsContent value="payable" className="mt-4">
                          <AgingPanel rows={aging} loading={agingLoading} formatCurrency={formatCurrency} income={false} emptyMessage="No hay cuentas por pagar pendientes." />
                          {openPayableRows.length > 0 && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {openPayableRows.length} cuenta{openPayableRows.length === 1 ? '' : 's'} abierta{openPayableRows.length === 1 ? '' : 's'} (exporta «Detalle» para contacto y saldo).
                            </p>
                          )}
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </section>
        </>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] max-w-[800px] overflow-y-auto p-4 sm:p-6">
          {previewReport && (
            <>
              <DialogHeader className="pr-8 text-left">
                <DialogTitle>Previsualización del informe</DialogTitle>
                <DialogDescription>
                  {issuedPublicId
                    ? `Emitido como ${issuedPublicId}. La descarga Word registra una exportación de la misma instancia.`
                    : 'Consulta con fecha de corte. Emite para congelar el snapshot o descarga Word como borrador.'}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-2 min-w-0 rounded-md border bg-white p-4 text-black shadow-sm sm:p-8">
                <ReportPreview report={previewReport} company={company} />
              </div>

              <DialogFooter className="mt-4 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                {!canExportDocs && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground sm:mr-auto">
                    <Lock className="h-3 w-3 shrink-0" />
                    Emitir y Word branded son Premium.
                  </p>
                )}
                {issuedPublicId && (
                  <p className="w-full text-xs text-muted-foreground sm:mr-auto sm:w-auto">ID: {issuedPublicId}</p>
                )}
                <PermissionGuard permission="reports.export" mode="disable">
                  {canExportDocs ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full sm:h-10 sm:w-auto"
                      disabled={issuing || !!issuedPublicId}
                      onClick={handleIssueReport}
                    >
                      {issuedPublicId ? 'Ya emitido' : (issuing ? 'Emitiendo…' : 'Emitir informe')}
                    </Button>
                  ) : (
                    <Button type="button" variant="secondary" className="h-11 w-full sm:h-10 sm:w-auto" onClick={() => notifyPremiumExport('emitir informes')}>
                      <Lock className="mr-2 h-4 w-4" />
                      Emitir (Premium)
                    </Button>
                  )}
                </PermissionGuard>
                <PermissionGuard permission="reports.export" mode="disable">
                  {canExportDocs ? (
                    <Button onClick={handleDownloadDOCX} className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:h-10 sm:w-auto">
                      <FileText className="mr-2 h-4 w-4" />
                      Descargar Word
                    </Button>
                  ) : (
                    <Button onClick={() => notifyPremiumExport('Word')} variant="secondary" className="h-11 w-full sm:h-10 sm:w-auto">
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
      </>
      )}
    </div>
  )
}

export default Reportes
