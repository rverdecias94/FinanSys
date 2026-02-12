/* eslint-disable react/prop-types */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listFields, addField, updateField, deleteField } from '@/services/dynamicInventory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, Plus } from 'lucide-react'

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

  const [newField, setNewField] = useState({ name: '', label: '', type: 'text', required: false, options: null, order: (fields?.length || 0) })

  const handleAddField = async () => {
    if (!newField.name || !newField.label) {
      alert('Nombre y etiqueta son obligatorios')
      return
    }
    await addField(areaId, newField, userId)
    setNewField({ name: '', label: '', type: 'text', required: false, options: null, order: (fields?.length || 0) + 1 })
    queryClient.invalidateQueries({ queryKey: ['inventoryFields', areaId] })
  }

  const handleUpdateField = async (fieldId, changes) => {
    await updateField(fieldId, changes, userId)
    queryClient.invalidateQueries({ queryKey: ['inventoryFields', areaId] })
  }

  const handleDeleteField = async (fieldId) => {
    await deleteField(fieldId, userId)
    queryClient.invalidateQueries({ queryKey: ['inventoryFields', areaId] })
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
          ) : fields.length === 0 ? (
            <div className="text-muted-foreground">No hay campos configurados aún</div>
          ) : (
            fields.map(f => (
              <div key={f.id} className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
                <div className="grid gap-1">
                  <Label>Nombre</Label>
                  <Input defaultValue={f.name} onBlur={(e) => handleUpdateField(f.id, { name: e.target.value })} />
                </div>
                <div className="grid gap-1">
                  <Label>Etiqueta</Label>
                  <Input defaultValue={f.label} onBlur={(e) => handleUpdateField(f.id, { label: e.target.value })} />
                </div>
                <div className="grid gap-1">
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
                <div className="grid gap-1">
                  <Label>Requerido</Label>
                  <Select defaultValue={String(f.required)} onValueChange={(v) => handleUpdateField(f.id, { required: v === 'true' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">Opcional</SelectItem>
                      <SelectItem value="true">Requerido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label>Orden</Label>
                  <Input type="number" defaultValue={f.order || 0} onBlur={(e) => handleUpdateField(f.id, { order: Number(e.target.value) })} />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="destructive" size="icon" onClick={() => handleDeleteField(f.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                {f.type === 'select' && (
                  <div className="sm:col-span-6 grid gap-1">
                    <Label>Opciones (JSON)</Label>
                    <Input
                      defaultValue={JSON.stringify(f.options || [])}
                      onBlur={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value || '[]')
                          handleUpdateField(f.id, { options: parsed })
                        } catch {
                          alert('JSON inválido en opciones')
                        }
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
            <Input value={newField.name} onChange={e => setNewField({ ...newField, name: e.target.value })} />
          </div>
          <div className="grid gap-1">
            <Label>Etiqueta</Label>
            <Input value={newField.label} onChange={e => setNewField({ ...newField, label: e.target.value })} />
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
          <div className="grid gap-1">
            <Label>Orden</Label>
            <Input type="number" value={newField.order} onChange={e => setNewField({ ...newField, order: Number(e.target.value) })} />
          </div>
          <div className="flex items-end">
            <Button className="gap-2" onClick={handleAddField}>
              <Plus className="w-4 h-4" />
              Agregar
            </Button>
          </div>
          {newField.type === 'select' && (
            <div className="sm:col-span-6 grid gap-1">
              <Label>Opciones (JSON)</Label>
              <Input
                placeholder='["opcion1","opcion2"]'
                onBlur={(e) => {
                  if (!e.target.value) return
                  try {
                    const parsed = JSON.parse(e.target.value)
                    setNewField({ ...newField, options: parsed })
                  } catch {
                    alert('JSON inválido en opciones')
                  }
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
