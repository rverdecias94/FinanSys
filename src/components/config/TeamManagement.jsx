import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserPlus, Trash2, Loader2, Shield, Mail } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession } from '@/hooks/useSession'
import { useSubscription } from '@/context/SubscriptionContext'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { getTeamMembers, inviteMember, removeMember, getRoles, updateMemberRole } from '@/services/team'
import { getSupabaseErrorMessage } from '@/services/notifications'

import { useBusiness } from '@/context/BusinessContext'

export function TeamManagement() {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { subscription, PLAN_LIMITS } = useSubscription()

  const [members, setMembers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)

  const [inviteEmail, setInviteEmail] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState(null)

  const allowedRole = (role) => String(role?.name || '').toLowerCase() !== 'visualizador'

  const fetchData = async () => {
    if (!session?.user?.id) return
    try {
      setLoading(true)
      const [membersData, rolesData] = await Promise.all([
        getTeamMembers(businessId || session.user.id),
        getRoles()
      ])
      setMembers(membersData || [])
      const nextRoles = (rolesData || []).filter(allowedRole)
      setRoles(nextRoles)

      // Set default role if available
      if (nextRoles.length > 0 && !selectedRole) {
        const defaultRole = nextRoles.find(r => r.name === 'Consultor') || nextRoles.find(r => r.name === 'Editor') || nextRoles[0]
        setSelectedRole(defaultRole.id)
      }
    } catch (error) {
      toast.error('Error al cargar datos del equipo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [session, businessId])

  const handleInvite = async () => {
    // Check limit
    const limit = PLAN_LIMITS?.[subscription?.plan_id || 'free']?.partners ?? 0
    if (members.length >= limit) {
      toast.error('Has alcanzado el límite de socios para tu plan.')
      return
    }

    if (!inviteEmail || !selectedRole) {
      toast.error('Email y rol son obligatorios')
      return
    }

    setInviteLoading(true)
    try {
      // 1. Create invite in DB
      await inviteMember({
        email: inviteEmail,
        role_id: selectedRole,
        owner_id: businessId || session.user.id
      })

      // Success message (No email sent)
      setInviteEmail('')
      toast.success(`Socio agregado: ${inviteEmail}`, {
        description: 'Cuando el usuario se registre con este correo, se unirá automáticamente a tu equipo.'
      })
      fetchData() // Refresh list
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
      await removeMember(memberToDelete.id)
      toast.success('Socio eliminado correctamente')
      setMembers(prev => prev.filter(m => m.id !== memberToDelete.id))
    } catch (err) {
      toast.error('Error al eliminar socio')
    } finally {
      setDeleteConfirmOpen(false)
      setMemberToDelete(null)
    }
  }

  const handleRoleChange = async (memberId, newRoleId) => {
    try {
      await updateMemberRole(memberId, newRoleId)
      toast.success('Rol actualizado')
      // Update local state
      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, role_id: newRoleId, roles: roles.find(r => r.id === newRoleId) } : m
      ))
    } catch {
      toast.error('Error al cambiar rol')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestión de Equipo</CardTitle>
        <CardDescription>Agrega socios para colaborar en tu cuenta y asigna roles específicos.</CardDescription>
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

        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Cargando equipo...
                  </TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No hay socios en el equipo.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.member_email}</TableCell>
                    <TableCell>
                      <Select
                        value={m.role_id}
                        onValueChange={(val) => handleRoleChange(m.id, val)}
                        disabled={m.status === 'pending'}
                      >
                        <SelectTrigger className="h-8 w-[180px]">
                          <div className="flex items-center gap-2">
                            {m.roles?.is_system && <Shield className="w-3 h-3 text-blue-500" />}
                            <span className="truncate">{m.roles?.name || 'Sin rol'}</span>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map(role => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.status === 'active' ? 'default' : 'secondary'}>
                        {m.status === 'active' ? 'Activo' : 'Pendiente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteMember(m)}
                        aria-label={`Eliminar a ${m.member_email}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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
