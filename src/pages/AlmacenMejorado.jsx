import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Package, 
  Plus, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  Pencil, 
  Trash2,
  Search,
  Filter,
  Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { PermissionGuard, usePermissionCheck, ActionButtons } from '@/components/common/PermissionGuard'
import { ProductModal } from '@/components/almacen/ProductModal'
import { MovementModal } from '@/components/almacen/MovementModal'
import { notify } from '@/services/notifications'
import { 
  listProducts, 
  createProduct, 
  updateProduct, 
  deleteProduct, 
  recordMovement,
  exportProducts
} from '@/services/almacen'

export default function AlmacenMejorado() {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { formatCurrency } = useCurrency()
  const { canView, canCreate, canEdit, canDelete, canExport } = usePermissionCheck()
  const queryClient = useQueryClient()

  // Estado local
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [movementModalOpen, setMovementModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedMovement, setSelectedMovement] = useState(null)
  const [viewMode, setViewMode] = useState('products') // 'products' o 'movements'

  const userId = session?.user?.id

  // Queries
  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products', businessId || userId],
    queryFn: () => listProducts(businessId || userId),
    enabled: !!userId && !!businessId && canView('warehouse'),
  })

  // Mutaciones
  const createProductMutation = useMutation({
    mutationFn: async (productData) => {
      return createProduct({ ...productData, user_id: userId }, userId, businessId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setProductModalOpen(false)
      setSelectedProduct(null)
      notify.success('Producto creado exitosamente')
    },
    onError: (error) => {
      notify.error('Error al crear producto')
    }
  })

  const updateProductMutation = useMutation({
    mutationFn: async (productData) => {
      const { id, ...rest } = productData
      return updateProduct(id, { ...rest, user_id: userId }, userId, businessId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setProductModalOpen(false)
      setSelectedProduct(null)
      notify.success('Producto actualizado exitosamente')
    },
    onError: (error) => {
      notify.error('Error al actualizar producto')
    }
  })

  const deleteProductMutation = useMutation({
    mutationFn: async (productId) => {
      return deleteProduct(productId, userId, businessId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      notify.success('Producto eliminado exitosamente')
    },
    onError: (error) => {
      notify.error('Error al eliminar producto')
    }
  })

  const recordMovementMutation = useMutation({
    mutationFn: async (movementData) => {
      return recordMovement({ ...movementData, user_id: userId }, userId, businessId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setMovementModalOpen(false)
      setSelectedMovement(null)
      notify.success('Movimiento registrado exitosamente')
    },
    onError: (error) => {
      notify.error('Error al registrar movimiento')
    }
  })

  // Handlers
  const handleCreateProduct = () => {
    setSelectedProduct(null)
    setProductModalOpen(true)
  }

  const handleEditProduct = (product) => {
    setSelectedProduct(product)
    setProductModalOpen(true)
  }

  const handleViewProduct = (product) => {
    setSelectedProduct({ ...product, readonly: true })
    setProductModalOpen(true)
  }

  const handleDeleteProduct = async (product) => {
    if (window.confirm(`¿Estás seguro de eliminar el producto "${product.name}"?`)) {
      await deleteProductMutation.mutateAsync(product.id)
    }
  }

  const handleRecordMovement = (product, type) => {
    setSelectedMovement({ product, type })
    setMovementModalOpen(true)
  }

  const handleExportProducts = async () => {
    try {
      await exportProducts(businessId || userId)
      notify.success('Exportación iniciada')
    } catch (error) {
      notify.error('Error al exportar productos')
    }
  }

  // Filtrar productos
  const filteredProducts = productsData?.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter
    return matchesSearch && matchesCategory
  }) || []

  // Obtener categorías únicas
  const categories = [...new Set(productsData?.map(p => p.category) || [])]

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
          
          <PermissionGuard permission="warehouse.create">
            <Button onClick={handleCreateProduct}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Producto
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="all">Todas las categorías</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de productos */}
      <Card>
        <CardHeader>
          <CardTitle>Productos ({filteredProducts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingProducts ? (
            <div className="text-center py-8">Cargando productos...</div>
          ) : (
            <div className="space-y-4">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay productos registrados
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredProducts.map(product => (
                    <Card key={product.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">{product.name}</CardTitle>
                          <Badge variant={product.stock <= product.min_stock ? 'destructive' : 'default'}>
                            Stock: {product.stock}
                          </Badge>
                        </div>
                        <Badge variant="outline">{product.category}</Badge>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Precio unitario:</span>
                          <span className="font-semibold">{formatCurrency(product.unit_price, product.currency)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Stock mínimo:</span>
                          <span>{product.min_stock}</span>
                        </div>
                        
                        {/* Botones de acción según permisos */}
                        <div className="flex gap-2 pt-3 border-t">
                          <ActionButtons module="warehouse">
                            <Button
                              size="sm"
                              variant="outline"
                              action="edit"
                              onClick={() => handleEditProduct(product)}
                              className="flex-1"
                            >
                              <Pencil className="w-4 h-4 mr-1" />
                              Editar
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              action="view"
                              onClick={() => handleViewProduct(product)}
                              className="flex-1"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              action="delete"
                              onClick={() => handleDeleteProduct(product)}
                              className="flex-1"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Eliminar
                            </Button>
                          </ActionButtons>
                          
                          {/* Botones de movimiento */}
                          <PermissionGuard permission="warehouse.move">
                            <div className="flex gap-1 pt-2 w-full">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRecordMovement(product, 'in')}
                                className="flex-1"
                              >
                                <ArrowUp className="w-4 h-4 mr-1 text-green-600" />
                                Entrada
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRecordMovement(product, 'out')}
                                className="flex-1"
                              >
                                <ArrowDown className="w-4 h-4 mr-1 text-red-600" />
                                Salida
                              </Button>
                            </div>
                          </PermissionGuard>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modales */}
      <ProductModal
        open={productModalOpen}
        onOpenChange={setProductModalOpen}
        product={selectedProduct}
        onSubmit={selectedProduct?.id ? updateProductMutation.mutate : createProductMutation.mutate}
        readonly={selectedProduct?.readonly || !canEdit('warehouse')}
      />
      
      <MovementModal
        open={movementModalOpen}
        onOpenChange={setMovementModalOpen}
        movement={selectedMovement}
        onSubmit={recordMovementMutation.mutate}
      />
    </div>
  )
}