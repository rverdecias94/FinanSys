import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'
import { getBusinessContext, acceptPendingInvitations } from '@/services/team'
import { readLocalCache, writeLocalCache } from '@/offline/localCache'

const BusinessContext = createContext({})

/** Tope para no dejar el splash colgado en redes lentas (Cuba / H+). */
const NETWORK_BUDGET_MS = 6000

function withTimeout(promise, ms) {
  let timer
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), ms)
    }),
  ])
}

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
    setError(null)

    // Cache-first: si ya conocemos el negocio, desbloquear la UI YA y refrescar detrás.
    // En mala conexión el await a Supabase podía dejar "Preparando tu negocio…" minutos.
    const cached = readLocalCache(`business:${userId}`)
    if (cached) {
      setBusinessContext(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }

    try {
      // Vincular invitaciones pendientes ANTES de resolver el contexto, en CUALQUIER
      // vía de entrada (login, confirmación de email, recarga, restauración de sesión).
      // Si no se hace, un miembro recién invitado se resuelve como "owner por defecto"
      // y ve el asistente de titular en lugar de los datos del negocio.
      // REGRESIÓN: el commit c30fd84 quitó esta llamada (quedó solo en Login.jsx);
      // se reintroduce aquí para que el flujo de miembro funcione en todas las vías.
      if (email && (typeof navigator === 'undefined' || navigator.onLine)) {
        try {
          await withTimeout(acceptPendingInvitations(email), NETWORK_BUDGET_MS)
        } catch {
          // No bloquear el arranque si la aceptación falla; se reintenta en la próxima carga.
        }
      }

      let context
      try {
        // soft:false → error de red NO se confunde con "no hay equipo" (null OK).
        context = await withTimeout(
          getBusinessContext(userId, { soft: false }),
          NETWORK_BUDGET_MS,
        )
      } catch {
        // Timeout / red: conservar caché (miembro) o degradar a owner-default.
        const fallback = cached || readLocalCache(`business:${userId}`)
        setBusinessContext(fallback || normalizeContext(null, userId))
        return
      }

      // null “exitoso” sin red: no pisar caché de miembro (mismo invariante de antes).
      if (context == null && typeof navigator !== 'undefined' && !navigator.onLine) {
        const fallback = cached || readLocalCache(`business:${userId}`)
        setBusinessContext(fallback || normalizeContext(null, userId))
        return
      }

      const normalized = normalizeContext(context, userId)
      setBusinessContext(normalized)
      // Cachear solo contextos REALES del servidor (no el owner-default derivado de null).
      if (context != null) {
        writeLocalCache(`business:${userId}`, normalized)
      }
    } catch (err) {
      // Error inesperado: preferir el contexto guardado antes que bloquear la app.
      const fallback = cached || readLocalCache(`business:${userId}`)
      if (fallback) {
        setBusinessContext(fallback)
      } else {
        setError(err)
        setBusinessContext(normalizeContext(null, userId))
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
