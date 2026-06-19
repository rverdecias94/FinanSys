/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil, AlertTriangle, CheckCircle2, Search, Package } from 'lucide-react'
import { ProductModal } from './ProductModal'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSubscription } from '@/context/SubscriptionContext'
import { useCurrency } from '@/context/CurrencyContext'
import { usePermissions } from '@/context/PermissionContext'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'
import { listProducts } from '@/services/almacen'

export function ProductList({
  userId,
  businessId,
  enabled = true,
  onRefresh,
  onProductCreated,
  categories = [],
}) {
  const [editingProduct, setEditingProduct] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const { checkLimit, recordUsage } = useSubscription()
  const { formatCurrency, businessCurrencies } = useCurrency()
  const { hasPermission } = usePermissions()
  const queryClient = useQueryClient()

  const handleEdit = (product) => {
    setEditingProduct(product)
    setModalOpen(true)
  }

  const handleCreate = () => {
    if (!checkLimit('products')) return
    setEditingProduct(null)
    setModalOpen(true)
  }

  const effectiveKey = businessId || userId
  const queryKey = useMemo(
    () => ['warehouse', 'products', effectiveKey, { search, category }],
    [effectiveKey, search, category]
  )

  const renderProduct = (p) => {
    const isLowStock = p.stock <= (p.min_stock || 5)
    return (
      <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <div className="shrink-0 rounded-full bg-primary/10 p-2">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-medium break-words">{p.name}</div>
            <div className="text-sm text-muted-foreground">{p.category}</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-3 sm:shrink-0 sm:justify-end sm:gap-4 sm:border-0 sm:pt-0">
          <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
            <div className="whitespace-nowrap font-semibold">
              {formatCurrency(p.unit_price, p.currency)}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Stock: {p.stock}</Badge>
              {isLowStock ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> Bajo
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> OK
                </Badge>
              )}
            </div>
          </div>

          {hasPermission('warehouse.edit') && (
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => handleEdit(p)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasPermission('warehouse.create') && (
          <Button onClick={handleCreate}>+ Nuevo Producto</Button>
        )}
      </div>

      <ResponsiveListing
        queryKey={queryKey}
        queryFn={({ page, pageSize }) => listProducts({ page, pageSize, search, category, userId, businessId })}
        enabled={enabled && !!userId}
        getItemKey={(p) => p.id}
        renderItem={renderProduct}
        emptyMessage="No hay productos registrados"
        loadingMessage="Cargando productos..."
      />

      <ProductModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        product={editingProduct}
        onSuccess={() => {
          if (!editingProduct) {
            recordUsage('products')
            onProductCreated && onProductCreated()
          }
          setModalOpen(false)
          queryClient.invalidateQueries({ queryKey: ['warehouse'] })
          onRefresh && onRefresh()
        }}
        categories={categories}
        currencies={businessCurrencies}
      />
    </div>
  )
}
