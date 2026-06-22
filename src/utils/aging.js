// Antigüedad de saldos (Q10): semántica compartida de tramos para la UI de Cuentas
// y el reporte exportable de Reportes. Los datos vienen de la RPC get_aging_report,
// agregados por moneda: cada fila =
//   { currency, not_due, d_1_30, d_31_60, d_61_90, d_over_90, total, cnt }

// Tramos en orden de severidad. `key` = columna de la RPC; `label` para la UI;
// `short` para móvil / encabezados de export.
export const AGING_BUCKETS = [
  { key: 'not_due',   label: 'Por vencer',      short: 'Por vencer' },
  { key: 'd_1_30',    label: '1-30 días',       short: '1-30' },
  { key: 'd_31_60',   label: '31-60 días',      short: '31-60' },
  { key: 'd_61_90',   label: '61-90 días',      short: '61-90' },
  { key: 'd_over_90', label: 'Más de 90 días',  short: '+90' },
]

// Tramos que representan saldo VENCIDO (excluye "por vencer").
export const OVERDUE_KEYS = ['d_1_30', 'd_31_60', 'd_61_90', 'd_over_90']

const num = (v) => Number(v || 0)

// Suma del saldo vencido de una fila (todos los tramos salvo "por vencer").
export function agingOverdue(row) {
  if (!row) return 0
  return OVERDUE_KEYS.reduce((acc, k) => acc + num(row[k]), 0)
}

// ¿Hay alguna cuenta pendiente con saldo en el reporte?
export function agingHasData(rows) {
  return Array.isArray(rows) && rows.some((r) => num(r.total) > 0)
}

// Total general por dirección, sumado por moneda: { USD: 1000, CUP: 5000, ... }.
export function agingTotalsByCurrency(rows) {
  const out = {}
  for (const r of rows || []) out[r.currency] = num(r.total)
  return out
}

// Filas planas para exportar (Excel/PDF). `income` solo afecta semántica de lectura.
export function agingToExportRows(rows) {
  return (rows || []).map((r) => ({
    Moneda: r.currency,
    'Por vencer': num(r.not_due),
    '1-30 días': num(r.d_1_30),
    '31-60 días': num(r.d_31_60),
    '61-90 días': num(r.d_61_90),
    'Más de 90 días': num(r.d_over_90),
    'Vencido total': agingOverdue(r),
    Total: num(r.total),
  }))
}
