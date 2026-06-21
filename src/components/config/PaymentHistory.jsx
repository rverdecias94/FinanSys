import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useBusiness } from '@/context/BusinessContext'
import { getMyPayments } from '@/services/billing'

const CYCLE_LABEL = { monthly: 'Mensual', quarterly: 'Trimestral', annual: 'Anual' }
const METHOD_LABEL = { transferencia: 'Transferencia', efectivo: 'Efectivo', acuerdo: 'Acuerdo comercial', otro: 'Otro' }
const PAGE_SIZE = 100

const fmt = (d) => {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('es-ES') } catch { return '—' }
}

// Historial de pagos del Premium (usuario). Mobile-first: apila en móvil.
// Se auto-oculta para cuentas sin pagos, salvo `alwaysShow` (plan Premium activo),
// donde muestra un estado vacío informativo. La RLS de `payments` (vía
// get_my_payments) garantiza que solo se ven los pagos del propio negocio.
export function PaymentHistory({ alwaysShow = false }) {
  const { businessId } = useBusiness()
  const { data, isLoading } = useQuery({
    queryKey: ['my-payments', businessId],
    queryFn: () => getMyPayments({ businessId, page: 1, pageSize: PAGE_SIZE }),
    enabled: !!businessId
  })

  if (!businessId) return null

  // Mientras carga, no parpadear para cuentas normales; solo Premium muestra el marco.
  if (isLoading && !alwaysShow) return null

  const payments = data?.data || []
  const total = Number(data?.count || 0)
  if (!isLoading && payments.length === 0 && !alwaysShow) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial de pagos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : payments.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Aún no hay pagos registrados.</div>
        ) : (
          <>
            {payments.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{fmt(p.paid_at)}</span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {CYCLE_LABEL[p.billing_cycle] || p.billing_cycle || '—'}
                    </span>
                    {p.status === 'refunded' ? (
                      <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Reembolsado</span>
                    ) : (
                      <span className="rounded bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Pagado</span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {METHOD_LABEL[p.method] || p.method || 'Método no indicado'}
                    {p.reference ? ` · Ref: ${p.reference}` : ''}
                    {(p.period_start || p.period_end) ? ` · ${fmt(p.period_start)} → ${fmt(p.period_end)}` : ''}
                  </div>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <span className="text-base font-semibold">${p.amount}</span>
                  <span className="ml-1 text-xs text-muted-foreground">{p.currency_code}</span>
                </div>
              </div>
            ))}
            {total > payments.length && (
              <p className="pt-1 text-center text-xs text-muted-foreground">
                Mostrando los {payments.length} pagos más recientes de {total}.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
