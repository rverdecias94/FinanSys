/**
 * Contexto de período y fecha de corte para consultas reproducibles *en el momento*.
 * No es un snapshot emitido (E6): si cambian datos vivos, regenerar puede diferir.
 *
 * Clasificación de período:
 * - closed: end <= now (ejercicio/rango cerrado)
 * - ytd_open: rango incluye el presente → effectiveTo = min(end, now)
 * - future_open: start > now (o sin solape con pasado) → período no cerrado; no implica datos futuros
 */

export function getClientTimeZone() {
  try {
    const tz = Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone
    if (tz && typeof tz === 'string') return tz
  } catch { /* ignore */ }
  return 'UTC'
}

/** @deprecated Preferir getClientTimeZone(); se mantiene por compatibilidad de imports. */
export const DEFAULT_REPORT_TIMEZONE = typeof Intl !== 'undefined'
  ? getClientTimeZone()
  : 'UTC'

function toIso(d) {
  if (d == null) return null
  if (typeof d === 'string') return d
  try {
    return new Date(d).toISOString()
  } catch {
    return null
  }
}

function fmtDateShort(iso, timezone) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-PE', {
      timeZone: timezone || 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    try {
      return new Date(iso).toISOString().slice(0, 10)
    } catch {
      return String(iso)
    }
  }
}

/**
 * Normaliza el período solicitado vs efectivo (abierto / cerrado / futuro).
 */
export function resolveEffectivePeriod(dateFilter = null, {
  now = new Date(),
  timezone = null,
} = {}) {
  const tz = timezone || getClientTimeZone()
  const nowMs = now.getTime()
  const from = dateFilter?.startDate ?? null
  const to = dateFilter?.endDate ?? null
  const requestedLabel = dateFilter?.label ?? null
  const fromMs = from != null ? new Date(from).getTime() : null
  const toMs = to != null ? new Date(to).getTime() : null
  const warnings = []

  let status = 'closed'
  let effectiveTo = to
  let label = requestedLabel

  if (fromMs != null && Number.isFinite(fromMs) && fromMs > nowMs) {
    status = 'future_open'
    effectiveTo = to
    warnings.push(
      'Período no cerrado: la fecha de inicio es posterior a hoy. El informe no implica la existencia de datos futuros.'
    )
    label = requestedLabel
      ? `${requestedLabel} (período no cerrado — sin datos futuros implícitos)`
      : 'Período no cerrado'
  } else if (toMs != null && Number.isFinite(toMs) && toMs > nowMs) {
    status = 'ytd_open'
    effectiveTo = now.toISOString()
    const cutLabel = fmtDateShort(effectiveTo, tz)
    label = requestedLabel
      ? `${requestedLabel} (acumulado al ${cutLabel})`
      : `Acumulado al ${cutLabel}`
    warnings.push(
      `Período en curso: el rango solicitado termina después de hoy. Se usa acumulado hasta ${cutLabel} (${tz}); no es un ejercicio cerrado.`
    )
  } else if (fromMs != null && toMs != null && fromMs <= nowMs && toMs <= nowMs) {
    status = 'closed'
    effectiveTo = to
    label = requestedLabel
  } else if (to == null && from != null) {
    status = 'ytd_open'
    effectiveTo = now.toISOString()
    label = requestedLabel
      ? `${requestedLabel} (acumulado al ${fmtDateShort(effectiveTo, tz)})`
      : `Acumulado al ${fmtDateShort(effectiveTo, tz)}`
  }

  const cutoffAt = effectiveTo || to || now.toISOString()

  return {
    from: toIso(from) || from,
    to: toIso(to) || to,
    effectiveTo: toIso(effectiveTo) || effectiveTo,
    requestedLabel,
    label,
    status,
    cutoffAt: toIso(cutoffAt) || cutoffAt,
    timezone: tz,
    warnings,
  }
}

/**
 * @param {object|null} dateFilter — { startDate, endDate, label, type }
 * @param {object} [opts]
 */
export function resolvePeriodContext(dateFilter = null, {
  timezone = null,
  now = new Date(),
  cutoffAt = null,
} = {}) {
  const effective = resolveEffectivePeriod(dateFilter, {
    now,
    timezone: timezone || getClientTimeZone(),
  })
  if (cutoffAt) {
    effective.cutoffAt = cutoffAt
  }
  return {
    from: effective.from,
    to: effective.to,
    effectiveTo: effective.effectiveTo,
    label: effective.label,
    requestedLabel: effective.requestedLabel,
    status: effective.status,
    cutoffAt: effective.cutoffAt,
    timezone: effective.timezone,
    generatedAt: now.toISOString(),
    warnings: effective.warnings,
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

export function formatCutoffLabel(cutoffAt, timezone = null) {
  if (!cutoffAt) return '—'
  const tz = timezone || getClientTimeZone()
  try {
    return `${new Date(cutoffAt).toISOString()} (${tz})`
  } catch {
    return String(cutoffAt)
  }
}

const STATUS_LABEL = {
  closed: 'Cerrado (rango completo hasta la fecha fin)',
  ytd_open: 'Acumulado / período en curso (no cerrado)',
  future_open: 'Período no cerrado (inicio futuro)',
}

/** Metadatos estándar para pie / cabecera de informe. */
export function cutoffMetadata(period) {
  if (!period) return []
  return [
    period.requestedLabel && period.requestedLabel !== period.label
      ? { label: 'Período solicitado', value: period.requestedLabel }
      : null,
    period.label
      ? { label: 'Período efectivo', value: period.label }
      : null,
    period.status
      ? { label: 'Estado del período', value: STATUS_LABEL[period.status] || period.status }
      : null,
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
