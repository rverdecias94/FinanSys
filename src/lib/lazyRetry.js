import { lazy } from 'react'

const CHUNK_RE =
  /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed|error loading dynamically imported module/i

const RELOAD_KEY = 'gestia.chunk.reload'

export function isChunkLoadError(error) {
  const msg = String(error?.message || error || '')
  return CHUNK_RE.test(msg)
}

/**
 * lazy() con un reintento/reload ante chunks viejos tras un deploy o fallo de red.
 * Evita el pantallazo "Algo salió mal" con CuentasMejorado-XXXX.js 404.
 */
export function lazyRetry(factory) {
  return lazy(async () => {
    try {
      const mod = await factory()
      try {
        sessionStorage.removeItem(RELOAD_KEY)
      } catch {
        // ignore
      }
      return mod
    } catch (error) {
      if (!isChunkLoadError(error)) throw error
      try {
        if (!sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, '1')
          window.location.reload()
          return new Promise(() => {})
        }
        sessionStorage.removeItem(RELOAD_KEY)
      } catch {
        // sessionStorage bloqueado: rethrow
      }
      throw error
    }
  })
}
