import { buildFinanceMgmtDocument } from './financeMgmt'
import { buildWarehouseDocument } from './warehouse'
import { buildWarehouseStockDocument } from './warehouseStock'
import { buildKardexDocument } from './kardex'
import { buildInventoryAreasDocument } from './inventoryAreas'
import { buildExecutiveDocument } from './executive'
import { buildGlobalDocument } from './global'
import { buildAuditDocument } from './audit'
import { buildReconcileDocument } from './reconcile'
import { REPORT_TYPES, toLegacyReportShape } from '@/reporting/documentModel'
import { resolvePeriodContext, cutoffMetadata } from '@/reporting/periodCutoff'

export const TEMPLATE_OPTIONS = [
  { id: 'executive', type: REPORT_TYPES.EXECUTIVE, label: 'Resumen ejecutivo', description: 'KPIs y excepciones' },
  { id: 'finanzas', type: REPORT_TYPES.FINANCE_MGMT, label: 'Financiero de gestión', description: 'Entradas/salidas registradas' },
  { id: 'almacen', type: REPORT_TYPES.WAREHOUSE, label: 'Almacén / existencias', description: 'Saldo por producto + valoración si hay unit_cost' },
  { id: 'kardex', type: REPORT_TYPES.KARDEX, label: 'Kardex', description: 'Libro de movimientos por producto' },
  { id: 'inventario', type: REPORT_TYPES.INVENTORY_AREAS, label: 'Inventario por áreas', description: 'Conteos por área' },
  { id: 'audit', type: REPORT_TYPES.AUDIT, label: 'Auditoría', description: 'Eventos audit_logs hasta la fecha de corte' },
  { id: 'reconcile', type: REPORT_TYPES.RECONCILE, label: 'Conciliación venta–stock–cobro', description: 'E7 avanzado + rotación valorizada' },
  { id: 'global', type: REPORT_TYPES.GLOBAL, label: 'Global consolidado', description: 'Finanzas + almacén + inventario' },
]

function attachPeriod(doc, periodContext) {
  if (!doc || !periodContext) return doc
  const meta = [...(doc.metadata || [])]
  for (const m of cutoffMetadata(periodContext)) {
    if (!meta.some((x) => x.label === m.label)) meta.push(m)
  }
  const warnings = [...(doc.warnings || [])]
  for (const w of periodContext.warnings || []) {
    if (!warnings.includes(w)) warnings.push(w)
  }
  return {
    ...doc,
    period: {
      ...(doc.period || {}),
      ...periodContext,
    },
    metadata: meta,
    warnings,
    generatedAt: periodContext.generatedAt || doc.generatedAt,
  }
}

/**
 * Construye un ReportDocument según plantilla y lo adapta a Preview/DOCX si `asLegacy`.
 */
export function buildReport(templateId, payload = {}, { asLegacy = true } = {}) {
  const periodContext = payload.periodContext || resolvePeriodContext(payload.dateFilter, {
    cutoffAt: payload.cutoffAt,
    timezone: payload.timezone, // si no viene, resolvePeriodContext usa getClientTimeZone()
  })
  // Propagar etiqueta efectiva al dateFilter que consumen narrativas legacy.
  const dateFilter = payload.dateFilter
    ? { ...payload.dateFilter, label: periodContext.label || payload.dateFilter.label }
    : payload.dateFilter
  const enriched = { ...payload, dateFilter, periodContext }

  let doc
  switch (templateId) {
    case 'executive':
      doc = buildExecutiveDocument(enriched)
      break
    case 'finanzas':
      doc = buildFinanceMgmtDocument(enriched)
      break
    case 'almacen':
      doc = buildWarehouseStockDocument(enriched)
      break
    case 'almacen_narrative':
      doc = buildWarehouseDocument(enriched)
      break
    case 'kardex':
      doc = buildKardexDocument(enriched)
      break
    case 'inventario':
      doc = buildInventoryAreasDocument(enriched)
      break
    case 'audit':
      doc = buildAuditDocument(enriched)
      break
    case 'reconcile':
      doc = buildReconcileDocument(enriched)
      break
    case 'global':
      doc = buildGlobalDocument(enriched)
      break
    default:
      throw new Error(`Plantilla desconocida: ${templateId}`)
  }

  doc = attachPeriod(doc, periodContext)
  return asLegacy ? toLegacyReportShape(doc) : doc
}

export {
  buildFinanceMgmtDocument,
  buildWarehouseDocument,
  buildWarehouseStockDocument,
  buildKardexDocument,
  buildInventoryAreasDocument,
  buildExecutiveDocument,
  buildGlobalDocument,
  buildAuditDocument,
  buildReconcileDocument,
}
