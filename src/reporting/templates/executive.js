import { format } from 'date-fns'
import { buildRecordedCashFlow } from '@/reporting/metrics/cashMetrics'
import {
  createReportDocument,
  REPORT_TYPES,
  DEFAULT_DISCLAIMER,
  DEFAULT_METHODOLOGY,
} from '@/reporting/documentModel'

/**
 * Resumen ejecutivo: KPIs y excepciones, sin volcar todo el detalle.
 * No inventa utilidad/rentabilidad; usa flujo neto registrado por moneda.
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
} = {}) {
  const reportDate = format(new Date(), 'dd/MM/yyyy')
  const periodLabel = dateFilter?.label || 'Periodo no especificado'
  const recorded = buildRecordedCashFlow(transactions)
  const productCount = new Set(
    (movements || []).map((m) => m.products?.name || m.product_id).filter(Boolean)
  ).size
  const totalItems = (inventorySummary || []).reduce((s, a) => s + (a.itemsCount || 0), 0)
  const pendingTx = (transactions || []).filter((t) => t.status === 'pending' || t.status === 'partial')

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
      code: 'inventory_items',
      label: 'Ítems de inventario (áreas)',
      value: totalItems,
      unit: 'count',
      currency: null,
      sourceRefs: [],
    },
  ]

  const kpiRows = kpis.map((k) => [
    k.label,
    k.unit === 'money' && k.currency
      ? `${Number(k.value).toLocaleString('es-PE', { minimumFractionDigits: 2 })} ${k.currency}`
      : String(k.value),
  ])

  const exceptions = []
  if (pendingTx.length) {
    exceptions.push(
      `Hay ${pendingTx.length} transacción(es) pendientes o parciales en el período: el flujo registrado no es caja cobrada.`
    )
  }
  if (productCount > 1) {
    exceptions.push(
      `Almacén: ${productCount} productos con movimiento; no agregar cantidades entre UDM distintas.`
    )
  }
  if (openReceivableCount != null && openReceivableCount > 0) {
    exceptions.push(`Cuentas por cobrar abiertas (foto actual): ${openReceivableCount}.`)
  }
  if (openPayableCount != null && openPayableCount > 0) {
    exceptions.push(`Cuentas por pagar abiertas (foto actual): ${openPayableCount}.`)
  }
  if (!exceptions.length) {
    exceptions.push('No se detectaron excepciones automáticas con la información disponible.')
  }

  const flowSummary = recorded.length
    ? recorded
        .map(
          (r) =>
            `${r.currency}: entradas ${r.inflow.toLocaleString('es-PE', { minimumFractionDigits: 2 })}, salidas ${r.outflow.toLocaleString('es-PE', { minimumFractionDigits: 2 })}, flujo neto registrado ${r.net.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
        )
        .join('. ')
    : 'Sin movimientos financieros registrados en el período.'

  const sections = [
    {
      title: '0. Nota metodológica',
      content: DEFAULT_DISCLAIMER,
    },
    {
      title: '1. Alcance',
      content: `Resumen ejecutivo de gestión para ${periodLabel}. Incluye indicadores de finanzas (registros), actividad de almacén e inventario por áreas. No sustituye informes de detalle ni estados financieros formales.`,
    },
    {
      title: '2. Indicadores clave',
      type: 'table',
      headers: ['Indicador', 'Valor'],
      rows: kpiRows.length ? kpiRows : [['Sin datos', '—']],
      notes: 'Flujos monetarios = base registrada (no liquidada).',
    },
    {
      title: '3. Flujo registrado por moneda',
      content: flowSummary,
    },
    {
      title: '4. Excepciones y alertas',
      type: 'list',
      items: exceptions.map((e) => `**Alerta:** ${e}`),
    },
    {
      title: '5. Actividad operativa',
      type: 'list',
      items: [
        `**Almacén:** ${(movements || []).length} movimientos sobre ${productCount} producto(s).`,
        `**Inventario (áreas):** ${(inventorySummary || []).length} áreas, ${totalItems} ítems.`,
        'Para el detalle, genera los informes financiero, de almacén o de inventario.',
      ],
    },
  ]

  return createReportDocument({
    type: REPORT_TYPES.EXECUTIVE,
    title: 'Resumen ejecutivo de gestión',
    disclaimer: DEFAULT_DISCLAIMER,
    company,
    period: {
      from: dateFilter?.startDate ?? null,
      to: dateFilter?.endDate ?? null,
      label: periodLabel,
    },
    generatedBy,
    criteria: { cashBasis: 'recorded', valuation: 'none', currencyMode: 'native' },
    filters: { modules: ['finanzas', 'almacen', 'inventario'] },
    kpis,
    sections,
    methodology: DEFAULT_METHODOLOGY,
    warnings: pendingTx.length
      ? ['Incluye operaciones no liquidadas en el flujo registrado.']
      : [],
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
