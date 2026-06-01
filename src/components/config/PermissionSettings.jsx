import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Shield,
  Users,
  Eye,
  Edit3,
  AlertTriangle,
  CheckCircle,
  Info,
  Settings
} from 'lucide-react'
import { usePermissionMode } from '@/context/PermissionModeContext'
import { usePermissions } from '@/context/PermissionContext'
import { DashboardPermissions } from '@/components/dashboard/DashboardPermissions'

export function PermissionSettings() {
  const {
    permissionModeEnabled,
    togglePermissionMode,
    showPermissionToggle,
    enablePermissionToggle,
    disablePermissionToggle
  } = usePermissionMode()

  const { isOwner, permissions } = usePermissions()
  const [showAdvanced, setShowAdvanced] = useState(false)

  if (!isOwner) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Solo los propietarios del sistema pueden configurar los permisos.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Configuración General */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Configuración de Permisos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Activar/Desactivar Sistema de Permisos */}
          <div className="flex items-center justify-between p-4 border rounded-lg gap-4">
            <div className="space-y-1">
              <Label htmlFor="permission-system" className="text-base font-medium">
                Sistema de Permisos
              </Label>
              <p className="text-sm text-muted-foreground">
                Activa el control de acceso basado en roles para tu equipo
              </p>
            </div>
            <Switch
              id="permission-system"
              checked={permissionModeEnabled}
              onCheckedChange={togglePermissionMode}
            />
          </div>

          {/* Mostrar/Ocultar Switch de Permisos */}
          <div className="flex items-center justify-between p-4 border rounded-lg gap-4">
            <div className="space-y-1">
              <Label htmlFor="show-toggle" className="text-base font-medium">
                Mostrar Switch en Navegación
              </Label>
              <p className="text-sm text-muted-foreground">
                Permite a los usuarios activar/desactivar el modo de permisos
              </p>
            </div>
            <Switch
              id="show-toggle"
              checked={showPermissionToggle}
              onCheckedChange={(checked) => {
                if (checked) {
                  enablePermissionToggle()
                } else {
                  disablePermissionToggle()
                }
              }}
            />
          </div>

          {permissionModeEnabled && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                El sistema de permisos está activo. Los usuarios verán/ocultarán funciones según sus roles asignados.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Información de Roles */}
      {permissionModeEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Roles del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-4 h-4 text-primary" />
                  <h3 className="font-medium text-primary">Visualizador</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Solo puede ver datos y reportes. No puede crear, editar ni eliminar registros.
                </p>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-primary" />
                    <span>Ver Dashboard, Finanzas, Almacén, Inventario, Reportes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-primary" />
                    <span>Exportar datos y reportes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-primary" />
                    <span>Filtrar y ver gráficos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3 text-yellow-500" />
                    <span>No puede acceder a Configuración ni Auditoría</span>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Edit3 className="w-4 h-4 text-blue-600" />
                  <h3 className="font-medium text-blue-600">Editor</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Puede ver y editar en operativas. No puede acceder a configuración del sistema.
                </p>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-primary" />
                    <span>Acceso completo a Dashboard</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-primary" />
                    <span>Crear, editar, eliminar en Finanzas, Almacén, Inventario</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-primary" />
                    <span>Acceso completo a Reportes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3 text-red-500" />
                    <span className="text-red-600">No puede acceder a Configuración ni Auditoría</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard de Permisos Personal */}
      {permissionModeEnabled && (
        <DashboardPermissions />
      )}

      {/* Configuración Avanzada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuración Avanzada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="mb-4"
          >
            {showAdvanced ? 'Ocultar' : 'Mostrar'} Opciones Avanzadas
          </Button>

          {showAdvanced && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">Opciones adicionales para administradores:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Gestionar roles personalizados</li>
                  <li>Configurar permisos específicos por módulo</li>
                  <li>Asignar usuarios a roles</li>
                  <li>Ver historial de cambios de permisos</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Gestionar Equipo
                </Button>
                <Button variant="outline" size="sm">
                  Ver Auditoría
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}