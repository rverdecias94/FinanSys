import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { RefreshCw } from 'lucide-react'
import { startOfDay, endOfDay } from 'date-fns'
import { toast } from 'sonner'
import {
  approvePlanChangeRequest,
  rejectPlanChangeRequest
} from '@/services/planRequests'
import { PlanRequestsTable } from '@/components/admin/PlanRequestsTable'
import { PlanRequestDetailsDialog } from '@/components/admin/PlanRequestDetailsDialog'
import { ApprovePlanRequestDialog } from '@/components/admin/ApprovePlanRequestDialog'
import { RejectPlanRequestDialog } from '@/components/admin/RejectPlanRequestDialog'
import { AdminSetBusinessPlanCard } from '@/components/admin/AdminSetBusinessPlanCard'

export default function AdminPlans() {
  const qc = useQueryClient()

  const [status, setStatus] = useState('pending')
  const [requestedPlanId, setRequestedPlanId] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [fromDate, setFromDate] = useState(null)
  const [toDate, setToDate] = useState(null)
  const [totalCount, setTotalCount] = useState(0)

  const [detailsRequest, setDetailsRequest] = useState(null)
  const [approveRequest, setApproveRequest] = useState(null)
  const [rejectRequest, setRejectRequest] = useState(null)

  const dateRange = useMemo(() => {
    return {
      startDate: fromDate ? startOfDay(fromDate).toISOString() : null,
      endDate: toDate ? endOfDay(toDate).toISOString() : null
    }
  }, [fromDate, toDate])

  const approveMutation = useMutation({
    mutationFn: ({ requestId, billingCycle, adminNotes }) => approvePlanChangeRequest({ requestId, billingCycle, adminNotes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-plan-change-requests'] })
      toast.success('Solicitud aprobada')
    }
  })

  const rejectMutation = useMutation({
    mutationFn: ({ requestId, adminNotes }) => rejectPlanChangeRequest({ requestId, adminNotes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-plan-change-requests'] })
      toast.success('Solicitud rechazada')
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Admin: Planes</h1>
          <p className="text-sm text-muted-foreground">Gestiona solicitudes Premium y ajustes manuales.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ['admin-plan-change-requests'] })}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Recargar
          </Button>
        </div>
      </div>

      <AdminSetBusinessPlanCard onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-plan-change-requests'] })} />

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Solicitudes de cambio de plan · {totalCount} registros</CardTitle>
          <div className="grid gap-3 md:grid-cols-6 items-end">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Buscar</Label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Email, teléfono, referencia o negocio"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="approved">Aprobadas</SelectItem>
                  <SelectItem value="rejected">Rechazadas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={requestedPlanId} onValueChange={setRequestedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="free">Gratuito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Desde</Label>
              <Calendar value={fromDate} onChange={setFromDate} placeholder="Desde" />
            </div>
            <div className="space-y-1.5">
              <Label>Hasta</Label>
              <Calendar value={toDate} onChange={setToDate} placeholder="Hasta" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <PlanRequestsTable
            status={status}
            requestedPlanId={requestedPlanId}
            searchTerm={searchTerm.trim()}
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            onMeta={({ count }) => setTotalCount(count)}
            onView={(r) => setDetailsRequest(r)}
            onApprove={(r) => setApproveRequest(r)}
            onReject={(r) => setRejectRequest(r)}
          />
        </CardContent>
      </Card>

      <PlanRequestDetailsDialog
        open={!!detailsRequest}
        onOpenChange={(open) => {
          if (!open) setDetailsRequest(null)
        }}
        request={detailsRequest}
      />

      <ApprovePlanRequestDialog
        open={!!approveRequest}
        onOpenChange={(open) => {
          if (!open) setApproveRequest(null)
        }}
        request={approveRequest}
        submitting={approveMutation.isPending}
        onApprove={async ({ requestId, billingCycle, adminNotes }) => {
          await approveMutation.mutateAsync({ requestId, billingCycle, adminNotes })
          setApproveRequest(null)
        }}
      />

      <RejectPlanRequestDialog
        open={!!rejectRequest}
        onOpenChange={(open) => {
          if (!open) setRejectRequest(null)
        }}
        request={rejectRequest}
        submitting={rejectMutation.isPending}
        onReject={async ({ requestId, adminNotes }) => {
          await rejectMutation.mutateAsync({ requestId, adminNotes })
          setRejectRequest(null)
        }}
      />
    </div>
  )
}

