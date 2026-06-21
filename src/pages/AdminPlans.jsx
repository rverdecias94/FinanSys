import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar } from '@/components/ui/calendar'
import { RefreshCw } from 'lucide-react'
import { startOfDay, endOfDay } from 'date-fns'
import { toast } from 'sonner'
import {
  approvePlanChangeRequest,
  rejectPlanChangeRequest
} from '@/services/planRequests'
import { setPaymentDate, adminRecordPayment } from '@/services/adminBusinesses'
import { setAccountStatus, deleteUser, previewUserDeletion } from '@/services/adminUsers'
import { PlanRequestsTable } from '@/components/admin/PlanRequestsTable'
import { PlanRequestDetailsDialog } from '@/components/admin/PlanRequestDetailsDialog'
import { ApprovePlanRequestDialog } from '@/components/admin/ApprovePlanRequestDialog'
import { RejectPlanRequestDialog } from '@/components/admin/RejectPlanRequestDialog'
import { AdminSetBusinessPlanCard } from '@/components/admin/AdminSetBusinessPlanCard'
import { BusinessesTable } from '@/components/admin/BusinessesTable'
import { BusinessDetailDialog } from '@/components/admin/BusinessDetailDialog'
import { SetPaymentDateDialog } from '@/components/admin/SetPaymentDateDialog'
import { RecordPaymentDialog } from '@/components/admin/RecordPaymentDialog'
import { TeamMembersAdminTable } from '@/components/admin/TeamMembersAdminTable'
import { ConfirmDeleteUserDialog } from '@/components/admin/ConfirmDeleteUserDialog'

