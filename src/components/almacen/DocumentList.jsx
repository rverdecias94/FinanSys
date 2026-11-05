/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, RotateCcw, CheckCircle2, Eye } from 'lucide-react'
import {
  listWarehouseDocuments,
  getWarehouseDocument,
  reverseWarehouseDocument,
  approveWarehouseDocument,
  postWarehouseDocument
} from '@/services/almacen'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { usePermissions } from '@/context/PermissionContext'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'

const DOC_LABELS = {
  receipt: 'Recepción',
  issue: 'Salida',
  adjustment: 'Ajuste',
  transfer: 'Transferencia',
  count: 'Conteo',
  return: 'Devolución',
  quick_in: 'Entrada rápida',
  quick_out: 'Salida rápida'
}

const STATUS_VARIANT = {
  draft: 'secondary',
  pending_approval: 'outline',
  posted: 'default',
  cancelled: 'secondary',
  reversed: 'destructive'
}

export function DocumentList({ userId, businessId, enabled = true, onRefresh }) {
  const [status, setStatus] = useState('all')
  const [docType, setDocType] = useState('all')
  const [detail, setDetail] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const { hasPermission, isOwner } = usePermissions()
  const queryClient = useQueryClient()

  const effectiveKey = businessId || userId
  const queryKey = useMemo(
    () => ['warehouse', 'documents', effectiveKey, { status, docType }],
    [effectiveKey, status, docType]
  )

  const openDetail = async (id) => {
    try {
      const full = await getWarehouseDocument(id, userId, businessId)
      setDetail(full)
    } catch (err) {
      notify.error(getSupabaseErrorMessage(err))
    }
  }

  const runAction = async (id, action) => {
    setBusyId(id)
    try {
      if (action === 'reverse') await reverseWarehouseDocument(id)
      if (action === 'approve') await approveWarehouseDocument(id)
      if (action === 'post') await postWarehouseDocument(id)
      notify.success('Comprobante actualizado')
      queryClient.invalidateQueries({ queryKey: ['warehouse'] })
      onRefresh?.()
      if (detail?.id === id) {
        const full = await getWarehouseDocument(id, userId, businessId)
        setDetail(full)
      }
    } catch (err) {
      notify.error(getSupabaseErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const renderDoc = (d) => (
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="shrink-0 rounded-full bg-primary/10 p-2">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="font-medium break-words">{d.doc_number}</div>
          <div className="text-sm text-muted-foreground">
            {DOC_LABELS[d.doc_type] || d.doc_type}
            {d.reason_code ? ` · ${d.reason_code}` : ''}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {d.created_at ? new Date(d.created_at).toLocaleString() : ''}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3 sm:border-0 sm:pt-0">
        <Badge variant={STATUS_VARIANT[d.status] || 'secondary'}>{d.status}</Badge>
        <Button variant="ghost" size="sm" onClick={() => openDetail(d.id)} aria-label="Ver detalle">
          <Eye className="h-4 w-4" />
        </Button>
        {hasPermission('warehouse.move') && d.status === 'posted' && (
          <Button
            variant="outline"
            size="sm"
            disabled={busyId === d.id}
            onClick={() => runAction(d.id, 'reverse')}
            className="gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reversar
          </Button>
        )}
        {isOwner && d.status === 'pending_approval' && (
          <Button
            size="sm"
            disabled={busyId === d.id}
            onClick={() => runAction(d.id, 'approve')}
            className="gap-1"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Aprobar
          </Button>
        )}
        {hasPermission('warehouse.move') && d.status === 'draft' && (
          <Button size="sm" disabled={busyId === d.id} onClick={() => runAction(d.id, 'post')}>
            Postear
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11 w-full sm:w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="posted">Postados</SelectItem>
            <SelectItem value="draft">Borrador</SelectItem>
            <SelectItem value="pending_approval">Pendiente</SelectItem>
            <SelectItem value="reversed">Reversados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={docType} onValueChange={setDocType}>
          <SelectTrigger className="h-11 w-full sm:w-48">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(DOC_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ResponsiveListing
        queryKey={queryKey}
        queryFn={({ page, pageSize }) => listWarehouseDocuments({
          page,
          pageSize,
          status,
          docType,
          userId,
          businessId
        })}
        enabled={enabled && !!userId}
        getItemKey={(d) => d.id}
        renderItem={renderDoc}
        emptyMessage="Sin comprobantes todavía. Los movimientos rápidos aparecen aquí."
        loadingMessage="Cargando comprobantes..."
      />

      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.doc_number}</DialogTitle>
            <DialogDescription>
              {DOC_LABELS[detail?.doc_type] || detail?.doc_type} · {detail?.status}
            </DialogDescription>
          </DialogHeader>
          {detail?.notes && (
            <p className="text-sm text-muted-foreground">{detail.notes}</p>
          )}
          <div className="space-y-2">
            {(detail?.lines || []).map((line) => (
              <div key={line.id} className="rounded-md border p-3 text-sm">
                <div className="font-medium">{line.products?.name || `Producto #${line.product_id}`}</div>
                <div className="text-muted-foreground">
                  Cantidad: {line.qty}
                  {line.unit_cost != null ? ` · Costo: ${line.unit_cost}` : ''}
                  {line.lot_text ? ` · Lote: ${line.lot_text}` : ''}
                  {line.location_text ? ` · Ubic.: ${line.location_text}` : ''}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
