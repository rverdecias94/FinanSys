/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  createWarehouseDocument,
  createCountAdjustment,
  listReasonCodes,
} from '@/services/almacen'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'

const MODES = {
  receipt: {
    title: 'Recepción',
    description: 'Entrada de mercancía (proveedor u origen).',
    docType: 'receipt',
    needsCost: true,
    needsPartner: true,
    needsReason: false
  },
  issue: {
    title: 'Salida',
    description: 'Salida de almacén por consumo o entrega.',
    docType: 'issue',
    needsCost: false,
    needsPartner: false,
    needsReason: false
  },
  adjustment: {
    title: 'Ajuste',
    description: 'Corregir diferencia con motivo obligatorio.',
    docType: 'adjustment',
    needsCost: false,
    needsPartner: false,
    needsReason: true
  },
  transfer: {
    title: 'Transferencia',
    description: 'Mover entre ubicaciones (mismo stock total).',
    docType: 'transfer',
    needsCost: false,
    needsPartner: false,
    needsReason: false
  },
  count: {
    title: 'Conteo',
    description: 'Comparar stock del sistema con el conteo físico.',
    docType: 'count',
    needsCost: false,
    needsPartner: false,
    needsReason: false
  }
}

export function WarehouseOperationModal({ open, onOpenChange, mode = 'receipt', products = [], onSuccess }) {
  const cfg = MODES[mode] || MODES.receipt
  const { session } = useSession()
  const { businessId } = useBusiness()
  const userId = session?.user?.id
  const [loading, setLoading] = useState(false)
  const [reasons, setReasons] = useState([])
  const [form, setForm] = useState({
    product_id: '',
    qty: '',
    unit_cost: '',
    partner_name: '',
    reason_code: '',
    location_text: '',
    location_to_text: '',
    lot_text: '',
    serial_text: '',
    expires_on: '',
    counted_qty: '',
    notes: '',
    adjustment_sign: 'in'
  })

  useEffect(() => {
    if (!open || !userId) return
    listReasonCodes(userId, businessId)
      .then(setReasons)
      .catch(() => setReasons([]))
    setForm({
      product_id: '',
      qty: '',
      unit_cost: '',
      partner_name: '',
      reason_code: mode === 'adjustment' ? 'COUNT_DIFF' : '',
      location_text: '',
      location_to_text: '',
      lot_text: '',
      serial_text: '',
      expires_on: '',
      counted_qty: '',
      notes: '',
      adjustment_sign: 'in'
    })
  }, [open, userId, businessId, mode])

  const selected = products.find((p) => String(p.id) === String(form.product_id))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.product_id) {
      notify.warning('Selecciona un producto')
      return
    }
    setLoading(true)
    try {
      if (mode === 'count') {
        const systemQty = Number(selected?.stock || 0)
        const counted = Number(form.counted_qty)
        if (!Number.isFinite(counted) || counted < 0) {
          notify.warning('Indica la cantidad contada')
          setLoading(false)
          return
        }
        const res = await createCountAdjustment({
          productId: form.product_id,
          systemQty,
          countedQty: counted,
          notes: form.notes,
          autoPost: true,
          approvalThreshold: 5
        })
        if (res?.stale_snapshot) {
          notify.warning(
            `El stock cambió mientras contabas. Se usó el saldo actual del sistema (${res.system_qty_used}).`
          )
        }
        if (res?.diff === 0) notify.success('Sin diferencia de conteo')
        else if (res?.needs_approval) notify.warning('Diferencia grande: queda pendiente de aprobación del titular')
        else if (!res?.stale_snapshot) notify.success('Conteo registrado')
        else notify.success('Conteo registrado con stock actualizado')
      } else {
        const qty = Number(form.qty)
        if (!Number.isFinite(qty) || qty <= 0) {
          notify.warning('La cantidad debe ser mayor que cero')
          setLoading(false)
          return
        }
        if (cfg.needsReason && !form.reason_code) {
          notify.warning('Elige un motivo')
          setLoading(false)
          return
        }
        const locationTo = mode === 'adjustment'
          ? form.adjustment_sign
          : (form.location_to_text || null)
        await createWarehouseDocument({
          docType: cfg.docType,
          lines: [{
            product_id: Number(form.product_id),
            qty,
            unit_cost: cfg.needsCost && form.unit_cost !== '' ? Number(form.unit_cost) : null,
            location_text: form.location_text || null,
            location_to_text: locationTo,
            lot_text: form.lot_text || null,
            serial_text: form.serial_text || null,
            notes: form.expires_on ? `expires_on=${form.expires_on}` : null
          }],
          partnerName: form.partner_name || null,
          reasonCode: form.reason_code || null,
          notes: form.notes || null,
          autoPost: true
        })
        notify.success(`${cfg.title} registrada`)
      }
      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      notify.error(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{cfg.title}</DialogTitle>
          <DialogDescription>{cfg.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label>Producto</Label>
            <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecciona..." />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} (Stock: {p.stock}{p.sku ? ` · ${p.sku}` : ''})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === 'count' ? (
            <div className="grid gap-2">
              <p className="text-sm text-muted-foreground">
                Stock sistema: <span className="font-medium text-foreground">{selected?.stock ?? '—'}</span>
              </p>
              <Label>Cantidad contada (ciego: no mires el sistema si puedes)</Label>
              <Input
                type="number"
                min="0"
                className="h-11"
                value={form.counted_qty}
                onChange={(e) => setForm({ ...form, counted_qty: e.target.value })}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  min="1"
                  className="h-11"
                  value={form.qty}
                  onChange={(e) => setForm({ ...form, qty: e.target.value })}
                />
              </div>
              {cfg.needsCost && (
                <div className="grid gap-2">
                  <Label>Costo unitario</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-11"
                    value={form.unit_cost}
                    onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
                  />
                </div>
              )}
              {mode === 'adjustment' && (
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Sentido del ajuste</Label>
                  <Select
                    value={form.adjustment_sign}
                    onValueChange={(v) => setForm({ ...form, adjustment_sign: v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">Incrementar stock (+)</SelectItem>
                      <SelectItem value="out">Reducir stock (−)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {cfg.needsPartner && (
            <div className="grid gap-2">
              <Label>Proveedor / origen</Label>
              <Input
                className="h-11"
                value={form.partner_name}
                onChange={(e) => setForm({ ...form, partner_name: e.target.value })}
              />
            </div>
          )}

          {cfg.needsReason && (
            <div className="grid gap-2">
              <Label>Motivo</Label>
              <Select value={form.reason_code} onValueChange={(v) => setForm({ ...form, reason_code: v })}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecciona motivo" />
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((r) => (
                    <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Lote (nota opcional)</Label>
              <Input
                className="h-11"
                value={form.lot_text}
                onChange={(e) => setForm({ ...form, lot_text: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Serie (nota opcional)</Label>
              <Input
                className="h-11"
                value={form.serial_text}
                onChange={(e) => setForm({ ...form, serial_text: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Notas</Label>
            <Input
              className="h-11"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={loading}>
              {loading ? 'Guardando...' : 'Confirmar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
