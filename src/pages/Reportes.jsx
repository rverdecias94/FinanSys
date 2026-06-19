import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, File, FileSpreadsheet, FileText, Loader2, Lock } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { getBusinessSettings } from '@/services/businessSettings'
import { notify } from '@/services/notifications'
import { useIsMobile } from '@/hooks/useIsMobile'
import DateRangeFilter from '@/components/common/DateRangeFilter'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PermissionGuard } from '@/components/common/PermissionGuard'
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

  const [financePage, setFinancePage] = useState(1)
  const [warehousePage, setWarehousePage] = useState(1)
  const [inventoryPage, setInventoryPage] = useState(1)

  const PAGE_SIZE_DESKTOP = 10
  const PAGE_SIZE_MOBILE = 10
  const INVENTORY_PAGE_SIZE_DESKTOP = 10
  const INVENTORY_PAGE_SIZE_MOBILE = 5

  useEffect(() => {
    setFinancePage(1)
    setWarehousePage(1)
    setInventoryPage(1)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, left: 0 })
  }, [dateFilter, effectiveUserId])

  const getTotalPages = (count, pageSize) => {
    const c = Number(count || 0)
    if (!c) return 1
    return Math.max(1, Math.ceil(c / pageSize))
  }

  const getPaginationItems = (page, totalPages) => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const items = []
    const add = (v) => items.push(v)
    add(1)
    const left = Math.max(2, page - 1)
    const right = Math.min(totalPages - 1, page + 1)
    if (left > 2) add('…')
    for (let p = left; p <= right; p++) add(p)
    if (right < totalPages - 1) add('…')
    add(totalPages)
    return items
  }

  const financePageQuery = useQuery({
    queryKey: ['reportes-finanzas-page', effectiveUserId, dateFilter, financePage, PAGE_SIZE_DESKTOP],
    queryFn: () => listTransactions({
      from: dateFilter?.startDate,
      to: dateFilter?.endDate,
      userId,
      businessId,
      page: financePage,
      pageSize: PAGE_SIZE_DESKTOP
    }),
    enabled: !!userId && !!effectiveUserId && !!dateFilter && !isMobile,
  })

  const financeInfiniteQuery = useInfiniteQuery({
    queryKey: ['reportes-finanzas-infinite', effectiveUserId, dateFilter, PAGE_SIZE_MOBILE],
    queryFn: ({ pageParam = 1 }) => listTransactions({
      from: dateFilter?.startDate,
      to: dateFilter?.endDate,
      userId,
      businessId,
      page: pageParam,
      pageSize: PAGE_SIZE_MOBILE
    }),
    enabled: !!userId && !!effectiveUserId && !!dateFilter && isMobile,
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const count = Number(lastPage?.count || 0)
      const loaded = allPages.reduce((acc, p) => acc + Number(p?.data?.length || 0), 0)
      if (!count || loaded >= count) return undefined
      return allPages.length + 1
    }
  })

  const warehousePageQuery = useQuery({
    queryKey: ['reportes-almacen-page', effectiveUserId, dateFilter, warehousePage, PAGE_SIZE_DESKTOP],
    queryFn: () => listMovements({
      startDate: dateFilter?.startDate,
      endDate: dateFilter?.endDate,
      userId,
      businessId,
      page: warehousePage,
      pageSize: PAGE_SIZE_DESKTOP
    }),
    enabled: !!userId && !!effectiveUserId && !!dateFilter && !isMobile
  })

  const warehouseInfiniteQuery = useInfiniteQuery({
    queryKey: ['reportes-almacen-infinite', effectiveUserId, dateFilter, PAGE_SIZE_MOBILE],
    queryFn: ({ pageParam = 1 }) => listMovements({
      startDate: dateFilter?.startDate,
      endDate: dateFilter?.endDate,
      userId,
      businessId,
      page: pageParam,
      pageSize: PAGE_SIZE_MOBILE
    }),
    enabled: !!userId && !!effectiveUserId && !!dateFilter && isMobile,
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const count = Number(lastPage?.count || 0)
      const loaded = allPages.reduce((acc, p) => acc + Number(p?.data?.length || 0), 0)
      if (!count || loaded >= count) return undefined
      return allPages.length + 1
    }
  })

  const inventoryPageQuery = useQuery({
    queryKey: ['reportes-inventario-page', effectiveUserId, dateFilter, inventoryPage, INVENTORY_PAGE_SIZE_DESKTOP],
    queryFn: async () => {
      const res = await listAreas(effectiveUserId, { page: inventoryPage, pageSize: INVENTORY_PAGE_SIZE_DESKTOP })
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
    },
    enabled: !!userId && !!effectiveUserId && !!dateFilter && !isMobile
  })

  const inventoryInfiniteQuery = useInfiniteQuery({
    queryKey: ['reportes-inventario-infinite', effectiveUserId, dateFilter, INVENTORY_PAGE_SIZE_MOBILE],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await listAreas(effectiveUserId, { page: pageParam, pageSize: INVENTORY_PAGE_SIZE_MOBILE })
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
    },
    enabled: !!userId && !!effectiveUserId && !!dateFilter && isMobile,
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const count = Number(lastPage?.count || 0)
      const loaded = allPages.reduce((acc, p) => acc + Number(p?.data?.length || 0), 0)
      if (!count || loaded >= count) return undefined
      return allPages.length + 1
    }
  })

  const transactionsDesktop = financePageQuery.data?.data || []
  const transactionsDesktopCount = financePageQuery.data?.count || 0
  const transactionsMobile = useMemo(() => {
    const pages = financeInfiniteQuery.data?.pages || []
    return pages.flatMap(p => p?.data || [])
  }, [financeInfiniteQuery.data])
  const transactionsMobileCount = financeInfiniteQuery.data?.pages?.[0]?.count || 0

  const movementsDesktop = warehousePageQuery.data?.data || []
  const movementsDesktopCount = warehousePageQuery.data?.count || 0
  const movementsMobile = useMemo(() => {
    const pages = warehouseInfiniteQuery.data?.pages || []
    return pages.flatMap(p => p?.data || [])
  }, [warehouseInfiniteQuery.data])
  const movementsMobileCount = warehouseInfiniteQuery.data?.pages?.[0]?.count || 0

  const inventoryDesktop = inventoryPageQuery.data?.data || []
  const inventoryDesktopCount = inventoryPageQuery.data?.count || 0
  const inventoryMobile = useMemo(() => {
    const pages = inventoryInfiniteQuery.data?.pages || []
    return pages.flatMap(p => p?.data || [])
  }, [inventoryInfiniteQuery.data])
  const inventoryMobileCount = inventoryInfiniteQuery.data?.pages?.[0]?.count || 0

  // Finanzas Query
  const { data: transactions = [], isLoading: loadingFinanzas } = useQuery({
    queryKey: ['reportes-finanzas', dateFilter, userId],
    queryFn: () => listTransactions({
      from: dateFilter?.startDate,
      to: dateFilter?.endDate,
      userId,
      businessId,
      limit: 1000 // Limit for report preview/export
    }),
    enabled: !!userId && !!effectiveUserId && !!dateFilter
  })

  // Almacén Query
  const { data: movementsData, isLoading: loadingAlmacen } = useQuery({
    queryKey: ['reportes-almacen', dateFilter, userId],
    queryFn: () => listMovements({
      startDate: dateFilter?.startDate,
      endDate: dateFilter?.endDate,
      userId,
      businessId,
      pageSize: 1000,
      page: 1
    }),
    enabled: !!userId && !!effectiveUserId && !!dateFilter
  })
  const movements = movementsData?.data || []

  // Inventario Query (Areas + Item Counts)
  const { data: inventorySummary = [], isLoading: loadingInventario } = useQuery({
    queryKey: ['reportes-inventario', dateFilter, userId],
    queryFn: async () => {
      const areas = await listAreas(effectiveUserId)
      const summaryPromises = areas.map(async (area) => {
        const { count } = await listItems(area.id, {
          page: 1,
          pageSize: 1,
          startDate: dateFilter?.startDate,
          endDate: dateFilter?.endDate
        }, effectiveUserId)
        return {
          ...area,
          itemsCount: count
        }
      })
      return Promise.all(summaryPromises)
    },
    enabled: !!userId && !!effectiveUserId && !!dateFilter
  })

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

  const financeSentinelRef = useRef(null)
  const warehouseSentinelRef = useRef(null)
  const inventorySentinelRef = useRef(null)

  const useInfiniteScroll = ({ enabled, sentinelRef, hasNextPage, isFetchingNextPage, fetchNextPage }) => {
    useEffect(() => {
      if (!enabled) return
      const el = sentinelRef.current
      if (!el) return

      const observer = new IntersectionObserver((entries) => {
        const first = entries[0]
        if (!first?.isIntersecting) return
        if (!hasNextPage) return
        if (isFetchingNextPage) return
        fetchNextPage()
      }, { rootMargin: '240px' })

      observer.observe(el)
      return () => observer.disconnect()
    }, [enabled, sentinelRef, hasNextPage, isFetchingNextPage, fetchNextPage])
  }

  useInfiniteScroll({
    enabled: isMobile,
    sentinelRef: financeSentinelRef,
    hasNextPage: financeInfiniteQuery.hasNextPage,
    isFetchingNextPage: financeInfiniteQuery.isFetchingNextPage,
    fetchNextPage: financeInfiniteQuery.fetchNextPage
  })

  useInfiniteScroll({
    enabled: isMobile,
    sentinelRef: warehouseSentinelRef,
    hasNextPage: warehouseInfiniteQuery.hasNextPage,
    isFetchingNextPage: warehouseInfiniteQuery.isFetchingNextPage,
    fetchNextPage: warehouseInfiniteQuery.fetchNextPage
  })

  useInfiniteScroll({
    enabled: isMobile,
    sentinelRef: inventorySentinelRef,
    hasNextPage: inventoryInfiniteQuery.hasNextPage,
    isFetchingNextPage: inventoryInfiniteQuery.isFetchingNextPage,
    fetchNextPage: inventoryInfiniteQuery.fetchNextPage
  })

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
                  <CardTitle>Resumen Financiero</CardTitle>
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
                {isMobile ? (
                  financeInfiniteQuery.isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                  ) : transactionsMobile.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">No hay transacciones en este periodo.</div>
                  ) : (
                    <div className="space-y-3">
                      {transactionsMobile.map((t) => (
                        <div key={t.id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{t.category || '-'}</div>
                              <div className="text-xs text-muted-foreground">
                                {t.date ? format(new Date(t.date), 'dd/MM/yyyy') : ''} • {t.type === 'income' ? 'Ingreso' : 'Gasto'}
                              </div>
                            </div>
                            <div className={`text-sm font-semibold whitespace-nowrap ${t.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                              {t.type === 'income' ? '+' : '-'}{t.amount} {t.currency}
                            </div>
                          </div>
                          {t.description ? (
                            <div className="mt-2 text-xs text-muted-foreground break-words">
                              {t.description}
                            </div>
                          ) : null}
                        </div>
                      ))}
                      <div ref={financeSentinelRef} />
                      {financeInfiniteQuery.isFetchingNextPage ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
                      ) : null}
                      {!financeInfiniteQuery.hasNextPage && transactionsMobile.length > 0 ? (
                        <div className="text-center text-xs text-muted-foreground py-2">
                          Mostrando {transactionsMobile.length} de {transactionsMobileCount}
                        </div>
                      ) : null}
                    </div>
                  )
                ) : financePageQuery.isLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : transactionsDesktop.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">No hay transacciones en este periodo.</div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
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
                        {transactionsDesktop.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell>{format(new Date(t.date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="capitalize">{t.type === 'income' ? 'Ingreso' : 'Gasto'}</TableCell>
                            <TableCell>{t.category}</TableCell>
                            <TableCell className={`text-right font-medium ${t.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                              {t.type === 'income' ? '+' : '-'}{t.amount} {t.currency}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 border-t bg-muted/30">
                      <div className="text-xs text-muted-foreground">
                        Mostrando {transactionsDesktop.length} de {transactionsDesktopCount}
                      </div>
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFinancePage(p => Math.max(1, p - 1))}
                          disabled={financePage <= 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="ml-1 hidden sm:inline">Anterior</span>
                        </Button>
                        {getPaginationItems(financePage, getTotalPages(transactionsDesktopCount, PAGE_SIZE_DESKTOP)).map((it, idx) => (
                          <Button
                            key={`${it}-${idx}`}
                            variant={it === financePage ? 'default' : 'outline'}
                            size="sm"
                            disabled={it === '…'}
                            onClick={() => typeof it === 'number' && setFinancePage(it)}
                          >
                            {it}
                          </Button>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFinancePage(p => Math.min(getTotalPages(transactionsDesktopCount, PAGE_SIZE_DESKTOP), p + 1))}
                          disabled={financePage >= getTotalPages(transactionsDesktopCount, PAGE_SIZE_DESKTOP)}
                        >
                          <span className="mr-1 hidden sm:inline">Siguiente</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
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
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2">
                <div className="space-y-1 min-w-0">
                  <CardTitle>Movimientos de Almacén</CardTitle>
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
                {isMobile ? (
                  warehouseInfiniteQuery.isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                  ) : movementsMobile.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">No hay movimientos en este periodo.</div>
                  ) : (
                    <div className="space-y-3">
                      {movementsMobile.map((m) => (
                        <div key={m.id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{m.products?.name || 'Desconocido'}</div>
                              <div className="text-xs text-muted-foreground">
                                {m.created_at ? format(new Date(m.created_at), 'dd/MM/yyyy HH:mm') : ''} • {m.type === 'in' ? 'Entrada' : 'Salida'}
                              </div>
                            </div>
                            <div className="text-sm font-semibold whitespace-nowrap">
                              {m.qty}
                            </div>
                          </div>
                          <div className="mt-2">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs ${m.type === 'in' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                              {m.type === 'in' ? 'Entrada' : 'Salida'}
                            </span>
                          </div>
                        </div>
                      ))}
                      <div ref={warehouseSentinelRef} />
                      {warehouseInfiniteQuery.isFetchingNextPage ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
                      ) : null}
                      {!warehouseInfiniteQuery.hasNextPage && movementsMobile.length > 0 ? (
                        <div className="text-center text-xs text-muted-foreground py-2">
                          Mostrando {movementsMobile.length} de {movementsMobileCount}
                        </div>
                      ) : null}
                    </div>
                  )
                ) : warehousePageQuery.isLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : movementsDesktop.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">No hay movimientos en este periodo.</div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
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
                        {movementsDesktop.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell>{format(new Date(m.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                            <TableCell>{m.products?.name || 'Desconocido'}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs ${m.type === 'in' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                                {m.type === 'in' ? 'Entrada' : 'Salida'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">{m.qty}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 border-t bg-muted/30">
                      <div className="text-xs text-muted-foreground">
                        Mostrando {movementsDesktop.length} de {movementsDesktopCount}
                      </div>
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setWarehousePage(p => Math.max(1, p - 1))}
                          disabled={warehousePage <= 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="ml-1 hidden sm:inline">Anterior</span>
                        </Button>
                        {getPaginationItems(warehousePage, getTotalPages(movementsDesktopCount, PAGE_SIZE_DESKTOP)).map((it, idx) => (
                          <Button
                            key={`${it}-${idx}`}
                            variant={it === warehousePage ? 'default' : 'outline'}
                            size="sm"
                            disabled={it === '…'}
                            onClick={() => typeof it === 'number' && setWarehousePage(it)}
                          >
                            {it}
                          </Button>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setWarehousePage(p => Math.min(getTotalPages(movementsDesktopCount, PAGE_SIZE_DESKTOP), p + 1))}
                          disabled={warehousePage >= getTotalPages(movementsDesktopCount, PAGE_SIZE_DESKTOP)}
                        >
                          <span className="mr-1 hidden sm:inline">Siguiente</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
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
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2">
                <div className="space-y-1 min-w-0">
                  <CardTitle>Resumen de Inventario (Activos)</CardTitle>
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
                {isMobile ? (
                  inventoryInfiniteQuery.isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                  ) : inventoryMobile.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">No hay áreas configuradas.</div>
                  ) : (
                    <div className="space-y-3">
                      {inventoryMobile.map((area) => (
                        <div key={area.id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{area.name}</div>
                              <div className="text-xs text-muted-foreground">
                                Ítems en período: {area.itemsCount}
                              </div>
                            </div>
                            <div className="text-sm font-semibold whitespace-nowrap">{area.itemsCount}</div>
                          </div>
                        </div>
                      ))}
                      <div ref={inventorySentinelRef} />
                      {inventoryInfiniteQuery.isFetchingNextPage ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
                      ) : null}
                      {!inventoryInfiniteQuery.hasNextPage && inventoryMobile.length > 0 ? (
                        <div className="text-center text-xs text-muted-foreground py-2">
                          Mostrando {inventoryMobile.length} de {inventoryMobileCount}
                        </div>
                      ) : null}
                    </div>
                  )
                ) : inventoryPageQuery.isLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : inventoryDesktop.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">No hay áreas configuradas.</div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Área</TableHead>
                          <TableHead>Ítems Registrados (Periodo)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inventoryDesktop.map((area) => (
                          <TableRow key={area.id}>
                            <TableCell className="font-medium">{area.name}</TableCell>
                            <TableCell>{area.itemsCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 border-t bg-muted/30">
                      <div className="text-xs text-muted-foreground">
                        Mostrando {inventoryDesktop.length} de {inventoryDesktopCount}
                      </div>
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInventoryPage(p => Math.max(1, p - 1))}
                          disabled={inventoryPage <= 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="ml-1 hidden sm:inline">Anterior</span>
                        </Button>
                        {getPaginationItems(inventoryPage, getTotalPages(inventoryDesktopCount, INVENTORY_PAGE_SIZE_DESKTOP)).map((it, idx) => (
                          <Button
                            key={`${it}-${idx}`}
                            variant={it === inventoryPage ? 'default' : 'outline'}
                            size="sm"
                            disabled={it === '…'}
                            onClick={() => typeof it === 'number' && setInventoryPage(it)}
                          >
                            {it}
                          </Button>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInventoryPage(p => Math.min(getTotalPages(inventoryDesktopCount, INVENTORY_PAGE_SIZE_DESKTOP), p + 1))}
                          disabled={inventoryPage >= getTotalPages(inventoryDesktopCount, INVENTORY_PAGE_SIZE_DESKTOP)}
                        >
                          <span className="mr-1 hidden sm:inline">Siguiente</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
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
