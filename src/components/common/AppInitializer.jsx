/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { useCurrency } from '@/context/CurrencyContext'
const STATUS_MESSAGES = [
  'Preparando tu negocio…',
  'Cargando tus datos…',
  'Casi listo…',
]

const EXIT_MS = 320
const MESSAGE_MS = 1600

/**
 * Splash de marca (Opción A): logo + barra indeterminada + textos rotativos.
 * Solo CSS (apto para conexión lenta en Cuba). Respeta claro/oscuro y reduced-motion.
 */
function BrandedLoader({ exiting = false }) {
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    if (exiting) return undefined
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % STATUS_MESSAGES.length)
    }, MESSAGE_MS)
    return () => clearInterval(id)
  }, [exiting])

  return (
    <div
      className={`gestia-splash fixed inset-0 z-[60] flex flex-col items-center justify-center px-6 ${
        exiting ? 'gestia-splash--exit' : ''
      }`}
      role="status"
      aria-live="polite"
      aria-busy={!exiting}
    >
      <div className="gestia-splash__glow" aria-hidden="true" />

      <div className="gestia-splash__stage flex w-full max-w-sm flex-col items-center gap-8">
        {/* Secuencia: G → wordmark (evita duplicar la G del logo horizontal). */}
        <div className="gestia-splash__mark relative flex flex-col items-center">
          <div className="gestia-splash__ico-wrap relative mb-1">
            <img
              src="/logo_ico.png"
              alt=""
              className="gestia-splash__ico h-16 w-16 object-contain sm:h-[4.5rem] sm:w-[4.5rem]"
              draggable={false}
            />
          </div>
          <div className="gestia-splash__wordmark-wrap overflow-hidden">
            {/* Solo tipografía de marca: el PNG horizontal volvería a mostrar la G. */}
            <span className="gestia-splash__wordmark block text-[1.75rem] font-bold tracking-tight text-foreground sm:text-3xl">
              Gestia
            </span>
          </div>
        </div>

        <div className="gestia-splash__status flex w-full max-w-[220px] flex-col items-center gap-3">
          <div className="gestia-splash__track h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className="gestia-splash__bar h-full w-2/5 rounded-full bg-primary" />
          </div>
          <p
            key={msgIndex}
            className="gestia-splash__msg min-h-[1.25rem] text-center text-sm text-muted-foreground"
          >
            {STATUS_MESSAGES[msgIndex]}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Bloquea el render de la app con BrandedLoader mientras:
 *  - se comprueba la sesión, o
 *  - hay sesión y aún cargan los contextos (negocio/suscripción/monedas).
 * Si no hay sesión (login/signup), renderiza los children normalmente.
 */
export function AppInitializer({ children }) {
  const { session, loading: sessionLoading } = useSession()
  const { loading: businessLoading } = useBusiness()
  const { loading: subscriptionLoading } = useSubscription()
  const { loading: currencyLoading } = useCurrency()

  const initializing = sessionLoading
    || (!!session && (businessLoading || subscriptionLoading || currencyLoading))

  const [visible, setVisible] = useState(initializing)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (initializing) {
      setVisible(true)
      setExiting(false)
      return undefined
    }
    if (!visible) return undefined
    setExiting(true)
    const t = setTimeout(() => {
      setVisible(false)
      setExiting(false)
    }, EXIT_MS)
    return () => clearTimeout(t)
  }, [initializing, visible])

  if (visible) return <BrandedLoader exiting={exiting} />
  return children
}
