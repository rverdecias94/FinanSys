import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  History, 
  Filter, 
  Search, 
  User, 
  Calendar,
  AlertCircle,
  CheckCircle,
  Info,
  Shield,
  Eye,
  Lock,
  AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { PermissionGuard, usePermissionCheck } from '@/components/common/PermissionGuard'

// Función auxiliar para obtener el ícono apropiado según el tipo de acción
const getActionIcon = (action) => {
  const actionLower = action?.toLowerCase() || ''
  
  if (actionLower.includes('crear') || actionLower.includes('create')) {
    return <CheckCircle className="w-4 h-4 text-green-600" />
  }
  if (actionLower.includes('actualizar') || actionLower.includes('update')) {
    return <Info className="w-4 h-4 text-blue-600" />
  }
  if (actionLower.includes('eliminar') || actionLower.includes('delete')) {
    return <AlertCircle className="w-4 h-4 text-red-600" />
  }
  if (actionLower.includes('login') || actionLower.includes('inicio')) {
    return <User className="w-4 h-4 text-purple-600" />
  }
  
  return <History className="w-4 h-4 text-gray-600" />
}

// Función auxiliar para obtener el color del badge según el área
const getAreaBadgeColor = (area) => {
  const areaLower = area?.toLowerCase() || ''
  
  if (areaLower.includes('finanzas')) return 'bg-green-100 text-green-800'
  if (areaLower.includes('almacén') || areaLower.includes('almacen')) return 'bg-blue-100 text-blue-800'
  if (areaLower.includes('inventario')) return 'bg-purple-100 text-purple-800'
  if (areaLower.includes('equipo')) return 'bg-orange-100 text-orange-800'
  if (areaLower.includes('config')) return 'bg-gray-100 text-gray-800'
  if (areaLower.includes('sistema')) return 'bg-red-100 text-red-800'
  
  return 'bg-gray-100 text-gray-800'
}

export default function LogsMejorado() {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { canView, isOwner, loading } = usePermissionCheck()

  // Estado local
  const [searchTerm, setSearchTerm] = useState('')
  const [areaFilter, setAreaFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')

  const userId = session?.user?.id

  // Query para obtener los logs de auditoría
  const { data: logsData, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['auditLogs', businessId || userId, { areaFilter, actionFilter, dateFilter }],
    queryFn: () => getAuditLogs(businessId || userId, { areaFilter, actionFilter, dateFilter }),
    enabled: !!userId && !!businessId && canView('logs'),
  })

  // Función simulada para obtener logs (debería ser reemplazada con la función real)
  const getAuditLogs = async (userId, filters) => {
    // Esta es una función simulada - en la implementación real deberías usar tu servicio de logs
    return [
      {
        id: '1',
        action: 'Crear Transacción',
        resource: 'Transacción #123',
        user_email: 'usuario@ejemplo.com',
        area: 'Finanzas',
        created_at: new Date().toISOString(),
        details: { amount: 100, currency: 'USD' }
      },
      {
        id: '2',
        action: 'Actualizar Producto',
        resource: 'Producto #456',
        user_email: 'usuario@ejemplo.com',
        area: 'Almacén',
        created_at: new Date().toISOString(),
        details: { name: 'Producto Actualizado' }
      },
      {
        id: '3',
        action: 'Eliminar Ítem',
        resource: 'Ítem #789',
        user_email: 'usuario@ejemplo.com',
        area: 'Inventario',
        created_at: new Date().toISOString(),
        details: { reason: 'Obsoleto' }
      }
    ]
  }

  // Filtrar logs según búsqueda
  const filteredLogs = logsData?.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_email.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesSearch
  }) || []

  // Si no tiene permisos de visualización, mostrar mensaje de acceso restringido
  if (!canView('logs')) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-6 text-center max-w-md">
          <CardContent className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Acceso Restringido</h3>
              <p className="text-muted-foreground mb-4">
                No tienes permisos para acceder al módulo de Auditoría y Logs.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800">¿Por qué no puedo acceder?</p>
                    <p className="text-yellow-700">
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

      {/* Mensaje de información para usuarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            Información de Auditoría
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aquí puedes ver el historial completo de todas las actividades realizadas en el sistema, 
            incluyendo creaciones, actualizaciones y eliminaciones de registros en todos los módulos.
          </p>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Todas las áreas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las áreas</SelectItem>
                <SelectItem value="finanzas">Finanzas</SelectItem>
                <SelectItem value="almacen">Almacén</SelectItem>
                <SelectItem value="inventario">Inventario</SelectItem>
                <SelectItem value="equipo">Equipo</SelectItem>
                <SelectItem value="config">Configuración</SelectItem>
                <SelectItem value="sistema">Sistema</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Todas las fechas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las fechas</SelectItem>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="month">Este mes</SelectItem>
                <SelectItem value="year">Este año</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Historial de Actividades</span>
            <Badge variant="secondary">
              {filteredLogs.length} actividades
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingLogs ? (
            <div className="text-center py-8">Cargando logs de auditoría...</div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No se encontraron actividades que coincidan con los filtros aplicados
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      {/* Icono de acción */}
                      <div className="mt-1">
                        {getActionIcon(log.action)}
                      </div>
                      
                      {/* Contenido principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{log.action}</h4>
                          <Badge className={getAreaBadgeColor(log.area)}>
                            {log.area}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2">
                          {log.resource}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{log.user_email}</span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(log.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                        
                        {/* Detalles adicionales si existen */}
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                            <details className="cursor-pointer">
                              <summary className="text-muted-foreground hover:text-gray-700">
                                Ver detalles
                              </summary>
                              <div className="mt-2 space-y-1">
                                {Object.entries(log.details).map(([key, value]) => (
                                  <div key={key} className="flex justify-between">
                                    <span className="text-gray-600 capitalize">{key}:</span>
                                    <span className="font-medium">{JSON.stringify(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}