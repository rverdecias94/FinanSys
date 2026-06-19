import { useMemo, useState } from 'react'
import {
  Eye,
  FileSpreadsheet,
  History,
  Loader2,
  Lock,
  Search,
  Shield
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { usePermissionCheck } from '@/components/common/PermissionGuard'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'
import { listAllAuditLogs, listAuditLogs } from '@/services/auditLogs'
// `exportToExcel` se importa dinámicamente en handleExport para no cargar
// las librerías de exportación al abrir la página de Auditoría (P3.5).
import { format, startOfDay, endOfDay } from 'date-fns'
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

  const [searchTerm, setSearchTerm] = useState('')
  const [areaFilter, setAreaFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')

  const now = useMemo(() => new Date(), [])
  const [reportType, setReportType] = useState('mensual')
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [rangeFrom, setRangeFrom] = useState(null)
  const [rangeTo, setRangeTo] = useState(null)

  const [exporting, setExporting] = useState(false)
  const [selectedLog, setSelectedLog] = useState(null)
  const [logsCount, setLogsCount] = useState(0)

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

    const start = rangeFrom ? startOfDay(rangeFrom) : null
    const end = rangeTo ? endOfDay(rangeTo) : null
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

  const renderLog = (log) => (
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <div className="shrink-0 rounded-full bg-primary/10 p-2">
          <History className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="font-medium break-words">{log.resource || log.action}</div>
          <div className="text-sm text-muted-foreground break-words">
            {log.user_email || '-'} · {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t pt-3 sm:shrink-0 sm:justify-end sm:gap-4 sm:border-0 sm:pt-0">
        <div className="flex flex-wrap items-center gap-2">
          {log.area ? <Badge variant="secondary">{log.area}</Badge> : null}
          <Badge variant={getActionBadgeVariant(log.action)} className="uppercase text-[10px]">
            {log.action}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)} aria-label={`Ver detalles de ${log.action}`}>
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  const handleExport = async () => {
    try {
      setExporting(true)
      const { exportToExcel } = await import('@/utils/exportUtils')
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
            <div className="space-y-1.5">
              <Label>Tipo de Reporte</Label>
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
            </div>

            {reportType === 'mensual' ? (
              <div className="space-y-1.5">
                <Label>Mes</Label>
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
              </div>
            ) : reportType === 'rango' ? (
              <div className="space-y-1.5">
                <Label>Desde</Label>
                <Calendar value={rangeFrom} onChange={setRangeFrom} placeholder="Desde" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Año</Label>
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
              </div>
            )}

            {reportType === 'rango' ? (
              <div className="space-y-1.5">
                <Label>Hasta</Label>
                <Calendar value={rangeTo} onChange={setRangeTo} placeholder="Hasta" />
              </div>
            ) : reportType === 'mensual' ? (
              <div className="space-y-1.5">
                <Label>Año</Label>
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
              </div>
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
              {logsCount} registros
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveListing
            queryKey={['auditLogs', effectiveBusinessId, filtersKey]}
            queryFn={({ page, pageSize }) => listAuditLogs({
              businessId: effectiveBusinessId,
              page,
              pageSize,
              searchTerm,
              area: areaFilter,
              action: actionFilter,
              startDate: dateRange.startDate,
              endDate: dateRange.endDate
            })}
            enabled={!!userId && !!effectiveBusinessId && canView('logs')}
            onMeta={({ count }) => setLogsCount(count)}
            getItemKey={(log) => log.id}
            renderItem={renderLog}
            emptyMessage="No se encontraron actividades que coincidan con los filtros aplicados"
            loadingMessage="Cargando actividades..."
          />
        </CardContent>
      </Card>

      <LogDetailsDialog log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  )
}
