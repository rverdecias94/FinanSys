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
import { Trash2, Pencil, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { notify } from '@/services/notifications'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { usePermissions } from '@/context/PermissionContext'
import { placeholderForType, toLabelFromName } from '@/utils/inventoryFormUtils'

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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [values, setValues] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const { hasPermission } = usePermissions()

  const { data: fields = [], isLoading: loadingFields } = useQuery({
    queryKey: ['inventoryFields', areaId],
    queryFn: () => listFields(areaId, userId),
    enabled: !!userId && !!areaId
  })

  const { data: itemsData, isLoading: loadingItems } = useQuery({
    queryKey: ['inventoryItems', areaId, { page, pageSize }],
    queryFn: () => listItems(areaId, { page, pageSize }, userId),
    enabled: !!userId && !!areaId,
    placeholderData: prev => prev
  })
  const items = itemsData?.data || []
  const count = itemsData?.count || 0
  const totalPages = Math.ceil(count / pageSize) || 1

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

  const visibleItems = useMemo(() => {
    if (!searchTerm) return items
    const t = searchTerm.toLowerCase()
    return items.filter(it => {
      const sku = String(it.sku || '').toLowerCase()
      const v = JSON.stringify(it.values || {}).toLowerCase()
      return sku.includes(t) || v.includes(t)
    })
  }, [items, searchTerm])

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
                        <Input type="date" {...commonProps} disabled={readOnly} onChange={readOnly ? undefined : commonProps.onChange} />
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
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
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
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por SKU o contenido..."
                className="pl-10"
              />
            </div>

            {loadingItems ? (
              <div className="text-muted-foreground">Cargando items...</div>
            ) : visibleItems.length === 0 ? (
              <div className="text-muted-foreground">No hay items registrados</div>
            ) : (
              visibleItems.map(item => (
                <div key={item.id} className="border rounded-md p-3 flex items-start justify-between gap-3">
                  <div className="text-sm">
                    <div className="text-muted-foreground">SKU {item.sku || '—'}</div>
                    {Object.entries(item.values || {}).map(([k, v]) => (
                      <div key={k}><span className="font-medium">{k}:</span> {String(v)}</div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
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
              ))
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Filas por página:</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
                  <SelectTrigger className="w-[96px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3">
                <div className="text-sm text-muted-foreground">Página {page} de {totalPages}</div>
                <div className="inline-flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} aria-label="Página anterior">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} aria-label="Página siguiente">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
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
