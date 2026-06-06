import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { usePermissions } from '@/context/PermissionContext'
import { getInventoryAreas } from '@/services/dynamicInventory'
import { FormBuilder } from '@/components/inventario/FormBuilder'

export default function InventarioConfigFormulario() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { isOwner } = usePermissions()

  const userId = session?.user?.id
  const effectiveUserId = businessId

  const initialArea = searchParams.get('area')
  const [areaId, setAreaId] = useState(initialArea ? Number(initialArea) : null)

  const { data: areas = [], isLoading } = useQuery({
    queryKey: ['inventoryAreas', effectiveUserId],
    queryFn: () => getInventoryAreas(effectiveUserId),
    enabled: !!effectiveUserId && !!userId
  })

  const currentArea = useMemo(() => {
    if (!areaId) return null
    return areas.find(a => a.id === areaId) || null
  }, [areas, areaId])

  if (!isOwner) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate('/inventario')} aria-label="Volver">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Configuración de formulario</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Acceso restringido</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            No tienes permisos para editar la configuración del formulario.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate('/inventario')} aria-label="Volver">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Settings2 className="w-6 h-6 text-primary" />
            </div>
            Configuración de formulario
          </h1>
        </div>

        <div className="w-full sm:w-[320px]">
          <Select
            value={areaId ? String(areaId) : ''}
            onValueChange={(v) => {
              const next = Number(v)
              setAreaId(next)
              const nextParams = new URLSearchParams(searchParams)
              nextParams.set('area', String(next))
              setSearchParams(nextParams)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoading ? 'Cargando...' : 'Selecciona un área'} />
            </SelectTrigger>
            <SelectContent>
              {areas.map(a => (
                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!currentArea ? (
        <Card>
          <CardContent className="py-10 text-muted-foreground">Selecciona un área para configurar su formulario</CardContent>
        </Card>
      ) : (
        <FormBuilder areaId={currentArea.id} userId={effectiveUserId} />
      )}
    </div>
  )
}

