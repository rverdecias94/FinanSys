import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function RejectPlanRequestDialog({ open, onOpenChange, request, submitting, onReject }) {
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setAdminNotes('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Rechazar solicitud</DialogTitle>
          <DialogDescription>
            Se marcará la solicitud como rechazada y no se modificará la suscripción.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          <Label>Motivo o nota administrativa</Label>
          <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => onReject?.({ requestId: request?.id, adminNotes })}
            loading={submitting}
            disabled={!request?.id}
          >
            Rechazar solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

