// Detecta fallos de red reales (DNS, cable/Wi‑Fi caído, DevTools Offline…).
// navigator.onLine a menudo sigue en true en Windows aunque no haya Internet;
// por eso NO basta con mirar solo ese flag.

const NETWORK_MSG_RE =
  /failed to fetch|networkerror|network request failed|load failed|err_name_not_resolved|err_internet_disconnected|err_connection|err_network|fetch failed|the internet connection appears to be offline/i

export function isNetworkError(error) {
  if (!error) return false

  // Fetch API / Chromium
  if (error instanceof TypeError && NETWORK_MSG_RE.test(String(error.message || ''))) {
    return true
  }

  const msg = String(error.message || error.error_description || error.details || '')
  if (NETWORK_MSG_RE.test(msg)) return true

  // Códigos que a veces trae supabase-js / wrappers
  const code = String(error.code || error.name || '')
  if (/NETWORK_ERROR|AbortError/i.test(code) && NETWORK_MSG_RE.test(msg || code)) return true
  if (code === 'Failed to fetch') return true

  return false
}

/** ¿Debemos tratar el entorno como offline para toasts / outbox? */
export function shouldTreatAsOffline(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return isNetworkError(error)
}
