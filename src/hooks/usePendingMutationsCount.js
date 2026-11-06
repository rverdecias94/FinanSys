import { useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { countQueuedMutations } from '@/offline/syncEngine'

/**
 * Contador reactivo de mutaciones en cola (paused/pending) del outbox.
 * Se suscribe al MutationCache para actualizar el banner sin polling.
 */
export function usePendingMutationsCount() {
  const queryClient = useQueryClient()

  return useSyncExternalStore(
    (onStoreChange) => {
      const cache = queryClient.getMutationCache()
      return cache.subscribe(() => onStoreChange())
    },
    () => countQueuedMutations(queryClient),
    () => 0,
  )
}
