import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

// Flujo (Q5/E2): una tarjeta por moneda. Labels configurables para base registrada vs liquidada.
export function CashFlowPanel({
  rows = [],
  formatCurrency,
  loading = false,
  emptyMessage,
  netLabel = 'Flujo neto',
  inflowLabel = 'Entradas',
  outflowLabel = 'Salidas',
}) {
  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-label="Cargando flujo">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    )
  }
  if (!rows.length) {
    return <p className="py-2 text-sm text-muted-foreground">{emptyMessage || 'No hay movimientos en el período seleccionado.'}</p>
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const positive = r.net > 0
        const negative = r.net < 0
        return (
          <div key={r.currency} className="rounded-lg border p-3 sm:p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-muted-foreground">{r.currency}</span>
              <div className="flex items-center gap-1.5">
                {positive
                  ? <TrendingUp className="h-4 w-4 text-success" />
                  : negative
                    ? <TrendingDown className="h-4 w-4 text-destructive" />
                    : <Minus className="h-4 w-4 text-muted-foreground" />}
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wide leading-none text-muted-foreground">{netLabel}</div>
                  <div className={`text-lg font-bold tabular-nums ${positive ? 'text-success' : negative ? 'text-destructive' : ''}`}>
                    {positive ? '+' : negative ? '−' : ''}{formatCurrency(Math.abs(r.net), r.currency)}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-1.5 border-t pt-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground"><ArrowUpRight className="h-3.5 w-3.5 text-success" /> {inflowLabel}</span>
                <span className="font-medium tabular-nums text-success">+{formatCurrency(r.inflow, r.currency)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground"><ArrowDownRight className="h-3.5 w-3.5 text-destructive" /> {outflowLabel}</span>
                <span className="font-medium tabular-nums text-destructive">−{formatCurrency(r.outflow, r.currency)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
