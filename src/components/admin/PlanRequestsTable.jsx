/* eslint-disable react/prop-types */
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, ThumbsDown, ThumbsUp, CreditCard } from 'lucide-react'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'
import { listPlanChangeRequests } from '@/services/planRequests'

function statusVariant(status) {
  if (status === 'pending') return 'secondary'
  if (status === 'approved') return 'default'
  if (status === 'rejected') return 'destructive'
  return 'outline'
}

export function PlanRequestsTable({
  enabled = true,
  status,
  requestedPlanId,
  searchTerm,
  startDate,
  endDate,
  onMeta,
  onView,
  onApprove,
  onReject,
}) {
  const queryKey = useMemo(
    () => [
      'admin-plan-change-requests',
      { status, requestedPlanId, searchTerm, startDate, endDate },
    ],
    [status, requestedPlanId, searchTerm, startDate, endDate]
  )

  const renderRequest = (r) => {
    const created = r?.created_at ? new Date(r.created_at).toLocaleString('es-ES') : '-'
    const canProcess = r?.status === 'pending'
    const title = r.contact_email || `${String(r.business_id || '').slice(0, 8)}...` || 'Solicitud'
    const subtitle = [
      r.requested_plan_id ? `Plan ${r.requested_plan_id}` : null,
      r.requested_months ? `${r.requested_months} mes(es)` : null,
      created,
    ]
      .filter(Boolean)
      .join(' · ')

    return (
      <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <div className="shrink-0 rounded-full bg-primary/10 p-2">
            <CreditCard className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-medium break-words capitalize">{title}</div>
            <div className="text-sm text-muted-foreground">{subtitle}</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-3 sm:shrink-0 sm:justify-end sm:gap-4 sm:border-0 sm:pt-0">
          <Badge variant={statusVariant(r.status)} className="capitalize">
            {r.status}
          </Badge>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => onView?.(r)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={!canProcess} onClick={() => onApprove?.(r)}>
              <ThumbsUp className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={!canProcess} onClick={() => onReject?.(r)}>
              <ThumbsDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ResponsiveListing
      queryKey={queryKey}
      queryFn={({ page, pageSize }) =>
        listPlanChangeRequests({
          status,
          requestedPlanId,
          searchTerm,
          startDate,
          endDate,
          page,
          pageSize,
        })
      }
      enabled={enabled}
      getItemKey={(r) => r.id}
      renderItem={renderRequest}
      onMeta={onMeta}
      emptyMessage="No hay solicitudes con los filtros actuales."
      loadingMessage="Cargando solicitudes..."
    />
  )
}
