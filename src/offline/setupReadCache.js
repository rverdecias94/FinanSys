import { CACHE_MAX_AGE } from '@/offline/queryPersister'
import { CRITICAL_READ_PREFIXES } from '@/offline/cacheMeta'

/** Datos de lectura: frescos ~30 min; viven en IndexedDB hasta CACHE_MAX_AGE. */
export const READ_STALE_TIME = 1000 * 60 * 30

/**
 * Defaults por módulo operativo: tras rehidratar offline no se dispara
 * un refetch inmediato que deje la UI en vacío si la red miente.
 */
export function setupReadCacheDefaults(queryClient) {
  const opts = {
    staleTime: READ_STALE_TIME,
    gcTime: CACHE_MAX_AGE,
    // Con networkMode online (default del client): sin red la query queda paused
    // y se conservan los datos rehidratados.
    refetchOnMount: true,
    refetchOnReconnect: true,
  }
  for (const prefix of CRITICAL_READ_PREFIXES) {
    queryClient.setQueryDefaults([prefix], opts)
  }
}
