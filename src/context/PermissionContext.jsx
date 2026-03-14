import { createContext, useContext, useEffect, useState } from 'react'
import { useSession } from '@/hooks/useSession'
import { getUserPermissions } from '@/services/team'
import { toast } from 'sonner'

const PermissionContext = createContext()

export function PermissionProvider({ children }) {
  const { session } = useSession()
  const [permissions, setPermissions] = useState([]) // Array of strings e.g. ['finanzas.view', 'config.edit']
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)

  const fetchPermissions = async () => {
    if (!session?.user?.id) {
      setPermissions([])
      setIsOwner(false)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const perms = await getUserPermissions(session.user.id)
      setPermissions(perms || [])
      setIsOwner(perms.includes('*'))
    } catch (error) {
      console.error('Error fetching permissions:', error)
      toast.error('Error al cargar permisos de usuario')
      setPermissions([]) // Fallback to no permissions on error
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPermissions()
  }, [session])

  /**
   * Check if user has specific permission
   * @param {string} requiredPermission - Permission code (e.g. 'finanzas.view')
   * @returns {boolean}
   */
  const hasPermission = (requiredPermission) => {
    if (loading) return false
    if (isOwner) return true // Super Admin access
    if (!requiredPermission) return true

    return permissions.includes(requiredPermission)
  }

  /**
   * Check if user has ANY of the provided permissions
   * @param {string[]} requiredPermissions - Array of permission codes
   * @returns {boolean}
   */
  const hasAnyPermission = (requiredPermissions = []) => {
    if (loading) return false
    if (isOwner) return true
    if (!requiredPermissions || requiredPermissions.length === 0) return true

    return requiredPermissions.some(p => permissions.includes(p))
  }

  /**
   * Check if user has ALL of the provided permissions
   * @param {string[]} requiredPermissions - Array of permission codes
   * @returns {boolean}
   */
  const hasAllPermissions = (requiredPermissions = []) => {
    if (loading) return false
    if (isOwner) return true
    if (!requiredPermissions || requiredPermissions.length === 0) return true

    return requiredPermissions.every(p => permissions.includes(p))
  }

  return (
    <PermissionContext.Provider value={{
      permissions,
      loading,
      isOwner,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      refreshPermissions: fetchPermissions
    }}>
      {children}
    </PermissionContext.Provider>
  )
}

export const usePermissions = () => {
  const context = useContext(PermissionContext)
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider')
  }
  return context
}
