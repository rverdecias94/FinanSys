import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { MovementModal } from './MovementModal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function MovementList({
  movements,
  products,
  loading,
  onRefresh,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  type,
  onTypeChange,
  productId,
  onProductChange
}) {
  const [modalOpen, setModalOpen] = useState(false)

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Select
            value={type}
            onValueChange={(v) => {
              onTypeChange(v)
              onPageChange(1)
            }}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="in">Entradas</SelectItem>
              <SelectItem value="out">Salidas</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={productId}
            onValueChange={(v) => {
              onProductChange(v)
              onPageChange(1)
            }}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Producto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los productos</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Registrar Movimiento</Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Stock Resultante</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No hay movimientos registrados
                </TableCell>
              </TableRow>
            ) : (
              movements.map((m) => {
                const isEntry = m.type === 'in'
                return (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm">
                      {format(new Date(m.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{m.products?.name}</div>
                      <div className="text-xs text-muted-foreground">{m.products?.category}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isEntry ? 'default' : 'destructive'} className="gap-1">
                        {isEntry ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                        {isEntry ? 'Entrada' : 'Salida'}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-bold ${isEntry ? 'text-green-600' : 'text-red-600'}`}>
                      {isEntry ? '+' : '-'}{m.qty}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">-</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
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

      <MovementModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        products={products}
        onSuccess={() => {
          setModalOpen(false)
          onRefresh()
        }}
      />
    </div>
  )
}
