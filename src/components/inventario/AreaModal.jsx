/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession } from '@/hooks/useSession'
import { useQueryClient } from '@tanstack/react-query'
import { createArea, updateArea, getAreaPrefix } from '@/services/dynamicInventory'
import { AREA_ICONS } from '@/lib/areaIcons'

export function AreaModal({ open, onOpenChange, onSuccess, areaToEdit }) {
  const { session } = useSession()
  const userId = session?.user?.id
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ name: '', icon: 'Home', slug: '', prefix: '' })

  useEffect(() => {
    if (open) {
      if (areaToEdit) {
        setFormData({
          name: areaToEdit.name,
          icon: areaToEdit.icon,
          slug: areaToEdit.slug || '',
          prefix: ''
        })
        if (userId) {
          getAreaPrefix(areaToEdit.id, userId).then(p => {
            setFormData(prev => ({ ...prev, prefix: p }))
          })
        }
      } else {
        setFormData({ name: '', icon: 'Home', slug: '', prefix: '' })
      }
    }
  }, [open, areaToEdit, userId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (areaToEdit) {
        await updateArea(areaToEdit.id, formData, userId)
      } else {
        await createArea(formData, userId)
      }
      queryClient.invalidateQueries({ queryKey: ['inventoryAreas'] })
      onSuccess?.()
    } catch (error) {
      console.error(error)
      alert(areaToEdit ? 'Error al actualizar área' : 'Error al crear área')
    } finally {
      setLoading(false)
    }
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{areaToEdit ? 'Editar Área' : 'Crear Nueva Área'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label>Nombre del Área</Label>
            <Input
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Cocina Principal, Almacén B, Habitación 101..."
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Tipo de Espacio (Icono)</Label>
            <Select
              value={formData.icon}
              onValueChange={v => setFormData({ ...formData, icon: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {AREA_ICONS.map(i => (
                  <SelectItem key={i.key} value={i.key}>
                    <div className="flex items-center gap-2">
                      <i.Comp className="w-4 h-4 text-muted-foreground" />
                      <span>{i.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Identificador (Slug) - Opcional</Label>
            <Input
              placeholder="Ej: cocina-principal"
              value={formData.slug}
              onChange={e => setFormData({ ...formData, slug: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Identificador único para URL o reportes. Si se deja vacío se generará automáticamente.
            </p>
          </div>
          <div className="grid gap-2">
            <Label>Prefijo SKU (3-4 caracteres)</Label>
            <Input
              placeholder="Ej: ADM, VNT, LOG"
              value={formData.prefix}
              maxLength={4}
              onChange={e => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })}
            />
            <p className="text-xs text-muted-foreground">
              Se usará para generar SKUs únicos por área. Ejemplo: ADM-0001
            </p>
          </div>
          <div className="flex justify-end pt-2 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (areaToEdit ? 'Actualizando...' : 'Creando...') : (areaToEdit ? 'Guardar Cambios' : 'Crear Área')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
