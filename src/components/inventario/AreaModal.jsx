/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession } from '@/hooks/useSession'
import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAreaPrefix } from '@/services/dynamicInventory'
import { AREA_ICONS } from '@/lib/areaIcons'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { notifyOfflineQueued } from '@/services/notifyWrap'
import { areaSchema, validateForm } from '@/utils/formSchemas'
import { GESTIA_TEMPLATES } from '@/utils/inventoryFormUtils'
import { ChevronDown, ChevronUp, ArrowLeft, Warehouse } from 'lucide-react'
import { Link } from 'react-router-dom'
import { INV_AREA_CREATE_KEY, INV_AREA_UPDATE_KEY } from '@/offline/mutationDefaults'
import {
  applyOptimisticAreaCreate,
  applyOptimisticAreaUpdate,
  buildPendingAreaRow,
  clearOptimisticArea,
  findAreaInCache,
  restoreAreaRow,
} from '@/offline/optimisticInventory'
import { genClientUuid } from '@/offline/clientUuid'
import { isNetworkError } from '@/offline/isNetworkError'
import { markOffline } from '@/offline/networkGuard'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function AreaModal({ open, onOpenChange, onSuccess, areaToEdit, businessId, canCreate = true }) {
  const { session } = useSession()
  const userId = session?.user?.id
  const online = useOnlineStatus()
  const queryClient = useQueryClient()
  const requeueGuardRef = useRef(new Set())
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
        if (userId && onlineManager.isOnline()) {
          getAreaPrefix(areaToEdit.id, userId, businessId).then(p => {
            setFormData(prev => ({ ...prev, prefix: p }))
          }).catch(() => {})
        }
      } else {
        setTemplateId('custom_blank')
        setFormData({ name: '', icon: 'Home', slug: '', prefix: '' })
      }
    }
  }, [open, areaToEdit, userId, businessId])

  const updateMutation = useMutation({
    mutationKey: INV_AREA_UPDATE_KEY,
    onMutate: async (vars) => {
      const id = vars?.id
      const previous = findAreaInCache(queryClient, id)
      if (previous && !requeueGuardRef.current.has(`area-upd-${id}`)) {
        applyOptimisticAreaUpdate(queryClient, id, vars?.payload || {})
      }
      if (!onlineManager.isOnline()) notifyOfflineQueued('Área')
      return { id, previous }
    },
    onSuccess: (_d, _v, ctx) => {
      if (ctx?.id != null) requeueGuardRef.current.delete(`area-upd-${ctx.id}`)
      queryClient.invalidateQueries({ queryKey: ['inventoryAreas'] })
      onSuccess?.(null)
    },
    onError: (error, vars, ctx) => {
      const id = ctx?.id ?? vars?.id
      const key = `area-upd-${id}`
      if (isNetworkError(error)) {
        markOffline()
        notifyOfflineQueued('Área')
        if (id != null && !requeueGuardRef.current.has(key)) {
          requeueGuardRef.current.add(key)
          queueMicrotask(() => updateMutation.mutate(vars))
        }
        onSuccess?.(null)
        return
      }
      requeueGuardRef.current.delete(key)
      restoreAreaRow(queryClient, id, ctx?.previous)
      notify.error(getSupabaseErrorMessage(error))
    },
  })

  const createMutation = useMutation({
    mutationKey: INV_AREA_CREATE_KEY,
    onMutate: async (vars) => {
      const clientUuid = vars?.payload?.client_uuid
      let pendingRow = null
      if (clientUuid && !requeueGuardRef.current.has(clientUuid)) {
        pendingRow = buildPendingAreaRow({
          ...vars.payload,
          clientUuid,
          businessId,
          userId,
        })
        applyOptimisticAreaCreate(queryClient, pendingRow)
        // Offline: seleccionar ya la fila pendiente (onSuccess llega al sync).
        if (!onlineManager.isOnline()) onSuccess?.(pendingRow)
      }
      if (!onlineManager.isOnline()) notifyOfflineQueued('Área')
      return { clientUuid, pendingRow }
    },
    onSuccess: (data, vars, ctx) => {
      if (ctx?.clientUuid) requeueGuardRef.current.delete(ctx.clientUuid)
      queryClient.invalidateQueries({ queryKey: ['inventoryAreas'] })
      queryClient.invalidateQueries({ queryKey: ['inventoryFields'] })
      if (data?.idempotent) {
        notify.info('Esta área ya estaba registrada; no se duplicó.')
      } else if (onlineManager.isOnline()) {
        notify.success('Área creada')
      }
      onSuccess?.(data)
    },
    onError: (error, vars, ctx) => {
      const uuid = ctx?.clientUuid || vars?.payload?.client_uuid
      if (isNetworkError(error)) {
        markOffline()
        notifyOfflineQueued('Área')
        if (uuid && !requeueGuardRef.current.has(uuid)) {
          requeueGuardRef.current.add(uuid)
          queueMicrotask(() => createMutation.mutate(vars))
        }
        onSuccess?.(null)
        return
      }
      if (uuid) requeueGuardRef.current.delete(uuid)
      clearOptimisticArea(queryClient, uuid)
      notify.error(getSupabaseErrorMessage(error))
    },
  })

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

    const payload = {
      name: formData.name,
      icon: formData.icon,
      slug: formData.slug || '',
      prefix: formData.prefix || '',
    }

    if (areaToEdit) {
      onOpenChange(false)
      updateMutation.mutate({
        id: areaToEdit.id,
        payload,
        userId,
        businessId,
      })
      return
    }

    const client_uuid = genClientUuid()
    onOpenChange(false)
    createMutation.mutate({
      payload: {
        ...payload,
        domain_type: selectedTpl.domain_type,
        template_id: selectedTpl.id,
        client_uuid,
      },
      userId,
      businessId,
    })
  }

  const busy = updateMutation.isPending || createMutation.isPending

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
                {!online && (
                  <span className="block mt-1 text-warning">
                    Sin red: el área se guarda aquí; los campos del modelo se aplican al sincronizar.
                  </span>
                )}
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button type="submit" loading={busy}>
                {busy ? 'Guardando…' : (areaToEdit ? 'Guardar' : 'Crear área')}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
