import { format } from 'date-fns'
import {
  buildWarehouseStockByProduct,
  formatValuation,
  summarizeWarehouseDataQuality,
} from '@/reporting/metrics/warehouseMetrics'
import {
  createReportDocument,
  REPORT_TYPES,
  DEFAULT_DISCLAIMER,
} from '@/reporting/documentModel'

/**
 * Informe de almacén / existencias por SKU (qty + valor si unit_cost completo).
 * Saldos reconstruidos por movimientos — no existencia física verificada.
 */
export function buildWarehouseStockDocument({
  movements = [],
  dateFilter = null,
  company = null,
  generatedBy = null,
  periodContext = null,
} = {}) {
  const periodLabel = periodContext?.label || dateFilter?.label || 'Sin período'
  const reportDate = format(new Date(), 'dd/MM/yyyy')
  const from = periodContext?.from ?? dateFilter?.startDate ?? null
  const to = periodContext?.effectiveTo ?? periodContext?.to ?? dateFilter?.endDate ?? null
  const rows = buildWarehouseStockByProduct(movements, { from, to })
  const quality = summarizeWarehouseDataQuality(rows)

  const warnings = []
  if (quality.missingCost) {
    warnings.push(
      `${quality.missingCost} producto(s) con valoración N/D por unit_cost incompleto. No se usó avg_cost actual.`
    )
  }
  if (quality.negative) {
    warnings.push(
      `${quality.negative} producto(s) con saldo reconstruido negativo: revisar movimientos o ajustes.`
    )
  }
  if (rows.length > 1) {
    warnings.push(
      'Las filas son por producto: no sumar columnas de cantidad entre productos (UDM pueden diferir; el catálogo no registra UDM).'
    )
  }
  warnings.push(
    'Los saldos son reconstruidos a partir del historial de movimientos hasta la fecha de corte; no equivalen a un inventario físico verificado.'
  )
  if (periodContext?.warnings?.length) warnings.push(...periodContext.warnings)

  const tableRows = rows.map((r) => [
    r.sku || '—',
    r.productName,
    '—',
    String(r.qtyInitial),
    String(r.qtyIn),
    String(r.qtyOut),
    String(r.qtyFinal),
    formatValuation(r.valueFinal, r.valuationAvailable),
    r.currency || '—',
    r.qualityLabel,
  ])

  const negatives = rows.filter((r) => r.negativeBalance)
  const unvalued = rows.filter((r) => !r.valuationAvailable)

  const sections = [
    {
      title: '1. Metodología',
      content:
        `${DEFAULT_DISCLAIMER} Existencias = saldo inicial (movimientos previos) + entradas − salidas. ` +
        'Es un saldo reconstruido, no una existencia física verificada. ' +
        'Valor final solo si el Kardex del producto tiene unit_cost en todas las líneas hasta la fecha de corte. ' +
        'UDM: el catálogo de productos no registra unidad de medida; se muestra «—» y no se inventa.',
    },
    {
      title: '2. Resumen e indicadores de calidad',
      content:
        `Informe de almacén — ${periodLabel}. ${quality.total} producto(s). ` +
        `Valorados: ${quality.valued} (${quality.valuedPct}%). Sin valoración confiable: ${quality.missingCost}. ` +
        `Saldos negativos: ${quality.negative}.`,
      type: 'list',
      items: [
        `**Productos en informe:** ${quality.total}`,
        `**Con valoración unit_cost completa:** ${quality.valued} (${quality.valuedPct}%)`,
        `**Sin valoración histórica confiable:** ${quality.missingCost}`,
        `**Saldo reconstruido negativo:** ${quality.negative}`,
      ],
    },
    {
      title: '3. Existencias por producto (reconstruidas)',
      type: 'table',
      headers: [
        'SKU',
        'Producto',
        'UDM',
        'Inicial',
        'Entradas',
        'Salidas',
        'Final',
        'Valor final',
        'Moneda',
        'Calidad',
      ],
      rows: tableRows.length ? tableRows : [['—', 'Sin datos', '—', '0', '0', '0', '0', 'N/D', '—', '—']],
      notes:
        'Inicial = Kardex de movimientos con fecha efectiva anterior al inicio del período. Valor = N/D si falta unit_cost.',
    },
  ]

  if (negatives.length) {
    sections.push({
      title: '4. Productos con saldo reconstruido negativo',
      type: 'list',
      items: negatives.map(
        (r) =>
          `**${r.productName}**${r.sku ? ` [${r.sku}]` : ''}: saldo final ${r.qtyFinal} (${r.currency || 'sin moneda'}).`
      ),
    })
  }

  if (unvalued.length) {
    sections.push({
      title: negatives.length ? '5. Productos sin valoración histórica confiable' : '4. Productos sin valoración histórica confiable',
      type: 'list',
      items: unvalued.map(
        (r) =>
          `**${r.productName}**${r.sku ? ` [${r.sku}]` : ''}: ${r.missingCostLines} línea(s) sin unit_cost; valor N/D.`
      ),
    })
  }

  return createReportDocument({
    type: REPORT_TYPES.WAREHOUSE,
    title: 'Informe de almacén y existencias',
    disclaimer: DEFAULT_DISCLAIMER,
    company,
    period: {
      from,
      to: periodContext?.to ?? to,
      label: periodLabel,
      cutoffAt: periodContext?.cutoffAt ?? to,
      timezone: periodContext?.timezone ?? null,
    },
    generatedBy,
    criteria: {
      cashBasis: 'recorded',
      valuation: rows.some((r) => r.valuationAvailable) ? 'wac_sealed_unit_cost' : 'none',
      currencyMode: 'native',
      dateField: 'moved_at_or_created_at',
      stockBasis: 'reconstructed_movements',
    },
    filters: { modules: ['almacen'] },
    kpis: [
      { code: 'sku_count', label: 'Productos', value: quality.total, unit: 'count', currency: null, sourceRefs: [] },
      { code: 'valued_skus', label: 'Productos con valoración', value: quality.valued, unit: 'count', currency: null, sourceRefs: [] },
      { code: 'negative_skus', label: 'Saldos negativos', value: quality.negative, unit: 'count', currency: null, sourceRefs: [] },
    ],
    sections,
    warnings,
    methodology: [
      'Saldo inicial = Kardex de movimientos con fecha efectiva anterior al inicio del período.',
      'Saldo reconstruido ≠ existencia física verificada.',
      'Valoración solo con movements.unit_cost; N/D si el historial está incompleto.',
      'UDM no registrada en catálogo: columna UDM = —.',
      'No se agrega cantidad entre productos.',
    ],
    metadata: [
      { label: 'Período', value: periodLabel },
      { label: 'Fecha de emisión', value: reportDate },
      { label: 'Criterio de valoración', value: 'unit_cost sellado (no avg_cost actual)' },
      { label: 'Naturaleza del saldo', value: 'Reconstruido por movimientos (no conteo físico)' },
    ],
  })
}
