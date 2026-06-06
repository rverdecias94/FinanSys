import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Package, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { PermissionGuard, usePermissionCheck } from '@/components/common/PermissionGuard'
import { AlmacenDashboard } from '@/components/almacen/AlmacenDashboard'
import { ProductList } from '@/components/almacen/ProductList'
import { MovementList } from '@/components/almacen/MovementList'
import { notify } from '@/services/notifications'
import {
  listProducts,
  listProductsForSelection,
  listMovements,
  exportProducts,
  getProductCategories,
  getAlmacenStats
} from '@/services/almacen'

export default function AlmacenMejorado() {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { canView } = usePermissionCheck()
  const queryClient = useQueryClient()

  // Estado local
  const [tab, setTab] = useState('products')

  const [productsPage, setProductsPage] = useState(1)
  const [productsPageSize, setProductsPageSize] = useState(10)
  const [productsSearch, setProductsSearch] = useState('')
  const [productsCategory, setProductsCategory] = useState('all')

  const [movementsPage, setMovementsPage] = useState(1)
  const [movementsPageSize, setMovementsPageSize] = useState(10)
  const [movementsType, setMovementsType] = useState('all')
  const [movementsProductId, setMovementsProductId] = useState('all')

  const userId = session?.user?.id

  const refreshWarehouse = () => {
    queryClient.invalidateQueries({ queryKey: ['warehouse'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const handleExportProducts = async () => {
    try {
      await exportProducts(businessId || userId)
      notify.success('Exportación iniciada')
    } catch (error) {
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

  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['warehouse', 'products', effectiveBusinessKey, { productsPage, productsPageSize, productsSearch, productsCategory }],
    queryFn: () => listProducts({
      page: productsPage,
      pageSize: productsPageSize,
      search: productsSearch,
      category: productsCategory,
      userId,
      businessId,
    }),
    enabled: !!userId && canView('warehouse'),
    keepPreviousData: true,
  })

  const { data: productsSelectionData } = useQuery({
    queryKey: ['warehouse', 'productsSelection', effectiveBusinessKey],
    queryFn: () => listProductsForSelection({ userId, businessId, limit: 5000 }),
    enabled: !!userId && canView('warehouse'),
    staleTime: 5 * 60 * 1000,
  })

  const { data: movementsData, isLoading: isLoadingMovements } = useQuery({
    queryKey: ['warehouse', 'movements', effectiveBusinessKey, { movementsPage, movementsPageSize, movementsType, movementsProductId }],
    queryFn: () => listMovements({
      page: movementsPage,
      pageSize: movementsPageSize,
      type: movementsType,
      productId: movementsProductId,
      userId,
      businessId,
    }),
    enabled: !!userId && canView('warehouse'),
    keepPreviousData: true,
  })

  const products = productsData?.data ?? []
  const productsTotalCount = productsData?.count ?? 0
  const movements = movementsData?.data ?? []
  const movementsTotalCount = movementsData?.count ?? 0
  const categories = categoriesData ?? []
  const productsForSelection = productsSelectionData ?? []

  // Si no tiene permisos de visualización, mostrar mensaje
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Package className="w-8 h-8 text-primary" />
          </div>
          Almacén
        </h1>

        <div className="flex gap-2">
          <PermissionGuard permission="warehouse.export">
            <Button variant="outline" onClick={handleExportProducts}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <AlmacenDashboard stats={statsData} loading={isLoadingStats} />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="movements">Movimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <ProductList
            products={products}
            loading={isLoadingProducts}
            onRefresh={refreshWarehouse}
            categories={categories}
            totalCount={productsTotalCount}
            page={productsPage}
            pageSize={productsPageSize}
            onPageChange={setProductsPage}
            onPageSizeChange={setProductsPageSize}
            search={productsSearch}
            onSearchChange={setProductsSearch}
            category={productsCategory}
            onCategoryChange={setProductsCategory}
          />
        </TabsContent>

        <TabsContent value="movements">
          <MovementList
            movements={movements}
            products={productsForSelection}
            loading={isLoadingMovements}
            onRefresh={refreshWarehouse}
            totalCount={movementsTotalCount}
            page={movementsPage}
            pageSize={movementsPageSize}
            onPageChange={setMovementsPage}
            onPageSizeChange={setMovementsPageSize}
            type={movementsType}
            onTypeChange={setMovementsType}
            productId={movementsProductId}
            onProductChange={setMovementsProductId}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
