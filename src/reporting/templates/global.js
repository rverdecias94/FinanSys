import { generateGlobalReport } from '@/utils/narrativeGenerator'
import { fromLegacyNarrative, REPORT_TYPES, DEFAULT_DISCLAIMER } from '@/reporting/documentModel'

/**
 * Informe global: compone finanzas + almacén + inventario sin fingir unificación de stock.
 */
export function buildGlobalDocument({
  transactions = [],
  prevTransactions = [],
  prevLabel = 'Periodo anterior',
  movements = [],
  inventorySummary = [],
  dateFilter = null,
  company = null,
  generatedBy = null,
} = {}) {
  const legacy = generateGlobalReport(
    {
      transactions,
      prevTransactions,
      prevLabel,
      movements,
      inventorySummary,
    },
    dateFilter
  )

  return fromLegacyNarrative(legacy, {
    type: REPORT_TYPES.GLOBAL,
    disclaimer: DEFAULT_DISCLAIMER,
    company,
    period: {
      from: dateFilter?.startDate ?? null,
      to: dateFilter?.endDate ?? null,
      label: dateFilter?.label ?? null,
    },
    generatedBy,
    criteria: { cashBasis: 'recorded', valuation: 'none', currencyMode: 'native' },
    filters: { modules: ['finanzas', 'almacen', 'inventario'] },
    warnings: [
      'Almacén e Inventario dinámico son dominios distintos: este consolidado no unifica existencias.',
    ],
  })
}
