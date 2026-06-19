import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

// Banner global (Capa B): avisa cuando no hay conexión y que se muestran datos
// guardados. Usa tokens de color (--warning) → respeta modo claro/oscuro.
// Mobile-first: texto reducido en móvil, icono que no se encoge, sin desborde.
export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-3 py-1.5 text-center text-xs text-foreground sm:text-sm"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <span>Sin conexión · estás viendo datos guardados</span>
    </div>
  )
}
