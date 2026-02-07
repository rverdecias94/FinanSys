import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Pencil, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { ProductModal } from './ProductModal'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function ProductList({
  products,
  loading,
  onRefresh,
  categories,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  search,
  onSearchChange,
  category,
  onCategoryChange
}) {
  const [editingProduct, setEditingProduct] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const handleEdit = (product) => {
    setEditingProduct(product)
    setModalOpen(true)
  }

  const handleCreate = () => {
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
        <Button onClick={handleCreate}>+ Nuevo Producto</Button>
      </div>

      <div className="border rounded-md">
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
                    <TableCell className="text-right">${Number(p.unit_price).toFixed(2)}</TableCell>
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
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Mostrando {products.length} de {totalCount} productos
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || loading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ProductModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        product={editingProduct}
        onSuccess={() => {
          setModalOpen(false)
          onRefresh()
        }}
        categories={categories}
      />
    </div>
  )
}
