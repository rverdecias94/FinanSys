import { useEffect, useMemo, useState } from 'react'
import { addMonths } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function ApprovePlanRequestDialog({ open, onOpenChange, request, submitting, onApprove }) {
  const [approvedMonths, setApprovedMonths] = useState('')
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setApprovedMonths(request?.requested_months ? String(request.requested_months) : '1')
    setAdminNotes('')
  }, [open, request])

  const previewEnd = useMemo(() => {
    const m = Math.max(1, Number(approvedMonths) || 1)
    return addMonths(new Date(), m)
  }, [approvedMonths])

  const canSubmit = !!request?.id && (Number(approvedMonths) || 0) > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Aprobar solicitud</DialogTitle>
          <DialogDescription>
            Se activará Premium para el negocio durante el período aprobado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Meses aprobados</Label>
            <Input
              type="number"
              min={1}
              value={approvedMonths}
              onChange={(e) => setApprovedMonths(e.target.value)}
            />
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
            onClick={() => onApprove?.({
              requestId: request.id,
              approvedMonths: Number(approvedMonths) || 1,
              adminNotes
            })}
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

