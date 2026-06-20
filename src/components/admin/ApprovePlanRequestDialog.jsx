import { useEffect, useMemo, useState } from 'react'
import { addMonths } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const CYCLE_MONTHS = { monthly: 1, quarterly: 3, annual: 12 }
const CYCLE_LABEL = { monthly: 'Mensual', quarterly: 'Trimestral', annual: 'Anual' }

export function ApprovePlanRequestDialog({ open, onOpenChange, request, submitting, onApprove }) {
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setBillingCycle(request?.billing_cycle || 'monthly')
    setAdminNotes('')
  }, [open, request])

  const months = CYCLE_MONTHS[billingCycle] || 1
  const previewEnd = useMemo(() => addMonths(new Date(), months), [months])
  const canSubmit = !!request?.id

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Aprobar solicitud</DialogTitle>
          <DialogDescription>
            Se activará Premium para el negocio durante el período aprobado y se registrará el pago.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {request?.requested_amount != null && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <span className="text-muted-foreground">Solicitado: </span>
              <span className="font-medium">{CYCLE_LABEL[request?.billing_cycle] || '-'}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="font-medium">${request?.requested_amount}</span>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Ciclo a aprobar</Label>
            <Select value={billingCycle} onValueChange={setBillingCycle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensual (1 mes)</SelectItem>
                <SelectItem value="quarterly">Trimestral (3 meses)</SelectItem>
                <SelectItem value="annual">Anual (12 meses)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1 text-sm">
            <div className="text-muted-foreground">Vence:</div>
            <div className="font-medium">{previewEnd.toLocaleDateString('es-ES')}</div>
          </div>

          <div className="grid gap-2">
            <Label>Nota administrativa</Label>
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={() => onApprove?.({ requestId: request.id, billingCycle, adminNotes })}
            loading={submitting}
            disabled={!canSubmit}
          >
            Aprobar Premium
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
