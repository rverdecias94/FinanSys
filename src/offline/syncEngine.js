// Motor de sincronización del outbox (Capa C):
// - Al reconectar → resumePausedMutations()
// - Tras rehidratar la caché (onSuccess de PersistQueryClientProvider) → idem
// - Contador de mutaciones pausadas (banner / límites locales)

import { onlineManager } from '@tanstack/react-query'

/** ¿La mutación está en cola offline (paused) o ejecutándose ahora? */
export function isMutationQueued(mutation) {
  if (!mutation) return false
  // Solo status pending (paused o en vuelo). Success/error NO cuentan.
  if (mutation.state?.status !== 'pending') return false
  return true
}

/** Cuenta mutaciones en cola. Si se pasa `mutationKeyPrefix`, filtra por prefijo. */
export function countQueuedMutations(queryClient, mutationKeyPrefix) {
  const all = queryClient.getMutationCache().getAll()
  return all.filter((m) => {
    if (!isMutationQueued(m)) return false
    if (!mutationKeyPrefix) return true
    const key = m.options?.mutationKey
    if (!Array.isArray(key)) return false
    return mutationKeyPrefix.every((part, i) => key[i] === part)
  }).length
}

/**
 * Suscribe al onlineManager y reanuda la cola al volver la red.
 * Devuelve unsubscribe.
 */
export function setupSyncEngine(queryClient) {
  const resume = () => {
    if (!onlineManager.isOnline()) return
    queryClient.resumePausedMutations().catch(() => {
      // Fallo puntual de sync: el usuario verá el contador; reintentará al próximo online.
    })
  }

  // Si ya hay red al montar (p. ej. tras rehidratar mutaciones pausadas).
  resume()

  return onlineManager.subscribe((online) => {
    if (online) resume()
  })
}
