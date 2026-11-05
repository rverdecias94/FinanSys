/**
 * E3 — Modelo documental estructurado (ReportDocument).
 * id=null hasta E6 (historial BD). Preview/DOCX consumen toLegacyReportShape().
 */

export const REPORT_SCHEMA_VERSION = 1

export const REPORT_TYPES = {
  EXECUTIVE: 'executive',
  FINANCE_MGMT: 'finance_mgmt',
  WAREHOUSE: 'warehouse',
  KARDEX: 'kardex',
  INVENTORY_AREAS: 'inventory_areas',
  AUDIT: 'audit',
  GLOBAL: 'global',
  RECONCILE: 'reconcile',
}

export const DEFAULT_DISCLAIMER =
  'Documento de gestión sobre registros operacionales de GESTIA. No constituye un estado financiero preparado mediante contabilidad de partida doble ni certificación contable.'

export const DEFAULT_METHODOLOGY = [
  'Base registrada: suma de transacciones income/expense del período por fecha de registro (cualquier estado de cobro/pago).',
  'Base liquidada (si se muestra en paneles): abonos por paid_at + altas al contado sin ledger; paid_amount es caché, no segunda fuente.',
  'Monedas: totales siempre por moneda nativa; no se suman USD y CUP.',
  'Almacén: cantidades por producto; no se agregan unidades de medida distintas.',
  'Valoración de almacén: solo movements.unit_cost sellado; N/D si falta costo; no se usa products.avg_cost actual.',
  'FX: no se consolidan monedas en reportes; fx_units_per_base solo informa si está sellado en el registro (no se inventa tipo de cambio).',
  'Rotación de inventario (si se muestra): COGS valorizado / inventario medio; nunca salidas÷entradas en cantidad.',
]

/**
 * @returns {object} ReportDocument serializable
 */
export function createReportDocument({
  schemaVersion = REPORT_SCHEMA_VERSION,
  id = null,
  type,
  title,
  disclaimer = DEFAULT_DISCLAIMER,
  company = null,
  period = {},
  generatedAt = new Date().toISOString(),
  generatedBy = null,
  criteria = {},
  filters = {},
  kpis = [],
  sections = [],
  methodology = DEFAULT_METHODOLOGY,
  warnings = [],
  metadata = [],
} = {}) {
  if (!type) throw new Error('ReportDocument.type es obligatorio')
  if (!title) throw new Error('ReportDocument.title es obligatorio')
  return {
    schemaVersion,
    id,
    type,
    title,
    disclaimer,
    company,
    period: {
      from: period.from ?? null,
      to: period.to ?? null,
      label: period.label ?? null,
      cutoffAt: period.cutoffAt ?? null,
      timezone: period.timezone ?? null,
    },
    generatedAt,
    generatedBy,
    criteria: {
      cashBasis: criteria.cashBasis ?? 'recorded',
      valuation: criteria.valuation ?? 'none',
      currencyMode: criteria.currencyMode ?? 'native',
      ...criteria,
    },
    filters: { ...filters },
    kpis: Array.isArray(kpis) ? kpis : [],
    sections: Array.isArray(sections) ? sections : [],
    methodology: Array.isArray(methodology) ? methodology : [],
    warnings: Array.isArray(warnings) ? warnings : [],
    metadata: Array.isArray(metadata) ? metadata : [],
  }
}

/** Envuelve el shape legacy { title, metadata, sections } en ReportDocument. */
export function fromLegacyNarrative(legacy, extras = {}) {
  if (!legacy?.title) throw new Error('fromLegacyNarrative: legacy.title requerido')
  return createReportDocument({
    title: legacy.title,
    metadata: legacy.metadata || [],
    sections: legacy.sections || [],
    ...extras,
  })
}

function hasMethodologySection(sections) {
  return (sections || []).some((s) => /metodol|disclaimer|nota metod/i.test(s.title || ''))
}

/**
 * Adapta ReportDocument → shape consumido por ReportPreview y generateDOCX.
 * No elimina secciones existentes; añade disclaimer/metodología/warnings si faltan.
 */
export function toLegacyReportShape(doc) {
  if (!doc) return null
  // Ya es legacy puro (sin type de documento E3)
  if (!doc.type && doc.title && Array.isArray(doc.sections)) {
    return { title: doc.title, metadata: doc.metadata || [], sections: doc.sections }
  }

  const sections = [...(doc.sections || [])]
  if (doc.disclaimer && !hasMethodologySection(sections)) {
    sections.unshift({
      title: '1. Metodología',
      content: doc.disclaimer,
    })
  }

  if ((doc.warnings || []).length) {
    sections.push({
      title: 'Advertencias de datos',
      type: 'list',
      items: doc.warnings.map((w) => (typeof w === 'string' ? w : String(w))),
    })
  }

  if ((doc.methodology || []).length && !hasMethodologySection(sections)) {
    sections.push({
      title: 'Metodología',
      type: 'list',
      items: doc.methodology.map((m) => (m.startsWith('**') ? m : `**Criterio:** ${m}`)),
    })
  }

  const metadata = [...(doc.metadata || [])]
  if (doc.criteria?.cashBasis && !metadata.some((m) => /base/i.test(m.label || ''))) {
    metadata.push({
      label: 'Criterio de flujo',
      value: doc.criteria.cashBasis === 'settled' ? 'Liquidado (caja movida)' : 'Registros operacionales',
    })
  }
  if (doc.id) {
    metadata.unshift({ label: 'ID documento', value: doc.id })
  }
  if (doc.period?.cutoffAt && !metadata.some((m) => /fecha de corte/i.test(m.label || ''))) {
    metadata.push({
      label: 'Fecha de corte',
      value: `${doc.period.cutoffAt}${doc.period.timezone ? ` (${doc.period.timezone})` : ''}`,
    })
  }

  return {
    title: doc.title,
    metadata,
    sections,
    // Passthrough opcional para consumidores E5+ (Preview lo ignora).
    period: doc.period,
    kpis: doc.kpis,
  }
}

export function isReportDocument(value) {
  return Boolean(value && typeof value === 'object' && value.type && value.schemaVersion)
}
