import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { contactSchema, validateForm } from '@/utils/formSchemas'

const EMPTY = { name: '', kind: 'cliente', phone: '', email: '', notes: '' }

export function ContactModal({ open, onOpenChange, contact, onSubmit, submitting = false, readOnly = false }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(contact
      ? {
        name: contact.name || '',
        kind: contact.kind || 'cliente',
        phone: contact.phone || '',
        email: contact.email || '',
        notes: contact.notes || ''
      }
      : EMPTY)
  }, [open, contact])

  const setField = (key) => (e) => {
    const value = e && e.target ? e.target.value : e
    setForm((f) => ({ ...f, [key]: value }))
  }

  const handleSubmit = () => {
    const validation = validateForm(contactSchema, {
      name: form.name,
      kind: form.kind,
      phone: form.phone || '',
      email: form.email || '',
      notes: form.notes || ''
    })
    if (!validation.success) {
      setErrors(validation.errors)
      return
    }
    setErrors({})
    onSubmit({ ...form, name: form.name.trim() })
  }

  const title = readOnly ? 'Contacto' : contact ? 'Editar contacto' : 'Nuevo contacto'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Clientes y proveedores de tu negocio.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="contact-name">Nombre</Label>
            <Input
              id="contact-name"
              value={form.name}
              onChange={setField('name')}
              disabled={readOnly}
              placeholder="Nombre o razón social"
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={form.kind} onValueChange={setField('kind')} disabled={readOnly}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="proveedor">Proveedor</SelectItem>
                <SelectItem value="ambos">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="contact-phone">Teléfono</Label>
              <Input id="contact-phone" value={form.phone} onChange={setField('phone')} disabled={readOnly} placeholder="Opcional" aria-invalid={!!errors.phone} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="contact-email">Correo</Label>
              <Input id="contact-email" type="email" value={form.email} onChange={setField('email')} disabled={readOnly} placeholder="Opcional" aria-invalid={!!errors.email} />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="contact-notes">Notas</Label>
            <Input id="contact-notes" value={form.notes} onChange={setField('notes')} disabled={readOnly} placeholder="Opcional" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          {!readOnly && (
            <Button onClick={handleSubmit} loading={submitting}>
              {contact ? 'Guardar' : 'Crear'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
