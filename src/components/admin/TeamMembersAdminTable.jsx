import { Ban, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'
import { listTeamMembers, ACCOUNT_STATE } from '@/services/adminUsers'

// Estado de la membresía (team_members.status) en tono neutro.
const MEMBERSHIP_LABEL = { active: 'Activo', pending: 'Pendiente', revoked: 'Revocado' }

// Listado GLOBAL de subcuentas de equipo (todos los negocios) con acciones de
// suspender / reactivar / eliminar. Mobile-first: apila en móvil, sin overflow.
export function TeamMembersAdminTable({ search, status, businessId = null, onMeta, onSetStatus, onDelete }) {
  return (
    <ResponsiveListing
      queryKey={['admin-team-members', businessId || 'all', search || '', status || 'all']}
      queryFn={({ page, pageSize }) => listTeamMembers({ businessId, search, status, page, pageSize })}
      onMeta={onMeta}
      emptyMessage="No hay subcuentas de equipo para mostrar"
      getItemKey={(m) => m.team_member_id}
      renderItem={(m) => {
        const acc = ACCOUNT_STATE[m.account_status] || {}
        const isSuspended = m.account_status === 'suspended'
        const noAccount = !m.member_id // invitación pendiente sin cuenta real
        return (
          <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium">{m.member_email}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${acc.cls || ''}`}>
                  {acc.label || m.account_status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {m.role || 'Sin rol'} · {MEMBERSHIP_LABEL[m.membership_status] || m.membership_status}
                <span className="block truncate sm:inline"> · Negocio: {m.owner_email || m.business_id}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t pt-3 sm:justify-end sm:border-0 sm:pt-0">
              {isSuspended ? (
                <Button variant="outline" size="sm" disabled={noAccount}
                  onClick={() => onSetStatus?.(m, 'active')}>
                  <RotateCcw className="mr-1.5 h-4 w-4" />Reactivar
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled={noAccount}
                  onClick={() => onSetStatus?.(m, 'suspended')}>
                  <Ban className="mr-1.5 h-4 w-4" />Suspender
                </Button>
              )}
              <Button variant="destructive" size="sm" disabled={noAccount}
                onClick={() => onDelete?.(m)}>
                <Trash2 className="mr-1.5 h-4 w-4" />Eliminar
              </Button>
            </div>
          </div>
        )
      }}
    />
  )
}
