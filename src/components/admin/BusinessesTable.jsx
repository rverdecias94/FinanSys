import { Eye, CalendarClock, Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'
import { listBusinesses, CYCLE_LABEL, PAYMENT_STATE } from '@/services/adminBusinesses'

const fmt = (d) => {
  try { return new Date(d).toLocaleDateString('es-ES') } catch { return '—' }
}

export function BusinessesTable({ search, plan, paymentState, onMeta, onView, onSetDate, onRecordPayment }) {
  return (
    <ResponsiveListing
      queryKey={['admin-businesses', search || '', plan || 'all', paymentState || 'all']}
      queryFn={({ page, pageSize }) => listBusinesses({ search, plan, paymentState, page, pageSize })}
      onMeta={onMeta}
      emptyMessage="No hay negocios para mostrar"
      getItemKey={(b) => b.business_id}
      renderItem={(b) => {
        const ps = PAYMENT_STATE[b.payment_state] || {}
        return (
          <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium">{b.email || b.business_id}</span>
                <Badge variant={b.plan_id === 'premium' ? 'default' : 'secondary'}>{b.plan_id}</Badge>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${ps.cls || ''}`}>{ps.label || b.payment_state}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {b.plan_id === 'premium'
                  ? `Ciclo ${CYCLE_LABEL[b.billing_cycle] || b.billing_cycle} · Vence ${b.current_period_end ? fmt(b.current_period_end) : '—'}`
                  : 'Plan gratuito'}
                {` · ${b.members} miembro(s)`}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t pt-3 sm:justify-end sm:border-0 sm:pt-0">
              <Button variant="outline" size="sm" onClick={() => onView?.(b)}>
                <Eye className="mr-1.5 h-4 w-4" />Detalle
              </Button>
              <Button variant="outline" size="sm" onClick={() => onSetDate?.(b)}>
                <CalendarClock className="mr-1.5 h-4 w-4" />Fecha
              </Button>
              <Button variant="outline" size="sm" onClick={() => onRecordPayment?.(b)}>
                <Receipt className="mr-1.5 h-4 w-4" />Pago
              </Button>
            </div>
          </div>
        )
      }}
    />
  )
}
