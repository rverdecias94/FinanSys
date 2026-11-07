import { useCallback, useRef, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getCriticalCacheMeta } from '@/offline/cacheMeta'

const EMPTY = Object.freeze({ hasData: false, updatedAt: null })

/**
 * Suscribe al QueryCache para saber si hay copia local de datos de negocio
 * y cuándo se actualizó (banner offline honesto).
 * getSnapshot debe ser referencialmente estable si no cambian hasData/updatedAt.
 */
export function useOfflineCacheMeta() {
  const queryClient = useQueryClient()
  const snapRef = useRef(EMPTY)

  const getSnapshot = useCallback(() => {
    const next = getCriticalCacheMeta(queryClient)
    const prev = snapRef.current
    if (prev.hasData === next.hasData && prev.updatedAt === next.updatedAt) {
      return prev
    }
    snapRef.current = next.hasData ? next : EMPTY
    return snapRef.current
  }, [queryClient])

  return useSyncExternalStore(
    (onStoreChange) => queryClient.getQueryCache().subscribe(() => {
      onStoreChange()
    }),
    getSnapshot,
    () => EMPTY,
  )
}
