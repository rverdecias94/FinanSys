import { useEffect, useMemo, useState } from 'react'
import { onlineManager, useIsRestoring, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layers, Plus, Pencil, Trash2, ClipboardList, Settings2, CloudOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { prefetchInventorySnapshot } from '@/offline/prefetchReadSnapshots'
import { OfflineBlockedPanel } from '@/components/common/OfflineBlockedPanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { usePermissions } from '@/context/PermissionContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { getInventoryAreas, deleteArea } from '@/services/dynamicInventory'
import { PlanLimitFeedback } from '@/components/common/PlanLimitFeedback'
import { AreaModal } from '@/components/inventario/AreaModal'
import { FormRunner } from '@/components/inventario/FormRunner'
import { FormBuilder } from '@/components/inventario/FormBuilder'
import { getAreaIcon } from '@/lib/areaIcons'
import { notify } from '@/services/notifications'
import { DOMAIN_LABELS } from '@/utils/inventoryFormUtils'
import { CardsBodySkeleton } from '@/components/common/pageSkeletons'

export default function InventarioMejorado() {
  const { session } = useSession()
  const { businessId, loading: businessLoading } = useBusiness()
  const { isOwner } = usePermissions()
  const { checkLimit, subscription, PLAN_LIMITS } = useSubscription()
  const queryClient = useQueryClient()
  const online = useOnlineStatus()
  const isRestoring = useIsRestoring()

  const userId = session?.user?.id
  const effectiveUserId = businessId

  const [selectedAreaId, setSelectedAreaId] = useState(null)
  const [mode, setMode] = useState('use')
  const [areaModalOpen, setAreaModalOpen] = useState(false)
  const [areaToEdit, setAreaToEdit] = useState(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [pendingDeleteAreaId, setPendingDeleteAreaId] = useState(null)

  useEffect(() => {
    if (!online || !userId || !businessId || businessLoading || isRestoring) return undefined
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void prefetchInventorySnapshot(queryClient, { userId, businessId })
    })
    return () => { cancelled = true }
  }, [online, userId, businessId, businessLoading, isRestoring, queryClient])

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

  const selectedPending = Boolean(
    selectedArea?._pending || String(selectedArea?.id || '').startsWith('pending-'),
  )

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
    if (area?._pending) {
      notify.info('Esta área aún no se ha sincronizado. Espera a que se suba para editarla de nuevo.')
      return
    }
    setAreaToEdit(area)
    setAreaModalOpen(true)
  }

  const requestDeleteArea = (areaId) => {
    if (String(areaId).startsWith('pending-')) {
      notify.info('Esta área aún no se ha sincronizado. Espera a que se suba para eliminarla.')
      return
    }
    if (!onlineManager.isOnline()) {
      notify.warning('Sin conexión no se pueden eliminar áreas. Reconecta e inténtalo de nuevo.')
      return
    }
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
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Layers className="w-8 h-8 text-primary" />
          </div>
          <div>
            Inventario
            <p className="mt-1 text-sm font-normal text-muted-foreground">
              Áreas, equipos y listas personalizadas (no es el stock de venta).
            </p>
            <PlanLimitFeedback metric="areas" label="Áreas" currentCount={areas.length} className="mt-1" />
          </div>
        </h1>

        {isOwner && (
          <Button
            onClick={openCreateArea}
            className="h-11 w-full shrink-0 justify-center gap-2 sm:w-auto"
            disabled={!canCreateArea}
            title={!canCreateArea ? 'Has alcanzado el límite de áreas de tu plan. Mejora a Premium para crear más.' : undefined}
          >
            <Plus className="w-4 h-4" />
            Crear Nueva Área
          </Button>
        )}
      </div>

      {isRestoring || loadingAreas ? (
        <CardsBodySkeleton cards={6} />
      ) : (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {areas.length === 0 ? (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="py-10 text-center space-y-3">
              <p className="text-base font-medium text-foreground">
                {online ? 'Crea tu primera área' : 'Sin copia local de áreas'}
              </p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {online
                  ? 'Un área agrupa lo que quieres controlar (equipos, suministros, listas…). Si vas a comprar y vender mercancía con stock y costo, usa Almacén.'
                  : 'Entra con conexión una vez para guardar tus áreas aquí, o créalas offline y se subirán al reconectar.'}
              </p>
              {isOwner && (
                <Button onClick={openCreateArea} className="gap-2" disabled={!canCreateArea}>
                  <Plus className="w-4 h-4" />
                  Crear área
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          areas.map(area => {
            const Icon = getAreaIcon(area.icon)
            const active = selectedAreaId === area.id
            const locked = area.plan_locked === true
            return (
              <div
                key={area.id}
                className={`flex h-full min-w-0 flex-col gap-3 rounded-xl border p-4 transition-colors ${active ? 'border-primary/50 bg-primary/5' : 'hover:bg-accent/30'}`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="shrink-0 rounded-lg bg-muted p-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold leading-snug break-words text-foreground">
                      {area.name}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {area.domain_type && area.domain_type !== 'custom' && (
                        <Badge variant="outline">{DOMAIN_LABELS[area.domain_type] || area.domain_type}</Badge>
                      )}
                      {active && <Badge variant="default">Activo</Badge>}
                      {locked && <Badge variant="secondary">Bloqueada</Badge>}
                      {area._pending && (
                        <Badge variant="outline" className="gap-1 border-warning/40 text-warning">
                          <CloudOff className="h-3 w-3" aria-hidden="true" />
                          Por sincronizar
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-auto flex items-center gap-2 border-t pt-3">
                  <Button
                    variant="outline"
                    className="min-w-0 flex-1"
                    onClick={() => {
                      setSelectedAreaId(area.id)
                      setMode('use')
                    }}
                  >
                    Abrir
                  </Button>
                  {isOwner && (
                    <>
                      <Button variant="outline" size="icon" className="shrink-0" onClick={() => openEditArea(area)} aria-label="Editar área" disabled={locked || Boolean(area._pending)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" className="shrink-0" onClick={() => requestDeleteArea(area.id)} aria-label="Eliminar área">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
      )}

      {selectedArea && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="text-lg font-semibold leading-snug break-words">{selectedArea.name}</div>
              {selectedArea.domain_type && (
                <Badge variant="outline" className="shrink-0">
                  {DOMAIN_LABELS[selectedArea.domain_type] || selectedArea.domain_type}
                </Badge>
              )}
              {selectedArea.plan_locked === true && <Badge variant="secondary" className="shrink-0">Bloqueada</Badge>}
            </div>

            {/* Pestañas en lenguaje claro (antes: combobox “Usar/Editar formulario”) */}
            <div
              className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:w-auto sm:inline-grid sm:min-w-[320px]"
              role="tablist"
              aria-label="Modo del área"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'use'}
                onClick={() => setMode('use')}
                className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  mode === 'use'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ClipboardList className="h-4 w-4 shrink-0" />
                Registrar
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'edit'}
                disabled={!isOwner || selectedArea.plan_locked === true}
                onClick={() => {
                  if (!isOwner || selectedArea.plan_locked === true) return
                  setMode('edit')
                }}
                className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none ${
                  mode === 'edit'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Settings2 className="h-4 w-4 shrink-0" />
                Armar lista
              </button>
            </div>
          </div>

          {selectedPending ? (
            <OfflineBlockedPanel
              title="Área pendiente de sincronizar"
              description="Cuando vuelva la conexión se creará el área en el servidor y se aplicará el modelo de campos. Mientras tanto no se pueden registrar ítems ni armar la lista."
            />
          ) : mode === 'use' ? (
            <FormRunner
              areaId={selectedArea.id}
              userId={effectiveUserId}
              currentArea={selectedArea}
              onConfigure={() => setMode('edit')}
            />
          ) : (
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
              ) : !online ? (
                <OfflineBlockedPanel
                  title="Armar lista necesita internet"
                  description="Añadir o cambiar campos del formulario toca la estructura del área en el servidor. Sin conexión no se edita, para evitar errores. Reconecta e inténtalo de nuevo."
                />
              ) : (
                <FormBuilder
                  areaId={selectedArea.id}
                  userId={effectiveUserId}
                  onReadyToRegister={() => setMode('use')}
                />
              )
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Acceso restringido</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  Solo el dueño del negocio puede armar los datos de esta área.
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}

      <AreaModal
        open={areaModalOpen}
        onOpenChange={setAreaModalOpen}
        onSuccess={(created) => {
          setAreaModalOpen(false)
          setAreaToEdit(null)
          if (!created?.id) return
          setSelectedAreaId(created.id)
          const pending = Boolean(created._pending) || String(created.id).startsWith('pending-')
          // Online + área real → armar lista; pendiente/offline → solo ver aviso.
          setMode(pending ? 'use' : 'edit')
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
