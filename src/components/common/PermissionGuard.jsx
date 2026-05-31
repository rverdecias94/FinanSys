import { usePermissions } from '@/context/PermissionContext'

/**
 * Componente para mostrar/ocultar elementos según permisos del usuario
 * @param {Object} props
 * @param {string} props.permission - Permiso requerido (ej: 'finanzas.create')
 * @param {string[]} props.anyPermission - Array de permisos (tiene ALGUNO)
 * @param {string[]} props.allPermissions - Array de permisos (tiene TODOS)
 * @param {boolean} props.inverse - Invertir la lógica (mostrar si NO tiene permiso)
 * @param {React.ReactNode} props.children - Contenido a mostrar/ocultar
 * @param {React.ReactNode} props.fallback - Contenido alternativo si no tiene permiso
 * @param {string} props.mode - Modo de renderizado: 'show' (por defecto), 'disable', 'readonly'
 */
export function PermissionGuard({ 
  permission, 
  anyPermission, 
  allPermissions, 
  inverse = false,
  children, 
  fallback = null,
  mode = 'show'
}) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = usePermissions()

  if (loading) {
    return mode === 'show' ? fallback : children
  }

  let hasAccess = false

  // Determinar si tiene acceso según los criterios
  if (permission) {
    hasAccess = hasPermission(permission)
  } else if (anyPermission) {
    hasAccess = hasAnyPermission(anyPermission)
  } else if (allPermissions) {
    hasAccess = hasAllPermissions(allPermissions)
  } else {
    hasAccess = true // Sin criterios = acceso total
  }

  // Aplicar lógica inversa si se solicita
  if (inverse) {
    hasAccess = !hasAccess
  }

  // Modo show: mostrar u ocultar completamente
  if (mode === 'show') {
    return hasAccess ? children : fallback
  }

  // Modo disable: deshabilitar el contenido
  if (mode === 'disable') {
    return React.cloneElement(children, { 
      ...children.props, 
      disabled: !hasAccess 
    })
  }

  // Modo readonly: hacer solo lectura
  if (mode === 'readonly') {
    return React.cloneElement(children, { 
      ...children.props, 
      readOnly: !hasAccess,
      disabled: !hasAccess 
    })
  }

  return children
}

/**
 * Hook para verificar permisos de forma rápida
 */
export function usePermissionCheck() {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading, isOwner } = usePermissions()

  return {
    canView: (module) => hasPermission(`${module}.view`) || isOwner,
    canCreate: (module) => hasPermission(`${module}.create`) || isOwner,
    canEdit: (module) => hasPermission(`${module}.edit`) || isOwner,
    canDelete: (module) => hasPermission(`${module}.delete`) || isOwner,
    canExport: (module) => hasPermission(`${module}.export`) || isOwner,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    loading,
    isOwner
  }
}

/**
 * Componente para mostrar botones de acción según permisos
 */
export function ActionButtons({ children, module }) {
  const { canCreate, canEdit, canDelete, loading } = usePermissionCheck()

  if (loading) {
    return null
  }

  // Filtrar hijos según permisos
  const filteredChildren = React.Children.map(children, child => {
    if (!React.isValidElement(child)) return null

    const { action } = child.props
    
    switch (action) {
      case 'create':
        return canCreate(module) ? child : null
      case 'edit':
        return canEdit(module) ? child : null
      case 'delete':
        return canDelete(module) ? child : null
      default:
        return child
    }
  })

  return <>{filteredChildren}</>
}