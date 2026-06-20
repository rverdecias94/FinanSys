import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock } from 'lucide-react'
import { useSubscription } from '@/context/SubscriptionContext'
import { useBusiness } from '@/context/BusinessContext'

// Banner global de aviso de pago (Fase 2). Patrón de OfflineBanner: usa tokens de
// color (--warning / --destructive) → respeta modo claro/oscuro. Mobile-first:
// flex-wrap para que el botón baje en móvil sin desbordar, icono que no se encoge.
// Solo lo ve el propietario y solo en estados due_soon (ámbar) y grace (rojo).
function formatDate(value) {
  try {
    return new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return ''
  }
}

export function PaymentReminderBanner() {
  const { paymentState, daysUntilDue, nextPaymentDate, graceUntil } = useSubscription()
  const { isOwner } = useBusiness()
  const navigate = useNavigate()

  const graceDaysLeft = useMemo(() => {
    if (!graceUntil) return 0
    return Math.max(0, Math.ceil((new Date(graceUntil).getTime() - Date.now()) / 86400000))
  }, [graceUntil])

  if (!isOwner) return null
  if (paymentState !== 'due_soon' && paymentState !== 'grace') return null

  const isGrace = paymentState === 'grace'
  const days = Math.max(0, Number(daysUntilDue) || 0)

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b px-3 py-1.5 text-center text-xs text-foreground sm:text-sm ${
        isGrace ? 'border-destructive/30 bg-destructive/10' : 'border-warning/30 bg-warning/10'
      }`}
    >
      {isGrace ? (
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
      ) : (
        <Clock className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      )}
      <span>
        {isGrace
          ? `Pago vencido · regulariza para no perder Premium${
              graceDaysLeft > 0 ? ` (se bloqueará en ${graceDaysLeft} ${graceDaysLeft === 1 ? 'día' : 'días'})` : ''
            }`
          : `Tu plan Premium vence el ${formatDate(nextPaymentDate)}${
              days > 0 ? ` (en ${days} ${days === 1 ? 'día' : 'días'})` : ' (hoy)'
            }`}
      </span>
      <button
        type="button"
        onClick={() => navigate('/configuracion')}
        className={`shrink-0 rounded px-2 py-0.5 font-semibold underline-offset-2 hover:underline ${
          isGrace ? 'text-destructive' : 'text-warning'
        }`}
      >
        Renovar
      </button>
    </div>
  )
}
