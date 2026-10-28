/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listFields, addField, updateField, deleteField, renameInventoryField } from '@/services/dynamicInventory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, Plus, ArrowUp, ArrowDown, GripVertical, Sparkles, Loader2, HelpCircle } from 'lucide-react'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormBuilderHelpModal } from '@/components/inventario/FormBuilderHelpModal'
import {
  arrayMove,
  optionsToCsv,
  parseOptionsCsv,
  toLabelFromName,
  FIELD_TYPE_GUIDES,
  FORM_STARTERS
} from '@/utils/inventoryFormUtils'

function typeGuide(type) {
  return FIELD_TYPE_GUIDES.find((t) => t.value === type) || FIELD_TYPE_GUIDES[0]
}

export function FormBuilder({ areaId, userId, onReadyToRegister }) {
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
  const [applyingStarter, setApplyingStarter] = useState(null)
  const [adding, setAdding] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    setLocalFields(sortedFields)
  }, [sortedFields])

  const persistOrder = async (nextList) => {
    const changes = nextList
      .map((f, idx) => ({ id: f.id, prev: f.order ?? 0, next: idx }))
      .filter((x) => x.prev !== x.next)

    if (changes.length === 0) return

    await Promise.all(changes.map((c) => updateField(c.id, { order: c.next }, userId)))
    queryClient.invalidateQueries({ queryKey: ['inventoryFields', areaId] })
  }

  const createFieldPayload = (field, order) => ({
    name: field.name,
    label: toLabelFromName(field.name),
    type: field.type,
    required: Boolean(field.required),
    options: field.type === 'select' ? (field.options || null) : null,
    order
  })

  const handleAddField = async () => {
    const name = String(newField.name || '').trim()
    if (!name) {
      notify.warning('Escribe el nombre de la pregunta (ej. Nombre, Cantidad)')
      return
    }

    const type = newField.type
    const options = type === 'select' ? parseOptionsCsv(newField.optionsText) : null

    if (type === 'select' && (!options || options.length === 0)) {
      notify.warning('Escribe al menos una opción, separadas por comas')
      return
    }

    setAdding(true)
    try {
      await addField(areaId, createFieldPayload({ name, type, required: newField.required, options }, localFields.length), userId)
      setNewField({ name: '', type: 'text', required: false, optionsText: '' })
      queryClient.invalidateQueries({ queryKey: ['inventoryFields', areaId] })
      notify.success('Pregunta agregada')
    } catch (e) {
      notify.error(getSupabaseErrorMessage(e))
    } finally {
      setAdding(false)
    }
  }

  const applyStarter = async (starter) => {
    if (!starter?.fields?.length) return
    setApplyingStarter(starter.id)
    try {
      let order = localFields.length
      for (const f of starter.fields) {
        await addField(areaId, createFieldPayload(f, order), userId)
        order += 1
      }
      queryClient.invalidateQueries({ queryKey: ['inventoryFields', areaId] })
      notify.success(`Listo: ${starter.title}`)
    } catch (e) {
      notify.error(getSupabaseErrorMessage(e))
    } finally {
      setApplyingStarter(null)
    }
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
    try {
      await updateField(fieldId, next, userId)
      queryClient.invalidateQueries({ queryKey: ['inventoryFields', areaId] })
    } catch (e) {
      notify.error(getSupabaseErrorMessage(e))
    }
  }

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
    try {
      await deleteField(pendingDeleteId, userId)
      queryClient.invalidateQueries({ queryKey: ['inventoryFields', areaId] })
    } catch (e) {
      notify.error(getSupabaseErrorMessage(e))
    } finally {
      setConfirmOpen(false)
      setPendingDeleteId(null)
    }
  }

  const moveByArrow = async (index, direction) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= localFields.length) return
    const next = arrayMove(localFields, index, nextIndex)
    setLocalFields(next)
    try {
      await persistOrder(next)
    } catch {
      notify.error('No se pudo reordenar')
    }
  }

  const handleDropOn = async (targetId) => {
    if (!draggingId || !targetId || draggingId === targetId) return
    const fromIndex = localFields.findIndex((f) => f.id === draggingId)
    const toIndex = localFields.findIndex((f) => f.id === targetId)
    if (fromIndex < 0 || toIndex < 0) return
    const next = arrayMove(localFields, fromIndex, toIndex)
    setLocalFields(next)
    setDraggingId(null)
    setDragOverId(null)
    try {
      await persistOrder(next)
    } catch {
      notify.error('No se pudo reordenar')
    }
  }

  const selectedGuide = typeGuide(newField.type)
  const isEmpty = !isLoading && localFields.length === 0

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">¿Qué quieres anotar de cada artículo?</h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-prose">
              Arma las preguntas de tu lista. Cuando registres algo, verás exactamente estos campos — sin jerga técnica.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full shrink-0 gap-2 sm:w-auto"
            onClick={() => setHelpOpen(true)}
          >
            <HelpCircle className="h-4 w-4" />
            ¿Necesitas ayuda?
          </Button>
        </div>
      </div>

      {/* Plantillas: siempre visibles si no hay preguntas; opcionales si ya hay pocas */}
      {isEmpty && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Empieza en un toque
            </CardTitle>
            <CardDescription>
              Elige un modelo listo. Luego puedes agregar, quitar o renombrar preguntas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FORM_STARTERS.map((starter) => (
                <button
                  key={starter.id}
                  type="button"
                  disabled={!!applyingStarter}
                  onClick={() => applyStarter(starter)}
                  className="flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-sm font-medium text-foreground flex items-center gap-2">
                    {applyingStarter === starter.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {starter.title}
                  </span>
                  <span className="text-xs text-muted-foreground leading-snug">{starter.description}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tus preguntas</CardTitle>
          {!isEmpty && (
            <CardDescription>Arrastra o usa las flechas para cambiar el orden.</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Cargando…</div>
          ) : isEmpty ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Todavía no hay preguntas.<br />
              Usa un modelo de arriba o agrega la primera abajo.
            </div>
          ) : (
            localFields.map((f, idx) => {
              const guide = typeGuide(f.type)
              const Icon = guide.Icon
              return (
                <div
                  key={f.id}
                  className={`rounded-lg border p-3 transition-colors ${dragOverId === f.id ? 'border-primary bg-primary/5' : ''}`}
                  draggable
                  onDragStart={() => setDraggingId(f.id)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOverId(f.id)
                  }}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleDropOn(f.id)
                  }}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-2">
                      <div className="mt-1 p-2 rounded-md border bg-background text-muted-foreground cursor-grab active:cursor-grabbing shrink-0">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1 grid gap-3">
                        <div className="grid gap-1.5">
                          <Label>Pregunta</Label>
                          <Input
                            defaultValue={f.name}
                            onBlur={(e) => handleRenameField(f, e.target.value)}
                            placeholder="Ej: Nombre, Cantidad, Marca"
                          />
                        </div>

                        <div className="grid gap-1.5">
                          <Label>Cómo se responde</Label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {FIELD_TYPE_GUIDES.map((t) => {
                              const TIcon = t.Icon
                              const active = f.type === t.value
                              return (
                                <button
                                  key={t.value}
                                  type="button"
                                  onClick={() => handleUpdateField(f.id, { type: t.value })}
                                  className={`flex items-start gap-2 rounded-md border p-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                    active
                                      ? 'border-primary bg-primary/10 text-foreground'
                                      : 'hover:bg-accent/50 text-muted-foreground'
                                  }`}
                                >
                                  <TIcon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${active ? 'text-primary' : ''}`} />
                                  <span className="leading-tight font-medium">{t.label}</span>
                                </button>
                              )
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5" />
                            {guide.example}
                          </p>
                        </div>

                        {f.type === 'select' && (
                          <div className="grid gap-1.5">
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

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t">
                          <label htmlFor={`field-req-${f.id}`} className="flex items-center gap-2 cursor-pointer select-none">
                            <Checkbox
                              id={`field-req-${f.id}`}
                              checked={Boolean(f.required)}
                              onCheckedChange={(checked) => handleUpdateField(f.id, { required: Boolean(checked) })}
                            />
                            <span className="text-sm">Hay que llenarlo sí o sí</span>
                          </label>
                          <div className="flex items-center gap-1.5">
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
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base">Agregar una pregunta</CardTitle>
              <CardDescription>Di qué quieres saber y cómo se responde.</CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto shrink-0 gap-1.5 self-start px-2 text-primary hover:text-primary"
              onClick={() => setHelpOpen(true)}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              ¿Necesitas ayuda?
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="new-field-name">Nombre de la pregunta</Label>
            <Input
              id="new-field-name"
              value={newField.name}
              onChange={(e) => setNewField({ ...newField, name: e.target.value })}
              placeholder="Ej: Nombre, Cantidad, Color"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Cómo se responde</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FIELD_TYPE_GUIDES.map((t) => {
                const TIcon = t.Icon
                const active = newField.type === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setNewField({ ...newField, type: t.value })}
                    className={`flex flex-col gap-1 rounded-md border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      active
                        ? 'border-primary bg-primary/10'
                        : 'hover:bg-accent/50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <TIcon className={`h-3.5 w-3.5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      {t.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground leading-snug">{t.example}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">{selectedGuide.example}</p>
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
              <span className="text-sm">Hay que llenarlo sí o sí</span>
            </label>
            <Button className="w-full gap-2 sm:w-auto" onClick={handleAddField} disabled={adding}>
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Agregar pregunta
            </Button>
          </div>
        </CardContent>
      </Card>

      {!isEmpty && typeof onReadyToRegister === 'function' && (
        <div className="flex justify-end">
          <Button onClick={onReadyToRegister} className="w-full sm:w-auto">
            Listo — empezar a registrar
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o)
          if (!o) setPendingDeleteId(null)
        }}
        title="¿Quitar esta pregunta?"
        description="Los artículos que ya guardaste seguirán existiendo, pero esta pregunta dejará de pedirse."
        confirmText="Quitar"
        cancelText="Cancelar"
        tone="destructive"
        onConfirm={confirmDelete}
      />

      <FormBuilderHelpModal open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}
