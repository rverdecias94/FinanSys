import { usePermissions } from '@/context/PermissionContext'

/**
 * Component to conditionally render children based on user permissions
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content to render if permitted
 * @param {React.ReactNode} props.fallback - Content to render if NOT permitted (optional)
 * @param {string} props.requiredPermission - Single permission code required (e.g. 'finanzas.create')
 * @param {string[]} props.requiredPermissions - Array of permissions (ALL required by default)
 * @param {boolean} props.any - If true, requires ANY of the requiredPermissions instead of ALL
 */
export default function PermissionGuard({
  children,
  fallback = null,
  requiredPermission,
  requiredPermissions,
  any = false
}) {
  const { hasPermission, hasAllPermissions, hasAnyPermission, loading, isOwner } = usePermissions()

  if (loading) return null // Or a skeleton if preferred

  if (isOwner) return children

  let allowed = false

  if (requiredPermission) {
    allowed = hasPermission(requiredPermission)
  } else if (requiredPermissions && requiredPermissions.length > 0) {
    allowed = any
      ? hasAnyPermission(requiredPermissions)
      : hasAllPermissions(requiredPermissions)
  } else {
    // No permission specified = allow
    allowed = true
  }

  return allowed ? children : fallback
}
