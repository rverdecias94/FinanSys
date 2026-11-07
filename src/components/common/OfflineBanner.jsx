import { useEffect, useRef, useState } from 'react'
import { WifiOff, Wifi, RefreshCw } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { usePendingMutationsCount } from '@/hooks/usePendingMutationsCount'
import { useOfflineCacheMeta } from '@/hooks/useOfflineCacheMeta'
import { formatCacheAgeLabel } from '@/offline/cacheMeta'
import { notify } from '@/services/notifications'

export const SYNC_TOAST_ID = 'gestia-sync-outbox'

/**
 * Banner global de conexión (Capa B/C):
 * - Offline (ámbar): sin red + pendientes / copia local honesta
 * - Reconexión (verde): flash ~3.5s "Vuelves a tener conexión"
 * - Sync (primario): cola en curso
 * Toast loading mientras sync; success al vaciar la cola (mismo id → reemplaza).
 */
export function OfflineBanner() {
  const online = useOnlineStatus()
  const pending = usePendingMutationsCount()
  const cacheMeta = useOfflineCacheMeta()
  const [reconnectedFlash, setReconnectedFlash] = useState(false)
  const wasOnlineRef = useRef(online)
  const syncToastActiveRef = useRef(false)

  // Flash verde al pasar de offline → online
  useEffect(() => {
    const wasOnline = wasOnlineRef.current
    wasOnlineRef.current = online
    if (wasOnline || !online) return undefined

    setReconnectedFlash(true)
    const t = window.setTimeout(() => setReconnectedFlash(false), 3500)
    return () => window.clearTimeout(t)
  }, [online])

  // Toast de sincronización (persiste mientras haya cola online)
  useEffect(() => {
    if (online && pending > 0) {
      if (!syncToastActiveRef.current) {
        syncToastActiveRef.current = true
        notify.loading(
          pending === 1
            ? 'Sincronizando 1 operación…'
            : `Sincronizando ${pending} operaciones…`,
          { id: SYNC_TOAST_ID },
        )
      } else {
        notify.loading(
          pending === 1
            ? 'Sincronizando 1 operación…'
            : `Sincronizando ${pending} operaciones…`,
          { id: SYNC_TOAST_ID },
        )
      }
      return undefined
    }

    if (online && pending === 0 && syncToastActiveRef.current) {
      syncToastActiveRef.current = false
      // Importante: NO reutilizar el id del toast.loading (duration: Infinity).
      // Sonner puede heredar Infinity y el success nunca se cierra.
      notify.dismiss(SYNC_TOAST_ID)
      notify.success('Datos sincronizados correctamente', { duration: 3200 })
      return undefined
    }

    if (!online && syncToastActiveRef.current) {
      syncToastActiveRef.current = false
      notify.dismiss(SYNC_TOAST_ID)
    }
    return undefined
  }, [online, pending])

  if (!online) {
    const age = formatCacheAgeLabel(cacheMeta.updatedAt)
    let message
    if (pending > 0) {
      message = `Sin conexión · ${pending} pendiente${pending === 1 ? '' : 's'} de sincronizar`
    } else if (cacheMeta.hasData) {
      message = age
        ? `Sin conexión · mostrando datos guardados (${age})`
        : 'Sin conexión · mostrando datos guardados'
    } else {
      message = 'Sin conexión · aún no hay copia local de tus datos en este dispositivo'
    }
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-3 py-1.5 text-center text-xs text-foreground sm:text-sm"
      >
        <WifiOff className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <span>{message}</span>
      </div>
    )
  }

  if (reconnectedFlash) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-2 border-b border-success/30 bg-success/10 px-3 py-1.5 text-center text-xs text-foreground motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 sm:text-sm"
      >
        <Wifi className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
        <span>
          {pending > 0
            ? 'Vuelves a tener conexión · sincronizando lo pendiente…'
            : 'Vuelves a tener conexión'}
        </span>
      </div>
    )
  }

  if (pending > 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-2 border-b border-primary/20 bg-primary/5 px-3 py-1.5 text-center text-xs text-foreground sm:text-sm"
      >
        <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
        <span>
          Sincronizando {pending} operaci{pending === 1 ? 'ón' : 'ones'}…
        </span>
      </div>
    )
  }

  return null
}
