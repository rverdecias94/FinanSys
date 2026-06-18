/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listFields, addField, updateField, deleteField, renameInventoryField } from '@/services/dynamicInventory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, Plus, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { arrayMove, optionsToCsv, parseOptionsCsv, toLabelFromName } from '@/utils/inventoryFormUtils'

const TYPE_OPTIONS = [
  { value: 'text', label: 'Texto', hint: 'Texto corto en una línea (ej. nombre, marca).' },
  { value: 'number', label: 'Número', hint: 'Solo números (ej. cantidad, precio).' },
  { value: 'select', label: 'Lista de opciones', hint: 'El usuario elige de una lista que tú defines.' },
  { value: 'color', label: 'Color', hint: 'Un color para identificar el artículo.' },
  { value: 'date', label: 'Fecha', hint: 'Una fecha (ej. compra o vencimiento).' },
  { value: 'boolean', label: 'Sí / No', hint: 'Una casilla para marcar Sí o No.' },
  { value: 'textarea', label: 'Texto largo', hint: 'Texto de varias líneas (ej. descripción, notas).' }
]

export function FormBuilder({ areaId, userId }) {
  const queryClient = useQueryClient()
  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['inventoryFields', areaId],
    queryFn: () => listFields(areaId, userId),
    enabled: !!userId && !!areaId
  })

  const sortedFields = useMemo(() => {
    return [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [fields])

  const [localFields, setLocalFields] = useState([])
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)

  const [newField, setNewField] = useState({ name: '', type: 'text', required: false, optionsText: '' })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  useEffect(() => {
    setLocalFields(sortedFields)
  }, [sortedFields])

  const persistOrder = async (nextList) => {
    const changes = nextList
      .map((f, idx) => ({ id: f.id, prev: f.order ?? 0, next: idx }))
      .filter(x => x.prev !== x.next)

    if (changes.length === 0) return

    await Promise.all(changes.map(c => updateField(c.id, { order: c.next }, userId)))
    queryClient.invalidateQueries({ queryKey: ['inventoryFields', areaId] })
  }

  const handleAddField = async () => {
    const name = String(newField.name || '').trim()
    if (!name) {
      notify.warning('Nombre es obligatorio')
      return
    }

    const type = newField.type
    const options = type === 'select' ? parseOptionsCsv(newField.optionsText) : null

    if (type === 'select' && (!options || options.length === 0)) {
      notify.warning('Ingresa al menos una opción separada por comas')
      return
    }

    const payload = {
      name,
      label: toLabelFromName(name),
      type,
      required: Boolean(newField.required),
      options,
      order: localFields.length
    }

    await addField(areaId, payload, userId)
    setNewField({ name: '', type: 'text', required: false, optionsText: '' })
    queryClient.invalidateQueries({ queryKey: ['inventoryFields', areaId] })
  }

  const handleUpdateField = async (fieldId, changes) => {
    const next = { ...changes }
    if (typeof next.name === 'string') {
      const name = next.name.trim()
      next.name = name
      next.label = toLabelFromName(name)
    }
    if (next.type && next.type !== 'select') {
      next.options = null
    }
    await updateField(fieldId, next, userId)
    queryClient.invalidateQueries({ queryKey: ['inventoryFields', areaId] })
  }

  // P1.9: renombrar pasa por la RPC para re-indexar los values de los ítems (evita huérfanos).
  const handleRenameField = async (field, rawNewName) => {
    const newName = String(rawNewName || '').trim()
    if (!newName || newName === field.name) return
    try {
      await renameInventoryField(field.id, newName)
      queryClient.invalidateQueries({ queryKey: ['inventoryFields', areaId] })
      queryClient.invalidateQueries({ queryKey: ['inventoryItems', areaId] })
    } catch (e) {
      notify.error(getSupabaseErrorMessage(e))
    }
  }

  const handleDeleteField = async (fieldId) => {
    setPendingDeleteId(fieldId)
    setConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    await deleteField(pendingDeleteId, userId)
    setConfirmOpen(false)
    setPendingDeleteId(null)
    queryClient.invalidateQueries({ queryKey: ['inventoryFields', areaId] })
  }

  const moveByArrow = async (index, direction) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= localFields.length) return
    const next = arrayMove(localFields, index, nextIndex)
    setLocalFields(next)
    try {
      await persistOrder(next)
    } catch {
      notify.error('Error al reordenar campos')
    }
  }

  const handleDropOn = async (targetId) => {
    if (!draggingId || !targetId || draggingId === targetId) return
    const fromIndex = localFields.findIndex(f => f.id === draggingId)
    const toIndex = localFields.findIndex(f => f.id === targetId)
    if (fromIndex < 0 || toIndex < 0) return
    const next = arrayMove(localFields, fromIndex, toIndex)
    setLocalFields(next)
    setDraggingId(null)
    setDragOverId(null)
    try {
      await persistOrder(next)
    } catch {
      notify.error('Error al reordenar campos')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Campos del Formulario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="text-muted-foreground">Cargando campos...</div>
          ) : localFields.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aún no hay campos en esta área.<br />
              Agrega tu primer campo abajo (por ejemplo <span className="font-medium text-foreground">Nombre</span> y <span className="font-medium text-foreground">Cantidad</span>) para empezar a registrar artículos.
            </div>
          ) : (
            localFields.map((f, idx) => (
              <div
                key={f.id}
                className={
                  `rounded-lg border p-3 transition-colors ${dragOverId === f.id ? 'border-primary' : ''}`
                }
                draggable
                onDragStart={() => {
                  setDraggingId(f.id)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverId(f.id)
                }}
                onDragLeave={() => {
                  setDragOverId(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  handleDropOn(f.id)
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-1 flex items-center justify-start">
                    <div className="p-2 rounded-md border bg-background text-muted-foreground cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="md:col-span-4 grid gap-1">
                    <Label>Nombre</Label>
                    <Input
                      defaultValue={f.name}
                      onBlur={(e) => handleRenameField(f, e.target.value)}
                      placeholder="Ej: nombre, cantidad, tipo"
                    />
                  </div>

                  <div className="md:col-span-3 grid gap-1">
                    <Label>Tipo</Label>
                    <Select defaultValue={f.type} onValueChange={(v) => handleUpdateField(f.id, { type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2 grid gap-1">
                    <Label htmlFor={`field-req-${f.id}`}>Obligatorio</Label>
                    <label htmlFor={`field-req-${f.id}`} className="flex h-9 items-center gap-2 cursor-pointer select-none">
                      <Checkbox
                        id={`field-req-${f.id}`}
                        checked={Boolean(f.required)}
                        onCheckedChange={(checked) => handleUpdateField(f.id, { required: Boolean(checked) })}
                      />
                      <span className="text-sm text-muted-foreground">{f.required ? 'Sí' : 'No'}</span>
                    </label>
                  </div>

                  <div className="md:col-span-2 flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => moveByArrow(idx, -1)}
                      disabled={idx === 0}
                      aria-label="Subir"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => moveByArrow(idx, 1)}
                      disabled={idx === localFields.length - 1}
                      aria-label="Bajar"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDeleteField(f.id)} aria-label="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {f.type === 'select' && (
                  <div className="grid gap-1 mt-3">
                    <Label>Opciones (separadas por comas)</Label>
                    <Input
                      defaultValue={optionsToCsv(f.options)}
                      placeholder="Ej: Chico, Mediano, Grande"
                      onBlur={(e) => {
                        const parsed = parseOptionsCsv(e.target.value)
                        handleUpdateField(f.id, { options: parsed })
                      }}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agregar Campo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div className="grid gap-1.5">
              <Label htmlFor="new-field-name">Nombre del campo</Label>
              <Input id="new-field-name" value={newField.name} onChange={e => setNewField({ ...newField, name: e.target.value })} placeholder="Ej: nombre, cantidad, color" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-field-type">Tipo de dato</Label>
              <Select value={newField.type} onValueChange={(v) => setNewField({ ...newField, type: v })}>
                <SelectTrigger id="new-field-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {TYPE_OPTIONS.find(t => t.value === newField.type)?.hint}
              </p>
            </div>
          </div>

          {newField.type === 'select' && (
            <div className="grid gap-1.5">
              <Label htmlFor="new-field-options">Opciones (separadas por comas)</Label>
              <Input
                id="new-field-options"
                value={newField.optionsText}
                onChange={(e) => setNewField({ ...newField, optionsText: e.target.value })}
                placeholder="Ej: Chico, Mediano, Grande"
              />
            </div>
          )}

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <label htmlFor="new-field-required" className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                id="new-field-required"
                checked={newField.required}
                onCheckedChange={(checked) => setNewField({ ...newField, required: Boolean(checked) })}
              />
              <span className="text-sm">¿Obligatorio? <span className="text-muted-foreground">(el usuario deberá rellenarlo)</span></span>
            </label>
            <Button className="w-full gap-2 sm:w-auto" onClick={handleAddField}>
              <Plus className="w-4 h-4" />
              Agregar campo
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o)
          if (!o) setPendingDeleteId(null)
        }}
        title="Confirmar eliminación"
        description="Eliminar este campo puede afectar formularios existentes. ¿Deseas continuar?"
        confirmText="Eliminar"
        cancelText="Cancelar"
        tone="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
