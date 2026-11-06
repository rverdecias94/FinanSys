import { Navigate, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/hooks/useSession'
import { usePermissions } from '@/context/PermissionContext'
import { useBusiness } from '@/context/BusinessContext'
import { isSystemAdmin } from '@/services/planRequests'
import { FullPageSkeleton, PageContentSkeleton } from '@/components/common/pageSkeletons'

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
    // Ruta anidada (ya hay sidebar): skeleton de contenido.
    // Ruta raíz de auth: skeleton a pantalla completa.
    return requiredPermission || systemAdminOnly
      ? <PageContentSkeleton />
      : <FullPageSkeleton />
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
