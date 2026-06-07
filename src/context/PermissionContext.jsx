import { createContext, useContext } from 'react'
import { useBusiness } from '@/context/BusinessContext'

const PermissionContext = createContext()

export function PermissionProvider({ children }) {
  const {
    permissions,
    isOwner,
    loading,
    refreshBusinessContext
  } = useBusiness()

  const hasPermission = (requiredPermission) => {
    if (loading) return false
    if (isOwner) return true
    if (!requiredPermission) return true
    return permissions.includes(requiredPermission)
  }

  const hasAnyPermission = (requiredPermissions = []) => {
    if (loading) return false
    if (isOwner) return true
    if (!requiredPermissions || requiredPermissions.length === 0) return true
    return requiredPermissions.some((p) => permissions.includes(p))
  }

  const hasAllPermissions = (requiredPermissions = []) => {
    if (loading) return false
    if (isOwner) return true
    if (!requiredPermissions || requiredPermissions.length === 0) return true
    return requiredPermissions.every((p) => permissions.includes(p))
  }

  return (
    <PermissionContext.Provider
      value={{
        permissions,
        loading,
        isOwner,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        refreshPermissions: refreshBusinessContext
      }}
    >
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
