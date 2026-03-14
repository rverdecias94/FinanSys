import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createRole, updateRole } from '@/services/team'
import { useSession } from '@/hooks/useSession'
import { toast } from 'sonner'
import { Shield, Lock } from 'lucide-react'

export function RoleModal({ open, onOpenChange, role, permissions, onSuccess }) {
  const { session } = useSession()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState([])

  useEffect(() => {
    if (role) {
      setName(role.name)
      setDescription(role.description || '')
      // role.permissions is array of codes, but we need IDs for update logic usually, 
      // but the service handles ID mapping if we pass IDs.
      // Wait, getRoles returns permissions as codes (strings). 
      // But updateRole expects permission IDs.
      // We need to map codes back to IDs or adjust how we pass data.

      // Let's assume we need to map back from codes to IDs using the permissions catalog
      const rolePermCodes = role.permissions || []
      const rolePermIds = permissions
        .filter(p => rolePermCodes.includes(p.code))
        .map(p => p.id)

      setSelectedPermissions(rolePermIds)
    } else {
      setName('')
      setDescription('')
      setSelectedPermissions([])
    }
  }, [role, open, permissions])

  const handleTogglePermission = (permId) => {
    setSelectedPermissions(prev =>
      prev.includes(permId)
        ? prev.filter(id => id !== permId)
        : [...prev, permId]
    )
  }

  const handleToggleModule = (moduleName) => {
    const modulePerms = permissions.filter(p => p.module === moduleName)
    const modulePermIds = modulePerms.map(p => p.id)

    const allSelected = modulePermIds.every(id => selectedPermissions.includes(id))

    if (allSelected) {
      // Deselect all
      setSelectedPermissions(prev => prev.filter(id => !modulePermIds.includes(id)))
    } else {
      // Select all
      const toAdd = modulePermIds.filter(id => !selectedPermissions.includes(id))
      setSelectedPermissions(prev => [...prev, ...toAdd])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('El nombre del rol es obligatorio')
      return
    }

    setLoading(true)
    try {
      if (role) {
        await updateRole(role.id, {
          name,
          description,
          permissionIds: selectedPermissions
        })
        toast.success('Rol actualizado correctamente')
      } else {
        await createRole({
          name,
          description,
          permissionIds: selectedPermissions,
          owner_id: session.user.id
        })
        toast.success('Rol creado correctamente')
      }
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error(error)
      toast.error('Error al guardar el rol')
    } finally {
      setLoading(false)
    }
  }

  // Group permissions by module
  const permissionsByModule = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = []
    acc[perm.module].push(perm)
    return acc
  }, {})

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{role ? 'Editar Rol' : 'Crear Nuevo Rol'}</DialogTitle>
          <DialogDescription>
            Define los permisos específicos para este rol.
          </DialogDescription>
        </DialogHeader>

        <form id="role-form" onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre del Rol</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Contador, Auxiliar de Almacén"
              disabled={loading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Descripción</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descripción de las responsabilidades"
              disabled={loading}
            />
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            <Label className="mb-2 block">Permisos</Label>
            <div className="border rounded-md flex-1 bg-muted/10">
              <ScrollArea className="h-[300px] p-4">
                <div className="space-y-6">
                  {Object.entries(permissionsByModule).map(([module, perms]) => (
                    <div key={module} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex-1">
                          {module}
                        </h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => handleToggleModule(module)}
                        >
                          {perms.every(p => selectedPermissions.includes(p.id)) ? 'Desmarcar todo' : 'Marcar todo'}
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {perms.map((perm) => (
                          <div
                            key={perm.id}
                            className={`flex items-start space-x-2 p-2 rounded-md border transition-colors ${selectedPermissions.includes(perm.id) ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}
                          >
                            <Checkbox
                              id={perm.id}
                              checked={selectedPermissions.includes(perm.id)}
                              onCheckedChange={() => handleTogglePermission(perm.id)}
                            />
                            <div className="grid gap-1.5 leading-none">
                              <label
                                htmlFor={perm.id}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {perm.description}
                              </label>
                              {/* Optional: Show code in tooltip or very small if needed for debugging, otherwise hide it as per user request */}
                              {/* <p className="text-xs text-muted-foreground">{perm.code}</p> */}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </form>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" form="role-form" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar Rol'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
