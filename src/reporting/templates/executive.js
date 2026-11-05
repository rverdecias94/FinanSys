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
 * Resumen ejecutivo breve: KPIs, alertas operativas, anomalías de almacén y recomendaciones.
 * No duplica informes especializados.
 */
export function buildExecutiveDocument({
  transactions = [],
  movements = [],
  inventorySummary = [],
  dateFilter = null,
  company = null,
  generatedBy = null,
  openReceivableCount = null,
  openPayableCount = null,
  periodContext = null,
} = {}) {
  const reportDate = format(new Date(), 'dd/MM/yyyy')
  const periodLabel = periodContext?.label || dateFilter?.label || 'Periodo no especificado'
  const from = periodContext?.from ?? dateFilter?.startDate ?? null
  const to = periodContext?.effectiveTo ?? periodContext?.to ?? dateFilter?.endDate ?? null
  const recorded = buildRecordedCashFlow(transactions)
  const stockRows = buildWarehouseStockByProduct(movements, { from, to })
  const stockQuality = summarizeWarehouseDataQuality(stockRows)
  const productCount = new Set(
    (movements || []).map((m) => m.products?.name || m.product_id).filter(Boolean)
  ).size
  const totalItems = (inventorySummary || []).reduce((s, a) => s + (a.itemsCount || 0), 0)
  const pendingTx = (transactions || []).filter((t) => t.status === 'pending' || t.status === 'partial')

  const flowTableRows = recorded.length
    ? recorded.map((r) => [
        r.currency,
        Number(r.inflow).toLocaleString('es-PE', { minimumFractionDigits: 2 }),
        Number(r.outflow).toLocaleString('es-PE', { minimumFractionDigits: 2 }),
        Number(r.net).toLocaleString('es-PE', { minimumFractionDigits: 2 }),
      ])
    : [['—', '0,00', '0,00', '0,00']]

  const kpis = [
    ...recorded.map((r) => ({
      code: `flow_${r.currency}`,
      label: `Flujo neto registrado (${r.currency})`,
      value: r.net,
      unit: 'money',
      currency: r.currency,
      sourceRefs: [],
    })),
    {
      code: 'movements',
      label: 'Movimientos de almacén',
      value: (movements || []).length,
      unit: 'count',
      currency: null,
      sourceRefs: [],
    },
    {
      code: 'inventory_cards',
      label: 'Fichas de inventario (áreas)',
      value: totalItems,
      unit: 'count',
      currency: null,
      sourceRefs: [],
    },
  ]

  const operationalAlerts = []
  if (pendingTx.length) {
    operationalAlerts.push(
      `${pendingTx.length} transacción(es) pendientes o parciales: el flujo registrado no es caja cobrada.`
    )
  }
  if (openReceivableCount != null && openReceivableCount > 0) {
    operationalAlerts.push(`Cuentas por cobrar abiertas (foto actual): ${openReceivableCount}.`)
  }
  if (openPayableCount != null && openPayableCount > 0) {
    operationalAlerts.push(`Cuentas por pagar abiertas (foto actual): ${openPayableCount}.`)
  }
  if (productCount > 1) {
    operationalAlerts.push(
      `Almacén: ${productCount} productos con movimiento; no agregar cantidades entre UDM distintas.`
    )
  }

  const warehouseAnomalies = []
  if (stockQuality.negative) {
    warehouseAnomalies.push(
      `${stockQuality.negative} producto(s) con saldo reconstruido negativo.`
    )
  }
  if (stockQuality.missingCost) {
    warehouseAnomalies.push(
      `${stockQuality.missingCost} producto(s) sin valoración histórica confiable (unit_cost incompleto).`
    )
  }
  stockRows.filter((r) => r.negativeBalance).slice(0, 5).forEach((r) => {
    warehouseAnomalies.push(
      `${r.productName}${r.sku ? ` [${r.sku}]` : ''}: saldo final ${r.qtyFinal}.`
    )
  })

  const recommendations = []
  if (pendingTx.length) {
    recommendations.push(
      'Revisar el panel Liquidado y cuentas abiertas: hay operaciones no cobradas/pagadas del todo.'
    )
  }
  if (stockQuality.negative) {
    recommendations.push(
      'Investigar saldos de almacén negativos (movimientos faltantes, ajustes o errores de captura) antes de decidir reposición.'
    )
  }
  if (stockQuality.missingCost) {
    recommendations.push(
      'Completar unit_cost en movimientos futuros para poder valorar existencias; no se inventan costos históricos.'
    )
  }
  recorded.filter((r) => r.net < 0).forEach((r) => {
    recommendations.push(
      `En ${r.currency}, el flujo neto registrado es negativo: priorizar revisión de salidas y cobros pendientes.`
    )
  })
  if (!recommendations.length) {
    recommendations.push(
      'Generar los informes de detalle (financiero, almacén o Kardex) solo si necesitas profundizar; este resumen no los sustituye.'
    )
  }

  const warnings = []
  if (pendingTx.length) warnings.push('Incluye operaciones no liquidadas en el flujo registrado.')
  if (periodContext?.warnings?.length) warnings.push(...periodContext.warnings)

  const sections = [
    {
      title: '1. Metodología',
      content:
        `${DEFAULT_DISCLAIMER} Flujos = base registrada (no liquidada). ` +
        'Inventario por áreas cuenta fichas/ítems, no volumen físico ni valor de mercancía de venta. ' +
        'Almacén usa saldos reconstruidos por movimientos.',
    },
    {
      title: '2. Alcance',
      content: `Resumen ejecutivo de gestión para ${periodLabel}. Indicadores de finanzas (registros), actividad de almacén e inventario por áreas. No sustituye informes de detalle ni estados financieros formales.`,
    },
    {
      title: '3. Flujo registrado por moneda',
      type: 'table',
      headers: ['Moneda', 'Entradas', 'Salidas', 'Flujo neto'],
      rows: flowTableRows,
      notes: 'Importes en moneda nativa; no se consolidan FX.',
    },
    {
      title: '4. Alertas operativas',
      type: 'list',
      items: (operationalAlerts.length
        ? operationalAlerts
        : ['No se detectaron alertas operativas automáticas.']
      ).map((e) => `**Alerta:** ${e}`),
    },
    {
      title: '5. Anomalías de almacén',
      type: 'list',
      items: (warehouseAnomalies.length
        ? warehouseAnomalies
        : ['Sin anomalías automáticas de saldo negativo o valoración incompleta en el alcance.']
      ).map((e) => `**Almacén:** ${e}`),
    },
    {
      title: '6. Actividad operativa (síntesis)',
      type: 'list',
      items: [
        `**Almacén:** ${(movements || []).length} movimientos sobre ${productCount} producto(s); valorados ${stockQuality.valued}/${stockQuality.total}.`,
        `**Inventario (áreas):** ${(inventorySummary || []).length} áreas, ${totalItems} ficha(s)/ítem(s) — no es stock de venta valorizado.`,
        'Para el detalle, genera los informes financiero, de almacén, Kardex o de inventario.',
      ],
    },
    {
      title: '7. Recomendaciones',
      type: 'list',
      items: recommendations.map((r) => `**Recomendación:** ${r}`),
    },
  ]

  return createReportDocument({
    type: REPORT_TYPES.EXECUTIVE,
    title: 'Resumen ejecutivo de gestión',
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
    criteria: { cashBasis: 'recorded', valuation: 'none', currencyMode: 'native' },
    filters: { modules: ['finanzas', 'almacen', 'inventario'] },
    kpis,
    sections,
    methodology: DEFAULT_METHODOLOGY,
    warnings,
    metadata: [
      { label: 'Período analizado', value: periodLabel },
      { label: 'Fecha de emisión', value: reportDate },
      { label: 'Base de preparación', value: 'Registros operacionales (no equivale a caja cobrada)' },
      {
        label: 'Monedas',
        value: recorded.length ? recorded.map((r) => r.currency).join(' / ') : '—',
      },
    ],
  })
}
