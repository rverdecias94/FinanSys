import { useState } from 'react'
import { Warehouse } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlmacenDashboard } from '@/components/almacen/AlmacenDashboard'
import { ProductList } from '@/components/almacen/ProductList'
import { MovementList } from '@/components/almacen/MovementList'
import { listProducts, listMovements, getAlmacenStats, getProductCategories } from '@/services/almacen'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'

export default function Almacen() {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { getRemainingUsage, subscription } = useSubscription()
  const queryClient = useQueryClient()
  const userId = session?.user?.id // ID real del usuario

  // --- Product Filters & Pagination ---
  const [prodPage, setProdPage] = useState(1)
  const [prodPageSize, setProdPageSize] = useState(10)
  const [prodSearch, setProdSearch] = useState('')
  const [prodCategory, setProdCategory] = useState('all')

  // --- Movement Filters & Pagination ---
  const [movPage, setMovPage] = useState(1)
  const [movPageSize, setMovPageSize] = useState(10)
  const [movType, setMovType] = useState('all')
  const [movProduct, setMovProduct] = useState('all')

  const remainingProducts = getRemainingUsage('products')
  const productsLimit = subscription?.plan_id === 'premium' ? Infinity : 40
  const remainingProductsDisplay = productsLimit === Infinity ? 'Ilimitados' : remainingProducts

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['almacenStats', businessId], // Agregar businessId a la clave
    queryFn: () => getAlmacenStats(userId, businessId), // Pasar ambos IDs
    enabled: !!userId && !!businessId // Asegurar que ambos estén disponibles
  })

  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['products', { page: prodPage, pageSize: prodPageSize, search: prodSearch, category: prodCategory, businessId }],
    queryFn: () => listProducts({
      page: prodPage,
      pageSize: prodPageSize,
      search: prodSearch,
      category: prodCategory,
      userId: userId,      // ID del usuario actual
      businessId: businessId // ID del negocio (owner_id si es miembro)
    }),
    enabled: !!userId && !!businessId,
    placeholderData: keepPreviousData
  })
  const products = productsData?.data || []
  const prodCount = productsData?.count || 0

  const { data: categories = [] } = useQuery({
    queryKey: ['productCategories'],
    queryFn: getProductCategories,
  })

  const { data: movementsData, isLoading: loadingMovements } = useQuery({
    queryKey: ['movements', { page: movPage, pageSize: movPageSize, type: movType, productId: movProduct, businessId }],
    queryFn: () => listMovements({
      page: movPage,
      pageSize: movPageSize,
      type: movType,
      productId: movProduct,
      userId: userId,      // ID del usuario actual
      businessId: businessId // ID del negocio (owner_id si es miembro)
    }),
    enabled: !!userId && !!businessId,
    placeholderData: keepPreviousData
  })
  const movements = movementsData?.data || []
  const movCount = movementsData?.count || 0

  const { data: allProducts = [] } = useQuery({
    queryKey: ['productsAllSimple', businessId],
    queryFn: async () => {
      const res = await listProducts({ page: 1, pageSize: 1000, userId: userId, businessId: businessId })
      return res.data
    },
    enabled: !!userId && !!businessId,
    staleTime: 0
  })

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['almacenStats'] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['movements'] })
    queryClient.invalidateQueries({ queryKey: ['productsAllSimple'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const refreshProducts = () => {
    // Add a small delay to ensure database transaction is committed
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['productsAllSimple'] })
    }, 300)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Warehouse className="w-8 h-8 text-primary" />
          </div>
          <div>
            Almacén
            {subscription?.plan_id === 'free' && (
              <div className="text-xs font-normal text-muted-foreground mt-1">
                Productos restantes: {remainingProductsDisplay} / {productsLimit}
              </div>
            )}
          </div>
        </h1>
      </div>

      <AlmacenDashboard stats={stats} loading={loadingStats} />

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="movements">Movimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <ProductList
            products={products}
            totalCount={prodCount}
            page={prodPage}
            pageSize={prodPageSize}
            onPageChange={setProdPage}
            onPageSizeChange={setProdPageSize}
            search={prodSearch}
            onSearchChange={setProdSearch}
            category={prodCategory}
            onCategoryChange={setProdCategory}
            loading={loadingProducts}
            onRefresh={handleRefresh}
            onProductCreated={refreshProducts}
            categories={categories}
          />
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          <MovementList
            movements={movements}
            totalCount={movCount}
            page={movPage}
            pageSize={movPageSize}
            onPageChange={setMovPage}
            onPageSizeChange={setMovPageSize}
            type={movType}
            onTypeChange={setMovType}
            productId={movProduct}
            onProductChange={setMovProduct}
            products={allProducts}
            loading={loadingMovements}
            onRefresh={handleRefresh}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}