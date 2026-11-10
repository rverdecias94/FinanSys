import { Ban, RotateCcw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'
import { listTeamMembers, ACCOUNT_STATE } from '@/services/adminUsers'

const MEMBERSHIP_LABEL = {
  active: 'Activo',
  pending: 'Pendiente',
  revoked: 'Revocado'
}

export function TeamMembersTable({
  search,
  accountStatus,
  onMeta,
  onSetStatus,
  onDelete,
  statusPending
}) {
  return (
    <ResponsiveListing
      queryKey={['admin-team-members', search || '', accountStatus || 'all']}
      queryFn={async ({ page, pageSize }) => {
        const res = await listTeamMembers({ search, status: accountStatus, page, pageSize })
        return { data: res.rows, count: res.total }
      }}
      onMeta={onMeta}
      emptyMessage="No hay miembros de equipo para mostrar"
      getItemKey={(m) => m.team_member_id || `${m.member_id}-${m.business_id}`}
      renderItem={(m) => {
        const acc = ACCOUNT_STATE[m.account_status] || ACCOUNT_STATE.active
        const isSuspended = m.account_status === 'suspended'
        const mem = MEMBERSHIP_LABEL[m.membership_status] || m.membership_status
        return (
          <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium">{m.member_email || m.member_id}</span>
                <Badge variant="secondary">{m.role || '—'}</Badge>
                <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{mem}</span>
                {m.account_status && m.account_status !== 'active' && (
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${acc.cls}`}>{acc.label}</span>
                )}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                Negocio: {m.owner_email || m.business_id}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t pt-3 sm:justify-end sm:border-0 sm:pt-0">
              {m.member_id ? (
                <>
                  {isSuspended ? (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={statusPending}
                      onClick={() => onSetStatus?.({ user_id: m.member_id, email: m.member_email }, 'active')}
                    >
                      <RotateCcw className="mr-1.5 h-4 w-4" />Reactivar
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={statusPending}
                      onClick={() => onSetStatus?.({ user_id: m.member_id, email: m.member_email }, 'suspended')}
                    >
                      <Ban className="mr-1.5 h-4 w-4" />Suspender
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete?.({ user_id: m.member_id, email: m.member_email })}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />Eliminar
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Invitación pendiente (sin cuenta)</span>
              )}
            </div>
          </div>
        )
      }}
    />
  )
}
