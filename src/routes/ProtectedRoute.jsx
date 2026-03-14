import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from '@/hooks/useSession'
import { usePermissions } from '@/context/PermissionContext'

/**
 * Protected Route with RBAC support
 * 
 * @param {string} requiredPermission - Code of permission required to access route
 */
export default function ProtectedRoute({ requiredPermission }) {
  const { session, loading: sessionLoading } = useSession()
  const { hasPermission, loading: permLoading, isOwner } = usePermissions()

  if (sessionLoading) {
    return <Outlet />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  // If permission required check it
  if (requiredPermission) {
    if (isOwner) return <Outlet />
    if (!hasPermission(requiredPermission)) {
      // User logged in but no permission -> Redirect to home or unauthorized page
      return <Navigate to="/" replace />
    }
  }

  return <Outlet />
}
