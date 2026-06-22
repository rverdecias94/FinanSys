/* eslint-disable react/prop-types */
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { registerMovement } from '@/services/almacen'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { movementSchema, validateForm } from '@/utils/formSchemas'

export function MovementModal({ open, onOpenChange, products, onSuccess }) {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const safeProducts = Array.isArray(products) ? products : []
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [formData, setFormData] = useState({
    product_id: '',
    qty: '',
    type: 'in',
    unit_cost: ''
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
    // Regla contextual: una salida no puede exceder el stock disponible.
    if (formData.type === 'out' && selectedProduct && Number(formData.qty) > selectedProduct.stock) {
      setErrors({ qty: 'La cantidad excede el stock disponible' })
      return
    }
    setErrors({})
    setLoading(true)
    try {
      const effectiveBusinessId = businessId || session?.user?.id
      await registerMovement({
        product_id: formData.product_id,
        qty: Number(formData.qty),
        type: formData.type,
        unit_cost: formData.type === 'in' ? formData.unit_cost : '',
        userId: session?.user?.id,
        businessId: effectiveBusinessId
      })
      onSuccess()
    } catch (error) {
      const msg = getSupabaseErrorMessage(error)
      notify.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const selectedProduct = safeProducts.find(p => String(p.id) === String(formData.product_id))

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      onOpenChange(nextOpen)
      if (!nextOpen) {
        setFormData({ product_id: '', qty: '', type: 'in', unit_cost: '' })
        setErrors({})
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Movimiento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label>Producto</Label>
            <Select
              value={formData.product_id}
              onValueChange={v => setFormData({ ...formData, product_id: v })}
            >
              <SelectTrigger aria-invalid={!!errors.product_id}>
                <SelectValue placeholder="Selecciona..." />
              </SelectTrigger>
              <SelectContent>
                {safeProducts.map(p => (
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
                <SelectTrigger>
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
              <Label>Costo unitario <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formData.unit_cost}
                onChange={e => setFormData({ ...formData, unit_cost: e.target.value })}
                aria-invalid={!!errors.unit_cost}
              />
              {errors.unit_cost
                ? <p className="text-xs text-destructive">{errors.unit_cost}</p>
                : <p className="text-xs text-muted-foreground">Si lo indicas, se recalcula el costo promedio del producto.</p>}
            </div>
          )}

          {selectedProduct && formData.type === 'out' && (
            <div className="text-sm text-muted-foreground">
              Stock actual: {selectedProduct.stock}
              {Number(formData.qty) > selectedProduct.stock && (
                <span className="text-red-500 block font-medium">⚠️ Cantidad excede el stock disponible</span>
              )}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button type="submit" loading={loading}>
              {loading ? 'Registrando...' : 'Confirmar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
