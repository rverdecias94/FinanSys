// Caché local (localStorage) para datos de contextos que NO usan React Query
// (suscripción, monedas). Permite mostrarlos OFFLINE en vez de fallar o caer a
// valores por defecto incorrectos (p. ej. mostrar 'free' siendo Premium).
//
// Seguridad: se limpia en logout y al cambiar de usuario (ver src/main.jsx,
// clearOfflineCache) para no filtrar datos entre cuentas en un dispositivo
// compartido. Las claves se namespacian por businessId desde quien la usa.
const PREFIX = 'gestia:cache:'

export function readLocalCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeLocalCache(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Cuota llena o modo privado: ignorar (la app sigue funcionando online).
  }
}

export function clearLocalCache() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    // ignorar
  }
}
