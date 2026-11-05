import { format } from 'date-fns'
import {
  createReportDocument,
  REPORT_TYPES,
  DEFAULT_DISCLAIMER,
} from '@/reporting/documentModel'
import { cutoffMetadata, buildSourceRefs } from '@/reporting/periodCutoff'

function fmtWhen(v) {
  if (!v) return '—'
  try {
    return format(new Date(v), 'dd/MM/yyyy HH:mm:ss')
  } catch {
    return String(v)
  }
}

function briefJson(value) {
  if (value == null) return '—'
  try {
    const s = typeof value === 'string' ? value : JSON.stringify(value)
    return s.length > 120 ? `${s.slice(0, 117)}…` : s
  } catch {
    return '—'
  }
}

/**
 * Informe de auditoría (consulta con corte). Requiere permiso logs.view en UI.
 */
export function buildAuditDocument({
  auditLogs = [],
  dateFilter = null,
  company = null,
  generatedBy = null,
  periodContext = null,
} = {}) {
  const periodLabel = dateFilter?.label || periodContext?.label || 'Sin período'
  const reportDate = format(new Date(), 'dd/MM/yyyy')
  const period = {
    from: periodContext?.from ?? dateFilter?.startDate ?? null,
    to: periodContext?.to ?? dateFilter?.endDate ?? null,
    label: periodLabel,
    cutoffAt: periodContext?.cutoffAt ?? dateFilter?.endDate ?? null,
    timezone: periodContext?.timezone ?? 'America/Havana',
  }

  const rows = (auditLogs || []).map((log) => [
    fmtWhen(log.created_at),
    log.user_email || '—',
    log.action || '—',
    log.resource || '—',
    log.area || '—',
    briefJson(log.old_value),
    briefJson(log.new_value),
    log.ip_address || '—',
    log.id != null ? String(log.id) : '—',
  ])

  const sections = [
    {
      title: '0. Nota metodológica',
      content:
        `${DEFAULT_DISCLAIMER} Este informe lista eventos de audit_logs hasta la fecha de corte. ` +
        'Es una consulta recalculable: registros posteriores o retroactivos pueden cambiar el resultado al regenerar. ' +
        'No es un documento emitido inmutable (eso corresponde a E6).',
    },
    {
      title: '1. Resumen',
      content: `Se incluyen ${rows.length} evento(s) de auditoría en ${periodLabel}. Columnas: quién, qué, cuándo, objeto, antes/después e IP cuando existen.`,
    },
    {
      title: '2. Eventos',
      type: 'table',
      headers: [
        'Fecha/hora',
        'Usuario',
        'Acción',
        'Objeto',
        'Área',
        'Antes',
        'Después',
        'IP',
        'ID',
      ],
      rows: rows.length
        ? rows
        : [['—', '—', 'Sin eventos', '—', '—', '—', '—', '—', '—']],
      notes: 'Orden: más reciente primero (según consulta).',
    },
  ]

  return createReportDocument({
    type: REPORT_TYPES.AUDIT,
    title: 'Informe de auditoría',
    disclaimer: DEFAULT_DISCLAIMER,
    company,
    period,
    generatedBy,
    criteria: {
      cashBasis: 'recorded',
      valuation: 'none',
      currencyMode: 'native',
      queryMode: 'cutoff_live',
    },
    filters: { modules: ['audit_logs'] },
    kpis: [
      {
        code: 'audit_events',
        label: 'Eventos en el alcance',
        value: rows.length,
        unit: 'count',
        currency: null,
        sourceRefs: buildSourceRefs(auditLogs, { table: 'audit_logs' }),
      },
    ],
    sections,
    warnings: [
      'Consulta con fecha de corte: regenerar tras nuevos logs puede cambiar el contenido.',
    ],
    methodology: [
      'Fuente: tabla audit_logs filtrada por business_id y created_at ≤ corte.',
      'No modifica ni elimina eventos (append-only).',
    ],
    metadata: [
      ...cutoffMetadata(period),
      { label: 'Período', value: periodLabel },
      { label: 'Fecha de emisión', value: reportDate },
      { label: 'Fuente', value: 'audit_logs' },
    ],
  })
}
