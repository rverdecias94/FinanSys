// Sincroniza onlineManager de React Query con la realidad de la red.
// Problema: en Windows navigator.onLine puede quedar en true sin DNS/Internet
// → las mutaciones NO se pausan y explotan con TypeError: Failed to fetch.
// Solución: al fallar un fetch por red → setOnline(false); sondeo periódico
// mientras estamos offline para detectar la reconexión sin esperar minutos.

import { onlineManager } from '@tanstack/react-query'
import { isNetworkError } from '@/offline/isNetworkError'

let installed = false
let probeTimer = null
let probing = false

const PROBE_MS = 2500

function getProbeUrl() {
  const base = import.meta.env.VITE_SUPABASE_URL
  if (!base) return null
  // Health de Auth: respuesta rápida; cualquier HTTP (200/401) = hay Internet.
  return `${String(base).replace(/\/$/, '')}/auth/v1/health`
}

/** Ping ligero. true = hay red real (DNS resolvió y hubo respuesta HTTP). */
export async function probeConnectivity() {
  const url = getProbeUrl()
  if (!url || typeof fetch === 'undefined') return typeof navigator !== 'undefined' ? navigator.onLine : false

  const controller = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
    ? { signal: AbortSignal.timeout(2500) }
    : {}

  try {
    // Usamos el fetch nativo si aún no está envuelto; tras install usamos window.fetch
    // (ya envuelto) — un 2xx/4xx cuenta igual: hubo conectividad.
    await window.fetch(url, {
      method: 'GET',
      cache: 'no-store',
      ...controller,
    })
    return true
  } catch (error) {
    // Timeout / DNS / Failed to fetch → sin red
    if (isNetworkError(error) || error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return false
    }
    // Otros errores raros: no forzar offline
    return onlineManager.isOnline()
  }
}

function stopProbe() {
  if (probeTimer) {
    clearInterval(probeTimer)
    probeTimer = null
  }
}

function startProbe() {
  if (probeTimer || typeof window === 'undefined') return
  probeTimer = window.setInterval(() => {
    void runProbe()
  }, PROBE_MS)
  // Primer intento casi inmediato
  void runProbe()
}

async function runProbe() {
  if (probing) return
  if (onlineManager.isOnline()) {
    stopProbe()
    return
  }
  probing = true
  try {
    const ok = await probeConnectivity()
    if (ok) {
      onlineManager.setOnline(true)
      stopProbe()
    }
  } finally {
    probing = false
  }
}

export function setupNetworkGuard() {
  if (installed || typeof window === 'undefined') return
  installed = true

  onlineManager.setOnline(typeof navigator === 'undefined' ? true : navigator.onLine)
  if (!onlineManager.isOnline()) startProbe()

  window.addEventListener('online', () => {
    // El evento del SO a veces miente o llega tarde: marcar online y verificar.
    onlineManager.setOnline(true)
    void (async () => {
      const ok = await probeConnectivity()
      if (ok) {
        stopProbe()
      } else {
        onlineManager.setOnline(false)
        startProbe()
      }
    })()
  })

  window.addEventListener('offline', () => {
    onlineManager.setOnline(false)
    startProbe()
  })

  const originalFetch = window.fetch.bind(window)
  window.fetch = async (...args) => {
    try {
      const res = await originalFetch(...args)
      if (!onlineManager.isOnline()) {
        onlineManager.setOnline(true)
        stopProbe()
      }
      return res
    } catch (error) {
      if (isNetworkError(error)) {
        onlineManager.setOnline(false)
        startProbe()
      }
      throw error
    }
  }
}

/** Marca offline de forma explícita (p. ej. desde onError de una mutación). */
export function markOffline() {
  onlineManager.setOnline(false)
  startProbe()
}

export function markOnline() {
  onlineManager.setOnline(true)
  stopProbe()
}