export default function AdminPlans() {
  const qc = useQueryClient()

  // --- Solicitudes ---
  const [status, setStatus] = useState('pending')
  const [requestedPlanId, setRequestedPlanId] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [fromDate, setFromDate] = useState(null)
  const [toDate, setToDate] = useState(null)
  const [totalCount, setTotalCount] = useState(0)
  const [detailsRequest, setDetailsRequest] = useState(null)
  const [approveRequest, setApproveRequest] = useState(null)
  const [rejectRequest, setRejectRequest] = useState(null)

  // --- Negocios ---
  const [bizSearch, setBizSearch] = useState('')
  const [bizPlan, setBizPlan] = useState('all')
  const [bizState, setBizState] = useState('all')
  const [bizTotal, setBizTotal] = useState(0)
  const [detailBizId, setDetailBizId] = useState(null)
  const [setDateBiz, setSetDateBiz] = useState(null)
  const [recordPayBiz, setRecordPayBiz] = useState(null)

  // --- Equipo ---
  const [teamSearch, setTeamSearch] = useState('')
  const [teamStatus, setTeamStatus] = useState('all')
  const [teamTotal, setTeamTotal] = useState(0)

  // Objetivo de borrado permanente (owner o miembro): { user_id, email }
  const [deleteTarget, setDeleteTarget] = useState(null)

  const dateRange = useMemo(() => ({
    startDate: fromDate ? startOfDay(fromDate).toISOString() : null,
    endDate: toDate ? endOfDay(toDate).toISOString() : null
  }), [fromDate, toDate])

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['admin-plan-change-requests'] })
    qc.invalidateQueries({ queryKey: ['admin-businesses'] })
    qc.invalidateQueries({ queryKey: ['admin-team-members'] })
  }

  const invalidateUsers = () => {
    qc.invalidateQueries({ queryKey: ['admin-businesses'] })
    qc.invalidateQueries({ queryKey: ['admin-business-detail'] })
    qc.invalidateQueries({ queryKey: ['admin-team-members'] })
    qc.invalidateQueries({ queryKey: ['accountStatus'] })
  }

  const approveMutation = useMutation({
    mutationFn: ({ requestId, billingCycle, adminNotes }) => approvePlanChangeRequest({ requestId, billingCycle, adminNotes }),
    onSuccess: () => { invalidateAll(); toast.success('Solicitud aprobada') }
  })

  const rejectMutation = useMutation({
    mutationFn: ({ requestId, adminNotes }) => rejectPlanChangeRequest({ requestId, adminNotes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-plan-change-requests'] }); toast.success('Solicitud rechazada') }
  })

  const setDateMutation = useMutation({
    mutationFn: ({ businessId, newPeriodEnd }) => setPaymentDate({ businessId, newPeriodEnd }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-businesses'] })
      qc.invalidateQueries({ queryKey: ['admin-business-detail'] })
      toast.success('Fecha de pago actualizada')
    },
    onError: (e) => toast.error('No se pudo cambiar la fecha', { description: e?.message })
  })

  const recordPayMutation = useMutation({
    mutationFn: (payload) => adminRecordPayment(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-businesses'] })
      qc.invalidateQueries({ queryKey: ['admin-business-detail'] })
      toast.success('Pago registrado')
    },
    onError: (e) => toast.error('No se pudo registrar el pago', { description: e?.message })
  })

  const setStatusMutation = useMutation({
    mutationFn: ({ targetUserId, status, reason }) => setAccountStatus({ targetUserId, status, reason }),
    onSuccess: (_data, vars) => {
      invalidateUsers()
      toast.success(vars.status === 'suspended' ? 'Cuenta suspendida' : 'Cuenta reactivada')
    },
    onError: (e) => toast.error('No se pudo cambiar el estado de la cuenta', { description: e?.message })
  })

  const deleteMutation = useMutation({
    mutationFn: (targetUserId) => deleteUser(targetUserId),
    onSuccess: (data) => {
      invalidateUsers()
      toast.success('Usuario eliminado permanentemente', { description: data?.email })
    },
    onError: (e) => toast.error('No se pudo eliminar el usuario', { description: e?.message })
  })

  // Previsualización del impacto del borrado (solo cuando hay objetivo seleccionado).
  const { data: deletionPreview, isLoading: loadingPreview } = useQuery({
    queryKey: ['admin-user-deletion-preview', deleteTarget?.user_id],
    queryFn: () => previewUserDeletion(deleteTarget.user_id),
    enabled: !!deleteTarget?.user_id
  })

  const handleSetStatus = (target, status) =>
    setStatusMutation.mutate({
      targetUserId: target.user_id,
      status,
      reason: status === 'suspended' ? 'Suspendida por el administrador' : null
    })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Admin: Planes</h1>
          <p className="text-sm text-muted-foreground">Gestiona solicitudes Premium, negocios y pagos.</p>
        </div>
        <Button variant="outline" onClick={invalidateAll}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Recargar
        </Button>
      </div>

      <AdminSetBusinessPlanCard onSuccess={invalidateAll} />

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Solicitudes</TabsTrigger>
          <TabsTrigger value="businesses">Negocios</TabsTrigger>
          <TabsTrigger value="team">Equipo</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle>Solicitudes de cambio de plan · {totalCount} registros</CardTitle>
              <div className="grid items-end gap-3 md:grid-cols-6">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Buscar</Label>
                  <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Email, teléfono, referencia o negocio" />
                </div>
                <div className="space-y-1.5">
                  <Label>Estado</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
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
                    <SelectTrigger><SelectValue placeholder="Plan" /></SelectTrigger>
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
        </TabsContent>

        <TabsContent value="businesses">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle>Negocios · {bizTotal} registros</CardTitle>
              <div className="grid items-end gap-3 md:grid-cols-4">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Buscar</Label>
                  <Input value={bizSearch} onChange={(e) => setBizSearch(e.target.value)} placeholder="Email o ID de negocio" />
                </div>
                <div className="space-y-1.5">
                  <Label>Plan</Label>
                  <Select value={bizPlan} onValueChange={setBizPlan}>
                    <SelectTrigger><SelectValue placeholder="Plan" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="free">Gratuito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Estado de pago</Label>
                  <Select value={bizState} onValueChange={setBizState}>
                    <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="ok">Al día</SelectItem>
                      <SelectItem value="due_soon">Por vencer</SelectItem>
                      <SelectItem value="grace">En gracia</SelectItem>
                      <SelectItem value="blocked">Bloqueado</SelectItem>
                      <SelectItem value="free">Gratis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <BusinessesTable
                search={bizSearch.trim()}
                plan={bizPlan}
                paymentState={bizState}
                onMeta={({ count }) => setBizTotal(count)}
                onView={(b) => setDetailBizId(b.business_id)}
                onSetDate={(b) => setSetDateBiz(b)}
                onRecordPayment={(b) => setRecordPayBiz(b)}
                onSetStatus={(b, status) => handleSetStatus({ user_id: b.business_id, email: b.email }, status)}
                onDelete={(b) => setDeleteTarget({ user_id: b.business_id, email: b.email })}
                statusPending={setStatusMutation.isPending}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle>Subcuentas de equipo · {teamTotal} registros</CardTitle>
              <div className="grid items-end gap-3 md:grid-cols-4">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Buscar</Label>
                  <Input value={teamSearch} onChange={(e) => setTeamSearch(e.target.value)} placeholder="Email del miembro o del negocio" />
                </div>
                <div className="space-y-1.5">
                  <Label>Estado de cuenta</Label>
                  <Select value={teamStatus} onValueChange={setTeamStatus}>
                    <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Activas</SelectItem>
                      <SelectItem value="suspended">Suspendidas</SelectItem>
                      <SelectItem value="deleted">Eliminadas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <TeamMembersAdminTable
                search={teamSearch.trim()}
                status={teamStatus}
                onMeta={({ count }) => setTeamTotal(count)}
                onSetStatus={(m, status) => handleSetStatus({ user_id: m.member_id, email: m.member_email }, status)}
                onDelete={(m) => setDeleteTarget({ user_id: m.member_id, email: m.member_email })}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogos de solicitudes */}
      <PlanRequestDetailsDialog
        open={!!detailsRequest}
        onOpenChange={(open) => { if (!open) setDetailsRequest(null) }}
        request={detailsRequest}
      />
      <ApprovePlanRequestDialog
        open={!!approveRequest}
        onOpenChange={(open) => { if (!open) setApproveRequest(null) }}
        request={approveRequest}
        submitting={approveMutation.isPending}
        onApprove={async ({ requestId, billingCycle, adminNotes }) => {
          await approveMutation.mutateAsync({ requestId, billingCycle, adminNotes })
          setApproveRequest(null)
        }}
      />
      <RejectPlanRequestDialog
        open={!!rejectRequest}
        onOpenChange={(open) => { if (!open) setRejectRequest(null) }}
        request={rejectRequest}
        submitting={rejectMutation.isPending}
        onReject={async ({ requestId, adminNotes }) => {
          await rejectMutation.mutateAsync({ requestId, adminNotes })
          setRejectRequest(null)
        }}
      />

      {/* Diálogos de negocios */}
      <BusinessDetailDialog
        open={!!detailBizId}
        onOpenChange={(open) => { if (!open) setDetailBizId(null) }}
        businessId={detailBizId}
        statusPending={setStatusMutation.isPending}
        onSetStatus={(b, status) => handleSetStatus({ user_id: b.business_id, email: b.email }, status)}
        onDelete={(b) => { setDeleteTarget({ user_id: b.business_id, email: b.email }); setDetailBizId(null) }}
      />
      <SetPaymentDateDialog
        open={!!setDateBiz}
        onOpenChange={(open) => { if (!open) setSetDateBiz(null) }}
        business={setDateBiz}
        submitting={setDateMutation.isPending}
        onConfirm={async (payload) => {
          await setDateMutation.mutateAsync(payload)
          setSetDateBiz(null)
        }}
      />
      <RecordPaymentDialog
        open={!!recordPayBiz}
        onOpenChange={(open) => { if (!open) setRecordPayBiz(null) }}
        business={recordPayBiz}
        submitting={recordPayMutation.isPending}
        onConfirm={async (payload) => {
          await recordPayMutation.mutateAsync(payload)
          setRecordPayBiz(null)
        }}
      />

      {/* Borrado permanente (owner o miembro) */}
      <ConfirmDeleteUserDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        target={deleteTarget}
        preview={deletionPreview}
        loadingPreview={loadingPreview}
        submitting={deleteMutation.isPending}
        onConfirm={async ({ targetUserId }) => {
          await deleteMutation.mutateAsync(targetUserId)
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
