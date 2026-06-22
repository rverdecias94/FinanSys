import { Badge } from '@/components/ui/badge'
import { AGING_BUCKETS, agingOverdue, agingHasData } from '@/utils/aging'

// Tono por tramo cuando hay saldo (>0): "por vencer" neutro; severidad creciente
// hacia el rojo. Si el tramo está en 0 se atenúa (muted) para dirigir la atención.
const BUCKET_TONE = {
  not_due:   'text-foreground',
  d_1_30:    'text-warning',
  d_31_60:   'text-warning',
  d_61_90:   'text-destructive',
  d_over_90: 'text-destructive',
}

// Panel de antigüedad de saldos (Q10): una tarjeta por moneda con el total y el
// desglose por tramos. Mobile-first: los chips de tramo se apilan en 2 columnas a
// 375px y se expanden a 5 en desktop, todos de igual altura (grid + flex-col).
export function AgingPanel({ rows = [], formatCurrency, income = true, loading = false, emptyMessage }) {
  if (loading) {
    return <p className="py-2 text-sm text-muted-foreground">Cargando antigüedad…</p>
  }
  if (!agingHasData(rows)) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        {emptyMessage || 'No hay saldos pendientes que clasificar.'}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {rows.filter((r) => Number(r.total) > 0).map((r) => {
        const overdue = agingOverdue(r)
        return (
          <div key={r.currency} className="rounded-lg border p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-muted-foreground">{r.currency}</span>
                <span className={`text-lg font-bold tabular-nums ${income ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(Number(r.total), r.currency)}
                </span>
              </div>
              {overdue > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  Vencido {formatCurrency(overdue, r.currency)}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {AGING_BUCKETS.map((b) => {
                const val = Number(r[b.key] || 0)
                const tone = val > 0 ? BUCKET_TONE[b.key] : 'text-muted-foreground'
                return (
                  <div key={b.key} className="flex flex-col rounded-md bg-muted/40 px-2.5 py-2 text-center">
                    <span className="text-[11px] leading-tight text-muted-foreground">{b.label}</span>
                    <span className={`mt-0.5 text-sm font-semibold tabular-nums ${tone}`}>
                      {formatCurrency(val, r.currency)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
