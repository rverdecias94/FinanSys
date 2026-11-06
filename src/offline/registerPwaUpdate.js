import { registerSW } from 'virtual:pwa-register'

/** Flag leída en App tras el reload automático. */
export const PWA_JUST_UPDATED_KEY = 'gestia.pwa.justUpdated'

const VERSION_RELOAD_KEY = 'gestia.version.reload.for'

/** Build id inyectado en vite.config (cambia en cada build). */
export const APP_BUILD_ID =
  typeof __GESTIA_BUILD_ID__ !== 'undefined' ? __GESTIA_BUILD_ID__ : 'dev'

/** Cada 12s + al enfocar / online / pageshow: detectar deploy sin pull-to-refresh. */
const CHECK_INTERVAL_MS = 12_000

let updateSWFn = null
let checking = false

async function fetchRemoteBuildId() {
  const res = await fetch(`/version.json?_=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data?.buildId || null
}

function markAndReload() {
  try {
    sessionStorage.setItem(PWA_JUST_UPDATED_KEY, '1')
  } catch {
    // ignore
  }
  window.location.reload()
}

/**
 * Si version.json del servidor ≠ este bundle → recarga (con guard anti-bucle).
 */
async function checkBuildVersion() {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) return
  try {
    const remote = await fetchRemoteBuildId()
    if (!remote || remote === APP_BUILD_ID) {
      try {
        sessionStorage.removeItem(VERSION_RELOAD_KEY)
      } catch {
        // ignore
      }
      return
    }
    try {
      if (sessionStorage.getItem(VERSION_RELOAD_KEY) === remote) return
      sessionStorage.setItem(VERSION_RELOAD_KEY, remote)
    } catch {
      // ignore
    }
    try {
      await updateSWFn?.(true)
    } catch {
      // ignore
    }
    markAndReload()
  } catch {
    // Sin red / 404 en preview local
  }
}

/**
 * Auto-actualiza la PWA lo antes posible:
 * - registerType autoUpdate + skipWaiting (vite.config)
 * - version.json NetworkOnly + cache-bust
 * - checks cada 12s + visibility / focus / online / pageshow
 */
export function registerPwaUpdate() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  updateSWFn = registerSW({
    immediate: true,
    onNeedReload() {
      markAndReload()
    },
    onRegisteredSW(swUrl, registration) {
      if (!registration) return

      const checkForUpdate = async () => {
        if (checking) return
        checking = true
        try {
          if (registration.installing) return
          if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
            return
          }

          await checkBuildVersion()

          try {
            await fetch(`${swUrl}${swUrl.includes('?') ? '&' : '?'}_=${Date.now()}`, {
              cache: 'no-store',
              headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
            })
          } catch {
            // ignore
          }
          await registration.update()

          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' })
            try {
              await updateSWFn?.(true)
            } catch {
              markAndReload()
            }
          }
        } finally {
          checking = false
        }
      }

      checkForUpdate()
      setInterval(checkForUpdate, CHECK_INTERVAL_MS)

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      window.addEventListener('focus', checkForUpdate)
      window.addEventListener('online', checkForUpdate)
      window.addEventListener('pageshow', () => checkForUpdate())

      // Solo recargar en updates (no en el primer install del SW).
      let hadController = Boolean(navigator.serviceWorker.controller)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController) {
          hadController = true
          return
        }
        markAndReload()
      })
    },
  })
}
