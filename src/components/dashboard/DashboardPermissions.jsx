import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Shield, 
  Eye, 
  Edit3, 
  UserCheck, 
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { usePermissionCheck } from '@/components/common/PermissionGuard'

/**
 * Componente para mostrar el estado de permisos del usuario actual
 * Muestra qué puede hacer según su rol (Consultor, Editor, etc.)
 */
export function DashboardPermissions({ userRole = 'Consultor' }) {
  const { 
    canView, 
    canCreate, 
    canEdit, 
    canDelete, 
    canExport,
    isOwner,
    loading 
  } = usePermissionCheck()

  // Definir los módulos y sus permisos
  const modules = [
    {
      name: 'Dashboard',
      icon: '📊',
      permissions: {
        view: canView('dashboard'),
        create: canCreate('dashboard'),
        edit: canEdit('dashboard'),
        delete: canDelete('dashboard'),
        export: canExport('dashboard')
      }
    },
    {
      name: 'Finanzas',
      icon: '💰',
      permissions: {
        view: canView('finanzas'),
        create: canCreate('finanzas'),
        edit: canEdit('finanzas'),
        delete: canDelete('finanzas'),
        export: canExport('finanzas')
      }
    },
    {
      name: 'Almacén',
      icon: '📦',
      permissions: {
        view: canView('warehouse'),
        create: canCreate('warehouse'),
        edit: canEdit('warehouse'),
        delete: canDelete('warehouse'),
        export: canExport('warehouse')
      }
    },
    {
      name: 'Inventario',
      icon: '📋',
      permissions: {
        view: canView('inventory'),
        create: canCreate('inventory'),
        edit: canEdit('inventory'),
        delete: canDelete('inventory'),
        export: canExport('inventory')
      }
    },
    {
      name: 'Reportes',
      icon: '📈',
      permissions: {
        view: canView('reports'),
        create: canCreate('reports'),
        edit: canEdit('reports'),
        delete: canDelete('reports'),
        export: canExport('reports')
      }
    },
    {
      name: 'Configuración',
      icon: '⚙️',
      permissions: {
        view: canView('config'),
        create: canCreate('config'),
        edit: canEdit('config'),
        delete: canDelete('config'),
        export: canExport('config')
      }
    },
    {
      name: 'Equipo',
      icon: '👥',
      permissions: {
        view: canView('team'),
        create: canCreate('team'),
        edit: canEdit('team'),
        delete: canDelete('team'),
        export: canExport('team')
      }
    },
    {
      name: 'Auditoría',
      icon: '📝',
      permissions: {
        view: canView('logs'),
        create: canCreate('logs'),
        edit: canEdit('logs'),
        delete: canDelete('logs'),
        export: canExport('logs')
      }
    }
  ]

  // Función para obtener el color del badge según el permiso
  const getPermissionBadge = (hasPermission) => {
    if (loading) return { variant: 'secondary', icon: <Shield className="w-3 h-3" /> }
    if (hasPermission) return { variant: 'default', icon: <CheckCircle className="w-3 h-3" /> }
    return { variant: 'destructive', icon: <XCircle className="w-3 h-3" /> }
  }

  // Función para obtener el rol actual con descripción
  const getRoleDescription = () => {
    if (isOwner) {
      return {
        title: 'Propietario',
        description: 'Acceso completo a todos los módulos y funciones del sistema',
        color: 'text-purple-600 bg-purple-100'
      }
    }
    
    if (canEdit('finanzas') && canEdit('warehouse') && canEdit('inventory')) {
      return {
        title: 'Editor',
        description: 'Puede ver y editar Finanzas, Almacén, Inventario y Reportes. Sin acceso a Configuración ni Auditoría',
        color: 'text-blue-600 bg-blue-100'
      }
    }
    
    if (canView('finanzas') && canView('warehouse') && canView('inventory')) {
      return {
        title: 'Consultor',
        description: 'Solo lectura. Puede ver datos y reportes. No puede crear, editar ni eliminar',
        color: 'text-green-600 bg-green-100'
      }
    }
    
    return {
      title: 'Usuario',
      description: 'Acceso limitado al sistema',
      color: 'text-gray-600 bg-gray-100'
    }
  }

  const roleInfo = getRoleDescription()

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Cargando permisos...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-4 bg-gray-200 rounded w-3/4"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tarjeta de información del rol */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Tu Rol en el Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${roleInfo.color}`}>
            <Shield className="w-4 h-4" />
            <span className="font-medium">{roleInfo.title}</span>
          </div>
          <p className="text-sm text-muted-foreground">{roleInfo.description}</p>
          
          {isOwner && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">Acceso Total</span>
              </div>
              <p className="text-sm text-yellow-700 mt-1">
                Como propietario, tienes acceso completo a todas las funciones del sistema.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabla de permisos por módulo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Permisos por Módulo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium">Módulo</th>
                  <th className="text-center py-3 px-2 font-medium">Ver</th>
                  <th className="text-center py-3 px-2 font-medium">Crear</th>
                  <th className="text-center py-3 px-2 font-medium">Editar</th>
                  <th className="text-center py-3 px-2 font-medium">Eliminar</th>
                  <th className="text-center py-3 px-2 font-medium">Exportar</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((module) => (
                  <tr key={module.name} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{module.icon}</span>
                        <span className="font-medium">{module.name}</span>
                      </div>
                    </td>
                    <td className="text-center py-3 px-2">
                      <Badge {...getPermissionBadge(module.permissions.view)}>
                        {module.permissions.view ? 'Sí' : 'No'}
                      </Badge>
                    </td>
                    <td className="text-center py-3 px-2">
                      <Badge {...getPermissionBadge(module.permissions.create)}>
                        {module.permissions.create ? 'Sí' : 'No'}
                      </Badge>
                    </td>
                    <td className="text-center py-3 px-2">
                      <Badge {...getPermissionBadge(module.permissions.edit)}>
                        {module.permissions.edit ? 'Sí' : 'No'}
                      </Badge>
                    </td>
                    <td className="text-center py-3 px-2">
                      <Badge {...getPermissionBadge(module.permissions.delete)}>
                        {module.permissions.delete ? 'Sí' : 'No'}
                      </Badge>
                    </td>
                    <td className="text-center py-3 px-2">
                      <Badge {...getPermissionBadge(module.permissions.export)}>
                        {module.permissions.export ? 'Sí' : 'No'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Resumen de restricciones */}
      {!isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              Restricciones de Acceso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {!canView('config') && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                  <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Configuración</p>
                    <p className="text-sm text-red-700">No puedes acceder a la configuración del sistema</p>
                  </div>
                </div>
              )}
              
              {!canView('logs') && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                  <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Auditoría</p>
                    <p className="text-sm text-red-700">No puedes ver el historial de actividades del sistema</p>
                  </div>
                </div>
              )}
              
              {!canCreate('finanzas') && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Modo Solo Lectura</p>
                    <p className="text-sm text-yellow-700">Puedes ver todos los datos pero no puedes crear, editar o eliminar registros</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * Componente para mostrar un resumen visual de permisos
 */
export function PermissionSummary({ compact = false }) {
  const { canView, canEdit, isOwner, loading } = usePermissionCheck()

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
        <span className="text-sm text-gray-500">Cargando...</span>
      </div>
    )
  }

  if (isOwner) {
    return (
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-purple-600" />
        <span className="text-sm font-medium text-purple-600">Propietario</span>
      </div>
    )
  }

  const roleType = canEdit('finanzas') ? 'Editor' : canView('finanzas') ? 'Consultor' : 'Usuario'
  const roleColor = canEdit('finanzas') ? 'text-blue-600' : canView('finanzas') ? 'text-green-600' : 'text-gray-600'
  const roleIcon = canEdit('finanzas') ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${roleColor}`}>
        {roleIcon}
        <span className="text-sm font-medium">{roleType}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
        roleType === 'Editor' ? 'bg-blue-100 text-blue-800' :
        roleType === 'Consultor' ? 'bg-green-100 text-green-800' :
        'bg-gray-100 text-gray-800'
      }`}>
        {roleIcon}
        <span className="ml-1">{roleType}</span>
      </div>
    </div>
  )
}
