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
import { GESTIA_TEMPLATES } from '@/utils/inventoryFormUtils'
import { ChevronDown, ChevronUp, ArrowLeft, Warehouse } from 'lucide-react'
import { Link } from 'react-router-dom'

export function AreaModal({ open, onOpenChange, onSuccess, areaToEdit, businessId, canCreate = true }) {
  const { session } = useSession()
  const userId = session?.user?.id
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(areaToEdit ? 2 : 1)
  const [templateId, setTemplateId] = useState('custom_blank')
  const [formData, setFormData] = useState({ name: '', icon: 'Home', slug: '', prefix: '' })
  const [errors, setErrors] = useState({})
  const [showAdvanced, setShowAdvanced] = useState(false)

  const selectedTpl = GESTIA_TEMPLATES.find((t) => t.id === templateId) || GESTIA_TEMPLATES[GESTIA_TEMPLATES.length - 1]

  useEffect(() => {
    if (open) {
      setErrors({})
      setShowAdvanced(false)
      setStep(areaToEdit ? 2 : 1)
      if (areaToEdit) {
        setTemplateId(areaToEdit.template_id || 'custom_blank')
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
        setTemplateId('custom_blank')
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
        created = await createArea({
          ...formData,
          domain_type: selectedTpl.domain_type,
          template_id: selectedTpl.id
        }, userId, businessId)
      }
      queryClient.invalidateQueries({ queryKey: ['inventoryAreas'] })
      queryClient.invalidateQueries({ queryKey: ['inventoryFields'] })
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
        setStep(1)
      }
    }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {areaToEdit ? 'Editar área' : (step === 1 ? '¿Qué quieres controlar?' : 'Nueva área')}
          </DialogTitle>
          <DialogDescription>
            {areaToEdit
              ? 'Cambia el nombre o el icono del área.'
              : step === 1
                ? 'Elige un modelo profesional. Luego puedes añadir campos propios.'
                : 'Un área agrupa equipos, suministros o listas — no es el mapa del depósito.'}
          </DialogDescription>
        </DialogHeader>

        {!areaToEdit && step === 1 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              {GESTIA_TEMPLATES.map((tpl) => {
                const active = templateId === tpl.id
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setTemplateId(tpl.id)}
                    className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      active ? 'border-primary bg-primary/10' : 'hover:bg-accent/40'
                    }`}
                  >
                    <div className="text-sm font-medium">{tpl.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground leading-snug">{tpl.description}</div>
                  </button>
                )
              })}
            </div>
            {selectedTpl?.warehouseCta && (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>¿Vas a vender esto con stock y costo? Mejor usa Almacén.</span>
                <Button asChild variant="outline" size="sm" className="gap-1 shrink-0">
                  <Link to="/almacen" onClick={() => onOpenChange(false)}>
                    <Warehouse className="h-3.5 w-3.5" /> Ir a Almacén
                  </Link>
                </Button>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button type="button" onClick={() => setStep(2)}>Continuar</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!areaToEdit && (
              <Button type="button" variant="ghost" size="sm" className="gap-1 -ml-2" onClick={() => setStep(1)}>
                <ArrowLeft className="h-3.5 w-3.5" /> Cambiar tipo
              </Button>
            )}
            {!areaToEdit && selectedTpl && (
              <p className="text-xs text-muted-foreground">
                Modelo: <span className="font-medium text-foreground">{selectedTpl.title}</span>
              </p>
            )}
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Equipos oficina, Suministros cocina…"
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
                        <i.Comp className="w-4 h-4" />
                        <span>{i.label || i.key}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <button
              type="button"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setShowAdvanced(v => !v)}
            >
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Opciones avanzadas (prefijo SKU)
            </button>
            {showAdvanced && (
              <div className="grid gap-2">
                <Label>Prefijo SKU (3–4 letras)</Label>
                <Input
                  value={formData.prefix}
                  onChange={e => setFormData({ ...formData, prefix: e.target.value.toUpperCase().slice(0, 4) })}
                  placeholder="ELEC"
                  aria-invalid={!!errors.prefix}
                />
                {errors.prefix && <p className="text-xs text-destructive">{errors.prefix}</p>}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" loading={loading}>
                {loading ? 'Guardando…' : (areaToEdit ? 'Guardar' : 'Crear área')}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
