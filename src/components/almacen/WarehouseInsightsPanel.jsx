/* eslint-disable react/prop-types */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getWarehouseKpis,
  listReorderAlerts,
  listWarehouseTasks,
  completeWarehouseTask,
  createWarehouseTask
} from '@/services/almacen'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { usePermissions } from '@/context/PermissionContext'
import { AlertTriangle, CheckSquare, Package } from 'lucide-react'

export function WarehouseInsightsPanel({ userId, businessId, products = [], enabled = true }) {
  const { hasPermission } = usePermissions()
  const queryClient = useQueryClient()
  const key = businessId || userId

  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ['warehouse', 'kpis', key],
    queryFn: getWarehouseKpis,
    enabled: enabled && !!userId
  })

  const { data: alerts = [], isLoading: loadingAlerts } = useQuery({
    queryKey: ['warehouse', 'reorder', key],
    queryFn: listReorderAlerts,
    enabled: enabled && !!userId
  })

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['warehouse', 'tasks', key],
    queryFn: () => listWarehouseTasks({ status: 'open', userId, businessId }),
    enabled: enabled && !!userId
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['warehouse'] })

  const handleComplete = async (id) => {
    try {
      await completeWarehouseTask(id, userId, businessId)
      notify.success('Tarea completada')
      refresh()
    } catch (err) {
      notify.error(getSupabaseErrorMessage(err))
    }
  }

  const handleQuickTask = async () => {
    const p = products[0]
    if (!p) {
      notify.warning('Crea un producto primero')
      return
    }
    try {
      await createWarehouseTask({
        task_type: 'count',
        priority: 'normal',
        product_id: p.id,
        notes: 'Conteo sugerido por alerta'
      }, userId, businessId)
      notify.success('Tarea de conteo creada')
      refresh()
    } catch (err) {
      notify.error(getSupabaseErrorMessage(err))
    }
  }

  const kpiItems = [
    { label: 'Productos', value: kpis?.total_products, icon: Package },
    { label: 'Bajo mínimo', value: kpis?.low_stock, icon: AlertTriangle },
    { label: 'Agotados', value: kpis?.out_of_stock },
    { label: 'Sobre máximo', value: kpis?.over_max },
    { label: 'Caducan ≤30d', value: kpis?.expiring_30d },
    { label: 'Sin movimiento 90d', value: kpis?.dead_stock_90d },
    { label: 'Tareas abiertas', value: kpis?.open_tasks, icon: CheckSquare }
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {loadingKpis ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))
        ) : (
          kpiItems.map((k) => (
            <Card key={k.label}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{k.label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{k.value ?? 0}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Alertas Min / Max</CardTitle>
          <CardDescription>Reposición sugerida según stock mínimo y máximo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingAlerts ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin alertas de reposición.</p>
          ) : (
            alerts.map((a) => (
              <div key={a.product_id} className="flex flex-col gap-1 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium truncate">{a.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Stock {a.stock} · mín {a.min_stock}{a.max_stock != null ? ` · máx ${a.max_stock}` : ''}
                    {a.sku ? ` · ${a.sku}` : ''}
                  </div>
                </div>
                <Badge variant={a.alert === 'out' ? 'destructive' : 'secondary'}>{a.alert}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Tareas de almacén</CardTitle>
            <CardDescription>Cola simple de putaway / picking / conteo.</CardDescription>
          </div>
          {hasPermission('warehouse.move') && (
            <Button variant="outline" size="sm" onClick={handleQuickTask}>Crear tarea conteo</Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingTasks ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay tareas abiertas.</p>
          ) : (
            tasks.map((t) => (
              <div key={t.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium capitalize">{t.task_type} · {t.priority}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {t.products?.name || 'Sin producto'}{t.notes ? ` — ${t.notes}` : ''}
                  </div>
                </div>
                {hasPermission('warehouse.move') && (
                  <Button size="sm" variant="secondary" onClick={() => handleComplete(t.id)}>
                    Completar
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
