/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createProduct, updateProduct, deleteProduct } from '@/services/almacen'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { usePermissions } from '@/context/PermissionContext'
import { productSchema, validateForm } from '@/utils/formSchemas'

export function ProductModal({ open, onOpenChange, product, onSuccess, categories, currencies = [] }) {
  const { session } = useSession()
  const { businessId } = useBusiness() // Obtener businessId del contexto
  const { hasPermission } = usePermissions()
  const userId = session?.user?.id
  const [loading, setLoading] = useState(false)
  const defaultCurrency = currencies.find(c => c.is_default)?.code || (currencies.length > 0 ? currencies[0].code : 'USD')

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit_price: '',
    currency: defaultCurrency,
    stock: 0,
    min_stock: 5
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
        min_stock: product.min_stock || 5
      })
    } else {
      setFormData({
        name: '',
        category: '',
        unit_price: '',
        currency: defaultCurrency,
        stock: 0,
        min_stock: 5
      })
    }
  }, [product, open, defaultCurrency])

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
    setLoading(true)
    try {
      const payload = {
        ...formData,
        unit_price: Number(formData.unit_price),
        stock: Number(formData.stock),
        min_stock: Number(formData.min_stock)
      }

      if (product) {
        await updateProduct(product.id, payload, userId, businessId) // Pasar ambos IDs
      } else {
        await createProduct(payload, userId, businessId) // Pasar ambos IDs
      }
      onSuccess()
    } catch (error) {
      const msg = getSupabaseErrorMessage(error)
      notify.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
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
          min_stock: 5
        })
        setConfirmOpen(false)
      }
    }}>
      <DialogContent className="sm:max-w-[500px]">
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
              <Label>Stock Actual</Label>
              <Input
                type="number"
                value={formData.stock}
                onChange={e => setFormData({ ...formData, stock: e.target.value })}
                aria-invalid={!!errors.stock}
              />
              {errors.stock && <p className="text-xs text-destructive">{errors.stock}</p>}
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

          <DialogFooter className="flex justify-between items-center sm:justify-between w-full mt-6">
            {product && hasPermission('warehouse.delete') ? (
              <Button type="button" variant="destructive" onClick={() => setConfirmOpen(true)} disabled={loading}>
                Eliminar
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" loading={loading}>
                {loading ? 'Guardando...' : 'Guardar'}
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