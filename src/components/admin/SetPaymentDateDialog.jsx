import { useEffect, useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

export function SetPaymentDateDialog({ open, onOpenChange, business, submitting, onConfirm }) {
  const [date, setDate] = useState(null)

  useEffect(() => {
    if (!open) return
    setDate(business?.current_period_end ? new Date(business.current_period_end) : null)
  }, [open, business])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Cambiar fecha de pago</DialogTitle>
          <DialogDescription className="truncate">
            Ajusta el vencimiento de {business?.email || 'este negocio'}. Si la fecha es futura, la cuenta se reactiva.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          <Label>Nueva fecha de vencimiento</Label>
          <Calendar value={date} onChange={setDate} placeholder="Selecciona una fecha" />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm?.({ businessId: business.business_id, newPeriodEnd: date ? new Date(date).toISOString() : null })}
            loading={submitting}
            disabled={!date}
          >
            Guardar fecha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
