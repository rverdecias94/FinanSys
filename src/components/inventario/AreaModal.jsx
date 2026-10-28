/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession } from '@/hooks/useSession'
import { useQueryClient } from '@tanstack/react-query'
import { createArea, updateArea, getAreaPrefix } from '@/services/dynamicInventory'
import { AREA_ICONS } from '@/lib/areaIcons'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { areaSchema, validateForm } from '@/utils/formSchemas'
import { ChevronDown, ChevronUp } from 'lucide-react'

export function AreaModal({ open, onOpenChange, onSuccess, areaToEdit, businessId, canCreate = true }) {
  const { session } = useSession()
  const userId = session?.user?.id
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ name: '', icon: 'Home', slug: '', prefix: '' })
  const [errors, setErrors] = useState({})
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (open) {
      setErrors({})
      setShowAdvanced(false)
      if (areaToEdit) {
        setFormData({
          name: areaToEdit.name,
          icon: areaToEdit.icon,
          slug: areaToEdit.slug || '',
          prefix: ''
        })
        if (userId) {
          getAreaPrefix(areaToEdit.id, userId, businessId).then(p => {
            setFormData(prev => ({ ...prev, prefix: p }))
          })
        }
      } else {
        setFormData({ name: '', icon: 'Home', slug: '', prefix: '' })
      }
    }
  }, [open, areaToEdit, userId, businessId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!areaToEdit && !canCreate) {
      notify.error('Límite del plan alcanzado')
      return
    }
    const validation = validateForm(areaSchema, {
      name: formData.name ?? '',
      icon: formData.icon ?? '',
      slug: formData.slug ?? '',
      prefix: formData.prefix ?? ''
    })
    if (!validation.success) {
      setErrors(validation.errors)
      return
    }
    setErrors({})
    setLoading(true)
    try {
      let created = null
      if (areaToEdit) {
        await updateArea(areaToEdit.id, formData, userId, businessId)
      } else {
        created = await createArea(formData, userId, businessId)
      }
      queryClient.invalidateQueries({ queryKey: ['inventoryAreas'] })
      onSuccess?.(created)
    } catch (error) {
      const msg = getSupabaseErrorMessage(error)
      notify.error(msg)
    } finally {
      setLoading(false)
    }
  }


  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      onOpenChange(nextOpen)
      if (!nextOpen) {
        setFormData({ name: '', icon: 'Home', slug: '', prefix: '' })
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{areaToEdit ? 'Editar área' : 'Nueva área'}</DialogTitle>
          <DialogDescription>
            Un área es un lugar o categoría donde guardas artículos (cocina, depósito, equipos…).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label>Nombre</Label>
            <Input
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Cocina Principal, Depósito, Equipos…"
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="grid gap-2">
            <Label>Icono</Label>
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

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-accent/40"
          >
            <span>Opciones avanzadas (opcional)</span>
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showAdvanced && (
            <div className="space-y-4 rounded-lg border bg-muted/20 p-3">
              <div className="grid gap-2">
                <Label>Código corto (para enlaces)</Label>
                <Input
                  placeholder="Ej: cocina-principal"
                  value={formData.slug}
                  onChange={e => setFormData({ ...formData, slug: e.target.value })}
                  aria-invalid={!!errors.slug}
                />
                {errors.slug
                  ? <p className="text-xs text-destructive">{errors.slug}</p>
                  : <p className="text-xs text-muted-foreground">
                      Si lo dejas vacío, se crea solo. Casi nunca lo necesitas.
                    </p>}
              </div>
              <div className="grid gap-2">
                <Label>Prefijo de código (3–4 letras)</Label>
                <Input
                  placeholder="Ej: COC, DEP, EQ"
                  value={formData.prefix}
                  maxLength={4}
                  onChange={e => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })}
                  aria-invalid={!!errors.prefix}
                />
                {errors.prefix
                  ? <p className="text-xs text-destructive">{errors.prefix}</p>
                  : <p className="text-xs text-muted-foreground">
                      Sirve para códigos automáticos tipo COC-0001. Opcional.
                    </p>}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading} disabled={!areaToEdit && !canCreate}>
              {loading ? (areaToEdit ? 'Guardando…' : 'Creando…') : (areaToEdit ? 'Guardar' : 'Crear área')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
