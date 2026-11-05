import { registerSW } from 'virtual:pwa-register'

/** Flag leída en App tras el reload automático. */
export const PWA_JUST_UPDATED_KEY = 'gestia.pwa.justUpdated'

/** Cada 30s + al volver a la pestaña: detectar deploy cuanto antes. */
const CHECK_INTERVAL_MS = 30_000

/**
 * Auto-actualiza la PWA lo antes posible:
 * - registerType autoUpdate + skipWaiting (vite.config)
 * - al activarse un SW nuevo → marca flag y recarga
 * - comprueba updates periódicamente y al enfocar la app
 */
export function registerPwaUpdate() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  registerSW({
    immediate: true,
    onNeedReload() {
      try {
        sessionStorage.setItem(PWA_JUST_UPDATED_KEY, '1')
      } catch {
        // sessionStorage bloqueado (modo privado estricto): igual recargamos
      }
      window.location.reload()
    },
    onRegisteredSW(swUrl, registration) {
      if (!registration) return

      const checkForUpdate = async () => {
        if (registration.installing) return
        if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
          return
        }
        try {
          const resp = await fetch(swUrl, {
            cache: 'no-store',
            headers: {
              cache: 'no-store',
              'cache-control': 'no-cache',
            },
          })
          if (resp?.status === 200) {
            await registration.update()
          }
        } catch {
          // Sin red o SW temporalmente inaccesible: reintentar en el próximo tick.
        }
      }

      setInterval(checkForUpdate, CHECK_INTERVAL_MS)

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      window.addEventListener('focus', checkForUpdate)
    },
  })
}
