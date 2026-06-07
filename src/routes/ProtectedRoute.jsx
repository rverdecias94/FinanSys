import { Navigate, Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { usePermissions } from '@/context/PermissionContext'
import { useBusiness } from '@/context/BusinessContext'

/**
 * Protected Route with RBAC support
 *
 * @param {string} requiredPermission - Code of permission required to access route
 */
export default function ProtectedRoute({ requiredPermission }) {
  const { session, loading: sessionLoading } = useSession()
  const { hasPermission, loading: permLoading, isOwner } = usePermissions()
  const { loading: businessLoading } = useBusiness()

  if (sessionLoading || permLoading || businessLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (requiredPermission) {
    if (isOwner) return <Outlet />
    if (!hasPermission(requiredPermission)) {
      return <Navigate to="/" replace />
    }
  }

  return <Outlet />
}
