import { useEffect, useState } from 'react'
import { useIsRestoring, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { prefetchWarehouseSnapshot } from '@/offline/prefetchReadSnapshots'
import { CardsBodySkeleton } from '@/components/common/pageSkeletons'
import { Package, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, ArrowLeftRight, ClipboardCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { PermissionGuard, usePermissionCheck } from '@/components/common/PermissionGuard'
import { AlmacenDashboard } from '@/components/almacen/AlmacenDashboard'
import { PlanLimitFeedback } from '@/components/common/PlanLimitFeedback'
import { ExportButton } from '@/components/common/ExportButton'
import { ProductList } from '@/components/almacen/ProductList'
import { MovementList } from '@/components/almacen/MovementList'
import { DocumentList } from '@/components/almacen/DocumentList'
import { LocationsPanel } from '@/components/almacen/LocationsPanel'
import { WarehouseInsightsPanel } from '@/components/almacen/WarehouseInsightsPanel'
import { WarehouseOperationModal } from '@/components/almacen/WarehouseOperationModal'
import { notify } from '@/services/notifications'
import {
  listProductsForSelection,
  exportProducts,
  getProductCategories,
  getAlmacenStats
} from '@/services/almacen'

export default function AlmacenMejorado() {
  const { session } = useSession()
  const { businessId, loading: businessLoading } = useBusiness()
  const { canView, hasPermission } = usePermissionCheck()
  const queryClient = useQueryClient()
  const online = useOnlineStatus()
  const isRestoring = useIsRestoring()

  const [tab, setTab] = useState('products')
  const [opMode, setOpMode] = useState(null)

  const userId = session?.user?.id

  useEffect(() => {
    if (!online || !userId || !businessId || businessLoading || isRestoring) return undefined
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void prefetchWarehouseSnapshot(queryClient, { userId, businessId })
    })
    return () => { cancelled = true }
  }, [online, userId, businessId, businessLoading, isRestoring, queryClient])

  const refreshWarehouse = () => {
    queryClient.invalidateQueries({ queryKey: ['warehouse'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const handleExportProducts = async () => {
    try {
      await exportProducts(businessId || userId)
      notify.success('Exportación iniciada')
    } catch {
      notify.error('Error al exportar productos')
    }
  }

  const effectiveBusinessKey = businessId || userId

  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ['warehouse', 'stats', effectiveBusinessKey],
    queryFn: () => getAlmacenStats(userId, businessId),
    enabled: !!userId && canView('warehouse'),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['warehouse', 'productCategories'],
    queryFn: () => getProductCategories(),
    enabled: canView('warehouse'),
    staleTime: 5 * 60 * 1000,
  })

  const { data: productsSelectionData } = useQuery({
    queryKey: ['warehouse', 'productsSelection', effectiveBusinessKey],
    queryFn: () => listProductsForSelection({ userId, businessId, limit: 5000 }),
    enabled: !!userId && canView('warehouse'),
    staleTime: 5 * 60 * 1000,
  })

  const categories = categoriesData ?? []
  const productsForSelection = productsSelectionData ?? []
  const canMove = hasPermission('warehouse.move')

  if (!canView('warehouse')) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-6 text-center">
          <CardContent>
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Acceso Restringido</h3>
            <p className="text-muted-foreground">
              No tienes permisos para acceder al módulo de Almacén.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <div>
            Almacén
            <p className="mt-1 text-sm font-normal text-muted-foreground">
              Productos que compras y vendes, con stock y costo.
            </p>
            <PlanLimitFeedback metric="products" label="Productos" className="mt-1" />
          </div>
        </h1>

        <div className="flex flex-wrap gap-2">
          <PermissionGuard permission="warehouse.export">
            <ExportButton format="excel" label="Exportar" size="default" onClick={handleExportProducts} />
          </PermissionGuard>
        </div>
      </div>

      {canMove && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Button variant="outline" className="h-11 gap-1.5 justify-start" onClick={() => setOpMode('receipt')}>
            <ArrowDownToLine className="h-4 w-4 text-success" /> Recibir
          </Button>
          <Button variant="outline" className="h-11 gap-1.5 justify-start" onClick={() => setOpMode('issue')}>
            <ArrowUpFromLine className="h-4 w-4 text-destructive" /> Salida
          </Button>
          <Button variant="outline" className="h-11 gap-1.5 justify-start" onClick={() => setOpMode('adjustment')}>
            <SlidersHorizontal className="h-4 w-4" /> Ajustar
          </Button>
          <Button variant="outline" className="h-11 gap-1.5 justify-start" onClick={() => setOpMode('transfer')}>
            <ArrowLeftRight className="h-4 w-4" /> Transferir
          </Button>
          <Button variant="outline" className="h-11 gap-1.5 justify-start col-span-2 sm:col-span-1" onClick={() => setOpMode('count')}>
            <ClipboardCheck className="h-4 w-4" /> Contar
          </Button>
        </div>
      )}

      <AlmacenDashboard stats={statsData} loading={isRestoring || isLoadingStats} />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="movements">Movimientos</TabsTrigger>
          <TabsTrigger value="documents">Comprobantes</TabsTrigger>
          <TabsTrigger value="locations">Ubicaciones</TabsTrigger>
          <TabsTrigger value="insights">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          {isRestoring ? <CardsBodySkeleton cards={4} /> : (
            <ProductList
              userId={userId}
              businessId={businessId}
              enabled={canView('warehouse')}
              onRefresh={refreshWarehouse}
              categories={categories}
              online={online}
            />
          )}
        </TabsContent>

        <TabsContent value="movements">
          {isRestoring ? <CardsBodySkeleton cards={4} /> : (
            <MovementList
              userId={userId}
              businessId={businessId}
              enabled={canView('warehouse')}
              products={productsForSelection}
              onRefresh={refreshWarehouse}
              online={online}
            />
          )}
        </TabsContent>

        <TabsContent value="documents">
          <DocumentList
            userId={userId}
            businessId={businessId}
            enabled={canView('warehouse')}
            onRefresh={refreshWarehouse}
          />
        </TabsContent>

        <TabsContent value="locations">
          <LocationsPanel
            userId={userId}
            businessId={businessId}
            enabled={canView('warehouse')}
          />
        </TabsContent>

        <TabsContent value="insights">
          <WarehouseInsightsPanel
            userId={userId}
            businessId={businessId}
            products={productsForSelection}
            enabled={canView('warehouse')}
          />
        </TabsContent>
      </Tabs>

      <WarehouseOperationModal
        open={!!opMode}
        onOpenChange={(o) => { if (!o) setOpMode(null) }}
        mode={opMode || 'receipt'}
        products={productsForSelection}
        onSuccess={refreshWarehouse}
      />
    </div>
  )
}
