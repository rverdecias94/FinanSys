/* eslint-disable react/prop-types */
import { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { notifyOfflineQueued } from '@/services/notifyWrap'
import { movementSchema, validateForm } from '@/utils/formSchemas'
import { genClientUuid } from '@/offline/clientUuid'
import { isNetworkError } from '@/offline/isNetworkError'
import { markOffline } from '@/offline/networkGuard'
import { WH_MOVEMENT_CREATE_KEY } from '@/offline/mutationDefaults'
import {
  applyOptimisticMovementCreate,
  applyOptimisticStockDelta,
  buildPendingMovementRow,
  clearOptimisticMovement,
  findProductInCache,
  restoreProductStock,
} from '@/offline/optimisticWarehouse'
import { stockUnitPlural, stockUnitShort } from '@/utils/stockUnit'
import { useFxGate } from '@/context/FxGateContext'

export function MovementModal({ open, onOpenChange, products, onSuccess }) {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { ensureTodayFx } = useFxGate()
  const queryClient = useQueryClient()
  const requeueGuardRef = useRef(new Set())
  const userId = session?.user?.id
  const effectiveBusinessId = businessId || userId
  const safeProducts = Array.isArray(products) ? products : []
  const [errors, setErrors] = useState({})
  const [formData, setFormData] = useState({
    product_id: '',
    qty: '',
    type: 'in',
    unit_cost: ''
  })

  const selectedProduct = safeProducts.find(p => String(p.id) === String(formData.product_id))
  const countShort = stockUnitShort(selectedProduct?.stock_unit)
  const countPlural = stockUnitPlural(selectedProduct?.stock_unit)

  const createMutation = useMutation({
    mutationKey: WH_MOVEMENT_CREATE_KEY,
    onMutate: async (vars) => {
      const clientUuid = vars?.client_uuid
      const product = findProductInCache(queryClient, vars.product_id)
        || safeProducts.find((p) => String(p.id) === String(vars.product_id))
      const prevStock = product != null ? Number(product.stock || 0) : null
      const qty = Number(vars.qty)
      const nextStock = vars.type === 'in'
        ? (prevStock ?? 0) + qty
        : Math.max(0, (prevStock ?? 0) - qty)

      if (clientUuid && !requeueGuardRef.current.has(clientUuid)) {
        applyOptimisticStockDelta(queryClient, vars.product_id, vars.type, qty)
        applyOptimisticMovementCreate(
          queryClient,
          buildPendingMovementRow({
            product,
            productId: vars.product_id,
            qty,
            type: vars.type,
            clientUuid,
            unitCost: vars.unit_cost,
            resultingStock: nextStock,
            businessId: effectiveBusinessId,
            userId,
          }),
        )
      }
      if (!onlineManager.isOnline()) notifyOfflineQueued('Movimiento')
      return { clientUuid, productId: vars.product_id, previousStock: prevStock }
    },
    onSuccess: (_data, _vars, ctx) => {
      if (ctx?.clientUuid) requeueGuardRef.current.delete(ctx.clientUuid)
      onSuccess?.()
    },
    onError: (error, vars, ctx) => {
      const uuid = ctx?.clientUuid || vars?.client_uuid
      if (isNetworkError(error)) {
        markOffline()
        notifyOfflineQueued('Movimiento')
        if (uuid && !requeueGuardRef.current.has(uuid)) {
          requeueGuardRef.current.add(uuid)
          queueMicrotask(() => createMutation.mutate(vars))
        }
        onSuccess?.()
        return
      }
      if (uuid) requeueGuardRef.current.delete(uuid)
      clearOptimisticMovement(queryClient, uuid)
      restoreProductStock(queryClient, ctx?.productId ?? vars?.product_id, ctx?.previousStock)
      notify.error(getSupabaseErrorMessage(error))
    },
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validation = validateForm(movementSchema, {
      product_id: formData.product_id,
      type: formData.type,
      qty: String(formData.qty ?? ''),
      unit_cost: String(formData.unit_cost ?? '')
    })
    if (!validation.success) {
      setErrors(validation.errors)
      return
    }
    // Solo productos ya sincronizados (C5: sin remap FK de producto pendiente).
    if (String(formData.product_id).startsWith('pending-')) {
      notify.warning('Este producto aún no se ha sincronizado. Espera a que se suba.')
      return
    }
    if (formData.type === 'out' && selectedProduct && Number(formData.qty) > Number(selectedProduct.stock)) {
      setErrors({ qty: 'La cantidad excede el stock disponible' })
      return
    }
    setErrors({})

    if (formData.type === 'in') {
      try {
        const ok = await ensureTodayFx({ reasonKey: 'warehouse_in' })
        if (!ok) return
      } catch {
        return
      }
    }

    const vars = {
      product_id: Number(formData.product_id),
      qty: Number(formData.qty),
      type: formData.type,
      unit_cost: formData.type === 'in' ? formData.unit_cost : '',
      userId,
      businessId: effectiveBusinessId,
      client_uuid: genClientUuid(),
    }

    onOpenChange(false)
    setFormData({ product_id: '', qty: '', type: 'in', unit_cost: '' })
    createMutation.mutate(vars)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      onOpenChange(nextOpen)
      if (!nextOpen) {
        setFormData({ product_id: '', qty: '', type: 'in', unit_cost: '' })
        setErrors({})
      }
    }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Movimiento rápido</DialogTitle>
          <DialogDescription>
            Entrada o salida en segundos. Se guarda un comprobante automático para auditoría.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label>Producto</Label>
            <Select
              value={formData.product_id}
              onValueChange={v => setFormData({ ...formData, product_id: v })}
            >
              <SelectTrigger className="h-11" aria-invalid={!!errors.product_id}>
                <SelectValue placeholder="Selecciona..." />
              </SelectTrigger>
              <SelectContent>
                {safeProducts
                  .filter((p) => !String(p.id).startsWith('pending-') && !p._pending)
                  .map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} (Stock: {p.stock})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {errors.product_id && <p className="text-xs text-destructive">{errors.product_id}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={v => setFormData({ ...formData, type: v })}
                required
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrada (+)</SelectItem>
                  <SelectItem value="out">Salida (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min="1"
                value={formData.qty}
                onChange={e => setFormData({ ...formData, qty: e.target.value })}
                aria-invalid={!!errors.qty}
              />
              {errors.qty && <p className="text-xs text-destructive">{errors.qty}</p>}
            </div>
          </div>

          {formData.type === 'in' && (
            <div className="grid gap-2">
              <Label>
                Costo por {countShort}{' '}
                <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="h-11"
                value={formData.unit_cost}
                onChange={e => setFormData({ ...formData, unit_cost: e.target.value })}
                aria-invalid={!!errors.unit_cost}
              />
              {errors.unit_cost
                ? <p className="text-xs text-destructive">{errors.unit_cost}</p>
                : (
                  <p className="text-xs text-muted-foreground">
                    Debe ser el costo de <strong>una {countShort}</strong> (la misma unidad del producto).
                    Si lo indicas, se recalcula el costo promedio.
                  </p>
                )}
            </div>
          )}

          {selectedProduct && (
            <div className="text-sm text-muted-foreground">
              Stock actual: {selectedProduct.stock} {countPlural}
              {formData.type === 'out' && Number(formData.qty) > selectedProduct.stock && (
                <span className="text-destructive block font-medium">La cantidad excede el stock disponible</span>
              )}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button type="submit" loading={createMutation.isPending}>
              {createMutation.isPending ? 'Registrando...' : 'Confirmar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
