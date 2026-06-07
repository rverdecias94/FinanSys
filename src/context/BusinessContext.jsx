import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'
import { getBusinessContext, acceptPendingInvitations } from '@/services/team'

const BusinessContext = createContext({})

function normalizeContext(raw, userId) {
  if (!raw) {
    return {
      businessId: userId,
      isOwner: true,
      roleId: null,
      permissions: ['*']
    }
  }

  const permissions = Array.isArray(raw.permissions)
    ? raw.permissions
    : raw.permissions
      ? JSON.parse(JSON.stringify(raw.permissions))
      : []

  return {
    businessId: raw.businessId || userId,
    isOwner: Boolean(raw.isOwner),
    roleId: raw.roleId || null,
    roleName: raw.roleName || null,
    permissions: raw.isOwner ? ['*'] : permissions
  }
}

export function BusinessProvider({ children }) {
  const { session } = useSession()
  const [businessContext, setBusinessContext] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const resolveBusinessContext = useCallback(async () => {
    if (!session?.user?.id) {
      setBusinessContext(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const email = session.user.email
      if (email) {
        await acceptPendingInvitations(email)
      }

      const context = await getBusinessContext(session.user.id)
      setBusinessContext(normalizeContext(context, session.user.id))
    } catch (err) {
      console.error('Error resolving business context:', err)
      setError(err)
      setBusinessContext(null)
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id, session?.user?.email])

  useEffect(() => {
    resolveBusinessContext()
  }, [resolveBusinessContext])

  const resolved = businessContext
  const isOwner = resolved?.isOwner ?? false

  const value = {
    businessId: loading ? null : (resolved?.businessId ?? null),
    isOwner,
    roleId: resolved?.roleId ?? null,
    roleName: resolved?.roleName ?? null,
    permissions: loading ? [] : (resolved?.permissions ?? []),
    loading,
    error,
    refreshBusinessContext: resolveBusinessContext
  }

  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  )
}

export const useBusiness = () => useContext(BusinessContext)
