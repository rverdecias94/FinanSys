import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserPlus, Trash2, Loader2, Shield, Mail } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession } from '@/hooks/useSession'
import { useSubscription } from '@/context/SubscriptionContext'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { getTeamMembers, inviteMember, removeMember, getRoles, updateMemberRole } from '@/services/team'
import { getSupabaseErrorMessage } from '@/services/notifications'
import { readLocalCache, writeLocalCache } from '@/offline/localCache'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'
import { useBusiness } from '@/context/BusinessContext'

export function TeamManagement() {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { subscription, PLAN_LIMITS } = useSubscription()
  const queryClient = useQueryClient()

  const [roles, setRoles] = useState([])
  const [memberCount, setMemberCount] = useState(0)

  const [inviteEmail, setInviteEmail] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState(null)

  const biz = businessId || session?.user?.id

  const allowedRole = (role) => String(role?.name || '').toLowerCase() !== 'visualizador'

  // Carga de roles (para el formulario de invitación y los selectores de rol).
  // Resiliente offline: si falla, usa la caché local (Capa B).
  useEffect(() => {
    if (!session?.user?.id) return
    let active = true
    const applyDefaultRole = (rolesList) => {
      if (rolesList.length > 0 && !selectedRole) {
        const def = rolesList.find(r => r.name === 'Consultor') || rolesList.find(r => r.name === 'Editor') || rolesList[0]
        setSelectedRole(def.id)
      }
    }
      ; (async () => {
        try {
          const rolesData = await getRoles()
          const nextRoles = (rolesData || []).filter(allowedRole)
          if (!active) return
          setRoles(nextRoles)
          applyDefaultRole(nextRoles)
          writeLocalCache(`team:roles:${biz}`, nextRoles)
        } catch {
          const cachedRoles = readLocalCache(`team:roles:${biz}`)
          if (active && cachedRoles) {
            setRoles(cachedRoles)
            applyDefaultRole(cachedRoles)
          }
        }
      })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, businessId])

  const membersQueryKey = useMemo(() => ['team', 'members', biz], [biz])

  // Lista de miembros vía ResponsiveListing. getTeamMembers no pagina → paginamos
  // en cliente (lista pequeña) y cacheamos para verla offline.
  const fetchMembersPage = async ({ page, pageSize }) => {
    let all
    try {
      all = await getTeamMembers(biz)
      writeLocalCache(`team:members:${biz}`, all || [])
    } catch {
      all = readLocalCache(`team:members:${biz}`) || []
    }
    all = all || []
    const from = (page - 1) * pageSize
    return { data: all.slice(from, from + pageSize), count: all.length }
  }

  const refreshMembers = () => queryClient.invalidateQueries({ queryKey: ['team', 'members', biz] })

  const handleInvite = async () => {
    const limit = PLAN_LIMITS?.[subscription?.plan_id || 'free']?.partners ?? 0
    if (memberCount >= limit) {
      toast.error('Has alcanzado el límite de miembros de equipo para tu plan.')
      return
    }

    if (!inviteEmail || !selectedRole) {
      toast.error('Email y rol son obligatorios')
      return
    }

    setInviteLoading(true)
    try {
      await inviteMember({
        email: inviteEmail,
        role_id: selectedRole,
        owner_id: biz,
        role_name: roles.find(r => r.id === selectedRole)?.name
      })

      setInviteEmail('')
      toast.success(`Socio agregado: ${inviteEmail}`, {
        description: 'Cuando el usuario se registre con este correo, se unirá automáticamente a tu equipo.'
      })
      refreshMembers()
    } catch (err) {
      const msg = getSupabaseErrorMessage(err)
      if (msg.includes('check_email_availability')) {
        toast.error('No se puede agregar a este usuario.', {
          description: 'El email ya está registrado como dueño de otro negocio o miembro de otro equipo.'
        })
      } else {
        toast.error('Error al agregar socio', { description: msg })
      }
    } finally {
      setInviteLoading(false)
    }
  }

  const handleDeleteMember = (member) => {
    setMemberToDelete(member)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!memberToDelete) return
    try {
      await removeMember(memberToDelete.id, memberToDelete.member_email)
      toast.success('Socio eliminado correctamente')
      refreshMembers()
    } catch (err) {
      toast.error('Error al eliminar socio')
    } finally {
      setDeleteConfirmOpen(false)
      setMemberToDelete(null)
    }
  }

  const handleRoleChange = async (memberId, newRoleId, memberEmail) => {
    try {
      const newRoleName = roles.find(r => r.id === newRoleId)?.name
      await updateMemberRole(memberId, newRoleId, { memberEmail, newRoleName })
      toast.success('Rol actualizado')
      refreshMembers()
    } catch {
      toast.error('Error al cambiar rol')
    }
  }

  const statusBadge = (status) => {
    if (status === 'active') return <Badge variant="default">Activo</Badge>
    if (status === 'revoked') return <Badge variant="outline" className="border-destructive/30 text-destructive">Revocado</Badge>
    return <Badge variant="secondary">Pendiente</Badge>
  }

  const renderMember = (m) => (
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <div className="shrink-0 rounded-full bg-primary/10 p-2">
          <Mail className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="break-all font-medium">{m.member_email}</div>
          <div className="mt-1">{statusBadge(m.status)}</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t pt-3 sm:shrink-0 sm:justify-end sm:gap-4 sm:border-0 sm:pt-0">
        <Select
          value={m.role_id}
          onValueChange={(val) => handleRoleChange(m.id, val, m.member_email)}
          disabled={m.status === 'pending'}
        >
          <SelectTrigger className="h-8 w-[160px]">
            <div className="flex items-center gap-2">
              {m.roles?.is_system && <Shield className="h-3 w-3 text-blue-500" />}
              <span className="truncate">{m.roles?.name || 'Sin rol'}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => handleDeleteMember(m)}
          aria-label={`Eliminar a ${m.member_email}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestión de Equipo</CardTitle>
        <CardDescription>Agrega miembros de equipo para colaborar en tu cuenta y asigna roles específicos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end bg-muted/20 p-4 rounded-lg border">
          <div className="space-y-2 flex-1 w-full">
            <Label>Email del socio</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="socio@ejemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={inviteLoading}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-2 w-full sm:w-[200px]">
            <Label>Rol Inicial</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole} disabled={inviteLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map(role => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleInvite} disabled={!inviteEmail || !selectedRole || inviteLoading} className="w-full sm:w-auto">
            {inviteLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Agregar Socio
          </Button>
        </div>

        <ResponsiveListing
          queryKey={membersQueryKey}
          queryFn={fetchMembersPage}
          enabled={!!session?.user?.id}
          onMeta={({ count }) => setMemberCount(count)}
          getItemKey={(m) => m.id}
          renderItem={renderMember}
          emptyMessage="No hay miembros de equipo en el equipo."
          loadingMessage="Cargando equipo..."
        />
      </CardContent>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={(o) => {
          setDeleteConfirmOpen(o)
          if (!o) setMemberToDelete(null)
        }}
        title="Confirmar eliminación de socio"
        description={`¿Deseas eliminar a ${memberToDelete?.member_email} de tu equipo?`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        tone="destructive"
        onConfirm={handleConfirmDelete}
      />
    </Card>
  )
}
