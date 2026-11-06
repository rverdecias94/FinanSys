import { CloudOff } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Contenedor visual para filas aún no subidas (outbox offline).
 * No depende solo del color: borde, fondo, icono + texto (accesibilidad).
 * Mobile-first: el aviso va arriba a ancho completo (sin solaparse).
 */
export function PendingSyncRow({ pending = false, className, children, ...props }) {
  if (!pending) {
    return (
      <div
        className={cn(
          'flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-label="Pendiente de sincronizar"
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-warning/40 border-l-4 border-l-warning',
        'bg-warning/5 p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300',
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-warning">
        <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Por sincronizar · se subirá al reconectar</span>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        {children}
      </div>
    </div>
  )
}
