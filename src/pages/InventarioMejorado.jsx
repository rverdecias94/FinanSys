import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Archive, 
  Plus, 
  Eye, 
  Pencil, 
  Trash2,
  Search,
  Download,
  Grid,
  List
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { PermissionGuard, usePermissionCheck, ActionButtons } from '@/components/common/PermissionGuard'
import { notify } from '@/services/notifications'
import { 
  getInventoryAreas, 
  getInventoryItems, 
  createInventoryItem, 
  updateInventoryItem, 
  deleteInventoryItem,
  exportInventoryData
} from '@/services/dynamicInventory'

export default function InventarioMejorado() {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { canView, canCreate, canEdit, canDelete, canExport } = usePermissionCheck()
  const queryClient = useQueryClient()

  // Estado local
  const [searchTerm, setSearchTerm] = useState('')
  const [areaFilter, setAreaFilter] = useState('all')
  const [viewMode, setViewMode] = useState('grid') // 'grid' o 'list'
  const [selectedArea, setSelectedArea] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [readonlyMode, setReadonlyMode] = useState(false)

  const userId = session?.user?.id

  // Queries
  const { data: areasData, isLoading: isLoadingAreas } = useQuery({
    queryKey: ['inventoryAreas', businessId || userId],
    queryFn: () => getInventoryAreas(businessId || userId),
    enabled: !!userId && !!businessId && canView('inventory'),
  })

  const { data: itemsData, isLoading: isLoadingItems } = useQuery({
    queryKey: ['inventoryItems', businessId || userId, selectedArea],
    queryFn: () => getInventoryItems(businessId || userId, selectedArea),
    enabled: !!userId && !!businessId && canView('inventory'),
  })

  // Mutaciones
  const createItemMutation = useMutation({
    mutationFn: async (itemData) => {
      return createInventoryItem({ ...itemData, user_id: userId }, userId, businessId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setModalOpen(false)
      setSelectedItem(null)
      notify.success('Ítem de inventario creado exitosamente')
    },
    onError: (error) => {
      notify.error('Error al crear ítem de inventario')
    }
  })

  const updateItemMutation = useMutation({
    mutationFn: async (itemData) => {
      const { id, ...rest } = itemData
      return updateInventoryItem(id, { ...rest, user_id: userId }, userId, businessId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setModalOpen(false)
      setSelectedItem(null)
      notify.success('Ítem de inventario actualizado exitosamente')
    },
    onError: (error) => {
      notify.error('Error al actualizar ítem de inventario')
    }
  })

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId) => {
      return deleteInventoryItem(itemId, userId, businessId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      notify.success('Ítem de inventario eliminado exitosamente')
    },
    onError: (error) => {
      notify.error('Error al eliminar ítem de inventario')
    }
  })

  // Handlers
  const handleCreateItem = () => {
    setSelectedItem(null)
    setReadonlyMode(false)
    setModalOpen(true)
  }

  const handleEditItem = (item) => {
    setSelectedItem(item)
    setReadonlyMode(false)
    setModalOpen(true)
  }

  const handleViewItem = (item) => {
    setSelectedItem(item)
    setReadonlyMode(true)
    setModalOpen(true)
  }

  const handleDeleteItem = async (item) => {
    if (window.confirm(`¿Estás seguro de eliminar el ítem "${item.values?.nombre || 'Sin nombre'}"?`)) {
      await deleteItemMutation.mutateAsync(item.id)
    }
  }

  const handleExportData = async () => {
    try {
      await exportInventoryData(businessId || userId, selectedArea)
      notify.success('Exportación iniciada')
    } catch (error) {
      notify.error('Error al exportar datos de inventario')
    }
  }

  // Filtrar ítems
  const filteredItems = itemsData?.filter(item => {
    const matchesSearch = JSON.stringify(item.values).toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  }) || []

  // Si no tiene permisos de visualización, mostrar mensaje
  if (!canView('inventory')) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-6 text-center">
          <CardContent>
            <Archive className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Acceso Restringido</h3>
            <p className="text-muted-foreground">
              No tienes permisos para acceder al módulo de Inventario.
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
            <Archive className="w-8 h-8 text-primary" />
          </div>
          Inventario Dinámico
        </h1>
        
        <div className="flex gap-2">
          <PermissionGuard permission="inventory.export">
            <Button variant="outline" onClick={handleExportData}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </PermissionGuard>
          
          <PermissionGuard permission="inventory.create">
            <Button onClick={handleCreateItem}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Ítem
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Filtros y selector de área */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en inventario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              value={selectedArea || ''}
              onChange={(e) => setSelectedArea(e.target.value || null)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">Todas las áreas</option>
              {areasData?.map(area => (
                <option key={area.id} value={area.id}>{area.name}</option>
              ))}
            </select>
            
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vista de ítems */}
      <Card>
        <CardHeader>
          <CardTitle>
            Ítems de Inventario ({filteredItems.length})
            {selectedArea && (
              <Badge variant="outline" className="ml-2">
                {areasData?.find(a => a.id === parseInt(selectedArea))?.name}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingItems ? (
            <div className="text-center py-8">Cargando inventario...</div>
          ) : (
            <div className="space-y-4">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay ítems en esta área del inventario
                </div>
              ) : (
                <div className={viewMode === 'grid' 
                  ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" 
                  : "space-y-3"
                }>
                  {filteredItems.map(item => (
                    <div 
                      key={item.id} 
                      className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                        viewMode === 'list' ? 'flex items-center justify-between' : ''
                      }`}
                    >
                      <div className={viewMode === 'list' ? 'flex-1' : ''}>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium">
                            {item.values?.nombre || 'Sin nombre'}
                          </h3>
                          <Badge variant="outline">
                            {areasData?.find(a => a.id === item.area_id)?.name}
                          </Badge>
                        </div>
                        
                        {viewMode === 'grid' && (
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {Object.entries(item.values || {}).slice(0, 3).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="capitalize">{key}:</span>
                                <span className="font-medium">{value}</span>
                              </div>
                            ))}
                            {Object.keys(item.values || {}).length > 3 && (
                              <div className="text-xs text-gray-500">
                                +{Object.keys(item.values).length - 3} campos más
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="text-xs text-muted-foreground mt-2">
                          SKU: {item.sku || 'Sin SKU'}
                        </div>
                      </div>
                      
                      {/* Botones de acción según permisos */}
                      <div className={`flex gap-2 ${viewMode === 'list' ? 'ml-4' : 'pt-3 border-t mt-3'}`}>
                        <ActionButtons module="inventory">
                          <Button
                            size="sm"
                            variant="outline"
                            action="edit"
                            onClick={() => handleEditItem(item)}
                            className={viewMode === 'list' ? '' : 'flex-1'}
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            {viewMode === 'grid' && 'Editar'}
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            action="view"
                            onClick={() => handleViewItem(item)}
                            className={viewMode === 'list' ? '' : 'flex-1'}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            {viewMode === 'grid' && 'Ver'}
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            action="delete"
                            onClick={() => handleDeleteItem(item)}
                            className={viewMode === 'list' ? '' : 'flex-1'}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            {viewMode === 'grid' && 'Eliminar'}
                          </Button>
                        </ActionButtons>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de ítem (placeholder - necesitaría implementación específica) */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {selectedItem ? (readonlyMode ? 'Ver Ítem' : 'Editar Ítem') : 'Nuevo Ítem'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>Modal de inventario - Implementación pendiente</p>
                <p className="text-sm mt-2">
                  {readonlyMode ? 'Modo solo lectura' : 'Modo edición'}
                </p>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                {!readonlyMode && (
                  <Button onClick={() => setModalOpen(false)}>
                    Guardar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}