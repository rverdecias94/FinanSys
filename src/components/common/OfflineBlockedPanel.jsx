import { CloudOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Pantalla amable cuando una sección requiere red (IA, reportes frescos, etc.).
 * Mobile-first; tokens de warning; no solo color.
 */
export function OfflineBlockedPanel({
  title = 'Sin conexión',
  description = 'Esta sección necesita internet para funcionar bien y evitar errores. Reconecta e inténtalo de nuevo.',
  className,
}) {
  return (
    <Card
      role="status"
      aria-live="polite"
      className={cn(
        'border-warning/40 bg-warning/5',
        className,
      )}
    >
      <CardContent className="flex flex-col items-center gap-3 px-5 py-10 text-center sm:px-8">
        <div className="rounded-full bg-warning/15 p-3 text-warning">
          <CloudOff className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h2 className="text-base font-semibold text-foreground sm:text-lg">{title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}
