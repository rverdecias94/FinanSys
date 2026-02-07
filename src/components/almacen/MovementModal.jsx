import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { registerMovement } from '@/services/almacen'
import { useSession } from '@/hooks/useSession'

export function MovementModal({ open, onOpenChange, products, onSuccess }) {
  const { session } = useSession()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    product_id: '',
    qty: '',
    type: 'in'
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await registerMovement({
        product_id: formData.product_id,
        qty: Number(formData.qty),
        type: formData.type,
        user_id: session?.user?.id
      })
      setFormData({ product_id: '', qty: '', type: 'in' })
      onSuccess()
    } catch (error) {
      console.error(error)
      alert('Error al registrar movimiento')
    } finally {
      setLoading(false)
    }
  }

  const selectedProduct = products.find(p => String(p.id) === String(formData.product_id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona..." />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} (Stock: {p.stock})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                required
              />
            </div>
          </div>

          {selectedProduct && formData.type === 'out' && (
            <div className="text-sm text-muted-foreground">
              Stock actual: {selectedProduct.stock}
              {Number(formData.qty) > selectedProduct.stock && (
                <span className="text-red-500 block font-medium">⚠️ Cantidad excede el stock disponible</span>
              )}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Registrando...' : 'Confirmar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
