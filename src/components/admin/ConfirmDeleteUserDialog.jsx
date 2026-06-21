import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Etiquetas legibles para los conteos del impacto (admin_preview_user_deletion).
const COUNT_LABELS = {
  transactions: 'Transacciones',
  products: 'Productos',
  movements: 'Movimientos',
  inventory_areas: 'Áreas de inventario',
  inventory_items: 'Ítems de inventario',
  inventory_area_fields: 'Campos de inventario',
  inventory_area_prefixes: 'Prefijos de inventario',
  business_currencies: 'Monedas del negocio',
  business_balances: 'Saldos',
  configuracion_balance: 'Configuración de balance',
  business_settings: 'Ajustes del negocio',
  contacts: 'Contactos',
  exchange_rates: 'Tipos de cambio',
  usage_metrics: 'Métricas de uso',
  payments: 'Pagos',
  plan_change_requests: 'Solicitudes de plan',
  roles: 'Roles',
  team_members_as_owner: 'Miembros del equipo',
  team_members_as_member: 'Membresías de equipo',
  subscriptions: 'Suscripción',
  audit_logs: 'Registros de auditoría',
  account_status: 'Estado de cuenta'
}

// Diálogo de BORRADO PERMANENTE con doble confirmación: muestra el impacto
// (conteos por tabla) y exige escribir el email exacto para habilitar el botón.
// Presentacional: recibe `preview` por props (la consulta vive en el padre).
export function ConfirmDeleteUserDialog({ open, onOpenChange, target, preview, loadingPreview, submitting, onConfirm }) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!open) return
    setTyped('')
  }, [open, target])

  const expectedEmail = (target?.email || preview?.email || '').trim()
  const matches = !!expectedEmail && typed.trim().toLowerCase() === expectedEmail.toLowerCase()

  const impactRows = useMemo(() => {
    const counts = preview?.counts || {}
    return Object.entries(counts)
      .map(([k, v]) => ({ key: k, label: COUNT_LABELS[k] || k, count: Number(v) || 0 }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [preview])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Eliminar usuario permanentemente
          </DialogTitle>
          <DialogDescription>
            Esta acción es <span className="font-semibold text-destructive">irreversible</span>. Se
            borrarán la cuenta y todos sus datos para siempre.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 text-sm">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Cuenta a eliminar</div>
            <div className="truncate font-medium">{expectedEmail || target?.user_id || '—'}</div>
          </div>

          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Impacto del borrado</span>
              {!loadingPreview && preview && (
                <span className="text-xs font-medium text-destructive">
                  {preview.total_rows} registro(s)
                </span>
              )}
            </div>
            {loadingPreview ? (
              <div className="flex items-center gap-2 py-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Calculando impacto…
              </div>
            ) : impactRows.length === 0 ? (
              <div className="py-1 text-muted-foreground">Sin datos asociados.</div>
            ) : (
              <ul className="grid gap-1">
                {impactRows.map((r) => (
                  <li key={r.key} className="flex items-center justify-between gap-2">
                    <span className="truncate text-muted-foreground">{r.label}</span>
                    <span className="shrink-0 font-medium tabular-nums">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm-email">
              Escribe <span className="font-semibold">{expectedEmail || 'el email'}</span> para confirmar
            </Label>
            <Input
              id="confirm-email"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="email del negocio"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm?.({ targetUserId: target?.user_id })}
            loading={submitting}
            disabled={!matches || !target?.user_id}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Eliminar definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
