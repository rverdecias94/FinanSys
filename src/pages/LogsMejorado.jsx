import { useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  History,
  Loader2,
  Lock,
  Search,
  Shield,
  User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { usePermissionCheck } from '@/components/common/PermissionGuard'
import { InfiniteScrollTrigger } from '@/components/common/InfiniteScrollTrigger'
import { useIsMobile } from '@/hooks/useIsMobile'
import { listAllAuditLogs, listAuditLogs } from '@/services/auditLogs'
import { exportToExcel } from '@/utils/exportUtils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'

const MONTHS = [
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' }
]

function getActionBadgeVariant(action) {
  const a = (action || '').toLowerCase()
  if (a.includes('eliminar') || a.includes('delete')) return 'destructive'
  if (a.includes('crear') || a.includes('create')) return 'secondary'
  if (a.includes('actualizar') || a.includes('update')) return 'outline'
  return 'outline'
}

// Etiquetas amigables (español) para las claves de `details`, para no mostrar
// JSON crudo ni identificadores técnicos en el modal de detalle.
const DETAIL_LABELS = {
  transaction_id: 'ID de transacción',
  type: 'Tipo',
  category: 'Categoría',
  currency: 'Moneda',
  currency_code: 'Moneda',
  rol: 'Rol',
  nuevo_rol: 'Nuevo rol',
  correo: 'Correo',
  permission_count: 'N.º de permisos'
}
const TYPE_LABELS = { income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia' }

function prettyDetailKey(k) {
  return DETAIL_LABELS[k] || String(k).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}
function prettyDetailValue(k, v) {
  if (v === null || v === undefined || v === '') return '—'
  if (k === 'type' && TYPE_LABELS[v]) return TYPE_LABELS[v]
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function LogDetailsDialog({ log, onClose }) {
  const details = log?.details
  const entries = details && typeof details === 'object'
    ? (Array.isArray(details) ? details.map((v, i) => [`#${i + 1}`, v]) : Object.entries(details))
    : []

  const Field = ({ label, value }) => (
    <div className="rounded-md border bg-muted/30 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value || '—'}</p>
    </div>
  )

  return (
    <Dialog open={!!log} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-[560px] max-h-[85vh] overflow-y-auto">
        {log && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 text-left">
                <Badge variant={getActionBadgeVariant(log.action)} className="uppercase text-[10px]">{log.action}</Badge>
                <span className="min-w-0 break-words">{log.resource}</span>
              </DialogTitle>
              <DialogDescription>Detalle completo del registro de auditoría.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Fecha y hora" value={format(new Date(log.created_at), "dd 'de' MMMM yyyy, HH:mm:ss", { locale: es })} />
                <Field label="Usuario" value={log.user_email} />
                <Field label="Área" value={log.area} />
                <Field label="Acción" value={log.action} />
                <Field label="Dirección IP" value={log.ip_address} />
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">Detalles</p>
                {entries.length > 0 ? (
                  <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {entries.map(([k, v]) => (
                      <div key={k} className="rounded-md border p-2.5">
                        <dt className="text-xs text-muted-foreground">{prettyDetailKey(k)}</dt>
                        <dd className="text-sm font-medium break-words">{prettyDetailValue(k, v)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin detalles adicionales para este registro.</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cerrar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function LogsMejorado() {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { canView, isOwner } = usePermissionCheck()
  const isMobile = useIsMobile()

  const [searchTerm, setSearchTerm] = useState('')
  const [areaFilter, setAreaFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')

  const now = useMemo(() => new Date(), [])
  const [reportType, setReportType] = useState('mensual')
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [exporting, setExporting] = useState(false)
  const [selectedLog, setSelectedLog] = useState(null)

  const userId = session?.user?.id
  const effectiveBusinessId = businessId

  const dateRange = useMemo(() => {
    if (reportType === 'mensual') {
      const y = Number(year)
      const m = Number(month) - 1
      const start = new Date(y, m, 1, 0, 0, 0, 0)
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999)
      return { startDate: start, endDate: end }
    }

    if (reportType === 'anual') {
      const y = Number(year)
      const start = new Date(y, 0, 1, 0, 0, 0, 0)
      const end = new Date(y, 11, 31, 23, 59, 59, 999)
      return { startDate: start, endDate: end }
    }

    const start = rangeFrom ? new Date(`${rangeFrom}T00:00:00`) : null
    const end = rangeTo ? new Date(`${rangeTo}T23:59:59.999`) : null
    return { startDate: start, endDate: end }
  }, [month, reportType, rangeFrom, rangeTo, year])

  const filtersKey = useMemo(() => {
    return {
      searchTerm,
      areaFilter,
      actionFilter,
      reportType,
      month,
      year,
      rangeFrom,
      rangeTo
    }
  }, [actionFilter, areaFilter, month, rangeFrom, rangeTo, reportType, searchTerm, year])

  useEffect(() => {
    if (isMobile) return
    setPage(1)
  }, [filtersKey, isMobile])

  const desktopQuery = useQuery({
    queryKey: ['auditLogs-page', effectiveBusinessId, filtersKey, page, pageSize],
    queryFn: () => listAuditLogs({
      businessId: effectiveBusinessId,
      page,
      pageSize,
      searchTerm,
      area: areaFilter,
      action: actionFilter,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    }),
    enabled: !!userId && !!effectiveBusinessId && canView('logs') && !isMobile,
    keepPreviousData: true
  })

  const PAGE_SIZE_MOBILE = 15
  const mobileQuery = useInfiniteQuery({
    queryKey: ['auditLogs-infinite', effectiveBusinessId, filtersKey, PAGE_SIZE_MOBILE],
    queryFn: ({ pageParam = 1 }) => listAuditLogs({
      businessId: effectiveBusinessId,
      page: pageParam,
      pageSize: PAGE_SIZE_MOBILE,
      searchTerm,
      area: areaFilter,
      action: actionFilter,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    }),
    enabled: !!userId && !!effectiveBusinessId && canView('logs') && isMobile,
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const count = Number(allPages?.[0]?.count || lastPage?.count || 0)
      const loaded = allPages.reduce((acc, p) => acc + Number(p?.data?.length || 0), 0)
      if (!count || loaded >= count) return undefined
      return allPages.length + 1
    }
  })

  const logs = useMemo(() => {
    if (!isMobile) return desktopQuery.data?.data || []
    const pages = mobileQuery.data?.pages || []
    return pages.flatMap(p => p?.data || [])
  }, [desktopQuery.data, isMobile, mobileQuery.data])

  const totalCount = isMobile
    ? Number(mobileQuery.data?.pages?.[0]?.count || 0)
    : Number(desktopQuery.data?.count || 0)

  const isLoadingLogs = isMobile ? mobileQuery.isLoading : desktopQuery.isLoading
  const isFetchingMore = isMobile ? mobileQuery.isFetchingNextPage : false
  const hasMore = isMobile ? !!mobileQuery.hasNextPage : false

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const handleExport = async () => {
    try {
      setExporting(true)
      const { data } = await listAllAuditLogs({
        businessId: effectiveBusinessId,
        searchTerm,
        area: areaFilter,
        action: actionFilter,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      })

      if (!data?.length) {
        toast.warning('No hay datos para exportar con los filtros actuales')
        return
      }

      const exportData = data.map((log) => ({
        Fecha: format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: es }),
        Usuario: log.user_email || '-',
        Área: log.area || '-',
        Acción: log.action || '-',
        Recurso: log.resource || '-',
        Detalles: log.details ? JSON.stringify(log.details) : '',
        IP: log.ip_address || '-'
      }))

      exportToExcel(
        'Logs de Auditoría',
        exportData,
        `audit_logs_${format(new Date(), 'yyyyMMdd_HHmm', { locale: es })}`
      )
      toast.success('Exportación completada')
    } catch {
      toast.error('Error al exportar logs')
    } finally {
      setExporting(false)
    }
  }

  // Si no tiene permisos de visualización, mostrar mensaje de acceso restringido
  if (!canView('logs')) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-6 text-center max-w-md">
          <CardContent className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Acceso Restringido</h3>
              <p className="text-muted-foreground mb-4">
                No tienes permisos para acceder al módulo de Auditoría y Logs.
              </p>
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="flex items-start gap-2">
                  <Shield className="mt-0.5 w-4 h-4 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="font-medium">¿Por qué no puedo acceder?</p>
                    <p className="text-muted-foreground">
                      Solo los usuarios con rol de Propietario o permisos específicos pueden ver el historial de actividades del sistema.
                    </p>
                  </div>
                </div>
              </div>
            </div>
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
            <History className="w-8 h-8 text-primary" />
          </div>
          Auditoría y Logs
        </h1>

        {/* Resumen de permisos actual */}
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {isOwner ? 'Acceso Total' : 'Acceso de Visualización'}
          </span>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tipo de Reporte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensual">Mensual</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
                <SelectItem value="rango">Rango</SelectItem>
              </SelectContent>
            </Select>

            {reportType === 'mensual' ? (
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : reportType === 'rango' ? (
              <Input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
            ) : (
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i)).map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {reportType === 'rango' ? (
              <Input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
            ) : reportType === 'mensual' ? (
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i)).map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="hidden sm:block" />
            )}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar (acción, recurso o usuario)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={areaFilter} onValueChange={setAreaFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Todas las Áreas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Áreas</SelectItem>
                  <SelectItem value="Finanzas">Finanzas</SelectItem>
                  <SelectItem value="Almacén">Almacén</SelectItem>
                  <SelectItem value="Inventario">Inventario</SelectItem>
                  <SelectItem value="Equipo">Equipo</SelectItem>
                  <SelectItem value="Configuración">Configuración</SelectItem>
                  <SelectItem value="Sistema">Sistema</SelectItem>
                </SelectContent>
              </Select>

              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Todas las Acciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Acciones</SelectItem>
                  <SelectItem value="Crear">Crear</SelectItem>
                  <SelectItem value="Actualizar">Actualizar</SelectItem>
                  <SelectItem value="Eliminar">Eliminar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={handleExport} disabled={exporting || !effectiveBusinessId}>
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
              )}
              <span className="ml-2">Exportar Excel</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Historial de Actividades</span>
            <Badge variant="secondary">
              {totalCount} registros
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingLogs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Mostrando {logs.length} de {totalCount} registros.
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No se encontraron actividades que coincidan con los filtros aplicados
                </div>
              ) : (
                <>
                  {isMobile ? (
                    <div className="space-y-3">
                      {logs.map((log) => (
                        <Card key={log.id}>
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate">{log.action}</div>
                                <div className="text-xs text-muted-foreground truncate">{log.resource}</div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {log.area ? <Badge variant="secondary">{log.area}</Badge> : null}
                                <Badge variant={getActionBadgeVariant(log.action)} className="uppercase text-[10px]">
                                  {log.action}
                                </Badge>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span className="truncate">{log.user_email || '-'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>{format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: es })}</span>
                              </div>
                            </div>

                            <div className="flex justify-end pt-1">
                              <Button variant="outline" size="sm" className="h-8" onClick={() => setSelectedLog(log)}>
                                <Eye className="h-3.5 w-3.5 mr-1.5" /> Ver detalles
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                      <InfiniteScrollTrigger
                        onLoadMore={() => mobileQuery.fetchNextPage()}
                        disabled={!hasMore || isFetchingMore}
                        className="mt-2"
                      />

                      {isFetchingMore && (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Usuario</TableHead>
                              <TableHead>Área</TableHead>
                              <TableHead>Acción</TableHead>
                              <TableHead>Recurso</TableHead>
                              <TableHead className="text-right">Detalles</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {logs.map((log) => (
                              <TableRow key={log.id}>
                                <TableCell className="whitespace-nowrap font-medium text-xs">
                                  {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                                </TableCell>
                                <TableCell className="text-xs">{log.user_email || '-'}</TableCell>
                                <TableCell className="text-xs">
                                  {log.area ? <Badge variant="secondary">{log.area}</Badge> : '-'}
                                </TableCell>
                                <TableCell className="text-xs">
                                  <Badge variant={getActionBadgeVariant(log.action)} className="uppercase text-[10px]">
                                    {log.action}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">{log.resource || '-'}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2"
                                    onClick={() => setSelectedLog(log)}
                                    aria-label={`Ver detalles de ${log.action}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                    <span className="ml-1.5 hidden lg:inline">Ver</span>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span>Filas por página:</span>
                          <Select
                            value={pageSize.toString()}
                            onValueChange={(v) => {
                              setPageSize(Number(v))
                              setPage(1)
                            }}
                          >
                            <SelectTrigger className="w-[80px] h-8">
                              <SelectValue placeholder="10" />
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
                            Página {page} de {totalPages}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setPage((p) => Math.max(1, p - 1))}
                              disabled={page === 1 || isLoadingLogs}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                              disabled={page >= totalPages || isLoadingLogs}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <LogDetailsDialog log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  )
}
