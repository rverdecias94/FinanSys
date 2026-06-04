/* eslint-disable react/prop-types */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Pencil, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { ProductModal } from './ProductModal'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSubscription } from '@/context/SubscriptionContext'
import { useCurrency } from '@/context/CurrencyContext'
import { usePermissions } from '@/context/PermissionContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InfiniteScrollTrigger } from '@/components/common/InfiniteScrollTrigger'

export function ProductList({
  products,
  loading,
  onRefresh,
  onProductCreated,
  categories,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  search,
  onSearchChange,
  category,
  onCategoryChange,
  isInfinite,
  onLoadMore,
  hasMore,
  loadingMore
}) {
  const [editingProduct, setEditingProduct] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const { checkLimit, recordUsage } = useSubscription()
  const { formatCurrency, businessCurrencies } = useCurrency()
  const { hasPermission } = usePermissions()

  const handleEdit = (product) => {
    setEditingProduct(product)
    setModalOpen(true)
  }

  const handleCreate = () => {
    if (!checkLimit('products')) return
    setEditingProduct(null)
    setModalOpen(true)
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => {
                onSearchChange(e.target.value)
                onPageChange(1) // Reset to page 1 on search
              }}
              className="pl-8"
            />
          </div>
          <Select
            value={category}
            onValueChange={(v) => {
              onCategoryChange(v)
              onPageChange(1)
            }}
          >
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

      <div className="sm:hidden">
        {loading ? (
          <div className="text-center py-10 text-muted-foreground">Cargando...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No hay productos registrados</div>
        ) : (
          <div className="space-y-3">
            {products.map((p) => {
              const isLowStock = p.stock <= (p.min_stock || 5)
              return (
                <Card key={p.id}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-base truncate">{p.name}</CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{p.category}</Badge>
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
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div className="text-sm text-muted-foreground">
                      Stock: <span className="font-semibold text-foreground">{p.stock}</span>
                    </div>
                    <div className="text-sm font-semibold">
                      {formatCurrency(p.unit_price, p.currency)}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
 
            {isInfinite && hasMore && (
              <InfiniteScrollTrigger
                disabled={loadingMore}
                onLoadMore={onLoadMore}
              />
            )}
 
            {isInfinite && loadingMore && (
              <div className="text-center py-4 text-sm text-muted-foreground">Cargando más...</div>
            )}
          </div>
        )}
      </div>
 
      <div className="hidden sm:block border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay productos registrados
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => {
                const isLowStock = p.stock <= (p.min_stock || 5)
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(p.unit_price, p.currency)}
                    </TableCell>
                    <TableCell className="text-center font-bold">{p.stock}</TableCell>
                    <TableCell className="text-center">
                      {isLowStock ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Bajo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-green-700 bg-green-50 hover:bg-green-100">
                          <CheckCircle2 className="h-3 w-3" /> OK
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {hasPermission('warehouse.edit') && (
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {!isInfinite && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Filas por página:</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(v) => {
              onPageSizeChange(Number(v))
              onPageChange(1)
            }}
          >
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue placeholder="5" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4">
          <span>
            Página {page} de {totalPages || 1}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages || loading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      )}

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
          onRefresh()
        }}
        categories={categories}
        currencies={businessCurrencies}
      />
    </div>
  )
}
