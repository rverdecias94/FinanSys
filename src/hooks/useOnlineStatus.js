import { useSyncExternalStore } from 'react'
import { onlineManager } from '@tanstack/react-query'

// Fuente de verdad = onlineManager (React Query), no solo navigator.onLine.
// networkGuard ajusta onlineManager cuando un fetch falla por DNS/red aunque
// Windows siga diciendo "online".

function subscribe(callback) {
  return onlineManager.subscribe(callback)
}

export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribe,
    () => onlineManager.isOnline(),
    () => true,
  )
}
