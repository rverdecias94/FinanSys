/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  listFields,
  listItems,
  createItem,
  updateItem,
  deleteItem,
  validateValuesAgainstFields,
  adjustInventoryItemQty,
  countInventoryItem,
  recordAssetEvent
} from '@/services/dynamicInventory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Trash2, Pencil, Package, SlidersHorizontal, ScanLine } from 'lucide-react'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'
import { Calendar } from '@/components/ui/calendar'
import { usePermissions } from '@/context/PermissionContext'
import {
  placeholderForType,
  toLabelFromName,
  isStockLikeDomain,
  isAssetLikeDomain
} from '@/utils/inventoryFormUtils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Link } from 'react-router-dom'

function parseDateValue(raw) {
  if (!raw) return null
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00`) : new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatFieldValue(field, raw) {
  if (raw === null || raw === undefined || raw === '') return '—'
  if (field?.type === 'boolean') return raw ? 'Sí' : 'No'
  if (field?.type === 'date' || field?.semantic === 'date_expiry' || field?.semantic === 'date_acquired') {
    const d = parseDateValue(raw)
    return d ? format(d, 'dd MMM yyyy', { locale: es }) : String(raw)
  }
  if (field?.type === 'currency') {
    const n = Number(raw)
    return Number.isFinite(n) ? n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(raw)
  }
  return String(raw)
}

function FieldRequiredMark({ required }) {
  return required
    ? <b className="text-red-500 ml-1">*</b>
    : <span className="text-muted-foreground ml-1">(Opcional)</span>
}

const TEXT_LIKE = new Set(['text', 'barcode', 'serial', 'person_text', 'location_text', 'photo_url'])
const NUMBER_LIKE = new Set(['number', 'quantity_uom', 'currency'])

export function FormRunner({ areaId, userId, currentArea, mode = 'full', initialItem = null, readOnly = false, onConfigure }) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustItem, setAdjustItem] = useState(null)
  const [adjustDelta, setAdjustDelta] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [countMode, setCountMode] = useState(false)
  const [countQty, setCountQty] = useState('')
  const { hasPermission } = usePermissions()

  const stockLike = isStockLikeDomain(currentArea?.domain_type)
  const assetLike = isAssetLikeDomain(currentArea?.domain_type)

  const { data: fields = [], isLoading: loadingFields } = useQuery({
    queryKey: ['inventoryFields', areaId],
    queryFn: () => listFields(areaId, userId),
    enabled: !!userId && !!areaId
  })

  const itemsQueryKey = useMemo(() => ['inventoryItems', areaId], [areaId])

  useEffect(() => {
    if (!initialItem) return
    setValues(initialItem.values || {})
    setEditingId(initialItem.id || null)
  }, [initialItem])

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const created = await createItem(areaId, data, userId)
      if (assetLike && created?.id) {
        try {
          await recordAssetEvent({ itemId: created.id, eventType: 'intake', toLocation: data.Ubicación || data.ubicacion, toCustodian: data.Custodio })
        } catch {
          // Alta del ítem ya OK; el timeline se puede completar luego
        }
      }
      return created
    },
    meta: {
      successMessage: 'Producto agregado satisfactoriamente',
      errorMessage: 'Error al agregar el producto'
    },
    onSuccess: () => {
      setValues({})
      queryClient.invalidateQueries({ queryKey: ['inventoryItems', areaId] })
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateItem(id, data, userId),
    meta: {
      successMessage: 'Producto actualizado correctamente',
      errorMessage: 'Error al actualizar el producto'
    },
    onSuccess: () => {
      setValues({})
      setEditingId(null)
      queryClient.invalidateQueries({ queryKey: ['inventoryItems', areaId] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteItem(id, userId),
    meta: {
      successMessage: 'Producto eliminado exitosamente',
      errorMessage: 'Error al eliminar el producto'
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems', areaId] })
    }
  })

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (countMode) {
        return countInventoryItem(adjustItem.id, Number(countQty), adjustReason)
      }
      return adjustInventoryItemQty(adjustItem.id, Number(adjustDelta), adjustReason)
    },
    onSuccess: () => {
      notify.success(countMode ? 'Conteo registrado' : 'Cantidad ajustada')
      setAdjustOpen(false)
      setAdjustItem(null)
      setAdjustDelta('')
      setCountQty('')
      setAdjustReason('')
      setCountMode(false)
      queryClient.invalidateQueries({ queryKey: ['inventoryItems', areaId] })
      if (adjustItem?.id) {
        queryClient.invalidateQueries({ queryKey: ['inventoryItem', String(adjustItem.id)] })
      }
    },
    onError: (e) => notify.error(getSupabaseErrorMessage(e))
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validation = await validateValuesAgainstFields(values, areaId, userId)
    if (!validation.ok) {
      if (validation.missing?.length) {
        notify.warning(`Faltan campos requeridos: ${validation.missing.join(', ')}`)
        return
      }
      if (validation.invalidNumbers?.length) {
        notify.warning(`Revisa los números: ${validation.invalidNumbers.join(', ')}`)
        return
      }
      notify.warning('Revisa los datos ingresados')
      return
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: values })
    } else {
      createMutation.mutate(values)
    }
  }

  const handleDeleteItem = async (id) => {
    setPendingDeleteId(id)
    setConfirmOpen(true)
  }

  const handleEditItem = (item) => {
    setValues(item.values || {})
    setEditingId(item.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setValues({})
    setEditingId(null)
  }

  const openAdjust = (item, asCount = false) => {
    setAdjustItem(item)
    setCountMode(asCount)
    setAdjustDelta('')
    setCountQty(item.qty != null ? String(item.qty) : String(item.values?.Cantidad ?? ''))
    setAdjustReason('')
    setAdjustOpen(true)
  }

  const canShowForm = readOnly ? true : (editingId ? hasPermission('inventory.edit') : hasPermission('inventory.create'))

  const textFields = useMemo(
    () => fields.filter((f) => TEXT_LIKE.has(f.type) || f.type === 'textarea'),
    [fields]
  )

  const renderFieldInput = (f) => {
    const label = f.label || toLabelFromName(f.name)
    const id = `field_${f.name}`
    const qtyLocked = stockLike && editingId && (f.semantic === 'quantity' || f.name === 'Cantidad')

    if (TEXT_LIKE.has(f.type) || f.type === 'textarea') {
      return (
        <div key={f.id} className="grid gap-1">
          <Label htmlFor={id}>{label}<FieldRequiredMark required={f.required} /></Label>
          {f.type === 'textarea' ? (
            <Textarea
              id={id}
              value={values[f.name] ?? ''}
              required={f.required}
              disabled={readOnly}
              onChange={readOnly ? undefined : (e) => setValues({ ...values, [f.name]: e.target.value })}
              placeholder={placeholderForType(f.type)}
            />
          ) : (
            <Input
              id={id}
              type={f.type === 'photo_url' ? 'url' : 'text'}
              value={values[f.name] ?? ''}
              required={f.required}
              disabled={readOnly}
              onChange={readOnly ? undefined : (e) => setValues({ ...values, [f.name]: e.target.value })}
              placeholder={placeholderForType(f.type)}
            />
          )}
        </div>
      )
    }

    if (NUMBER_LIKE.has(f.type)) {
      return (
        <div key={f.id} className="grid gap-1">
          <Label htmlFor={id}>{label}<FieldRequiredMark required={f.required} /></Label>
          <Input
            type="number"
            min={f.type === 'currency' ? 0 : (f.semantic === 'quantity' ? 1 : 0)}
            step={f.type === 'currency' ? '0.01' : '1'}
            id={id}
            required={f.required}
            value={values[f.name] ?? ''}
            placeholder={placeholderForType(f.type)}
            disabled={readOnly || qtyLocked}
            onChange={(e) => {
              if (readOnly || qtyLocked) return
              const raw = e.target.value
              if (raw === '') {
                setValues({ ...values, [f.name]: '' })
                return
              }
              const n = Number(raw)
              if (!Number.isFinite(n)) return
              const min = f.type === 'currency' ? 0 : (f.semantic === 'quantity' || f.type === 'quantity_uom' || f.type === 'number' ? 0 : 0)
              setValues({ ...values, [f.name]: String(Math.max(min, n)) })
            }}
          />
          {qtyLocked && (
            <p className="text-xs text-muted-foreground">
              La cantidad se cambia con «Ajustar» (queda historial).
            </p>
          )}
        </div>
      )
    }

    if (f.type === 'date') {
      return (
        <div key={f.id} className="grid gap-1">
          <Label htmlFor={id}>{label}<FieldRequiredMark required={f.required} /></Label>
          <Calendar
            value={parseDateValue(values[f.name])}
            disabled={readOnly}
            placeholder="Selecciona una fecha"
            options={{ maxDate: null }}
            onChange={readOnly ? undefined : (d) => setValues({ ...values, [f.name]: d ? format(d, 'yyyy-MM-dd') : '' })}
          />
        </div>
      )
    }

    if (f.type === 'color') {
      return (
        <div key={f.id} className="grid gap-1">
          <Label htmlFor={id}>{label}<FieldRequiredMark required={f.required} /></Label>
          <Input
            type="color"
            id={id}
            required={f.required}
            value={values[f.name] ?? '#000000'}
            disabled={readOnly}
            onChange={readOnly ? undefined : (e) => setValues({ ...values, [f.name]: e.target.value })}
          />
        </div>
      )
    }

    if (f.type === 'boolean') {
      return (
        <div key={f.id} className="flex items-center gap-2">
          <Checkbox
            checked={Boolean(values[f.name])}
            disabled={readOnly}
            onCheckedChange={(checked) => {
              if (readOnly) return
              setValues({ ...values, [f.name]: Boolean(checked) })
            }}
          />
          <Label htmlFor={id}>{label}<FieldRequiredMark required={f.required} /></Label>
        </div>
      )
    }

    if (f.type === 'select') {
      const options = Array.isArray(f.options) ? f.options : []
      return (
        <div key={f.id} className="grid gap-1">
          <Label htmlFor={id}>{label}<FieldRequiredMark required={f.required} /></Label>
          <Select
            disabled={readOnly}
            value={String(values[f.name] ?? '')}
            onValueChange={(v) => {
              if (readOnly) return
              setValues({ ...values, [f.name]: v })
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={placeholderForType('select')} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )
    }

    return null
  }

  const renderItem = (item) => {
    const itemValues = item.values || {}
    const labelFor = (f) => f.label || toLabelFromName(f.name)
    const firstText = textFields[0]
    const title =
      (firstText && itemValues[firstText.name] != null && String(itemValues[firstText.name]).trim()) ||
      (item.sku && String(item.sku).trim()) ||
      `Item ${item.id}`

    const subtitleFields = fields.filter((f) => f !== firstText).slice(0, 3)
    const subtitle = subtitleFields
      .map((f) => `${labelFor(f)}: ${formatFieldValue(f, itemValues[f.name] ?? (f.semantic === 'quantity' ? item.qty : null))}`)
      .join(' · ')

    return (
      <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <div className="shrink-0 rounded-full bg-primary/10 p-2">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-medium break-words">{title}</div>
            {subtitle && <div className="text-sm text-muted-foreground break-words">{subtitle}</div>}
            {item.status && (
              <div className="mt-1 text-xs text-muted-foreground">Estado: {item.status}</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t pt-3 sm:shrink-0 sm:justify-end sm:border-0 sm:pt-0">
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {stockLike && hasPermission('inventory.edit') && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openAdjust(item, false)}>
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Ajustar
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openAdjust(item, true)}>
                  <ScanLine className="w-3.5 h-3.5" />
                  Contar
                </Button>
              </>
            )}
            {assetLike && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/inventario/${item.id}`}>Ficha</Link>
              </Button>
            )}
            {hasPermission('inventory.edit') && (
              <Button variant="outline" size="icon" onClick={() => handleEditItem(item)}>
                <Pencil className="w-4 h-4" />
              </Button>
            )}
            {hasPermission('inventory.delete') && (
              <Button variant="destructive" size="icon" onClick={() => handleDeleteItem(item.id)} disabled={deleteMutation.isPending}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {currentArea?.domain_type === 'merchandise' && (
        <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          ¿Vas a vender esto con costo?{' '}
          <Link to="/almacen" className="font-medium text-primary underline-offset-2 hover:underline">
            Usa Almacén
          </Link>
          {' '}— aquí es control de lista, sin venta.
        </div>
      )}

      {canShowForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingId ? `Editar en ${currentArea?.name || 'el área'}` : `Registrar en ${currentArea?.name || 'el área'}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingFields ? (
              <div className="text-muted-foreground">Cargando…</div>
            ) : fields.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
                <p className="text-sm font-medium text-foreground">Todavía no hay datos que anotar</p>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Primero arma la lista (nombre, cantidad, etc.). Toma menos de un minuto.
                </p>
                {typeof onConfigure === 'function' && (
                  <Button type="button" onClick={onConfigure}>
                    Armar mi lista
                  </Button>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {fields.map((f) => renderFieldInput(f))}
                {!readOnly && (
                  <div className="sm:col-span-2 flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                    {editingId && (
                      <Button type="button" variant="outline" onClick={handleCancelEdit}>
                        Cancelar Edición
                      </Button>
                    )}
                    <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                      {createMutation.isPending || updateMutation.isPending
                        ? 'Guardando…'
                        : (editingId ? 'Guardar cambios' : 'Guardar artículo')}
                    </Button>
                  </div>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {mode === 'full' && (
        <Card>
          <CardHeader>
            <CardTitle>Artículos guardados</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveListing
              queryKey={itemsQueryKey}
              queryFn={({ page, pageSize }) => listItems(areaId, { page, pageSize }, userId)}
              enabled={!!userId && !!areaId}
              getItemKey={(item) => item.id}
              renderItem={renderItem}
              emptyMessage="Aún no hay artículos. Completa el formulario de arriba y guárdalo."
              loadingMessage="Cargando artículos…"
            />
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o)
          if (!o) setPendingDeleteId(null)
        }}
        title="Confirmar eliminación"
        description="¿Deseas eliminar este artículo?"
        confirmText="Eliminar"
        cancelText="Cancelar"
        tone="destructive"
        onConfirm={() => {
          if (pendingDeleteId) {
            deleteMutation.mutate(pendingDeleteId)
            setConfirmOpen(false)
            setPendingDeleteId(null)
          }
        }}
      />

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{countMode ? 'Conteo físico' : 'Ajustar cantidad'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Actual: {adjustItem?.qty ?? adjustItem?.values?.Cantidad ?? '—'}
            </p>
            {countMode ? (
              <div className="grid gap-1.5">
                <Label htmlFor="count-qty">Cantidad contada</Label>
                <Input
                  id="count-qty"
                  type="number"
                  min={0}
                  value={countQty}
                  onChange={(e) => setCountQty(e.target.value)}
                />
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="adj-delta">Cambio (+/−)</Label>
                <Input
                  id="adj-delta"
                  type="number"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  placeholder="Ej: -2 o 5"
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="adj-reason">Motivo (obligatorio)</Label>
              <Textarea
                id="adj-reason"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Rotura, consumo, error de carga…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
            <Button
              type="button"
              loading={adjustMutation.isPending}
              onClick={() => {
                if (!String(adjustReason || '').trim() || String(adjustReason).trim().length < 2) {
                  notify.warning('El motivo es obligatorio')
                  return
                }
                if (countMode) {
                  if (countQty === '' || !Number.isFinite(Number(countQty))) {
                    notify.warning('Indica la cantidad contada')
                    return
                  }
                } else if (!adjustDelta || Number(adjustDelta) === 0) {
                  notify.warning('El ajuste no puede ser cero')
                  return
                }
                adjustMutation.mutate()
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
