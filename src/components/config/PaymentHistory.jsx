import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'
import { useBusiness } from '@/context/BusinessContext'
import { getMyPayments } from '@/services/billing'
import { BILLING_CYCLE_LABEL, PAYMENT_METHOD_LABEL } from '@/lib/billingLabels'

const fmt = (d) => {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('es-ES') } catch { return '—' }
}

function PaymentRow({ p }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{fmt(p.paid_at)}</span>
          <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {BILLING_CYCLE_LABEL[p.billing_cycle] || p.billing_cycle || '—'}
          </span>
          {p.status === 'refunded' ? (
            <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Reembolsado</span>
          ) : (
            <span className="rounded bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Pagado</span>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {PAYMENT_METHOD_LABEL[p.method] || p.method || 'Método no indicado'}
          {p.reference ? ` · Ref: ${p.reference}` : ''}
          {(p.period_start || p.period_end) ? ` · ${fmt(p.period_start)} → ${fmt(p.period_end)}` : ''}
        </div>
      </div>
      <div className="shrink-0 text-left sm:text-right">
        <span className="text-base font-semibold">${p.amount}</span>
        <span className="ml-1 text-xs text-muted-foreground">{p.currency_code}</span>
      </div>
    </div>
  )
}

// Historial de pagos del Premium (Fase 7). Paginado con ResponsiveListing.
// Miembros con config.view ven el historial (RLS); solo el titular cambia de plan.
export function PaymentHistory({ alwaysShow = false }) {
  const { businessId } = useBusiness()

  const { data: firstPage, isLoading } = useQuery({
    queryKey: ['my-payments-head', businessId],
    queryFn: () => getMyPayments({ businessId, page: 1, pageSize: 1 }),
    enabled: !!businessId
  })

  if (!businessId) return null

  const total = Number(firstPage?.count || 0)
  if (!alwaysShow && !isLoading && total === 0) return null
  if (isLoading && !alwaysShow) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial de pagos</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && alwaysShow ? (
          <div className="space-y-2" role="status" aria-label="Cargando pagos">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
            ))}
          </div>
        ) : (
          <ResponsiveListing
            queryKey={['my-payments', businessId]}
            queryFn={({ page, pageSize }) => getMyPayments({ businessId, page, pageSize })}
            getItemKey={(p) => p.id}
            emptyMessage="Aún no hay pagos registrados."
            showSummary={false}
            renderItem={(p) => <PaymentRow p={p} />}
          />
        )}
      </CardContent>
    </Card>
  )
}
