import { format } from 'date-fns'
import {
  buildWarehouseStockByProduct,
  formatValuation,
} from '@/reporting/metrics/warehouseMetrics'
import {
  createReportDocument,
  REPORT_TYPES,
  DEFAULT_DISCLAIMER,
} from '@/reporting/documentModel'

/**
 * Informe de almacén / existencias por SKU en el período (qty + valor si unit_cost completo).
 */
export function buildWarehouseStockDocument({
  movements = [],
  dateFilter = null,
  company = null,
  generatedBy = null,
} = {}) {
  const periodLabel = dateFilter?.label || 'Sin período'
  const reportDate = format(new Date(), 'dd/MM/yyyy')
  const rows = buildWarehouseStockByProduct(movements, {
    from: dateFilter?.startDate ?? null,
    to: dateFilter?.endDate ?? null,
  })

  const warnings = []
  const nd = rows.filter((r) => !r.valuationAvailable)
  if (nd.length) {
    warnings.push(
      `${nd.length} producto(s) con valoración N/D por unit_cost incompleto. No se usó avg_cost actual.`
    )
  }
  if (rows.length > 1) {
    warnings.push(
      'Las filas son por producto: no sumar columnas de cantidad entre productos con UDM distintas.'
    )
  }

  const tableRows = rows.map((r) => [
    r.sku || '—',
    r.productName,
    String(r.qtyInitial),
    String(r.qtyIn),
    String(r.qtyOut),
    String(r.qtyFinal),
    formatValuation(r.valueFinal, r.valuationAvailable),
    r.currency || '—',
  ])

  const sections = [
    {
      title: '0. Nota metodológica',
      content:
        `${DEFAULT_DISCLAIMER} Existencias del período = saldo inicial (movimientos previos) + entradas − salidas. ` +
        'Valor final solo si el Kardex del producto tiene unit_cost en todas las líneas hasta la fecha de corte del período.',
    },
    {
      title: '1. Resumen',
      content: `Informe de almacén y existencias — ${periodLabel}. ${rows.length} producto(s) con movimiento o saldo. Valoración: coste sellado en movimientos (WAC histórico), no avg_cost actual.`,
    },
    {
      title: '2. Existencias por producto',
      type: 'table',
      headers: [
        'SKU',
        'Producto',
        'Inicial',
        'Entradas',
        'Salidas',
        'Final',
        'Valor final',
        'Moneda',
      ],
      rows: tableRows.length ? tableRows : [['—', 'Sin datos', '0', '0', '0', '0', 'N/D', '—']],
      notes: 'Valor final = N/D cuando falta unit_cost en el historial del producto.',
    },
  ]

  return createReportDocument({
    type: REPORT_TYPES.WAREHOUSE,
    title: 'Informe de almacén y existencias',
    disclaimer: DEFAULT_DISCLAIMER,
    company,
    period: {
      from: dateFilter?.startDate ?? null,
      to: dateFilter?.endDate ?? null,
      label: periodLabel,
    },
    generatedBy,
    criteria: {
      cashBasis: 'recorded',
      valuation: rows.some((r) => r.valuationAvailable) ? 'wac_sealed_unit_cost' : 'none',
      currencyMode: 'native',
      dateField: 'moved_at_or_created_at',
    },
    filters: { modules: ['almacen'] },
    kpis: [
      {
        code: 'sku_count',
        label: 'Productos',
        value: rows.length,
        unit: 'count',
        currency: null,
        sourceRefs: [],
      },
      {
        code: 'valued_skus',
        label: 'Productos con valoración',
        value: rows.filter((r) => r.valuationAvailable).length,
        unit: 'count',
        currency: null,
        sourceRefs: [],
      },
    ],
    sections,
    warnings,
    methodology: [
      'Saldo inicial = Kardex de movimientos con fecha efectiva anterior al inicio del período.',
      'Valoración solo con movements.unit_cost; N/D si el historial está incompleto.',
      'No se agrega cantidad entre productos.',
    ],
    metadata: [
      { label: 'Período', value: periodLabel },
      { label: 'Fecha de emisión', value: reportDate },
      { label: 'Criterio de valoración', value: 'unit_cost sellado (no avg_cost actual)' },
    ],
  })
}
