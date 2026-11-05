/* eslint-disable react/prop-types */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  listWarehouses,
  createWarehouse,
  listWarehouseLocations,
  createWarehouseLocation
} from '@/services/almacen'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { usePermissions } from '@/context/PermissionContext'
import { MapPin, Plus } from 'lucide-react'

export function LocationsPanel({ userId, businessId, enabled = true }) {
  const { hasPermission } = usePermissions()
  const queryClient = useQueryClient()
  const canEdit = hasPermission('warehouse.edit')
  const [warehouseId, setWarehouseId] = useState('')
  const [newWh, setNewWh] = useState('')
  const [locCode, setLocCode] = useState('')
  const [locName, setLocName] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: warehouses = [], isLoading: loadingWh } = useQuery({
    queryKey: ['warehouse', 'warehouses', businessId || userId],
    queryFn: () => listWarehouses(userId, businessId),
    enabled: enabled && !!userId
  })

  const selectedWh = warehouseId || warehouses.find((w) => w.is_default)?.id || warehouses[0]?.id || ''

  const { data: locations = [], isLoading: loadingLoc } = useQuery({
    queryKey: ['warehouse', 'locations', selectedWh],
    queryFn: () => listWarehouseLocations(selectedWh, userId, businessId),
    enabled: enabled && !!userId && !!selectedWh
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['warehouse'] })

  const handleAddWarehouse = async () => {
    const name = newWh.trim()
    if (!name) return
    setSaving(true)
    try {
      await createWarehouse({ name, userId, businessId })
      setNewWh('')
      notify.success('Almacén creado')
      refresh()
    } catch (err) {
      notify.error(getSupabaseErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleAddLocation = async () => {
    const code = locCode.trim()
    if (!code || !selectedWh) return
    setSaving(true)
    try {
      await createWarehouseLocation({
        warehouseId: selectedWh,
        code,
        name: locName.trim() || null,
        userId,
        businessId
      })
      setLocCode('')
      setLocName('')
      notify.success('Ubicación creada')
      refresh()
    } catch (err) {
      notify.error(getSupabaseErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Almacenes físicos</CardTitle>
          <CardDescription>
            Estructura del depósito. No confundir con las áreas del módulo Inventario.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingWh ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {warehouses.map((w) => (
                <Badge
                  key={w.id}
                  variant={String(w.id) === String(selectedWh) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setWarehouseId(String(w.id))}
                >
                  {w.name}{w.is_default ? ' (principal)' : ''}
                </Badge>
              ))}
            </div>
          )}
          {canEdit && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                className="h-11"
                placeholder="Nombre del almacén"
                value={newWh}
                onChange={(e) => setNewWh(e.target.value)}
              />
              <Button className="h-11 gap-1" disabled={saving} onClick={handleAddWarehouse}>
                <Plus className="h-4 w-4" /> Agregar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Ubicaciones
          </CardTitle>
          <CardDescription>Códigos tipo A01-01 dentro del almacén seleccionado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={String(selectedWh || '')} onValueChange={setWarehouseId}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Almacén" />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {loadingLoc ? (
            <p className="text-sm text-muted-foreground">Cargando ubicaciones...</p>
          ) : locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay ubicaciones. Puedes operar solo con el almacén principal.</p>
          ) : (
            <ul className="space-y-2">
              {locations.map((loc) => (
                <li key={loc.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="font-medium">{loc.code}</span>
                  <span className="text-muted-foreground">{loc.name || loc.zone_text || '—'}</span>
                </li>
              ))}
            </ul>
          )}

          {canEdit && (
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <div className="grid gap-1">
                <Label className="text-xs">Código</Label>
                <Input className="h-11" placeholder="A01-01" value={locCode} onChange={(e) => setLocCode(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Nombre</Label>
                <Input className="h-11" placeholder="Pasillo A" value={locName} onChange={(e) => setLocName(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button className="h-11 w-full gap-1" disabled={saving || !selectedWh} onClick={handleAddLocation}>
                  <Plus className="h-4 w-4" /> Ubicación
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
