import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'

function statusVariant(status) {
  if (status === 'pending') return 'secondary'
  if (status === 'approved') return 'default'
  if (status === 'rejected') return 'destructive'
  return 'outline'
}

async function copyText(value) {
  const v = (value || '').trim()
  if (!v) return
  try {
    await navigator.clipboard.writeText(v)
    toast.success('Copiado')
  } catch {
    toast.error('No se pudo copiar')
  }
}

export function PlanRequestDetailsDialog({ open, onOpenChange, request }) {
  const r = request
  const created = r?.created_at ? new Date(r.created_at).toLocaleString('es-ES') : '-'
  const reviewed = r?.reviewed_at ? new Date(r.reviewed_at).toLocaleString('es-ES') : '-'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Detalle de solicitud</DialogTitle>
          <DialogDescription>Información completa registrada en la solicitud.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(r?.status)} className="capitalize">
              {r?.status || '-'}
            </Badge>
            <div className="text-muted-foreground">Creada: {created}</div>
          </div>

          <div className="grid gap-2 rounded-md border p-3">
            <div className="grid gap-1">
              <div className="text-xs text-muted-foreground">Negocio</div>
              <div className="font-mono text-xs">{r?.business_id || '-'}</div>
            </div>

            <div className="grid gap-1">
              <div className="text-xs text-muted-foreground">Solicitante</div>
              <div className="font-mono text-xs">{r?.requested_by || '-'}</div>
            </div>

            <div className="grid gap-1">
              <div className="text-xs text-muted-foreground">Email</div>
              <div className="flex items-center justify-between gap-2">
                <div className="truncate">{r?.contact_email || '-'}</div>
                <Button variant="outline" size="icon" onClick={() => copyText(r?.contact_email)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-1">
              <div className="text-xs text-muted-foreground">Teléfono</div>
              <div className="flex items-center justify-between gap-2">
                <div className="truncate">{r?.contact_phone || '-'}</div>
                <Button variant="outline" size="icon" onClick={() => copyText(r?.contact_phone)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-2 rounded-md border p-3">
            <div className="grid gap-1">
              <div className="text-xs text-muted-foreground">Plan solicitado</div>
              <div className="capitalize">{r?.requested_plan_id || '-'}</div>
            </div>
            <div className="grid gap-1">
              <div className="text-xs text-muted-foreground">Plan actual</div>
              <div className="capitalize">{r?.current_plan_id || '-'}</div>
            </div>
            <div className="grid gap-1">
              <div className="text-xs text-muted-foreground">Ciclo</div>
              <div>{({ monthly: 'Mensual', quarterly: 'Trimestral', annual: 'Anual' }[r?.billing_cycle]) || r?.billing_cycle || '-'}</div>
            </div>
            <div className="grid gap-1">
              <div className="text-xs text-muted-foreground">Importe</div>
              <div>{r?.requested_amount != null ? `$${r.requested_amount}` : '-'}</div>
            </div>
            <div className="grid gap-1">
              <div className="text-xs text-muted-foreground">Método de pago</div>
              <div className="capitalize">{r?.payment_method || '-'}</div>
            </div>
            <div className="grid gap-1">
              <div className="text-xs text-muted-foreground">Referencia</div>
              <div className="flex items-center justify-between gap-2">
                <div className="truncate">{r?.payment_reference || '-'}</div>
                <Button variant="outline" size="icon" onClick={() => copyText(r?.payment_reference)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-2 rounded-md border p-3">
            <div className="grid gap-1">
              <div className="text-xs text-muted-foreground">Notas del usuario</div>
              <div className="whitespace-pre-wrap">{r?.user_notes || '-'}</div>
            </div>
            <div className="grid gap-1">
              <div className="text-xs text-muted-foreground">Revisión</div>
              <div className="text-muted-foreground">{reviewed}</div>
            </div>
            <div className="grid gap-1">
              <div className="text-xs text-muted-foreground">Notas admin</div>
              <div className="whitespace-pre-wrap">{r?.admin_notes || '-'}</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

