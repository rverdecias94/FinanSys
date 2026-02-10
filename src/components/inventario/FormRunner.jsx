/* eslint-disable react/prop-types */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listFields, listItems, createItem, updateItem, deleteItem, validateValuesAgainstFields } from '@/services/dynamicInventory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, Pencil } from 'lucide-react'

export function FormRunner({ areaId, userId, currentArea }) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [values, setValues] = useState({})
  const [editingId, setEditingId] = useState(null)

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validation = await validateValuesAgainstFields(values, areaId, userId)
    if (!validation.ok) {
      alert(`Faltan campos requeridos: ${validation.missing.join(', ')}`)
      return
    }

    if (editingId) {
      await updateItem(editingId, values, userId)
      setEditingId(null)
    } else {
      await createItem(areaId, values, userId)
    }

    setValues({})
    queryClient.invalidateQueries({ queryKey: ['inventoryItems', areaId] })
  }

  const handleDeleteItem = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este artículo?')) {
      await deleteItem(id, userId)
      queryClient.invalidateQueries({ queryKey: ['inventoryItems', areaId] })
    }
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

  return (
    <div className="space-y-6">
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
                const commonProps = {
                  id: `field_${f.name}`,
                  required: f.required,
                  value: values[f.name] ?? '',
                  onChange: e => setValues({ ...values, [f.name]: e.target.value })
                }
                if (f.type === 'text' || f.type === 'textarea') {
                  return (
                    <div key={f.id} className="grid gap-1">
                      <Label htmlFor={commonProps.id}>{f.label}
                        {f.required ? <b className="text-red-500 ml-1">*</b> : <span className="text-muted-foreground ml-1">(Opcional)</span>}
                      </Label>
                      <Input {...commonProps} />
                    </div>
                  )
                }
                if (f.type === 'number') {
                  return (
                    <div key={f.id} className="grid gap-1">
                      <Label htmlFor={commonProps.id}>{f.label}</Label>
                      <Input type="number" {...commonProps} />
                    </div>
                  )
                }
                if (f.type === 'date') {
                  return (
                    <div key={f.id} className="grid gap-1">
                      <Label htmlFor={commonProps.id}>{f.label}</Label>
                      <Input type="date" {...commonProps} />
                    </div>
                  )
                }
                if (f.type === 'color') {
                  return (
                    <div key={f.id} className="grid gap-1">
                      <Label htmlFor={commonProps.id}>{f.label}</Label>
                      <Input type="color" {...commonProps} />
                    </div>
                  )
                }
                if (f.type === 'boolean') {
                  return (
                    <div key={f.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={Boolean(values[f.name])}
                        onCheckedChange={(checked) => setValues({ ...values, [f.name]: Boolean(checked) })}
                      />
                      <Label htmlFor={commonProps.id}>{f.label}</Label>
                    </div>
                  )
                }
                if (f.type === 'select') {
                  const options = Array.isArray(f.options) ? f.options : []
                  return (
                    <div key={f.id} className="grid gap-1">
                      <Label htmlFor={commonProps.id}>{f.label}</Label>
                      <Select
                        value={String(values[f.name] ?? '')}
                        onValueChange={(v) => setValues({ ...values, [f.name]: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona..." />
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
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                {editingId && (
                  <Button type="button" variant="outline" onClick={handleCancelEdit}>
                    Cancelar Edición
                  </Button>
                )}
                <Button type="submit">
                  {editingId ? 'Actualizar Item' : 'Guardar Item'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Artículos Registrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingItems ? (
            <div className="text-muted-foreground">Cargando items...</div>
          ) : items.length === 0 ? (
            <div className="text-muted-foreground">No hay items registrados</div>
          ) : (
            items.map(item => (
              <div key={item.id} className="border rounded-md p-3 flex items-start justify-between gap-3">
                <div className="text-sm">
                  <div className="text-muted-foreground">SKU {item.sku || '—'}</div>
                  {Object.entries(item.values || {}).map(([k, v]) => (
                    <div key={k}><span className="font-medium">{k}:</span> {String(v)}</div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleEditItem(item)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDeleteItem(item.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>Filas por página:</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
                <SelectTrigger className="w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
              <div className="inline-flex gap-2 ml-3">
                <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Anterior</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>Siguiente</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
