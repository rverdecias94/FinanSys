import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Eye, ThumbsDown, ThumbsUp } from 'lucide-react'

function statusVariant(status) {
  if (status === 'pending') return 'secondary'
  if (status === 'approved') return 'default'
  if (status === 'rejected') return 'destructive'
  return 'outline'
}

export function PlanRequestsTable({ loading, requests, onView, onApprove, onReject }) {
  if (loading) {
    return (
      <div className="rounded-md border p-6 text-sm text-muted-foreground">
        Cargando solicitudes...
      </div>
    )
  }

  if (!requests?.length) {
    return (
      <div className="rounded-md border p-6 text-sm text-muted-foreground">
        No hay solicitudes con los filtros actuales.
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Negocio</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Actual</TableHead>
            <TableHead>Meses</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Referencia</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((r) => {
            const created = r?.created_at ? new Date(r.created_at).toLocaleString('es-ES') : '-'
            const canProcess = r?.status === 'pending'
            return (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{created}</TableCell>
                <TableCell className="font-mono text-xs">{String(r.business_id || '').slice(0, 8)}...</TableCell>
                <TableCell className="max-w-[220px] truncate">{r.contact_email || '-'}</TableCell>
                <TableCell className="capitalize">{r.requested_plan_id}</TableCell>
                <TableCell className="capitalize">{r.current_plan_id || '-'}</TableCell>
                <TableCell>{r.requested_months}</TableCell>
                <TableCell className="max-w-[140px] truncate">{r.contact_phone || '-'}</TableCell>
                <TableCell className="capitalize">{r.payment_method || '-'}</TableCell>
                <TableCell className="max-w-[200px] truncate">{r.payment_reference || '-'}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(r.status)} className="capitalize">
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="icon" onClick={() => onView?.(r)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" disabled={!canProcess} onClick={() => onApprove?.(r)}>
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" disabled={!canProcess} onClick={() => onReject?.(r)}>
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

