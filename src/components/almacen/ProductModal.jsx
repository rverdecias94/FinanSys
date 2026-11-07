/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
  clearProductPendingFlag,
  findProductInCache,
  restoreProductRow,
  serializeProductPayload,
} from '@/offline/optimisticWarehouse'
import {
  STOCK_UNITS,
  normalizeStockUnit,
  perPieceFromBox,
  stockUnitPlural,
  stockUnitShort,
} from '@/utils/stockUnit'

export function ProductModal({ open, onOpenChange, product, onSuccess, categories, currencies = [] }) {
  const { session } = useSession()
  const { businessId } = useBusiness() // Obtener businessId del contexto
  const { hasPermission } = usePermissions()
  const queryClient = useQueryClient()
  const requeueGuardRef = useRef(new Set())
  const userId = session?.user?.id
  const [loading, setLoading] = useState(false)
  const defaultCurrency = currencies.find(c => c.is_default)?.code || (currencies.length > 0 ? currencies[0].code : 'USD')

  const emptyForm = () => ({
    name: '',
    category: '',
    unit_price: '',
    currency: defaultCurrency,
    is_for_sale: true,
    stock_unit: 'unit',
    units_per_box: '',
    stock: 0,
    min_stock: 5,
    max_stock: '',
    sku: '',
    barcode: '',
    track_lot: false,
    track_serial: false,
    track_expiry: false,
    issue_strategy: 'none',
  })

  const [formData, setFormData] = useState(emptyForm)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [errors, setErrors] = useState({})
  const countShort = stockUnitShort(formData.stock_unit)
  const countPlural = stockUnitPlural(formData.stock_unit)
  const pieceHint = formData.stock_unit === 'box'
    ? perPieceFromBox(formData.unit_price, formData.units_per_box)
    : null

  useEffect(() => {
    setErrors({})
    if (product) {
      setFormData({
        name: product.name,
        category: product.category,
        unit_price: product.unit_price,
        currency: product.currency || defaultCurrency,
        is_for_sale: product.is_for_sale !== false,
        stock_unit: normalizeStockUnit(product.stock_unit),
        units_per_box: product.units_per_box ?? '',
        stock: product.stock,
        min_stock: product.min_stock || 5,
        max_stock: product.max_stock ?? '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        track_lot: !!product.track_lot,
        track_serial: !!product.track_serial,
        track_expiry: !!product.track_expiry,
        issue_strategy: product.issue_strategy || 'none',
      })
    } else {
      setFormData(emptyForm())
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
      const offline = !onlineManager.isOnline()
      if (previous && !requeueGuardRef.current.has(`prod-upd-${id}`)) {
        // Solo marcar "por sincronizar" si realmente no hay red.
        applyOptimisticProductUpdate(queryClient, id, vars?.payload || {}, { pending: offline })
      }
      if (offline) notifyOfflineQueued('Producto')
      return { id, previous, offline }
    },
    onSuccess: (_d, _v, ctx) => {
      if (ctx?.id != null) {
        requeueGuardRef.current.delete(`prod-upd-${ctx.id}`)
        clearProductPendingFlag(queryClient, ctx.id)
      }
      onSuccess?.({ created: false })
    },
    onError: (error, vars, ctx) => {
      const id = ctx?.id ?? vars?.id
      const key = `prod-upd-${id}`
      if (isNetworkError(error)) {
        markOffline()
        notifyOfflineQueued('Producto')
        // Ahora sí: queda en cola → mostrar pendiente.
        if (id != null) {
          applyOptimisticProductUpdate(queryClient, id, vars?.payload || {}, { pending: true })
        }
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
    const priceForValidation = formData.is_for_sale
      ? String(formData.unit_price ?? '')
      : String(formData.unit_price === '' || formData.unit_price == null ? '0' : formData.unit_price)
    const validation = validateForm(productSchema, {
      name: formData.name,
      category: formData.category || '',
      unit_price: priceForValidation,
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
      is_for_sale: !!formData.is_for_sale,
      unit_price: formData.is_for_sale ? Number(formData.unit_price) : Number(priceForValidation),
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
        setFormData(emptyForm())
        setConfirmOpen(false)
      }
    }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="product-name">Nombre</Label>
            <Input
              id="product-name"
              className="h-11"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3">
            <div className="grid gap-1.5 min-w-0">
              <Label>SKU</Label>
              <div className="flex h-11 gap-2">
                <Input
                  className="h-11 min-w-0"
                  value={formData.sku}
                  onChange={e => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="PRD-0001"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 shrink-0 px-3"
                  onClick={() => setFormData({ ...formData, sku: generateProductSku(formData.name) })}
                >
                  Generar
                </Button>
              </div>
            </div>
            <div className="grid gap-1.5 min-w-0">
              <Label>Código de barras</Label>
              <Input
                className="h-11"
                value={formData.barcode}
                onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="EAN / UPC"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Categoría</Label>
            <Select
              value={formData.category}
              onValueChange={v => setFormData({ ...formData, category: v })}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories && categories.length > 0 ? categories.map(c => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                )) : <SelectItem value="General">General</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 px-3 py-2.5">
            <div className="min-w-0">
              <Label htmlFor="is-for-sale" className="text-sm font-medium">
                Se vende al cliente
              </Label>
              <p className="text-xs text-muted-foreground leading-snug">
                Off = uso interno (cocina, buffet, insumos). Sin precio sugerido FX.
              </p>
            </div>
            <Switch
              id="is-for-sale"
              className="shrink-0"
              checked={formData.is_for_sale}
              onCheckedChange={(checked) => setFormData({ ...formData, is_for_sale: checked })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5 min-w-0 content-start">
              <Label className="min-h-5">Se cuenta por</Label>
              <Select
                value={formData.stock_unit}
                onValueChange={(v) => setFormData({
                  ...formData,
                  stock_unit: v,
                  units_per_box: v === 'box' ? formData.units_per_box : '',
                })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STOCK_UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5 min-w-0 content-start">
              <Label className="min-h-5">Unidades por caja</Label>
              <Input
                type="number"
                min="1"
                step="1"
                className="h-11"
                placeholder="Ej. 24"
                value={formData.units_per_box}
                disabled={formData.stock_unit !== 'box'}
                onChange={(e) => setFormData({ ...formData, units_per_box: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">
                {formData.stock_unit === 'box'
                  ? 'Solo para ver equivalencia por pieza.'
                  : 'Activo si cuentas por caja.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5 min-w-0 content-start">
              <Label className="min-h-5">
                {formData.is_for_sale ? `Precio por ${countShort}` : `Precio ref. / ${countShort}`}
              </Label>
              <Input
                type="number"
                step="0.01"
                className="h-11"
                value={formData.unit_price}
                onChange={e => setFormData({ ...formData, unit_price: e.target.value })}
                aria-invalid={!!errors.unit_price}
                disabled={!formData.is_for_sale}
              />
              {errors.unit_price && <p className="text-xs text-destructive">{errors.unit_price}</p>}
              {pieceHint != null && formData.is_for_sale && (
                <p className="text-[11px] text-muted-foreground">
                  ≈ {pieceHint} {formData.currency} por pieza
                </p>
              )}
            </div>
            <div className="grid gap-1.5 min-w-0 content-start">
              <Label className="min-h-5">Moneda</Label>
              <Select
                value={formData.currency}
                onValueChange={v => setFormData({ ...formData, currency: v })}
              >
                <SelectTrigger className="h-11">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5 min-w-0 content-start">
              <Label className="min-h-5">
                {product ? `Stock (${countPlural})` : `Stock inicial (${countPlural})`}
              </Label>
              <Input
                type="number"
                min="0"
                step="1"
                className="h-11"
                value={formData.stock}
                onChange={e => setFormData({ ...formData, stock: e.target.value })}
                aria-invalid={!!errors.stock}
                disabled={!!product}
              />
              {errors.stock && <p className="text-xs text-destructive">{errors.stock}</p>}
              {product && (
                <p className="text-[11px] text-muted-foreground">
                  Entrada/salida en {countPlural}. Costo de entrada = por {countShort}.
                </p>
              )}
            </div>
            <div className="grid gap-1.5 min-w-0 content-start">
              <Label className="min-h-5">Stock mínimo</Label>
              <Input
                type="number"
                className="h-11"
                value={formData.min_stock}
                onChange={e => setFormData({ ...formData, min_stock: e.target.value })}
                aria-invalid={!!errors.min_stock}
              />
              {errors.min_stock && <p className="text-xs text-destructive">{errors.min_stock}</p>}
            </div>
          </div>

          <details className="group rounded-lg border border-border/80 open:bg-muted/20">
            <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden flex items-center justify-between">
              <span>Opciones avanzadas</span>
              <span className="text-xs text-muted-foreground group-open:hidden">Máx., lotes, serie…</span>
            </summary>
            <div className="space-y-3 border-t border-border/60 px-3 pb-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5 min-w-0">
                  <Label className="min-h-5">Stock máximo</Label>
                  <Input
                    type="number"
                    min="0"
                    className="h-11"
                    value={formData.max_stock}
                    onChange={e => setFormData({ ...formData, max_stock: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5 min-w-0">
                  <Label className="min-h-5">Estrategia de salida</Label>
                  <Select
                    value={formData.issue_strategy}
                    onValueChange={v => setFormData({ ...formData, issue_strategy: v })}
                  >
                    <SelectTrigger className="h-11">
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
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={formData.track_lot}
                    onChange={e => setFormData({ ...formData, track_lot: e.target.checked })}
                  />
                  Lote
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={formData.track_serial}
                    onChange={e => setFormData({ ...formData, track_serial: e.target.checked })}
                  />
                  Serie
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={formData.track_expiry}
                    onChange={e => setFormData({ ...formData, track_expiry: e.target.checked })}
                  />
                  Caducidad
                </label>
              </div>
            </div>
          </details>

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