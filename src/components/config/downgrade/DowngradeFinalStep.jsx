import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'

export function DowngradeFinalStep({ preview, selectedCurrencyCode, selectedAreasLabel, partnersCount, finalConfirm, setFinalConfirm }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4">
        <div className="text-sm font-medium">Resumen antes de cambiar a Gratuito</div>

        <div className="mt-3 space-y-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Moneda activa</div>
            <div className="font-medium">{selectedCurrencyCode || '—'}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Áreas editables</div>
            <div className="text-sm">{selectedAreasLabel || '—'}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Miembros de equipo</div>
            <div className="text-sm">{partnersCount} Usuarios perderán acceso</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Funciones desactivadas</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {(preview?.features_lost || []).length ? (
                (preview.features_lost || []).map((f) => (
                  <Badge key={f} variant="secondary">{f}</Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-3">
        <Checkbox checked={finalConfirm} onCheckedChange={(v) => setFinalConfirm(Boolean(v))} />
        <div className="text-sm">
          <div className="font-medium">Entiendo los cambios y quiero cambiar a Plan Gratuito</div>
          <div className="text-muted-foreground">El downgrade aplicará límites sin borrar tus datos.</div>
        </div>
      </div>
    </div>
  )
}

