import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import {
  approvePlanChangeRequest,
  expirePastDueSubscriptions,
  listPlanChangeRequests,
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
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [detailsRequest, setDetailsRequest] = useState(null)
  const [approveRequest, setApproveRequest] = useState(null)
  const [rejectRequest, setRejectRequest] = useState(null)

  const dateRange = useMemo(() => {
    const startDate = fromDate ? new Date(`${fromDate}T00:00:00`) : null
    const endDate = toDate ? new Date(`${toDate}T23:59:59.999`) : null
    return {
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null
    }
  }, [fromDate, toDate])

  const filtersKey = useMemo(() => {
    return {
      status,
      requestedPlanId,
      searchTerm: searchTerm.trim(),
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    }
  }, [dateRange.endDate, dateRange.startDate, requestedPlanId, searchTerm, status])

  const requestsQuery = useQuery({
    queryKey: ['admin-plan-change-requests', filtersKey, page, pageSize],
    queryFn: () => listPlanChangeRequests({
      status,
      requestedPlanId,
      searchTerm,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      page,
      pageSize
    }),
    keepPreviousData: true
  })

  const totalCount = Number(requestsQuery.data?.count || 0)
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const approveMutation = useMutation({
    mutationFn: ({ requestId, approvedMonths, adminNotes }) => approvePlanChangeRequest({ requestId, approvedMonths, adminNotes }),
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

  const expireMutation = useMutation({
    mutationFn: () => expirePastDueSubscriptions(),
    onSuccess: (affected) => {
      toast.success('Vencimiento ejecutado', { description: `Suscripciones actualizadas: ${affected}` })
      qc.invalidateQueries({ queryKey: ['admin-plan-change-requests'] })
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Admin: Planes</h1>
          <p className="text-sm text-muted-foreground">Gestiona solicitudes Premium, ajustes manuales y vencimientos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => requestsQuery.refetch()}
            disabled={requestsQuery.isFetching}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Recargar
          </Button>
          <Button
            variant="secondary"
            onClick={() => expireMutation.mutate()}
            disabled={expireMutation.isPending}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Vencer Premium
          </Button>
        </div>
      </div>

      <AdminSetBusinessPlanCard onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-plan-change-requests'] })} />

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Solicitudes de cambio de plan</CardTitle>
          <div className="grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setPage(1)
                }}
                placeholder="Buscar por email, teléfono, referencia o negocio"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v)
                setPage(1)
              }}
            >
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
            <Select
              value={requestedPlanId}
              onValueChange={(v) => {
                setRequestedPlanId(v)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="free">Gratuito</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value)
                setPage(1)
              }}
            />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value)
                setPage(1)
              }}
            />
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v))
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <PlanRequestsTable
            loading={requestsQuery.isLoading}
            requests={requestsQuery.data?.data || []}
            onView={(r) => setDetailsRequest(r)}
            onApprove={(r) => setApproveRequest(r)}
            onReject={(r) => setRejectRequest(r)}
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Página {page} de {totalPages} · {totalCount} registros
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || requestsQuery.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={page >= totalPages || requestsQuery.isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>
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
        onApprove={async ({ requestId, approvedMonths, adminNotes }) => {
          await approveMutation.mutateAsync({ requestId, approvedMonths, adminNotes })
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

