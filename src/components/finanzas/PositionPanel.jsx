import { Wallet } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

// P0-005: business_balances = caja cobrada. CxC/CxP son contexto, no recalculan la cifra.
export function PositionPanel({ rows = [], formatCurrency, loading = false, emptyMessage }) {
  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-label="Cargando posición">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    )
  }
  if (!rows.length) {
    return <p className="py-2 text-sm text-muted-foreground">{emptyMessage || 'Aún no hay saldos ni cuentas para mostrar.'}</p>
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.currency} className="rounded-lg border p-3 sm:p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Wallet className="h-3.5 w-3.5 text-primary" /> Caja cobrada · {r.currency}
            </span>
            <span className={`text-lg font-bold tabular-nums ${r.caja < 0 ? 'text-destructive' : ''}`}>
              {r.caja < 0 ? '−' : ''}{formatCurrency(Math.abs(r.caja), r.currency)}
            </span>
          </div>
          <div className="space-y-1.5 border-t pt-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Por cobrar</span>
              <span className="font-medium tabular-nums text-success">+{formatCurrency(r.porCobrar, r.currency)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Por pagar</span>
              <span className="font-medium tabular-nums text-destructive">−{formatCurrency(r.porPagar, r.currency)}</span>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            Solo cuenta lo cobrado/pagado. Lo pendiente aparece aparte y no mueve la caja hasta el abono.
          </p>
        </div>
      ))}
    </div>
  )
}
