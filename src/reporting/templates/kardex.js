import { format } from 'date-fns'
import {
  buildPeriodKardexByProduct,
  formatValuation,
} from '@/reporting/metrics/warehouseMetrics'
import {
  createReportDocument,
  REPORT_TYPES,
  DEFAULT_DISCLAIMER,
} from '@/reporting/documentModel'

function fmtDate(v) {
  if (!v) return '—'
  try {
    return format(new Date(v), 'dd/MM/yyyy HH:mm')
  } catch {
    return String(v)
  }
}

/**
 * Libro de movimientos / Kardex por producto.
 * Valoración solo con unit_cost; si falta → N/D. Saldo inicial explícito.
 */
export function buildKardexDocument({
  movements = [],
  dateFilter = null,
  company = null,
  generatedBy = null,
  productId = null,
  periodContext = null,
} = {}) {
  const periodLabel = periodContext?.label || dateFilter?.label || 'Sin período'
  const reportDate = format(new Date(), 'dd/MM/yyyy')
  const from = periodContext?.from ?? dateFilter?.startDate ?? null
  const to = periodContext?.effectiveTo ?? periodContext?.to ?? dateFilter?.endDate ?? null

  let books = buildPeriodKardexByProduct(movements, { from, to })
  if (productId != null) {
    books = books.filter((b) => b.productKey === String(productId))
  }

  const warnings = []
  const incomplete = books.filter((b) => !b.valuationAvailable)
  if (incomplete.length) {
    warnings.push(
      `${incomplete.length} producto(s) sin valoración completa: falta unit_cost en una o más líneas. No se usa avg_cost actual.`
    )
  }
  const negatives = books.filter((b) => b.negativeBalance)
  if (negatives.length) {
    warnings.push(
      `${negatives.length} producto(s) con saldo reconstruido negativo al cierre.`
    )
  }
  if (!books.length) {
    warnings.push('No hay movimientos para armar Kardex en el alcance seleccionado.')
  }
  warnings.push(
    'UDM no registrada en el catálogo de productos (columna UDM = —). Los saldos son reconstruidos, no existencia física verificada.'
  )
  if (periodContext?.warnings?.length) warnings.push(...periodContext.warnings)

  const sections = [
    {
      title: '1. Metodología',
      content:
        `${DEFAULT_DISCLAIMER} El Kardex acumula cantidades por producto según fecha efectiva (moved_at o created_at). ` +
        'El valor de línea y saldo valorado solo existen cuando unit_cost está sellado en el movimiento. ' +
        'products.avg_cost actual no se utiliza. Referencias Doc/Tx solo si el movimiento las tiene; no se inventan.',
    },
    {
      title: '2. Alcance',
      content: `Libro de movimientos de almacén — ${periodLabel}. ${books.length} producto(s). Las cantidades de productos distintos no son sumables entre sí.`,
    },
  ]

  books.forEach((book, idx) => {
    const headers = [
      'Fecha efectiva',
      'ID mov.',
      'Doc. / Tx',
      'Entrada',
      'Salida',
      'Saldo qty',
      'Coste unit.',
      'Valor línea',
      'Saldo valor',
    ]
    const rows = (book.periodRows || []).map((r) => [
      fmtDate(r.effectiveAt),
      r.movementId != null ? String(r.movementId) : '—',
      r.sourceRef || '—',
      r.qtyIn != null ? String(r.qtyIn) : '—',
      r.qtyOut != null ? String(r.qtyOut) : '—',
      String(r.balanceQty),
      r.unitCost != null ? String(r.unitCost) : 'N/D',
      r.lineValue != null ? formatValuation(r.lineValue, true) : 'N/D',
      r.balanceValue != null ? formatValuation(r.balanceValue, true) : 'N/D',
    ])

    const openingNote =
      `Saldo inicial qty: ${book.openingQty}` +
      (book.openingValuationAvailable
        ? ` · Valor inicial: ${formatValuation(book.openingValue, true)}${book.currency ? ` ${book.currency}` : ''}`
        : ' · Valor inicial: N/D') +
      `. Origen: ${book.openingSource}`

    const closeNote = book.valuationAvailable
      ? `Saldo final: ${book.finalQty} · Valor final: ${formatValuation(book.finalValue, true)}${book.currency ? ` ${book.currency}` : ''}`
      : `Saldo final qty: ${book.finalQty} · Valor final: N/D (${book.missingCostLines} línea(s) sin unit_cost)`

    const flags = []
    if (book.negativeBalance) flags.push('Saldo reconstruido negativo al cierre.')
    if (!book.valuationAvailable) flags.push('Valoración incompleta (unit_cost faltante).')
    if ((book.periodRows || []).some((r) => r.missingCost)) {
      flags.push('Hay movimientos del período sin coste sellado.')
    }

    sections.push({
      title: `3.${idx + 1} Kardex — ${book.productName}`,
      content:
        `SKU: ${book.sku || '—'} · UDM: — · Moneda: ${book.currency || '—'}. ${openingNote}` +
        (flags.length ? ` Alertas: ${flags.join(' ')}` : ''),
      type: 'table',
      headers,
      rows: rows.length ? rows : [['—', '—', '—', '—', '—', String(book.openingQty), 'N/D', 'N/D', 'N/D']],
      notes: closeNote,
      pageBreakBefore: idx > 0,
    })
  })

  return createReportDocument({
    type: REPORT_TYPES.KARDEX,
    title: 'Libro de movimientos (Kardex)',
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
      valuation: books.some((b) => b.valuationAvailable) ? 'wac_sealed_unit_cost' : 'none',
      currencyMode: 'native',
      dateField: 'moved_at_or_created_at',
      stockBasis: 'reconstructed_movements',
    },
    filters: { modules: ['almacen'], productId },
    kpis: [
      {
        code: 'products_kardex',
        label: 'Productos en Kardex',
        value: books.length,
        unit: 'count',
        currency: null,
        sourceRefs: [],
      },
      {
        code: 'lines',
        label: 'Líneas de movimiento (alcance)',
        value: (movements || []).length,
        unit: 'count',
        currency: null,
        sourceRefs: [],
      },
      {
        code: 'negative',
        label: 'Productos con saldo negativo',
        value: negatives.length,
        unit: 'count',
        currency: null,
        sourceRefs: [],
      },
    ],
    sections,
    warnings,
    methodology: [
      'Fecha efectiva = moved_at si existe; si no, created_at.',
      'Saldo inicial = Kardex de movimientos previos al inicio del período.',
      'Valoración por línea = qty × unit_cost sellado; N/D si falta unit_cost.',
      'No se utiliza products.avg_cost actual.',
      'Doc./Tx solo si movements.document_id o transaction_id existen.',
    ],
    metadata: [
      { label: 'Período', value: periodLabel },
      { label: 'Fecha de emisión', value: reportDate },
      { label: 'Fuente', value: 'movements (unit_cost histórico)' },
      {
        label: 'Moneda(s)',
        value: [...new Set(books.map((b) => b.currency).filter(Boolean))].join(' / ') || '—',
      },
    ],
  })
}
