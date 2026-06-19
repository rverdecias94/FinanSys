import { useSyncExternalStore } from 'react'

// Estado de conexión del navegador (Capa B/C offline). Se suscribe a los eventos
// online/offline; en SSR/primer render asume online.
function subscribe(callback) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
}
