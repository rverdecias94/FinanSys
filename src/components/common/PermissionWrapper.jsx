import { PermissionGuard, usePermissionCheck } from '@/components/common/PermissionGuard'
import { usePermissionMode } from '@/context/PermissionModeContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Wrapper para páginas existentes que integra permisos gradualmente
 * @param {Object} props
 * @param {string} props.module - Módulo (finanzas, warehouse, inventory, etc.)
 * @param {string} props.permission - Permiso requerido (view, create, edit, delete)
 * @param {React.ReactNode} props.children - Contenido de la página
 * @param {string} props.title - Título de la página
 * @param {Object} props.actions - Acciones permitidas (crear, editar, eliminar)
 */
export function PermissionWrapper({ 
  module, 
  permission = 'view', 
  children, 
  title,
  actions = {}
}) {
  const { permissionModeEnabled } = usePermissionMode()
  const { canView, canCreate, canEdit, canDelete, loading } = usePermissionCheck()

  // Si el modo de permisos está desactivado, mostrar todo
  if (!permissionModeEnabled) {
    return <>{children}</>
  }

  // Verificar permiso de vista
  const hasViewPermission = canView(module)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-center">
          <Shield className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-500">Verificando permisos...</p>
        </div>
      </div>
    )
  }

  if (!hasViewPermission) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle className="text-red-600">Acceso Restringido</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              No tienes permisos para acceder al módulo de <strong>{title || module}</strong>.
            </p>
            <p className="text-sm text-gray-500">
              Contacta al administrador del sistema si necesitas acceso.
            </p>
            <Button 
              variant="outline" 
              onClick={() => window.history.back()}
              className="mt-4"
            >
              Volver atrás
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Filtrar acciones según permisos
  const filteredActions = {}
  if (actions.create && !canCreate(module)) {
    filteredActions.create = false
  }
  if (actions.edit && !canEdit(module)) {
    filteredActions.edit = false
  }
  if (actions.delete && !canDelete(module)) {
    filteredActions.delete = false
  }

  // Pasar información de permisos a los hijos mediante contexto o props
  const childrenWithProps = typeof children === 'function' 
    ? children({ 
        canView: canView(module),
        canCreate: canCreate(module),
        canEdit: canEdit(module),
        canDelete: canDelete(module),
        permissionModeEnabled: true
      })
    : children

  return <>{childrenWithProps}</>
}

/**
 * Hook para usar en páginas que necesitan verificar permisos
 */
export function usePagePermissions(module) {
  const { permissionModeEnabled } = usePermissionMode()
  const { canView, canCreate, canEdit, canDelete, loading } = usePermissionCheck()

  return {
    loading,
    permissionModeEnabled,
    canView: permissionModeEnabled ? canView(module) : true,
    canCreate: permissionModeEnabled ? canCreate(module) : true,
    canEdit: permissionModeEnabled ? canEdit(module) : true,
    canDelete: permissionModeEnabled ? canDelete(module) : true,
  }
}