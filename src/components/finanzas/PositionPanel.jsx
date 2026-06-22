import { Wallet } from 'lucide-react'

// Posición simplificada (Q5): una tarjeta por moneda. El saldo de GESTIA es DEVENGADO
// (ya incluye lo pendiente), así que la cifra destacada es la CAJA REAL hoy
// (= saldo − por cobrar + por pagar) y debajo el desglose. Layout de filas para no
// desbordar con saldos grandes.
export function PositionPanel({ rows = [], formatCurrency, loading = false, emptyMessage }) {
  if (loading) {
    return <p className="py-2 text-sm text-muted-foreground">Cargando posición…</p>
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
              <Wallet className="h-3.5 w-3.5 text-primary" /> Caja real hoy · {r.currency}
            </span>
            <span className="text-lg font-bold tabular-nums">{formatCurrency(r.caja, r.currency)}</span>
          </div>
          <div className="space-y-1.5 border-t pt-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Saldo registrado</span>
              <span className="font-medium tabular-nums">{formatCurrency(r.saldo, r.currency)}</span>
            </div>
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
            Caja real = saldo − por cobrar + por pagar (lo que te deben aún no entró; lo que debes aún no salió).
          </p>
        </div>
      ))}
    </div>
  )
}
