/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listAssetEvents, recordAssetEvent } from '@/services/dynamicInventory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { usePermissions } from '@/context/PermissionContext'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { UserCheck, ArrowLeftRight, Wrench, Ban, RotateCcw } from 'lucide-react'

const EVENT_META = {
  intake: { label: 'Alta', tone: 'default' },
  assign: { label: 'Asignación', tone: 'default' },
  return: { label: 'Devolución', tone: 'secondary' },
  transfer: { label: 'Transferencia', tone: 'secondary' },
  maintenance: { label: 'Mantenimiento', tone: 'outline' },
  dispose: { label: 'Baja', tone: 'destructive' }
}

const ACTIONS = [
  { type: 'assign', label: 'Asignar', Icon: UserCheck, needsCustodian: true, needsLocation: true },
  { type: 'transfer', label: 'Transferir', Icon: ArrowLeftRight, needsLocation: true },
  { type: 'return', label: 'Devolver', Icon: RotateCcw },
  { type: 'maintenance', label: 'Mantenimiento', Icon: Wrench },
  { type: 'dispose', label: 'Dar de baja', Icon: Ban, ownerOnly: true }
]

export function AssetEventsPanel({ itemId, userId, itemStatus, readOnly = false }) {
  const queryClient = useQueryClient()
  const { hasPermission, isOwner } = usePermissions()
  const disposed = ['baja', 'disposed'].includes(String(itemStatus || '').toLowerCase())
  const canEdit = !readOnly && hasPermission('inventory.edit') && !disposed

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['inventoryAssetEvents', itemId],
    queryFn: () => listAssetEvents(itemId, userId),
    enabled: !!itemId && !!userId
  })

  const [open, setOpen] = useState(false)
  const [action, setAction] = useState(null)
  const [form, setForm] = useState({ toCustodian: '', toLocation: '', notes: '', signatureName: '', attachmentUrl: '' })

  const mutation = useMutation({
    mutationFn: (payload) => recordAssetEvent(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryAssetEvents', itemId] })
      queryClient.invalidateQueries({ queryKey: ['inventoryItem', String(itemId)] })
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] })
      notify.success('Evento registrado')
      setOpen(false)
      setAction(null)
    },
    onError: (e) => notify.error(getSupabaseErrorMessage(e))
  })

  const openAction = (a) => {
    setAction(a)
    setForm({ toCustodian: '', toLocation: '', notes: '', signatureName: '', attachmentUrl: '' })
    setOpen(true)
  }

  const submit = () => {
    if (!action) return
    if (action.needsCustodian && !String(form.toCustodian || '').trim()) {
      notify.warning('Indica el custodio')
      return
    }
    if (action.needsLocation && !String(form.toLocation || '').trim()) {
      notify.warning('Indica la ubicación')
      return
    }
    if (action.type === 'dispose' && !String(form.notes || '').trim()) {
      notify.warning('Escribe el motivo de la baja')
      return
    }
    mutation.mutate({
      itemId,
      eventType: action.type,
      toLocation: form.toLocation || null,
      toCustodian: form.toCustodian || null,
      notes: [form.notes, form.signatureName ? `Firma: ${form.signatureName}` : null].filter(Boolean).join(' · ') || null,
      attachmentUrl: form.attachmentUrl || null
    })
  }

  const visibleActions = useMemo(
    () => ACTIONS.filter((a) => !a.ownerOnly || isOwner),
    [isOwner]
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Ciclo de vida del activo</CardTitle>
        <CardDescription>
          Asigna, transfiere o da de baja. Queda un historial (sin depreciación contable).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {visibleActions.map((a) => (
              <Button
                key={a.type}
                type="button"
                variant={a.type === 'dispose' ? 'destructive' : 'outline'}
                className="h-auto min-h-10 justify-start gap-2 px-3 py-2"
                onClick={() => openAction(a)}
              >
                <a.Icon className="h-4 w-4 shrink-0" />
                <span className="text-sm">{a.label}</span>
              </Button>
            ))}
          </div>
        )}
        {disposed && (
          <p className="text-sm text-muted-foreground">Este activo está dado de baja; no admite nuevas asignaciones.</p>
        )}

        <div className="space-y-2">
          <div className="text-sm font-medium">Historial</div>
          {isLoading ? (
            <div className="space-y-2" role="status" aria-label="Cargando historial">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
              Aún no hay eventos.
            </p>
          ) : (
            <ul className="space-y-2">
              {events.map((ev) => {
                const meta = EVENT_META[ev.event_type] || { label: ev.event_type, tone: 'outline' }
                const when = ev.created_at
                  ? format(new Date(ev.created_at), "dd MMM yyyy · HH:mm", { locale: es })
                  : '—'
                return (
                  <li key={ev.id} className="rounded-lg border p-3 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <Badge variant={meta.tone}>{meta.label}</Badge>
                      <span className="text-xs text-muted-foreground">{when}</span>
                    </div>
                    {(ev.to_custodian || ev.to_location) && (
                      <p className="text-sm text-muted-foreground break-words">
                        {[ev.to_custodian && `Custodio: ${ev.to_custodian}`, ev.to_location && `Ubicación: ${ev.to_location}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                    {ev.notes && <p className="text-sm break-words">{ev.notes}</p>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{action?.label || 'Evento'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {action?.needsCustodian && (
              <div className="grid gap-1.5">
                <Label htmlFor="asset-custodian">Custodio</Label>
                <Input
                  id="asset-custodian"
                  value={form.toCustodian}
                  onChange={(e) => setForm((f) => ({ ...f, toCustodian: e.target.value }))}
                  placeholder="Quién lo tiene"
                />
              </div>
            )}
            {(action?.needsLocation || action?.type === 'transfer' || action?.type === 'return') && (
              <div className="grid gap-1.5">
                <Label htmlFor="asset-location">Ubicación</Label>
                <Input
                  id="asset-location"
                  value={form.toLocation}
                  onChange={(e) => setForm((f) => ({ ...f, toLocation: e.target.value }))}
                  placeholder="Oficina, sala…"
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="asset-notes">Notas / motivo</Label>
              <Textarea
                id="asset-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Opcional (obligatorio en baja)"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="asset-sign">Firma (nombre)</Label>
              <Input
                id="asset-sign"
                value={form.signatureName}
                onChange={(e) => setForm((f) => ({ ...f, signatureName: e.target.value }))}
                placeholder="Quién confirma el movimiento"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="asset-attach">Adjunto (URL)</Label>
              <Input
                id="asset-attach"
                value={form.attachmentUrl}
                onChange={(e) => setForm((f) => ({ ...f, attachmentUrl: e.target.value }))}
                placeholder="https://…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={submit} loading={mutation.isPending}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
