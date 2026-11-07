// Metadatos de la caché de lectura (Capa B): ¿hay datos reales guardados?
// Solo cuenta queries con éxito — nunca inventa filas.

/** Prefijos de queryKey que representan datos de negocio visibles offline. */
export const CRITICAL_READ_PREFIXES = [
  'transactions',
  'filteredTotals',
  'warehouse',
  'open-accounts',
  'contacts',
  'inventoryAreas',
  'inventoryItems',
  'recurring',
  'dashboard',
  'aging',
]

function isCriticalKey(queryKey) {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return false
  const head = queryKey[0]
  return typeof head === 'string' && CRITICAL_READ_PREFIXES.includes(head)
}

/**
 * Recorre la QueryCache en memoria y devuelve el dataUpdatedAt más reciente
 * de queries críticas con éxito y datos.
 * @returns {{ hasData: boolean, updatedAt: number | null }}
 */
export function getCriticalCacheMeta(queryClient) {
  if (!queryClient) return { hasData: false, updatedAt: null }
  let updatedAt = null
  const queries = queryClient.getQueryCache().getAll()
  for (const q of queries) {
    if (!isCriticalKey(q.queryKey)) continue
    if (q.state.status !== 'success') continue
    if (q.state.data == null) continue
    const ts = Number(q.state.dataUpdatedAt || 0)
    if (!ts) continue
    if (updatedAt == null || ts > updatedAt) updatedAt = ts
  }
  return { hasData: updatedAt != null, updatedAt }
}

/** Texto corto en español para la antigüedad de la copia local. */
export function formatCacheAgeLabel(updatedAt, now = Date.now()) {
  if (!updatedAt) return null
  const diffMs = Math.max(0, now - updatedAt)
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'hace un momento'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'hace 1 día'
  return `hace ${days} días`
}

/** Clave estable de período (sin label localizado). */
export function buildFinanceDateKey(dateFilter) {
  if (!dateFilter?.startDate || !dateFilter?.endDate) return null
  return `${dateFilter.type || 'range'}:${dateFilter.startDate}:${dateFilter.endDate}`
}
