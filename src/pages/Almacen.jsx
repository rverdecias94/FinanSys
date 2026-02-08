import { useState } from 'react'
import { Warehouse } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlmacenDashboard } from '@/components/almacen/AlmacenDashboard'
import { ProductList } from '@/components/almacen/ProductList'
import { MovementList } from '@/components/almacen/MovementList'
import { listProducts, listMovements, getAlmacenStats, getProductCategories } from '@/services/almacen'
import { useSession } from '@/hooks/useSession'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'

export default function Almacen() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

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

  // 1. Fetch Stats
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['almacenStats'],
    queryFn: getAlmacenStats,
    enabled: !!userId
  })

  // 2. Fetch Products (Paginated & Filtered)
  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['products', { page: prodPage, pageSize: prodPageSize, search: prodSearch, category: prodCategory }],
    queryFn: () => listProducts({ 
      page: prodPage, 
      pageSize: prodPageSize, 
      search: prodSearch, 
      category: prodCategory 
    }),
    enabled: !!userId,
    placeholderData: keepPreviousData
  })
  const products = productsData?.data || []
  const prodCount = productsData?.count || 0

  // 3. Fetch Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['productCategories'],
    queryFn: getProductCategories
  })

  // 4. Fetch Movements (Paginated & Filtered)
  const { data: movementsData, isLoading: loadingMovements } = useQuery({
    queryKey: ['movements', { page: movPage, pageSize: movPageSize, type: movType, productId: movProduct }],
    queryFn: () => listMovements({ 
      page: movPage, 
      pageSize: movPageSize, 
      type: movType, 
      productId: movProduct 
    }),
    enabled: !!userId,
    placeholderData: keepPreviousData
  })
  const movements = movementsData?.data || []
  const movCount = movementsData?.count || 0

  // Also fetch ALL products just for the select dropdown in Movements filter (lightweight version?)
  // Or just reuse the current page products? Ideally we need a list of all product names for the dropdown.
  // For now, let's use a separate query or just use the stats query if it had names.
  // Let's create a "simple product list" query for dropdowns.
  const { data: allProducts = [] } = useQuery({
    queryKey: ['productsAllSimple'],
    queryFn: async () => {
      // Reusing listProducts but asking for a larger page or we should add a specific method.
      // Using existing method with large page size for dropdown. 
      // In production, this should be a "searchable" select or a specific lightweight endpoint.
      const res = await listProducts({ page: 1, pageSize: 1000 }) 
      return res.data
    },
    enabled: !!userId
  })

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['almacenStats'] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['movements'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Warehouse className="w-8 h-8 text-primary" />
          </div>
          Almacén
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
