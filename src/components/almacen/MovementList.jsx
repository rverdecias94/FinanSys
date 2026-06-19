/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { MovementModal } from './MovementModal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePermissions } from '@/context/PermissionContext'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'
import { listMovements } from '@/services/almacen'

export function MovementList({
  userId,
  businessId,
  enabled = true,
  products = [],
  onRefresh,
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [type, setType] = useState('all')
  const [productId, setProductId] = useState('all')
  const { hasPermission } = usePermissions()
  const queryClient = useQueryClient()

  const handleOpenModal = () => {
    onRefresh && onRefresh()
    setModalOpen(true)
  }

  const effectiveKey = businessId || userId
  const queryKey = useMemo(
    () => ['warehouse', 'movements', effectiveKey, { type, productId }],
    [effectiveKey, type, productId]
  )

  const renderMovement = (m) => {
    const isEntry = m.type === 'in'
    return (
      <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <div className={`shrink-0 rounded-full p-2 ${isEntry ? 'bg-success/10' : 'bg-destructive/10'}`}>
            {isEntry ? (
              <ArrowUpRight className="h-4 w-4 text-success" />
            ) : (
              <ArrowDownLeft className="h-4 w-4 text-destructive" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium break-words">{m.products?.name}</div>
            <div className="text-sm text-muted-foreground">
              {m.products?.category ? `${m.products.category} · ` : ''}
              {format(new Date(m.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-3 sm:shrink-0 sm:justify-end sm:gap-4 sm:border-0 sm:pt-0">
          <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
            <div className={`whitespace-nowrap font-semibold ${isEntry ? 'text-success' : 'text-destructive'}`}>
              {isEntry ? '+' : '−'}{m.qty}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={isEntry ? 'default' : 'destructive'} className="gap-1">
                {isEntry ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                {isEntry ? 'Entrada' : 'Salida'}
              </Badge>
              <Badge variant="outline">
                Stock: {m.resulting_stock !== undefined ? m.resulting_stock : (m.products?.stock ?? '-')}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="in">Entradas</SelectItem>
              <SelectItem value="out">Salidas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={productId} onValueChange={setProductId}>
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
        {hasPermission('warehouse.move') && (
          <Button onClick={handleOpenModal}>+ Registrar Movimiento</Button>
        )}
      </div>

      <ResponsiveListing
        queryKey={queryKey}
        queryFn={({ page, pageSize }) => listMovements({ page, pageSize, type, productId, userId, businessId })}
        enabled={enabled && !!userId}
        getItemKey={(m) => m.id}
        renderItem={renderMovement}
        emptyMessage="No hay movimientos registrados"
        loadingMessage="Cargando movimientos..."
      />

      <MovementModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        products={products}
        onSuccess={() => {
          setModalOpen(false)
          queryClient.invalidateQueries({ queryKey: ['warehouse'] })
          onRefresh && onRefresh()
        }}
      />
    </div>
  )
}
