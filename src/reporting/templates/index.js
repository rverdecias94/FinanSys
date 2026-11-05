import { buildFinanceMgmtDocument } from './financeMgmt'
import { buildWarehouseDocument } from './warehouse'
import { buildInventoryAreasDocument } from './inventoryAreas'
import { buildExecutiveDocument } from './executive'
import { buildGlobalDocument } from './global'
import { REPORT_TYPES, toLegacyReportShape } from '@/reporting/documentModel'

export const TEMPLATE_OPTIONS = [
  { id: 'executive', type: REPORT_TYPES.EXECUTIVE, label: 'Resumen ejecutivo', description: 'KPIs y excepciones' },
  { id: 'finanzas', type: REPORT_TYPES.FINANCE_MGMT, label: 'Financiero de gestión', description: 'Entradas/salidas registradas' },
  { id: 'almacen', type: REPORT_TYPES.WAREHOUSE, label: 'Almacén', description: 'Movimientos por producto' },
  { id: 'inventario', type: REPORT_TYPES.INVENTORY_AREAS, label: 'Inventario por áreas', description: 'Conteos por área' },
  { id: 'global', type: REPORT_TYPES.GLOBAL, label: 'Global consolidado', description: 'Finanzas + almacén + inventario' },
]

/**
 * Construye un ReportDocument según plantilla y lo adapta a Preview/DOCX si `asLegacy`.
 */
export function buildReport(templateId, payload = {}, { asLegacy = true } = {}) {
  let doc
  switch (templateId) {
    case 'executive':
      doc = buildExecutiveDocument(payload)
      break
    case 'finanzas':
      doc = buildFinanceMgmtDocument(payload)
      break
    case 'almacen':
      doc = buildWarehouseDocument(payload)
      break
    case 'inventario':
      doc = buildInventoryAreasDocument(payload)
      break
    case 'global':
      doc = buildGlobalDocument(payload)
      break
    default:
      throw new Error(`Plantilla desconocida: ${templateId}`)
  }
  return asLegacy ? toLegacyReportShape(doc) : doc
}

export {
  buildFinanceMgmtDocument,
  buildWarehouseDocument,
  buildInventoryAreasDocument,
  buildExecutiveDocument,
  buildGlobalDocument,
}
