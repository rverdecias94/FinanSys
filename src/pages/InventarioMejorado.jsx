import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layers, Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { usePermissions } from '@/context/PermissionContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { getInventoryAreas, deleteArea } from '@/services/dynamicInventory'
import { AreaModal } from '@/components/inventario/AreaModal'
import { FormRunner } from '@/components/inventario/FormRunner'
import { FormBuilder } from '@/components/inventario/FormBuilder'
import { getAreaIcon } from '@/lib/areaIcons'
import { notify } from '@/services/notifications'

export default function InventarioMejorado() {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { isOwner } = usePermissions()
  const { checkLimit, subscription, PLAN_LIMITS } = useSubscription()
  const queryClient = useQueryClient()

  const userId = session?.user?.id
  const effectiveUserId = businessId

  const [selectedAreaId, setSelectedAreaId] = useState(null)
  const [mode, setMode] = useState('use')
  const [areaModalOpen, setAreaModalOpen] = useState(false)
  const [areaToEdit, setAreaToEdit] = useState(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [pendingDeleteAreaId, setPendingDeleteAreaId] = useState(null)

  const { data: areas = [], isLoading: loadingAreas } = useQuery({
    queryKey: ['inventoryAreas', effectiveUserId],
    queryFn: () => getInventoryAreas(effectiveUserId),
    enabled: !!effectiveUserId && !!userId
  })

  const planAreasLimit = (PLAN_LIMITS?.[subscription?.plan_id || 'free']?.areas) ?? 5
  const canCreateArea = isOwner && (planAreasLimit === Infinity || areas.length < planAreasLimit)

  const selectedArea = useMemo(() => {
    if (!selectedAreaId) return null
    return areas.find(a => a.id === selectedAreaId) || null
  }, [areas, selectedAreaId])

  const deleteAreaMutation = useMutation({
    mutationFn: async (id) => deleteArea(id, userId, businessId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryAreas', effectiveUserId] })
      if (pendingDeleteAreaId === selectedAreaId) {
        setSelectedAreaId(null)
        setMode('use')
      }
      notify.success('Área eliminada')
    },
    onError: () => {
      notify.error('Error al eliminar área')
    }
  })

  const openCreateArea = () => {
    if (!checkLimit('areas', areas.length)) return
    setAreaToEdit(null)
    setAreaModalOpen(true)
  }

  const openEditArea = (area) => {
    setAreaToEdit(area)
    setAreaModalOpen(true)
  }

  const requestDeleteArea = (areaId) => {
    setPendingDeleteAreaId(areaId)
    setConfirmDeleteOpen(true)
  }

  const confirmDeleteArea = async () => {
    if (!pendingDeleteAreaId) return
    await deleteAreaMutation.mutateAsync(pendingDeleteAreaId)
    setConfirmDeleteOpen(false)
    setPendingDeleteAreaId(null)
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

        {isOwner && (
          <Button onClick={openCreateArea} className="gap-2" disabled={!canCreateArea}>
            <Plus className="w-4 h-4" />
            Crear Nueva Área
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loadingAreas ? (
          <Card>
            <CardContent className="py-10 text-muted-foreground">Cargando áreas...</CardContent>
          </Card>
        ) : areas.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-muted-foreground">No hay áreas creadas aún</CardContent>
          </Card>
        ) : (
          areas.map(area => {
            const Icon = getAreaIcon(area.icon)
            const active = selectedAreaId === area.id
            const locked = area.plan_locked === true
            return (
              <div
                key={area.id}
                className={`min-w-0 rounded-xl border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 transition-colors ${active ? 'border-primary/50 bg-primary/5' : 'hover:bg-accent/30'}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-muted shrink-0">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{area.name}</div>
                    {(active || locked) && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {active && <Badge variant="default">Activo</Badge>}
                        {locked && <Badge variant="secondary">Bloqueada</Badge>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-end gap-2 border-t pt-3 sm:border-0 sm:pt-0">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedAreaId(area.id)
                      setMode('use')
                    }}
                  >
                    Abrir
                  </Button>
                  {isOwner && (
                    <>
                      <Button variant="outline" size="icon" onClick={() => openEditArea(area)} aria-label="Editar área" disabled={locked}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => requestDeleteArea(area.id)} aria-label="Eliminar área">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {selectedArea && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <div className="text-lg font-semibold truncate">{selectedArea.name}</div>
              {selectedArea.plan_locked === true && <Badge variant="secondary" className="shrink-0">Bloqueada</Badge>}
            </div>

            <div className="w-full sm:w-[240px] sm:shrink-0">
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="use">Usar Formulario</SelectItem>
                  <SelectItem value="edit" disabled={!isOwner || selectedArea.plan_locked === true}>Editar Campos del Formulario</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {mode === 'use' && (
            <FormRunner areaId={selectedArea.id} userId={effectiveUserId} currentArea={selectedArea} />
          )}

          {mode === 'edit' && (
            isOwner ? (
              selectedArea.plan_locked === true ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Área bloqueada</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground">
                    Esta área está en solo lectura por el plan actual.
                  </CardContent>
                </Card>
              ) : (
                <FormBuilder areaId={selectedArea.id} userId={effectiveUserId} />
              )
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Acceso restringido</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  No tienes permisos para editar la configuración del formulario.
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}

      <AreaModal
        open={areaModalOpen}
        onOpenChange={setAreaModalOpen}
        onSuccess={() => {
          setAreaModalOpen(false)
          setAreaToEdit(null)
        }}
        areaToEdit={areaToEdit}
        businessId={businessId}
        canCreate={canCreateArea}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={(o) => {
          setConfirmDeleteOpen(o)
          if (!o) setPendingDeleteAreaId(null)
        }}
        title="Confirmar eliminación"
        description="¿Deseas eliminar esta área? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        tone="destructive"
        loading={deleteAreaMutation.isPending}
        onConfirm={confirmDeleteArea}
      />
    </div>
  )
}
