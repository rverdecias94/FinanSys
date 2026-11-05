import { format } from 'date-fns'
import {
  buildKardexByProduct,
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
 * Valoración solo con unit_cost; si falta → N/D.
 */
export function buildKardexDocument({
  movements = [],
  dateFilter = null,
  company = null,
  generatedBy = null,
  productId = null,
} = {}) {
  const periodLabel = dateFilter?.label || 'Sin período'
  const reportDate = format(new Date(), 'dd/MM/yyyy')
  const all = buildKardexByProduct(movements)
  const books = productId != null
    ? all.filter((b) => b.productKey === String(productId))
    : all

  const warnings = []
  const incomplete = books.filter((b) => !b.valuationAvailable)
  if (incomplete.length) {
    warnings.push(
      `${incomplete.length} producto(s) sin valoración completa: falta unit_cost en una o más líneas. No se usa avg_cost actual.`
    )
  }
  if (!books.length) {
    warnings.push('No hay movimientos para armar Kardex en el alcance seleccionado.')
  }

  const sections = [
    {
      title: '0. Nota metodológica',
      content:
        `${DEFAULT_DISCLAIMER} El Kardex acumula cantidades por producto según fecha efectiva (moved_at o created_at). ` +
        'El valor de línea y saldo valorado solo existen cuando unit_cost está sellado en el movimiento. ' +
        'products.avg_cost actual no se utiliza para cortes históricos.',
    },
    {
      title: '1. Alcance',
      content: `Libro de movimientos de almacén — ${periodLabel}. ${books.length} producto(s). Las cantidades de productos distintos no son sumables entre sí.`,
    },
  ]

  for (const book of books) {
    const headers = [
      'Fecha efectiva',
      'ID mov.',
      'Entrada',
      'Salida',
      'Saldo qty',
      'Coste unit.',
      'Valor línea',
      'Saldo valor',
    ]
    const rows = book.rows.map((r) => [
      fmtDate(r.effectiveAt),
      r.movementId != null ? String(r.movementId) : '—',
      r.qtyIn != null ? String(r.qtyIn) : '—',
      r.qtyOut != null ? String(r.qtyOut) : '—',
      String(r.balanceQty),
      r.unitCost != null ? String(r.unitCost) : 'N/D',
      r.lineValue != null ? formatValuation(r.lineValue, true) : 'N/D',
      r.balanceValue != null ? formatValuation(r.balanceValue, true) : 'N/D',
    ])

    sections.push({
      title: `Kardex — ${book.productName}${book.sku ? ` [${book.sku}]` : ''}`,
      type: 'table',
      headers,
      rows: rows.length ? rows : [['—', '—', '—', '—', '0', 'N/D', 'N/D', 'N/D']],
      notes: book.valuationAvailable
        ? `Saldo final: ${book.finalQty} · Valor final: ${formatValuation(book.finalValue, true)}${book.currency ? ` ${book.currency}` : ''}`
        : `Saldo final qty: ${book.finalQty} · Valor final: N/D (${book.missingCostLines} línea(s) sin unit_cost)`,
    })
  }

  return createReportDocument({
    type: REPORT_TYPES.KARDEX,
    title: 'Libro de movimientos (Kardex)',
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
      valuation: books.some((b) => b.valuationAvailable) ? 'wac_sealed_unit_cost' : 'none',
      currencyMode: 'native',
      dateField: 'moved_at_or_created_at',
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
        label: 'Líneas de movimiento',
        value: (movements || []).length,
        unit: 'count',
        currency: null,
        sourceRefs: [],
      },
    ],
    sections,
    warnings,
    methodology: [
      'Fecha efectiva = moved_at si existe; si no, created_at.',
      'Valoración por línea = qty × unit_cost sellado en el movimiento.',
      'Si falta unit_cost en cualquier línea del producto, el saldo valorado es N/D.',
      'No se utiliza products.avg_cost actual para reconstruir el pasado.',
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
