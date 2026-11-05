import { format } from 'date-fns'
import { buildRecordedCashFlow } from '@/reporting/metrics/cashMetrics'
import {
  buildWarehouseStockByProduct,
  summarizeWarehouseDataQuality,
} from '@/reporting/metrics/warehouseMetrics'
import {
  createReportDocument,
  REPORT_TYPES,
  DEFAULT_DISCLAIMER,
  DEFAULT_METHODOLOGY,
} from '@/reporting/documentModel'

/**
 * Informe global integrado: síntesis por dominio (no copia íntegra de los tres reportes).
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
  periodContext = null,
} = {}) {
  const reportDate = format(new Date(), 'dd/MM/yyyy')
  const periodLabel = periodContext?.label || dateFilter?.label || 'Sin período'
  const from = periodContext?.from ?? dateFilter?.startDate ?? null
  const to = periodContext?.effectiveTo ?? periodContext?.to ?? dateFilter?.endDate ?? null

  const recorded = buildRecordedCashFlow(transactions)
  const prevRecorded = buildRecordedCashFlow(prevTransactions || [])
  const stock = buildWarehouseStockByProduct(movements, { from, to })
  const quality = summarizeWarehouseDataQuality(stock)
  const areaCount = (inventorySummary || []).length
  const itemCards = (inventorySummary || []).reduce((s, a) => s + (a.itemsCount || 0), 0)
  const pending = (transactions || []).filter((t) => t.status === 'pending' || t.status === 'partial')

  const flowRows = recorded.length
    ? recorded.map((r) => {
        const prev = prevRecorded.find((p) => p.currency === r.currency)
        return [
          r.currency,
          Number(r.inflow).toLocaleString('es-PE', { minimumFractionDigits: 2 }),
          Number(r.outflow).toLocaleString('es-PE', { minimumFractionDigits: 2 }),
          Number(r.net).toLocaleString('es-PE', { minimumFractionDigits: 2 }),
          prev
            ? Number(prev.net).toLocaleString('es-PE', { minimumFractionDigits: 2 })
            : '—',
        ]
      })
    : [['—', '0,00', '0,00', '0,00', '—']]

  const crossAlerts = []
  if (pending.length) {
    crossAlerts.push(`Finanzas: ${pending.length} transacción(es) pending/partial (flujo ≠ caja).`)
  }
  if (quality.negative) {
    crossAlerts.push(`Almacén: ${quality.negative} producto(s) con saldo reconstruido negativo.`)
  }
  if (quality.missingCost) {
    crossAlerts.push(`Almacén: ${quality.missingCost} producto(s) sin valoración unit_cost completa.`)
  }
  recorded.filter((r) => r.net < 0).forEach((r) => {
    crossAlerts.push(`Finanzas: flujo neto registrado negativo en ${r.currency}.`)
  })
  if (!crossAlerts.length) {
    crossAlerts.push('Sin alertas transversales automáticas con los datos disponibles.')
  }

  const warnings = [
    'Almacén (mercancía de venta) e Inventario dinámico (fichas/áreas) son dominios distintos: este consolidado no unifica existencias ni valora fichas de inventario.',
    'El número de fichas de inventario no representa volumen físico ni valor económico de existencias de almacén.',
  ]
  if (periodContext?.warnings?.length) warnings.push(...periodContext.warnings)

  const sections = [
    {
      title: '1. Metodología',
      content:
        `${DEFAULT_DISCLAIMER} Este informe es una síntesis integrada. ` +
        'No reproduce íntegramente los reportes financiero, de almacén o de inventario. ' +
        'Finanzas en base registrada; almacén con saldos reconstruidos; inventario = conteo de fichas por área.',
    },
    {
      title: '2. Resumen ejecutivo consolidado',
      content: `Período ${periodLabel}. ${(transactions || []).length} transacción(es), ${(movements || []).length} movimiento(s) de almacén, ${areaCount} área(s) de inventario con ${itemCards} ficha(s).`,
      type: 'table',
      headers: ['Moneda', 'Entradas reg.', 'Salidas reg.', 'Flujo neto', `Neto ${prevLabel}`],
      rows: flowRows,
      notes: 'Totales por moneda nativa; sin consolidación FX.',
    },
    {
      title: '3. Alertas y hallazgos transversales',
      type: 'list',
      items: crossAlerts.map((a) => `**Alerta:** ${a}`),
    },
    {
      title: '4. Finanzas (síntesis)',
      type: 'list',
      items: [
        `**Base:** registros operacionales del período (no caja liquidada).`,
        `**Pendientes/parciales:** ${pending.length}.`,
        recorded.length
          ? recorded.map((r) => `**${r.currency}:** neto ${Number(r.net).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`).join(' ')
          : 'Sin movimientos financieros en el período.',
        'Detalle: generar el informe financiero de gestión.',
      ],
    },
    {
      title: '5. Almacén (síntesis)',
      type: 'list',
      items: [
        `**Productos en alcance:** ${quality.total}. Valorados: ${quality.valued} (${quality.valuedPct}%). Negativos: ${quality.negative}.`,
        'Saldos reconstruidos por movimientos; no son existencia física verificada.',
        'Detalle: informes de existencias y Kardex.',
      ],
    },
    {
      title: '6. Inventario dinámico (síntesis)',
      type: 'list',
      items: [
        `**Áreas:** ${areaCount}. **Fichas/ítems:** ${itemCards}.`,
        'Estas fichas no miden stock de venta ni valor económico de almacén.',
        'Detalle: informe de inventario por áreas.',
      ],
    },
    {
      title: '7. Recomendaciones por módulo',
      type: 'list',
      items: [
        '**Finanzas:** si hay pending/partial, cruzar con Liquidado y antigüedad de saldos.',
        quality.negative
          ? '**Almacén:** investigar saldos negativos antes de reponer o valorar.'
          : '**Almacén:** mantener unit_cost en movimientos nuevos para valoración futura.',
        quality.missingCost
          ? '**Almacén:** no usar avg_cost actual para cerrar huecos históricos; documentar N/D.'
          : '**Almacén:** la valoración unit_cost del alcance está completa donde aplica.',
        '**Inventario:** interpretar fichas como control de activos/listas, no como Kardex de mercancía.',
      ],
    },
  ]

  return createReportDocument({
    type: REPORT_TYPES.GLOBAL,
    title: 'Informe global integrado de gestión',
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
    criteria: { cashBasis: 'recorded', valuation: 'partial_unit_cost', currencyMode: 'native' },
    filters: { modules: ['finanzas', 'almacen', 'inventario'] },
    kpis: [
      ...recorded.map((r) => ({
        code: `net_${r.currency}`,
        label: `Flujo neto (${r.currency})`,
        value: r.net,
        unit: 'money',
        currency: r.currency,
        sourceRefs: [],
      })),
      { code: 'sku', label: 'Productos almacén', value: quality.total, unit: 'count', currency: null, sourceRefs: [] },
      { code: 'cards', label: 'Fichas inventario', value: itemCards, unit: 'count', currency: null, sourceRefs: [] },
    ],
    sections,
    methodology: DEFAULT_METHODOLOGY,
    warnings,
    metadata: [
      { label: 'Período', value: periodLabel },
      { label: 'Fecha de emisión', value: reportDate },
      { label: 'Tipo', value: 'Síntesis integrada (no copia de reportes individuales)' },
    ],
  })
}
