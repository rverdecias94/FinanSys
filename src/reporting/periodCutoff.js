/**
 * E5 — Contexto de período y fecha de corte para consultas reproducibles *en el momento*.
 * No es un snapshot emitido (E6): si cambian datos vivos, regenerar puede diferir.
 */

export const DEFAULT_REPORT_TIMEZONE = 'America/Havana'

/**
 * @param {object|null} dateFilter — { startDate, endDate, label, type }
 * @param {object} [opts]
 */
export function resolvePeriodContext(dateFilter = null, {
  timezone = DEFAULT_REPORT_TIMEZONE,
  now = new Date(),
  cutoffAt = null,
} = {}) {
  const resolvedCutoff = cutoffAt || dateFilter?.endDate || now.toISOString()
  return {
    from: dateFilter?.startDate ?? null,
    to: dateFilter?.endDate ?? null,
    label: dateFilter?.label ?? null,
    cutoffAt: resolvedCutoff,
    timezone,
    generatedAt: now.toISOString(),
  }
}

export function isAtOrBeforeCutoff(dateValue, cutoffAt) {
  if (!cutoffAt) return true
  if (!dateValue) return true
  const t = new Date(dateValue).getTime()
  const c = new Date(cutoffAt).getTime()
  if (!Number.isFinite(t) || !Number.isFinite(c)) return true
  return t <= c
}

export function filterRowsByCutoff(rows = [], getDate, cutoffAt) {
  if (!cutoffAt) return [...(rows || [])]
  return (rows || []).filter((row) => isAtOrBeforeCutoff(getDate(row), cutoffAt))
}

/** Refs de trazabilidad para un KPI agregado. */
export function buildSourceRefs(rows = [], { idKey = 'id', table = 'transactions', limit = 50 } = {}) {
  const refs = []
  for (const row of rows || []) {
    const id = row?.[idKey]
    if (id == null) continue
    refs.push({ table, id: String(id) })
    if (refs.length >= limit) break
  }
  return refs
}

export function formatCutoffLabel(cutoffAt, timezone = DEFAULT_REPORT_TIMEZONE) {
  if (!cutoffAt) return '—'
  try {
    return `${new Date(cutoffAt).toISOString()} (${timezone})`
  } catch {
    return String(cutoffAt)
  }
}

/** Metadatos estándar E5 para pie / cabecera de informe. */
export function cutoffMetadata(period) {
  if (!period) return []
  return [
    period.cutoffAt
      ? { label: 'Fecha de corte', value: formatCutoffLabel(period.cutoffAt, period.timezone) }
      : null,
    period.timezone
      ? { label: 'Zona horaria', value: period.timezone }
      : null,
    {
      label: 'Modo',
      value: 'Consulta con corte (recalculable; no es informe emitido inmutable)',
    },
  ].filter(Boolean)
}
