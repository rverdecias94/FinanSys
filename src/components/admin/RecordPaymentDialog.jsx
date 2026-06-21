import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Importes por defecto (solo prefijado editable; la fuente real es plans.pricing en backend).
const CYCLE_DEFAULT_AMOUNT = { monthly: 10, semiannual: 57, annual: 102 }

export function RecordPaymentDialog({ open, onOpenChange, business, submitting, onConfirm }) {
  const [form, setForm] = useState({ billingCycle: 'monthly', amount: '10', method: 'transferencia', reference: '', notes: '' })

  useEffect(() => {
    if (!open) return
    const cycle = business?.billing_cycle || 'monthly'
    setForm({ billingCycle: cycle, amount: String(CYCLE_DEFAULT_AMOUNT[cycle] ?? 10), method: 'transferencia', reference: '', notes: '' })
  }, [open, business])

  const setCycle = (c) => setForm((p) => ({ ...p, billingCycle: c, amount: String(CYCLE_DEFAULT_AMOUNT[c] ?? p.amount) }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription className="truncate">
            Registra un pago de {business?.email || 'este negocio'} en el historial (no cambia el plan).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Ciclo</Label>
            <Select value={form.billingCycle} onValueChange={setCycle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensual</SelectItem>
                <SelectItem value="semiannual">Semestral</SelectItem>
                <SelectItem value="annual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Importe (USD)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label>Método</Label>
            <Select value={form.method} onValueChange={(v) => setForm((p) => ({ ...p, method: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="acuerdo">Acuerdo</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Referencia</Label>
            <Input
              value={form.reference}
              onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
              placeholder="Comprobante o nota"
            />
          </div>
          <div className="grid gap-2">
            <Label>Notas</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Opcional"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm?.({
              businessId: business.business_id,
              amount: Number(form.amount) || 0,
              billingCycle: form.billingCycle,
              method: form.method,
              reference: form.reference,
              notes: form.notes
            })}
            loading={submitting}
            disabled={!(Number(form.amount) >= 0)}
          >
            Registrar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
