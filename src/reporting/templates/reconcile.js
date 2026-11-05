import { format } from 'date-fns'
import {
  buildSaleStockPaymentRows,
  summarizeReconcile,
  describeFxReportingStatus,
} from '@/reporting/metrics/reconcileMetrics'
import {
  buildWarehouseStockByProduct,
} from '@/reporting/metrics/warehouseMetrics'
import {
  buildInventoryRotation,
  periodLengthDays,
} from '@/reporting/metrics/rotationMetrics'
import {
  createReportDocument,
  REPORT_TYPES,
  DEFAULT_DISCLAIMER,
  DEFAULT_METHODOLOGY,
} from '@/reporting/documentModel'

const STATUS_LABEL = {
  conciliado: 'Conciliado',
  parcial: 'Parcial',
  sin_entrega: 'Sin entrega',
  sin_cobro: 'Sin cobro',
  cobrado_sin_entrega: 'Cobrado sin entrega',
  sin_vinculo_stock: 'Sin vínculo stock',
}

function money(v, currency) {
  if (v == null || !Number.isFinite(Number(v))) return 'N/D'
  const n = Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2 })
  return currency ? `${n} ${currency}` : n
}

/**
 * Informe avanzado E7: conciliación venta–stock–cobro + rotación valorizada + nota FX.
 */
export function buildReconcileDocument({
  transactions = [],
  movements = [],
  payments = [],
  dateFilter = null,
  company = null,
  generatedBy = null,
  periodContext = null,
} = {}) {
  const periodLabel = dateFilter?.label || periodContext?.label || 'Sin período'
  const reportDate = format(new Date(), 'dd/MM/yyyy')
  const from = periodContext?.from ?? dateFilter?.startDate ?? null
  const to = periodContext?.to ?? dateFilter?.endDate ?? null

  const reconcileRows = buildSaleStockPaymentRows({ transactions, movements, payments })
  const summary = summarizeReconcile(reconcileRows)
  const fx = describeFxReportingStatus(transactions)

  const stock = buildWarehouseStockByProduct(movements, { from, to })
  const days = periodLengthDays(from, to)
  const rotation = buildInventoryRotation(stock, { periodDays: days })
  const rotationOk = rotation.filter((r) => r.available)

  const warnings = []
  if (fx.distinctCurrencies.length > 1) warnings.push(fx.note)
  if (rotation.length && rotationOk.length === 0) {
    warnings.push('Rotación N/D: falta unit_cost sellado en movimientos del período.')
  }
  const missingLink = reconcileRows.filter((r) => !r.delivered).length
  if (missingLink) {
    warnings.push(
      `${missingLink} ingreso(s) sin salida de almacén vinculada (transaction_id). Puede ser venta sin stock o movimiento manual.`
    )
  }

  const tableRows = reconcileRows.map((r) => [
    r.date || '—',
    String(r.transactionId),
    r.description || '—',
    money(r.saleAmount, r.currency),
    money(r.inventoryCost, r.currency),
    String(r.qtyDelivered),
    money(r.collected, r.currency),
    money(r.receivable, r.currency),
    STATUS_LABEL[r.status] || r.status,
  ])

  const rotationRows = rotation.map((r) => [
    r.sku || '—',
    r.productName || '—',
    r.available ? money(r.cogs, r.currency) : 'N/D',
    r.available ? money(r.avgInventory, r.currency) : 'N/D',
    r.available && r.rotation != null ? r.rotation.toFixed(2) : 'N/D',
    r.available && r.daysOfInventory != null ? r.daysOfInventory.toFixed(1) : 'N/D',
    r.currency || '—',
  ])

  const statusBits = Object.entries(summary.byStatus)
    .map(([k, n]) => `${STATUS_LABEL[k] || k}: ${n}`)
    .join('; ')

  const sections = [
    {
      title: '1. Metodología',
      content:
        `${DEFAULT_DISCLAIMER} Este informe relaciona tres hechos operativos por separado: ` +
        'entrega (almacén), registro de venta (ingreso) y cobro (abonos o paid_amount). ' +
        'No es un asiento de partida doble ni un estado financiero. ' +
        fx.note,
    },
    {
      title: '2. Resumen de conciliación',
      content:
        `Período ${periodLabel}: ${summary.total} ingreso(s). ` +
        `Con entrega: ${summary.withDelivery}. Totalmente cobrados y entregados: ${summary.fullyCollected}. ` +
        (statusBits ? `Detalle — ${statusBits}.` : ''),
    },
    {
      title: '3. Venta · stock · cobro',
      type: 'table',
      headers: [
        'Fecha',
        'Tx',
        'Descripción',
        'Venta',
        'Coste stock',
        'Qty entregada',
        'Cobrado',
        'Por cobrar',
        'Estado',
      ],
      rows: tableRows.length ? tableRows : [['—', '—', 'Sin ingresos en el período', '—', '—', '—', '—', '—', '—']],
    },
    {
      title: '4. Rotación valorizada (COGS / inventario medio)',
      content:
        rotationOk.length
          ? `Calculada solo donde unit_cost está completo. Días del período: ${days ?? 'N/D'}.`
          : 'Sin productos con valoración completa: rotación no disponible (no se usa salidas/entradas en cantidad).',
      type: 'table',
      headers: ['SKU', 'Producto', 'COGS', 'Inv. medio', 'Rotación', 'Días inv.', 'Moneda'],
      rows: rotationRows.length
        ? rotationRows
        : [['—', 'Sin datos de almacén', '—', '—', '—', '—', '—']],
    },
    {
      title: '5. FX',
      content: fx.note,
    },
  ]

  return createReportDocument({
    type: REPORT_TYPES.RECONCILE,
    title: `Conciliación venta–stock–cobro — ${periodLabel}`,
    disclaimer: DEFAULT_DISCLAIMER,
    company,
    period: {
      from,
      to,
      label: periodLabel,
      cutoffAt: periodContext?.cutoffAt ?? to,
      timezone: periodContext?.timezone ?? 'America/Havana',
    },
    generatedAt: new Date().toISOString(),
    generatedBy,
    criteria: {
      cashBasis: 'mixed',
      valuation: 'unit_cost',
      currencyMode: 'native',
      reconcile: 'sale_stock_payment',
    },
    methodology: [
      ...DEFAULT_METHODOLOGY,
      'Conciliación: entrega = movements.out con transaction_id; cobro = account_payments o paid_amount (caché).',
      'Rotación = COGS (valueOut con unit_cost) / inventario medio valorizado; N/D si falta costo.',
    ],
    warnings,
    metadata: [
      { label: 'Fecha del informe', value: reportDate },
      { label: 'Período', value: periodLabel },
      { label: 'Plantilla', value: 'Conciliación E7' },
    ],
    kpis: [
      { code: 'sales', label: 'Ingresos en conciliación', value: summary.total, unit: 'count' },
      { code: 'reconciled', label: 'Conciliados', value: summary.fullyCollected, unit: 'count' },
      {
        code: 'rotation_products',
        label: 'Productos con rotación',
        value: rotationOk.length,
        unit: 'count',
      },
    ],
    sections,
  })
}
