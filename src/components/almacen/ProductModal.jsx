/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { deleteProduct, generateProductSku } from '@/services/almacen'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { notifyOfflineQueued } from '@/services/notifyWrap'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { usePermissions } from '@/context/PermissionContext'
import { productSchema, validateForm } from '@/utils/formSchemas'
import { genClientUuid } from '@/offline/clientUuid'
import { isNetworkError } from '@/offline/isNetworkError'
import { markOffline } from '@/offline/networkGuard'
import { PRODUCT_CREATE_KEY, PRODUCT_UPDATE_KEY } from '@/offline/mutationDefaults'
import {
  applyOptimisticProductCreate,
  applyOptimisticProductUpdate,
  buildPendingProductRow,
  clearOptimisticProduct,
  findProductInCache,
  restoreProductRow,
  serializeProductPayload,
} from '@/offline/optimisticWarehouse'

export function ProductModal({ open, onOpenChange, product, onSuccess, categories, currencies = [] }) {
  const { session } = useSession()
  const { businessId } = useBusiness() // Obtener businessId del contexto
  const { hasPermission } = usePermissions()
  const queryClient = useQueryClient()
  const requeueGuardRef = useRef(new Set())
  const userId = session?.user?.id
  const [loading, setLoading] = useState(false)
  const defaultCurrency = currencies.find(c => c.is_default)?.code || (currencies.length > 0 ? currencies[0].code : 'USD')

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit_price: '',
    currency: defaultCurrency,
    stock: 0,
    min_stock: 5,
    max_stock: '',
    sku: '',
    barcode: '',
    track_lot: false,
    track_serial: false,
    track_expiry: false,
    issue_strategy: 'none'
  })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setErrors({})
    if (product) {
      setFormData({
        name: product.name,
        category: product.category,
        unit_price: product.unit_price,
        currency: product.currency || defaultCurrency,
        stock: product.stock,
        min_stock: product.min_stock || 5,
        max_stock: product.max_stock ?? '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        track_lot: !!product.track_lot,
        track_serial: !!product.track_serial,
        track_expiry: !!product.track_expiry,
        issue_strategy: product.issue_strategy || 'none'
      })
    } else {
      setFormData({
        name: '',
        category: '',
        unit_price: '',
        currency: defaultCurrency,
        stock: 0,
        min_stock: 5,
        max_stock: '',
        sku: '',
        barcode: '',
        track_lot: false,
        track_serial: false,
        track_expiry: false,
        issue_strategy: 'none'
      })
    }
  }, [product, open, defaultCurrency])

  const createMutation = useMutation({
    mutationKey: PRODUCT_CREATE_KEY,
    onMutate: async (vars) => {
      const payload = vars?.payload || {}
      const clientUuid = payload.client_uuid
      if (clientUuid && !requeueGuardRef.current.has(clientUuid)) {
        applyOptimisticProductCreate(
          queryClient,
          buildPendingProductRow(payload, { userId, businessId }),
        )
      }
      if (!onlineManager.isOnline()) notifyOfflineQueued('Producto')
      return { clientUuid }
    },
    onSuccess: (_d, _v, ctx) => {
      if (ctx?.clientUuid) requeueGuardRef.current.delete(ctx.clientUuid)
      onSuccess?.({ created: true })
    },
    onError: (error, vars, ctx) => {
      const uuid = ctx?.clientUuid || vars?.payload?.client_uuid
      if (isNetworkError(error)) {
        markOffline()
        notifyOfflineQueued('Producto')
        if (uuid && !requeueGuardRef.current.has(uuid)) {
          requeueGuardRef.current.add(uuid)
          queueMicrotask(() => createMutation.mutate(vars))
        }
        return
      }
      if (uuid) requeueGuardRef.current.delete(uuid)
      clearOptimisticProduct(queryClient, uuid)
      notify.error(getSupabaseErrorMessage(error))
    },
  })

  const updateMutation = useMutation({
    mutationKey: PRODUCT_UPDATE_KEY,
    onMutate: async (vars) => {
      const id = vars?.id
      const previous = findProductInCache(queryClient, id)
      if (previous && !requeueGuardRef.current.has(`prod-upd-${id}`)) {
        applyOptimisticProductUpdate(queryClient, id, vars?.payload || {})
      }
      if (!onlineManager.isOnline()) notifyOfflineQueued('Producto')
      return { id, previous }
    },
    onSuccess: (_d, _v, ctx) => {
      if (ctx?.id != null) requeueGuardRef.current.delete(`prod-upd-${ctx.id}`)
      onSuccess?.({ created: false })
    },
    onError: (error, vars, ctx) => {
      const id = ctx?.id ?? vars?.id
      const key = `prod-upd-${id}`
      if (isNetworkError(error)) {
        markOffline()
        notifyOfflineQueued('Producto')
        if (id != null && !requeueGuardRef.current.has(key)) {
          requeueGuardRef.current.add(key)
          queueMicrotask(() => updateMutation.mutate(vars))
        }
        onSuccess?.({ created: false })
        return
      }
      requeueGuardRef.current.delete(key)
      restoreProductRow(queryClient, id, ctx?.previous)
      notify.error(getSupabaseErrorMessage(error))
    },
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validation = validateForm(productSchema, {
      name: formData.name,
      category: formData.category || '',
      unit_price: String(formData.unit_price ?? ''),
      currency: formData.currency,
      stock: String(formData.stock ?? ''),
      min_stock: String(formData.min_stock ?? '')
    })
    if (!validation.success) {
      setErrors(validation.errors)
      return
    }
    setErrors({})

    const payload = serializeProductPayload({
      ...formData,
      unit_price: Number(formData.unit_price),
      stock: Number(formData.stock),
      min_stock: Number(formData.min_stock),
      max_stock: formData.max_stock === '' || formData.max_stock == null ? null : Number(formData.max_stock),
    })

    if (product) {
      // El stock no se edita aquí (solo vía movimientos).
      onOpenChange(false)
      updateMutation.mutate({
        id: product.id,
        payload,
        userId,
        businessId,
      })
      return
    }

    if (!payload.client_uuid) payload.client_uuid = genClientUuid()
    onOpenChange(false)
    createMutation.mutate({ payload, userId, businessId })
  }

  const handleDelete = async () => {
    if (!onlineManager.isOnline()) {
      notify.warning('Sin conexión no se pueden eliminar productos. Reconecta e inténtalo de nuevo.')
      setConfirmOpen(false)
      return
    }
    setLoading(true)
    try {
      await deleteProduct(product.id, userId, businessId) // Pasar ambos IDs
      onSuccess()
    } catch (error) {
      const msg = getSupabaseErrorMessage(error)
      notify.error(msg)
    } finally {
      setLoading(false)
      setConfirmOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      onOpenChange(nextOpen)
      if (!nextOpen) {
        setFormData({
          name: '',
          category: '',
          unit_price: '',
          currency: defaultCurrency,
          stock: 0,
          min_stock: 5,
          max_stock: '',
          sku: '',
          barcode: '',
          track_lot: false,
          track_serial: false,
          track_expiry: false,
          issue_strategy: 'none'
        })
        setConfirmOpen(false)
      }
    }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label>Nombre</Label>
            <Input
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>SKU</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.sku}
                  onChange={e => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="PRD-0001"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => setFormData({ ...formData, sku: generateProductSku(formData.name) })}
                >
                  Generar
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Código de barras</Label>
              <Input
                value={formData.barcode}
                onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="EAN / UPC"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Categoría</Label>
            <Select
              value={formData.category}
              onValueChange={v => setFormData({ ...formData, category: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories && categories.length > 0 ? categories.map(c => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                )) : <SelectItem value="General">General</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Precio Unitario</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.unit_price}
                onChange={e => setFormData({ ...formData, unit_price: e.target.value })}
                aria-invalid={!!errors.unit_price}
              />
              {errors.unit_price && <p className="text-xs text-destructive">{errors.unit_price}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Moneda</Label>
              <Select
                value={formData.currency}
                onValueChange={v => setFormData({ ...formData, currency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                  ))}
                  {currencies.length === 0 && <SelectItem value="USD">USD</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{product ? 'Stock Actual' : 'Stock inicial'}</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={formData.stock}
                onChange={e => setFormData({ ...formData, stock: e.target.value })}
                aria-invalid={!!errors.stock}
                disabled={!!product}
              />
              {errors.stock && <p className="text-xs text-destructive">{errors.stock}</p>}
              {!product && (
                <p className="text-xs text-muted-foreground">
                  Si indicas una cantidad, se registra como entrada inicial.
                </p>
              )}
              {product && (
                <p className="text-xs text-muted-foreground">
                  El stock se ajusta con movimientos (Entrada/Salida), no desde aquí.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Stock Mínimo (Alerta)</Label>
              <Input
                type="number"
                value={formData.min_stock}
                onChange={e => setFormData({ ...formData, min_stock: e.target.value })}
                aria-invalid={!!errors.min_stock}
              />
              {errors.min_stock && <p className="text-xs text-destructive">{errors.min_stock}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Stock máximo <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
              <Input
                type="number"
                min="0"
                value={formData.max_stock}
                onChange={e => setFormData({ ...formData, max_stock: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Estrategia de salida</Label>
              <Select
                value={formData.issue_strategy}
                onValueChange={v => setFormData({ ...formData, issue_strategy: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguna</SelectItem>
                  <SelectItem value="fifo">FIFO</SelectItem>
                  <SelectItem value="fefo">FEFO (caducidad)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.track_lot}
                onChange={e => setFormData({ ...formData, track_lot: e.target.checked })}
              />
              Control por lote
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.track_serial}
                onChange={e => setFormData({ ...formData, track_serial: e.target.checked })}
              />
              Control por serie
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.track_expiry}
                onChange={e => setFormData({ ...formData, track_expiry: e.target.checked })}
              />
              Caducidad
            </label>
          </div>

          <DialogFooter className="flex justify-between items-center sm:justify-between w-full mt-6">
            {product && hasPermission('warehouse.delete') ? (
              <Button type="button" variant="destructive" onClick={() => setConfirmOpen(true)} disabled={loading || updateMutation.isPending}>
                Eliminar
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading || updateMutation.isPending}>
                Cancelar
              </Button>
              <Button type="submit" loading={loading || createMutation.isPending || updateMutation.isPending}>
                {loading || createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirmar eliminación"
        description="¿Deseas eliminar este producto? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        tone="destructive"
        onConfirm={handleDelete}
        loading={loading}
      />
    </Dialog>
  )
}