import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { usePermissions } from '@/context/PermissionContext'
import { FormRunner } from '@/components/inventario/FormRunner'
import { getInventoryAreas, getItem } from '@/services/dynamicInventory'

export default function InventarioItem({ forceNew = false }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { hasPermission } = usePermissions()

  const userId = session?.user?.id
  const effectiveUserId = businessId

  const isNew = forceNew || !id
  const [manualAreaId, setManualAreaId] = useState(() => {
    const a = searchParams.get('area')
    return a ? Number(a) : null
  })

  const { data: areas = [] } = useQuery({
    queryKey: ['inventoryAreas', effectiveUserId],
    queryFn: () => getInventoryAreas(effectiveUserId),
    enabled: !!effectiveUserId && !!userId
  })

  const { data: item, isLoading: loadingItem } = useQuery({
    queryKey: ['inventoryItem', id, effectiveUserId],
    queryFn: () => getItem(id, userId, businessId),
    enabled: !!id && !!userId && !!effectiveUserId && !isNew
  })

  const areaId = useMemo(() => {
    if (isNew) return manualAreaId
    return item?.area_id ?? null
  }, [isNew, item?.area_id, manualAreaId])

  const currentArea = useMemo(() => {
    if (!areaId) return null
    return areas.find(a => a.id === areaId) || null
  }, [areas, areaId])

  const readOnly = isNew ? !hasPermission('inventory.create') : !hasPermission('inventory.edit')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate('/inventario')} aria-label="Volver">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Layers className="w-6 h-6 text-primary" />
            </div>
            {isNew ? 'Nuevo ítem' : 'Detalle de ítem'}
          </h1>
        </div>
      </div>

      {!areaId ? (
        <Card>
          <CardHeader>
            <CardTitle>Selecciona un área</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-w-sm">
              <Select
                value={manualAreaId ? String(manualAreaId) : ''}
                onValueChange={(v) => {
                  const next = Number(v)
                  setManualAreaId(next)
                  const nextParams = new URLSearchParams(searchParams)
                  nextParams.set('area', String(next))
                  setSearchParams(nextParams)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un área" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {loadingItem ? (
            <Card>
              <CardContent className="py-10 text-muted-foreground">Cargando ítem...</CardContent>
            </Card>
          ) : (
            <FormRunner
              areaId={areaId}
              userId={effectiveUserId}
              currentArea={currentArea}
              mode="form"
              initialItem={isNew ? null : item}
              readOnly={readOnly}
            />
          )}
        </>
      )}
    </div>
  )
}

