/* eslint-disable react/prop-types */
import { Lock } from 'lucide-react'
import { formatClosedThroughLabel } from '@/utils/periodLock'

/**
 * Aviso de período cerrado (solo lectura / sin guardar).
 * @param {'view'|'create'} variant
 *   view   — movimiento ya existente dentro del cierre
 *   create — fecha elegida cae en el cierre (cambia la fecha para poder guardar)
 */
export function PeriodLockedBanner({ closedThrough, variant = 'view' }) {
  const label = formatClosedThroughLabel(closedThrough)
  if (!label) return null

  const message =
    variant === 'create'
      ? `Período cerrado hasta ${label}. Elige una fecha posterior para poder guardar.`
      : `Período cerrado hasta ${label}. Este movimiento no se puede modificar. Para cambiarlo, el propietario debe reabrir el período en Cuenta → Negocio.`

  return (
    <div
      role="status"
      className="flex gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-foreground"
    >
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <p className="min-w-0 leading-snug">{message}</p>
    </div>
  )
}
