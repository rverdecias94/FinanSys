import { useQuery } from '@tanstack/react-query'
import { Loader2, Ban, RotateCcw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getBusinessDetail, CYCLE_LABEL, PAYMENT_STATE } from '@/services/adminBusinesses'
import { ACCOUNT_STATE } from '@/services/adminUsers'

function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="grid gap-1 rounded-md border p-3">
      <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{title}</div>
      {children}
    </div>
  )
}

const fmt = (d) => {
  try { return new Date(d).toLocaleDateString('es-ES') } catch { return '-' }
}

export function BusinessDetailDialog({ open, onOpenChange, businessId, onSetStatus, onDelete, statusPending }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-business-detail', businessId],
    queryFn: () => getBusinessDetail(businessId),
    enabled: open && !!businessId
  })

  const sub = data?.subscription
  const ps = PAYMENT_STATE[data?.payment_state] || {}
  const acc = ACCOUNT_STATE[data?.account_status] || {}
  const isSuspended = data?.account_status === 'suspended'
  const owner = data ? { business_id: data.business_id, email: data.email } : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Detalle del negocio</DialogTitle>
          <DialogDescription className="truncate">{data?.email || businessId}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={sub?.plan_id === 'premium' ? 'default' : 'secondary'}>{sub?.plan_id || '-'}</Badge>
              {data?.payment_state && (
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${ps.cls || ''}`}>{ps.label || data.payment_state}</span>
              )}
              {data?.account_status && data.account_status !== 'active' && (
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${acc.cls || ''}`}>{acc.label || data.account_status}</span>
              )}
              {sub?.billing_cycle && <span className="text-xs text-muted-foreground">{CYCLE_LABEL[sub.billing_cycle] || sub.billing_cycle}</span>}
            </div>

            <Section title="Suscripción">
              <Row k="Vencimiento" v={sub?.current_period_end ? fmt(sub.current_period_end) : '—'} />
              <Row k="Estado" v={sub?.status || '-'} />
              <Row k="Origen" v={sub?.source || '-'} />
            </Section>

            <Section title={`Pagos (${data?.payments?.length || 0})`}>
              {(data?.payments || []).length === 0 ? (
                <div className="py-1 text-muted-foreground">Sin pagos registrados</div>
              ) : (
                data.payments.map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-2 border-b py-1.5 last:border-0">
                    <div className="min-w-0">
                      <div className="text-muted-foreground">
                        {fmt(p.paid_at)} · {CYCLE_LABEL[p.billing_cycle] || p.billing_cycle || '-'}
                      </div>
                      <div className="truncate text-xs text-muted-foreground/80">
                        {p.method || 'Método no indicado'}
                        {p.reference ? ` · Ref: ${p.reference}` : ''}
                        {(p.period_start || p.period_end) ? ` · ${fmt(p.period_start)} → ${fmt(p.period_end)}` : ''}
                      </div>
                    </div>
                    <span className="shrink-0 font-medium">${p.amount} {p.currency_code}</span>
                  </div>
                ))
              )}
            </Section>

            <Section title={`Equipo (${data?.members?.length || 0})`}>
              {(data?.members || []).length === 0 ? (
                <div className="py-1 text-muted-foreground">Sin miembros</div>
              ) : (
                data.members.map((m, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 border-b py-1.5 last:border-0">
                    <span className="truncate">{m.member_email}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                      {m.role || '—'}
                      {m.account_status === 'suspended' && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">Suspendida</span>
                      )}
                    </span>
                  </div>
                ))
              )}
            </Section>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {!isLoading && owner && (
            <div className="flex flex-wrap gap-2">
              {isSuspended ? (
                <Button variant="outline" size="sm" loading={statusPending} onClick={() => onSetStatus?.(owner, 'active')}>
                  <RotateCcw className="mr-1.5 h-4 w-4" />Reactivar
                </Button>
              ) : (
                <Button variant="outline" size="sm" loading={statusPending} onClick={() => onSetStatus?.(owner, 'suspended')}>
                  <Ban className="mr-1.5 h-4 w-4" />Suspender
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={() => onDelete?.(owner)}>
                <Trash2 className="mr-1.5 h-4 w-4" />Eliminar
              </Button>
            </div>
          )}
          <Button variant="outline" onClick={() => onOpenChange?.(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
