/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listFields, addField, updateField, deleteField } from '@/services/dynamicInventory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, Plus, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import { notify } from '@/services/notifications'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { arrayMove, optionsToCsv, parseOptionsCsv, toLabelFromName } from '@/utils/inventoryFormUtils'

const TYPE_OPTIONS = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'select', label: 'Selección' },
  { value: 'color', label: 'Color' },
  { value: 'date', label: 'Fecha' },
  { value: 'boolean', label: 'Sí/No (Booleano)' },
  { value: 'textarea', label: 'Área de Texto' }
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
            <div className="text-muted-foreground">No hay campos configurados aún</div>
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
                      onBlur={(e) => handleUpdateField(f.id, { name: e.target.value })}
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
                    <Label>Requerido</Label>
                    <Select defaultValue={String(Boolean(f.required))} onValueChange={(v) => handleUpdateField(f.id, { required: v === 'true' })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">Opcional</SelectItem>
                        <SelectItem value="true">Requerido</SelectItem>
                      </SelectContent>
                    </Select>
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
        <CardContent className="grid grid-cols-1 sm:grid-cols-6 gap-2">
          <div className="grid gap-1">
            <Label>Nombre</Label>
            <Input value={newField.name} onChange={e => setNewField({ ...newField, name: e.target.value })} placeholder="Ej: nombre, cantidad, tipo" />
          </div>
          <div className="grid gap-1">
            <Label>Tipo</Label>
            <Select value={newField.type} onValueChange={(v) => setNewField({ ...newField, type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Requerido</Label>
            <Select value={String(newField.required)} onValueChange={(v) => setNewField({ ...newField, required: v === 'true' })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Opcional</SelectItem>
                <SelectItem value="true">Requerido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="gap-2" onClick={handleAddField}>
              <Plus className="w-4 h-4" />
              Agregar
            </Button>
          </div>
          {newField.type === 'select' && (
            <div className="sm:col-span-6 grid gap-1">
              <Label>Opciones (separadas por comas)</Label>
              <Input
                value={newField.optionsText}
                onChange={(e) => setNewField({ ...newField, optionsText: e.target.value })}
                placeholder="Ej: Chico, Mediano, Grande"
              />
            </div>
          )}
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
