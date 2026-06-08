import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Shield, Lock } from 'lucide-react'
import { getRoles, getPermissions, deleteRole } from '@/services/team'
import { useSession } from '@/hooks/useSession'
import { RoleModal } from './RoleModal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'

export function RoleManagement() {
  const { session } = useSession()
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState(null)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [roleToDelete, setRoleToDelete] = useState(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [rolesData, permsData] = await Promise.all([
        getRoles(),
        getPermissions()
      ])
      setRoles(rolesData)
      setPermissions(permsData)
    } catch (error) {
      toast.error('Error al cargar roles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.id) {
      fetchData()
    }
  }, [session])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-10 w-48 bg-muted animate-pulse rounded"></div>
          <div className="h-10 w-40 bg-muted animate-pulse rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-48 animate-pulse bg-muted/20" />
          ))}
        </div>
      </div>
    )
  }

  const handleCreate = () => {
    setEditingRole(null)
    setModalOpen(true)
  }

  const handleEdit = (role) => {
    if (role.is_system) return
    setEditingRole(role)
    setModalOpen(true)
  }

  const handleDeleteClick = (role) => {
    if (role.is_system) return
    setRoleToDelete(role)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return
    try {
      await deleteRole(roleToDelete.id)
      toast.success('Rol eliminado')
      fetchData()
    } catch {
      toast.error('Error al eliminar rol')
    } finally {
      setDeleteConfirmOpen(false)
      setRoleToDelete(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-medium">Roles y Permisos</h3>
          <p className="text-sm text-muted-foreground">
            Gestiona los roles disponibles para tu equipo y sus permisos específicos.
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" /> Crear Rol Personalizado
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.filter((r) => String(r.name || '').toLowerCase() !== 'visualizador').map((role) => (
          <Card key={role.id} className={`flex flex-col ${role.is_system ? 'bg-muted/30' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${role.is_system ? 'bg-secondary text-secondary-foreground' : 'bg-primary/10 text-primary'}`}>
                    {role.is_system ? <Lock className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                  </div>
                  <CardTitle className="text-base">{role.name}</CardTitle>
                </div>
                {role.is_system && (
                  <Badge variant="secondary" className="text-xs">Sistema</Badge>
                )}
              </div>
              <CardDescription className="mt-2 text-xs line-clamp-2 min-h-[2.5em]">
                {role.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-4">
              <div className="text-xs text-muted-foreground mb-4">
                <strong>{role.permissions?.length || 0}</strong> permisos asignados
              </div>
              <div className="flex flex-wrap gap-1">
                {role.permissions?.slice(0, 3).map(p => (
                  <Badge key={p} variant="outline" className="text-[10px] px-1 py-0 h-5 font-normal">
                    {p}
                  </Badge>
                ))}
                {(role.permissions?.length || 0) > 3 && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-5 font-normal">
                    +{role.permissions.length - 3} más
                  </Badge>
                )}
              </div>
            </CardContent>
            {!role.is_system && (
              <div className="p-4 pt-0 mt-auto flex justify-end gap-2 border-t pt-3">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(role)}>
                  <Pencil className="w-3 h-3 mr-1" /> Editar
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteClick(role)}>
                  <Trash2 className="w-3 h-3 mr-1" /> Eliminar
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <RoleModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        role={editingRole}
        permissions={permissions}
        onSuccess={fetchData}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Eliminar Rol"
        description={`¿Estás seguro de eliminar el rol "${roleToDelete?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        tone="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
