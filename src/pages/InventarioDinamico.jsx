import { useState } from 'react'
import { Layers, PlusCircle, Trash2, Pencil } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { listAreas, getArea, deleteArea } from '@/services/dynamicInventory'
import { AreaModal } from '@/components/inventario/AreaModal'
import { DeleteConfirmationModal } from '@/components/inventario/DeleteConfirmationModal'
import { FormBuilder } from '@/components/inventario/FormBuilder'
import { FormRunner } from '@/components/inventario/FormRunner'
import { getAreaIcon } from '@/lib/areaIcons'

export default function InventarioDinamico() {
  const { session } = useSession()
  const userId = session?.user?.id
  const queryClient = useQueryClient()
  const [areaModalOpen, setAreaModalOpen] = useState(false)
  const [editingArea, setEditingArea] = useState(null)

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletingAreaId, setDeletingAreaId] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [selectedAreaId, setSelectedAreaId] = useState(null)
  const [mode, setMode] = useState('use') // 'edit' | 'use'

  const { data: areas = [], isLoading: loadingAreas } = useQuery({
    queryKey: ['inventoryAreas'],
    queryFn: () => listAreas(userId),
    enabled: !!userId
  })

  const { data: currentArea } = useQuery({
    queryKey: ['inventoryArea', selectedAreaId],
    queryFn: () => getArea(selectedAreaId, userId),
    enabled: !!userId && !!selectedAreaId
  })

  const handleAreaSaved = () => {
    setAreaModalOpen(false)
    setEditingArea(null)
    queryClient.invalidateQueries({ queryKey: ['inventoryAreas'] })
    if (selectedAreaId) {
      queryClient.invalidateQueries({ queryKey: ['inventoryArea', selectedAreaId] })
    }
  }

  const handleEditClick = (e, area) => {
    e.stopPropagation()
    setEditingArea(area)
    setAreaModalOpen(true)
  }

  const handleDeleteClick = (e, areaId) => {
    e.stopPropagation()
    setDeletingAreaId(areaId)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingAreaId) return
    setDeleteLoading(true)
    try {
      await deleteArea(deletingAreaId, userId)
      queryClient.invalidateQueries({ queryKey: ['inventoryAreas'] })
      if (selectedAreaId === deletingAreaId) {
        setSelectedAreaId(null)
      }
      setDeleteModalOpen(false)
      setDeletingAreaId(null)
    } catch (error) {
      console.error('Error deleting area:', error)
      alert('Error al eliminar el área')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Layers className="w-8 h-8 text-primary" />
          </div>
          Inventario
        </h1>
        <Button onClick={() => { setEditingArea(null); setAreaModalOpen(true) }} className="gap-2">
          <PlusCircle className="w-4 h-4" />
          Crear Nueva Área
        </Button>
      </div>

      <AreaModal
        open={areaModalOpen}
        onOpenChange={(open) => { setAreaModalOpen(open); if (!open) setEditingArea(null); }}
        onSuccess={handleAreaSaved}
        areaToEdit={editingArea}
      />

      <DeleteConfirmationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar Área?"
        description="¿Estás seguro de que deseas eliminar esta área? Esta acción no se puede deshacer y eliminará permanentemente todos los ítems, configuraciones y registros asociados a esta área."
        loading={deleteLoading}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loadingAreas ? (
          <Card><CardContent className="py-6 text-muted-foreground">Cargando áreas...</CardContent></Card>
        ) : areas.length === 0 ? (
          <Card><CardContent className="py-6 text-muted-foreground">No hay áreas creadas aún</CardContent></Card>
        ) : (
          areas.map(a => {
            const IconComp = getAreaIcon(a.icon)
            const isSelected = selectedAreaId === a.id
            return (
              <Card
                key={a.id}
                className={`transition-colors ${isSelected ? 'border-primary bg-primary/10' : 'hover:bg-accent/50'}`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconComp className="w-5 h-5 text-muted-foreground" />
                      <span>{a.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => setSelectedAreaId(a.id)}>
                        {isSelected ? 'Activo' : 'Abrir'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={(e) => handleEditClick(e, a)}
                        title="Editar Área"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                        onClick={(e) => handleDeleteClick(e, a.id)}
                        title="Eliminar Área"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
              </Card>
            )
          })
        )}
      </div>

      {selectedAreaId && currentArea && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              {(() => {
                const IconComp = getAreaIcon(currentArea.icon)
                return <IconComp className="w-6 h-6 text-primary" />
              })()}
              {currentArea.name}
            </h2>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Modo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="edit">Editar Campos del Formulario</SelectItem>
                <SelectItem value="use">Usar Formulario</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === 'edit' ? (
            <FormBuilder areaId={selectedAreaId} userId={userId} />
          ) : (
            <FormRunner areaId={selectedAreaId} userId={userId} currentArea={currentArea} />
          )}
        </div>
      )}
    </div>
  )
}
