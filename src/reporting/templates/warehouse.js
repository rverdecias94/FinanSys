import { generateWarehouseReport } from '@/utils/narrativeGenerator'
import { fromLegacyNarrative, REPORT_TYPES, DEFAULT_DISCLAIMER } from '@/reporting/documentModel'

export function buildWarehouseDocument({
  movements = [],
  dateFilter = null,
  company = null,
  generatedBy = null,
} = {}) {
  const legacy = generateWarehouseReport(movements, dateFilter)
  const productNames = new Set(
    (movements || []).map((m) => m.products?.name || m.product_id || 'Desconocido')
  )
  const warnings = []
  if (productNames.size > 1) {
    warnings.push(
      'Hay varios productos en el período: las cantidades no deben sumarse entre unidades de medida distintas.'
    )
  }
  const missingCost = (movements || []).some((m) => m.unit_cost == null && m.type === 'out')
  if (missingCost) {
    warnings.push('Algunas salidas no tienen unit_cost: la valoración histórica no está disponible (E4).')
  }

  return fromLegacyNarrative(legacy, {
    type: REPORT_TYPES.WAREHOUSE,
    disclaimer: DEFAULT_DISCLAIMER,
    company,
    period: {
      from: dateFilter?.startDate ?? null,
      to: dateFilter?.endDate ?? null,
      label: dateFilter?.label ?? null,
    },
    generatedBy,
    criteria: { cashBasis: 'recorded', valuation: 'none', currencyMode: 'native' },
    filters: { modules: ['almacen'] },
    kpis: [
      {
        code: 'movements_count',
        label: 'Movimientos registrados',
        value: (movements || []).length,
        unit: 'count',
        currency: null,
        sourceRefs: [],
      },
      {
        code: 'products_touched',
        label: 'Productos con movimiento',
        value: productNames.size,
        unit: 'count',
        currency: null,
        sourceRefs: [],
      },
    ],
    warnings,
  })
}
