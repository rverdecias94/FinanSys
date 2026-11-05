import { generateInventoryReport } from '@/utils/narrativeGenerator'
import { fromLegacyNarrative, REPORT_TYPES, DEFAULT_DISCLAIMER } from '@/reporting/documentModel'

export function buildInventoryAreasDocument({
  inventorySummary = [],
  dateFilter = null,
  company = null,
  generatedBy = null,
} = {}) {
  const legacy = generateInventoryReport(inventorySummary, dateFilter)
  const totalItems = (inventorySummary || []).reduce((s, a) => s + (a.itemsCount || 0), 0)

  return fromLegacyNarrative(legacy, {
    type: REPORT_TYPES.INVENTORY_AREAS,
    disclaimer: DEFAULT_DISCLAIMER,
    company,
    period: {
      from: dateFilter?.startDate ?? null,
      to: dateFilter?.endDate ?? null,
      label: dateFilter?.label ?? null,
    },
    generatedBy,
    criteria: { cashBasis: 'recorded', valuation: 'none', currencyMode: 'native' },
    filters: { modules: ['inventario'] },
    kpis: [
      {
        code: 'areas_count',
        label: 'Áreas',
        value: (inventorySummary || []).length,
        unit: 'count',
        currency: null,
        sourceRefs: [],
      },
      {
        code: 'items_count',
        label: 'Ítems registrados',
        value: totalItems,
        unit: 'count',
        currency: null,
        sourceRefs: [],
      },
    ],
    warnings: [
      'Este informe describe el Inventario dinámico (áreas/activos/listas). No sustituye al Almacén de mercancía para venta.',
    ],
  })
}
