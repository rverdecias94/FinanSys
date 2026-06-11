import { Navigate, Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/hooks/useSession'
import { usePermissions } from '@/context/PermissionContext'
import { useBusiness } from '@/context/BusinessContext'
import { isSystemAdmin } from '@/services/planRequests'

/**
 * Protected Route with RBAC support
 *
 * @param {string} requiredPermission - Code of permission required to access route
 */
export default function ProtectedRoute({ requiredPermission, systemAdminOnly }) {
  const { session, loading: sessionLoading } = useSession()
  const { hasPermission, loading: permLoading, isOwner } = usePermissions()
  const { loading: businessLoading } = useBusiness()

  const adminQuery = useQuery({
    queryKey: ['isSystemAdmin'],
    queryFn: isSystemAdmin,
    enabled: !!session && systemAdminOnly,
    staleTime: 5 * 60 * 1000
  })

  if (sessionLoading || permLoading || businessLoading || (systemAdminOnly && adminQuery.isLoading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (systemAdminOnly && !adminQuery.data) {
    return <Navigate to="/" replace />
  }

  if (requiredPermission) {
    if (isOwner) return <Outlet />
    if (!hasPermission(requiredPermission)) {
      return <Navigate to="/" replace />
    }
  }

  return <Outlet />
}
