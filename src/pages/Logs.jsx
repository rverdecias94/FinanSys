/* eslint-disable no-unused-vars */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldAlert, Loader2, Filter, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useSession } from '@/hooks/useSession'
import { useSubscription } from '@/context/SubscriptionContext'
import { supabase } from '@/config/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateRangeFilter } from '@/components/common/DateRangeFilter'
import { exportToExcel } from '@/utils/exportUtils'
import { toast } from 'sonner'


export default function Logs() {
  const { session } = useSession()
  const { canAccessFeature } = useSubscription()
  const userId = session?.user?.id
  // State for filters and pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined })
  const [areaFilter, setAreaFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')

  // Query function
  const fetchLogs = async ({ queryKey }) => {
    const [_, _userId, _page, _pageSize, _dateRange, _areaFilter, _actionFilter] = queryKey

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', _userId)
      .order('created_at', { ascending: false })

    // Apply filters
    if (_dateRange?.from) {
      query = query.gte('created_at', _dateRange.from.toISOString())
    }
    if (_dateRange?.to) {
      // Set to end of day
      const endDate = new Date(_dateRange.to)
      endDate.setHours(23, 59, 59, 999)
      query = query.lte('created_at', endDate.toISOString())
    }

    if (_areaFilter && _areaFilter !== 'all') {
      query = query.eq('area', _areaFilter)
    }

    if (_actionFilter && _actionFilter !== 'all') {
      if (['Crear', 'Actualizar', 'Eliminar'].includes(_actionFilter)) {
        query = query.ilike('action', `%${_actionFilter}%`)
      } else {
        query = query.eq('action', _actionFilter)
      }
    }

    // Apply pagination
    const from = (_page - 1) * _pageSize
    const to = from + _pageSize - 1
    query = query.range(from, to)

    const { data, count, error } = await query
    if (error) throw error
    return { logs: data, count }
  }

  const { data: { logs = [], count = 0 } = {}, isLoading, isError, refetch } = useQuery({
    queryKey: ['auditLogs', userId, page, pageSize, dateRange, areaFilter, actionFilter],
    queryFn: fetchLogs,
    enabled: !!userId && canAccessFeature('audit_logs'),
    keepPreviousData: true
  })

  // Export handler
  const handleExport = async () => {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      // Apply same filters
      if (dateRange?.from) query = query.gte('created_at', dateRange.from.toISOString())
      if (dateRange?.to) {
        const endDate = new Date(dateRange.to)
        endDate.setHours(23, 59, 59, 999)
        query = query.lte('created_at', endDate.toISOString())
      }
      if (areaFilter !== 'all') query = query.eq('area', areaFilter)
      if (actionFilter !== 'all') {
        if (['Crear', 'Actualizar', 'Eliminar'].includes(actionFilter)) {
          query = query.ilike('action', `%${actionFilter}%`)
        } else {
          query = query.eq('action', actionFilter)
        }
      }

      const { data, error } = await query
      if (error) throw error

      if (!data || data.length === 0) {
        toast.warning('No hay datos para exportar con los filtros actuales')
        return
      }

      const exportData = data.map(log => ({
        Fecha: format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
        Usuario: log.user_email || 'N/A',
        Área: log.area || 'General',
        Acción: log.action,
        Recurso: log.resource,
        Detalles: JSON.stringify(log.details),
        IP: log.ip_address || '-'
      }))

      exportToExcel('Logs de Auditoría', exportData, `audit_logs_${format(new Date(), 'yyyyMMdd_HHmm')}`)
      toast.success('Exportación completada')
    } catch (err) {
      console.error('Export error:', err)
      toast.error('Error al exportar logs')
    }
  }

  if (!canAccessFeature('audit_logs')) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Logs de Auditoría</h1>
        <Alert className="bg-yellow-50 border-yellow-200">
          <ShieldAlert className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Acceso Restringido</AlertTitle>
          <AlertDescription className="text-yellow-700 flex flex-col gap-2">
            <span>
              El historial de auditoría y trazabilidad es una función exclusiva del Plan Premium.
              Actualiza tu tipo de cuenta en configuración para ver quién hizo qué y cuándo.
            </span>
          </AlertDescription>
        </Alert>

        {/* Mock/Blur UI to show what it looks like */}
        <Card className="opacity-50 pointer-events-none select-none filter blur-[1px]">
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Hace 2 horas</TableCell>
                  <TableCell>Actualización</TableCell>
                  <TableCell>Producto #123</TableCell>
                  <TableCell>192.168.1.1</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShieldAlert className="w-8 h-8 text-primary" />
          Logs de Auditoría
        </h1>
        <p className="text-muted-foreground">Registro detallado de seguridad y acciones en tu cuenta.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
        <DateRangeFilter date={dateRange} setDate={setDateRange} />
      </div>

      <div className="flex flex-wrap gap-2 items-end md:items-center justify-between flex-1">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-[6]">
              <Filter className="w-8 h-4 mr-2" />
              <SelectValue placeholder="Área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las Áreas</SelectItem>
              <SelectItem value="Finanzas">Finanzas</SelectItem>
              <SelectItem value="Almacén">Almacén</SelectItem>
              <SelectItem value="Inventario">Inventario</SelectItem>
              <SelectItem value="Configuración">Configuración</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[6]">
              <Filter className="w-8 h-4" />
              <SelectValue placeholder="Acción" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las Acciones</SelectItem>
              <SelectItem value="Crear">Crear</SelectItem>
              <SelectItem value="Actualizar">Actualizar</SelectItem>
              <SelectItem value="Eliminar">Eliminar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={handleExport} className="flex gap-2 items-end">
          <FileSpreadsheet className="w-4 h-4 text-green-600" />
          Exportar Excel
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Historial de Actividad</CardTitle>
          <CardDescription>
            Mostrando {logs.length} de {count} registros.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : logs.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">No hay registros que coincidan con los filtros.</div>
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
                      {/* <TableHead>Detalles</TableHead> */}
                      {/* <TableHead className="text-right">IP</TableHead> */}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap font-medium text-xs">
                          {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                        </TableCell>
                        <TableCell className="text-xs">{log.user_email || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs font-normal">
                            {log.area || 'General'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.action.includes('Eliminar') ? 'destructive' : 'outline'} className="text-xs">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs truncate max-w-[250px]" title={log.resource}>
                          {log.resource}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Filas por página:</span>
                  <Select value={String(pageSize)} onValueChange={(val) => { setPageSize(Number(val)); setPage(1); }}>
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue placeholder={pageSize} />
                    </SelectTrigger>
                    <SelectContent side="top">
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Página {page} de {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
