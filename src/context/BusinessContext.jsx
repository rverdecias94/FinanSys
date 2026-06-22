import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'
import { getBusinessContext, acceptPendingInvitations } from '@/services/team'
import { readLocalCache, writeLocalCache } from '@/offline/localCache'

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

    const userId = session.user.id
    const email = session.user.email
    setLoading(true)
    setError(null)

    try {
      // Vincular invitaciones pendientes ANTES de resolver el contexto, en CUALQUIER
      // vía de entrada (login, confirmación de email, recarga, restauración de sesión).
      // Si no se hace, un miembro recién invitado se resuelve como "owner por defecto"
      // y ve el asistente de titular en lugar de los datos del negocio.
      // REGRESIÓN: el commit c30fd84 quitó esta llamada (quedó solo en Login.jsx);
      // se reintroduce aquí para que el flujo de miembro funcione en todas las vías.
      if (email && (typeof navigator === 'undefined' || navigator.onLine)) {
        try {
          await acceptPendingInvitations(email)
        } catch {
          // No bloquear el arranque si la aceptación falla; se reintenta en la próxima carga.
        }
      }

      const context = await getBusinessContext(userId)

      // Offline y sin respuesta del servidor: restaurar el contexto REAL guardado.
      // Clave para miembros de equipo: si no, caerían a "owner por defecto" (escalada
      // de privilegios + businessId equivocado). Para el owner sin caché, el
      // owner-default es el comportamiento correcto.
      if (context === null && typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = readLocalCache(`business:${userId}`)
        setBusinessContext(cached || normalizeContext(null, userId))
        return
      }

      const normalized = normalizeContext(context, userId)
      setBusinessContext(normalized)
      // Cachear solo contextos REALES del servidor (no el owner-default derivado de null).
      if (context !== null) writeLocalCache(`business:${userId}`, normalized)
    } catch (err) {
      // Error inesperado: preferir el contexto guardado antes que bloquear la app.
      const cached = readLocalCache(`business:${userId}`)
      if (cached) {
        setBusinessContext(cached)
      } else {
        setError(err)
        setBusinessContext(null)
      }
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
