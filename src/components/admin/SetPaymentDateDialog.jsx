import { useEffect, useMemo, useState } from 'react'
import { addYears, format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const toYMD = (d) => {
  if (!d) return ''
  const dt = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  return format(dt, 'yyyy-MM-dd')
}

export function SetPaymentDateDialog({ open, onOpenChange, business, submitting, onConfirm }) {
  const [date, setDate] = useState('')

  // Tope: 1 año posterior a hoy (duración máxima del plan). Se permiten fechas
  // futuras (input nativo, sin desbordes ni dependencias de calendario).
  const maxDate = useMemo(() => format(addYears(new Date(), 1), 'yyyy-MM-dd'), [])

  useEffect(() => {
    if (!open) return
    setDate(toYMD(business?.current_period_end))
  }, [open, business])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Cambiar fecha de pago</DialogTitle>
          <DialogDescription className="break-words">
            Ajusta el vencimiento de {business?.email || 'este negocio'}. Si la fecha es futura, la cuenta se reactiva.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          <Label htmlFor="payment-date">Nueva fecha de vencimiento</Label>
          <Input
            id="payment-date"
            type="date"
            value={date}
            max={maxDate}
            onChange={(e) => setDate(e.target.value)}
            className="[color-scheme:light] dark:[color-scheme:dark]"
          />
          <p className="text-xs text-muted-foreground">Máximo 1 año desde hoy (duración máxima del plan).</p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm?.({
              businessId: business.business_id,
              newPeriodEnd: date ? new Date(`${date}T00:00:00`).toISOString() : null
            })}
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
