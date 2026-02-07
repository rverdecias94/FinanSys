import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createProduct, updateProduct, deleteProduct } from '@/services/almacen'

export function ProductModal({ open, onOpenChange, product, onSuccess, categories }) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit_price: '',
    stock: 0,
    min_stock: 5
  })

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        category: product.category,
        unit_price: product.unit_price,
        stock: product.stock,
        min_stock: product.min_stock || 5
      })
    } else {
      setFormData({
        name: '',
        category: '',
        unit_price: '',
        stock: 0,
        min_stock: 5
      })
    }
  }, [product, open])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        ...formData,
        unit_price: Number(formData.unit_price),
        stock: Number(formData.stock),
        min_stock: Number(formData.min_stock)
      }

      if (product) {
        await updateProduct(product.id, payload)
      } else {
        await createProduct(payload)
      }
      onSuccess()
    } catch (error) {
      console.error(error)
      alert('Error al guardar producto')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return
    setLoading(true)
    try {
      await deleteProduct(product.id)
      onSuccess()
    } catch (error) {
      console.error(error)
      alert('Error al eliminar producto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label>Nombre</Label>
            <Input
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Categoría</Label>
            <Select
              value={formData.category}
              onValueChange={v => setFormData({ ...formData, category: v })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                ))}
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
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Stock Mínimo (Alerta)</Label>
              <Input
                type="number"
                value={formData.min_stock}
                onChange={e => setFormData({ ...formData, min_stock: e.target.value })}
                required
              />
            </div>
          </div>
          {!product && (
            <div className="grid gap-2">
              <Label>Stock Inicial</Label>
              <Input
                type="number"
                value={formData.stock}
                onChange={e => setFormData({ ...formData, stock: e.target.value })}
                required
              />
            </div>
          )}

          <div className="flex justify-between pt-4">
            {product ? (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
                Eliminar
              </Button>
            ) : <div />}
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
