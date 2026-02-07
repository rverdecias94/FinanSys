import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from '@/hooks/useSession'
import { useUserRole } from '@/hooks/useUserRole'

export default function ProtectedRoute({ allowedRoles }) {
  const { session, loading } = useSession()
  const userId = session?.user?.id || null
  const { role, loading: roleLoading } = useUserRole(userId)

  if (loading || roleLoading) return null
  if (!session) return <Navigate to="/login" replace />
  if (allowedRoles && role && !allowedRoles.includes(role)) return <Navigate to="/" replace />
  return <Outlet />
}
