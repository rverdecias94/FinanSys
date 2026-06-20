/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { listFields, listItems, createItem, updateItem, deleteItem, validateValuesAgainstFields } from '@/services/dynamicInventory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Trash2, Pencil, Package } from 'lucide-react'
import { notify } from '@/services/notifications'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'
import { Calendar } from '@/components/ui/calendar'
import { usePermissions } from '@/context/PermissionContext'
import { placeholderForType, toLabelFromName } from '@/utils/inventoryFormUtils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// Convierte un valor de fecha guardado (string 'yyyy-MM-dd' o ISO) a Date local
// (evita el desfase de un día al interpretar 'yyyy-MM-dd' como UTC).
function parseDateValue(raw) {
  if (!raw) return null
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00`) : new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

// Formatea el valor de un item según el tipo de campo dinámico (igual criterio
// que usa el formulario), para que la fila del listado sea legible.
function formatFieldValue(field, raw) {
  if (raw === null || raw === undefined || raw === '') return '—'
  if (field?.type === 'boolean') return raw ? 'Sí' : 'No'
  if (field?.type === 'date') {
    const d = parseDateValue(raw)
    return d ? format(d, 'dd MMM yyyy', { locale: es }) : String(raw)
  }
  return String(raw)
}

// Indicador de obligatoriedad consistente para TODOS los tipos de campo.
// Antes solo lo mostraban los campos de texto, por lo que un campo requerido (p. ej. número)
// se veía igual que uno opcional. Esto unifica el asterisco rojo (requerido) / "(Opcional)".
function FieldRequiredMark({ required }) {
  return required
    ? <b className="text-red-500 ml-1">*</b>
    : <span className="text-muted-foreground ml-1">(Opcional)</span>
}

export function FormRunner({ areaId, userId, currentArea, mode = 'full', initialItem = null, readOnly = false }) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const { hasPermission } = usePermissions()

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

  // Mutaciones con mensajes automáticos configurados en 'meta'
  const createMutation = useMutation({
    mutationFn: (data) => createItem(areaId, data, userId),
    meta: {
      successMessage: "Producto agregado satisfactoriamente",
      errorMessage: "Error al agregar el producto"
    },
    onSuccess: () => {
      setValues({})
      queryClient.invalidateQueries({ queryKey: ['inventoryItems', areaId] })
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateItem(id, data, userId),
    meta: {
      successMessage: "Producto actualizado correctamente",
      errorMessage: "Error al actualizar el producto"
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
      successMessage: "Producto eliminado exitosamente",
      errorMessage: "Error al eliminar el producto"
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems', areaId] })
    }
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
        notify.warning(`Los campos numéricos deben ser mínimo 1: ${validation.invalidNumbers.join(', ')}`)
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
    // Scroll to form top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setValues({})
    setEditingId(null)
  }

  const canShowForm = readOnly ? true : (editingId ? hasPermission('inventory.edit') : hasPermission('inventory.create'))

  // Columnas DINÁMICAS: las cabeceras dependen de los campos del área.
  // Construimos una fila legible a partir de la definición de campos (`fields`)
  // y de los valores del item (`item.values`).
  const textFields = useMemo(() => fields.filter(f => f.type === 'text' || f.type === 'textarea'), [fields])

  const renderItem = (item) => {
    const itemValues = item.values || {}
    const labelFor = (f) => f.label || toLabelFromName(f.name)

    // Título: primer campo de texto, o SKU, con fallback al id.
    const firstText = textFields[0]
    const title =
      (firstText && itemValues[firstText.name] != null && String(itemValues[firstText.name]).trim()) ||
      (item.sku && String(item.sku).trim()) ||
      `Item ${item.id}`

    // Subtítulo: siguientes 2-3 campos como "Etiqueta: valor" separados por " · ".
    const subtitleFields = fields
      .filter(f => f !== firstText)
      .slice(0, 3)
    const subtitle = subtitleFields
      .map(f => `${labelFor(f)}: ${formatFieldValue(f, itemValues[f.name])}`)
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
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-3 sm:shrink-0 sm:justify-end sm:gap-4 sm:border-0 sm:pt-0">
          <div className="flex shrink-0 items-center gap-2">
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
      {canShowForm && (
        <Card>
          <CardHeader>
            <CardTitle>Formulario para {currentArea?.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingFields ? (
              <div className="text-muted-foreground">Cargando formulario...</div>
            ) : fields.length === 0 ? (
              <div className="text-muted-foreground">No hay campos configurados en esta área</div>
            ) : (
              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {fields.map(f => {
                  const label = f.label || toLabelFromName(f.name)
                  const commonProps = {
                    id: `field_${f.name}`,
                    required: f.required,
                    value: values[f.name] ?? '',
                    onChange: e => setValues({ ...values, [f.name]: e.target.value })
                  }
                  if (f.type === 'text' || f.type === 'textarea') {
                    return (
                      <div key={f.id} className="grid gap-1">
                        <Label htmlFor={commonProps.id}>{label}<FieldRequiredMark required={f.required} /></Label>
                        {f.type === 'textarea' ? (
                          <Textarea
                            id={commonProps.id}
                            value={commonProps.value}
                            required={commonProps.required}
                            onChange={readOnly ? undefined : commonProps.onChange}
                            disabled={readOnly}
                            placeholder={placeholderForType('textarea')}
                          />
                        ) : (
                          <Input {...commonProps} disabled={readOnly} onChange={readOnly ? undefined : commonProps.onChange} placeholder={placeholderForType('text')} />
                        )}
                      </div>
                    )
                  }
                  if (f.type === 'number') {
                    return (
                      <div key={f.id} className="grid gap-1">
                        <Label htmlFor={commonProps.id}>{label}<FieldRequiredMark required={f.required} /></Label>
                        <Input
                          type="number"
                          min={1}
                          id={commonProps.id}
                          required={commonProps.required}
                          value={commonProps.value}
                          placeholder={placeholderForType('number')}
                          disabled={readOnly}
                          onChange={(e) => {
                            if (readOnly) return
                            const raw = e.target.value
                            if (raw === '') {
                              setValues({ ...values, [f.name]: '' })
                              return
                            }
                            const n = Number(raw)
                            if (!Number.isFinite(n)) return
                            setValues({ ...values, [f.name]: String(Math.max(1, n)) })
                          }}
                        />
                      </div>
                    )
                  }
                  if (f.type === 'date') {
                    return (
                      <div key={f.id} className="grid gap-1">
                        <Label htmlFor={commonProps.id}>{label}<FieldRequiredMark required={f.required} /></Label>
                        <Calendar
                          value={parseDateValue(values[f.name])}
                          disabled={readOnly}
                          placeholder="Selecciona una fecha"
                          // Permitir fechas futuras (p. ej. vencimientos), a diferencia del default.
                          options={{ maxDate: null }}
                          onChange={readOnly ? undefined : (d) => setValues({ ...values, [f.name]: d ? format(d, 'yyyy-MM-dd') : '' })}
                        />
                      </div>
                    )
                  }
                  if (f.type === 'color') {
                    return (
                      <div key={f.id} className="grid gap-1">
                        <Label htmlFor={commonProps.id}>{label}<FieldRequiredMark required={f.required} /></Label>
                        <Input type="color" {...commonProps} disabled={readOnly} onChange={readOnly ? undefined : commonProps.onChange} />
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
                        <Label htmlFor={commonProps.id}>{label}<FieldRequiredMark required={f.required} /></Label>
                      </div>
                    )
                  }
                  if (f.type === 'select') {
                    const options = Array.isArray(f.options) ? f.options : []
                    return (
                      <div key={f.id} className="grid gap-1">
                        <Label htmlFor={commonProps.id}>{label}<FieldRequiredMark required={f.required} /></Label>
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
                            {options.map(opt => <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  }
                  return null
                })}
                {!readOnly && (
                  <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                    {editingId && (
                      <Button type="button" variant="outline" onClick={handleCancelEdit}>
                        Cancelar Edición
                      </Button>
                    )}
                    <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                      {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : (editingId ? 'Actualizar Item' : 'Guardar Item')}
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
            <CardTitle>Artículos Registrados</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveListing
              queryKey={itemsQueryKey}
              queryFn={({ page, pageSize }) => listItems(areaId, { page, pageSize }, userId)}
              enabled={!!userId && !!areaId}
              getItemKey={(item) => item.id}
              renderItem={renderItem}
              emptyMessage="No hay items registrados"
              loadingMessage="Cargando items..."
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
    </div>
  )
}
