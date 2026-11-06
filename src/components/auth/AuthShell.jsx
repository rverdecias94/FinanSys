import BrandLogo from '@/components/BrandLogo'
import { Link } from 'react-router-dom'
import { BarChart3, Coins, Package, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const HIGHLIGHTS = [
  {
    icon: Coins,
    title: 'Finanzas',
    description: 'Control de ingresos y gastos.',
  },
  {
    icon: Package,
    title: 'Almacén',
    description: 'Stock, movimientos y costos.',
  },
  {
    icon: BarChart3,
    title: 'Reportes',
    description: 'Análisis y resúmenes en tiempo real.',
  },
  {
    icon: Sparkles,
    title: 'Copiloto',
    description: 'Asistente inteligente para tu gestión.',
  },
]

/**
 * Login/Signup: portada de fondo + copy centrado a la izquierda;
 * panel de formulario a altura completa (sin radios), blur 8 + transparencia.
 */
export function AuthShell({
  title,
  subtitle = 'Accede a tu espacio de trabajo.',
  children,
  footer,
  className,
}) {
  return (
    <div
      className={cn(
        'gestia-auth-shell relative flex h-dvh max-h-dvh w-full overflow-hidden',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[#071a14] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/portada.webp)' }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/35 to-black/50" />
      </div>

      <div className="relative z-10 flex h-full min-h-0 w-full">
        {/* Copy izquierdo: centrado en el espacio libre (desktop) */}
        <aside className="gestia-auth-shell__hero hidden min-h-0 flex-1 items-center justify-center px-8 py-10 lg:flex xl:px-14">
          <div className="gestia-auth-shell__hero-inner w-full max-w-[34rem] text-white">
            {/* Fondo siempre oscuro: forzar logo claro */}
            <img
              src="/logo_light.png"
              alt="Gestia"
              className="h-11 w-auto object-contain drop-shadow-md xl:h-12"
            />
            <div className="mt-3 h-1 w-12 rounded-full bg-primary" aria-hidden="true" />

            <h2 className="mt-7 text-balance text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
              Gestiona tu negocio en un solo lugar.
            </h2>
            <p className="mt-4 max-w-[32rem] text-pretty text-base leading-relaxed text-white/80 xl:text-lg">
              Controla tus finanzas, inventario y reportes de forma simple, rápida y confiable.
            </p>

            <ul className="mt-9 space-y-4">
              {HIGHLIGHTS.map(({ icon: Icon, title: itemTitle, description }) => (
                <li key={itemTitle} className="flex items-start gap-3.5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary ring-1 ring-primary/30">
                    <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[15px] font-semibold leading-none">{itemTitle}</p>
                    <p className="mt-1.5 text-sm leading-snug text-white/70">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Panel formulario: top → bottom, sin radios, blur 8 */}
        <section
          className={cn(
            'gestia-auth-shell__panel gestia-auth-shell__glass',
            'flex h-full min-h-0 w-full shrink-0 flex-col overflow-y-auto',
            'rounded-none border-0 border-l border-white/10',
            'bg-white/40 backdrop-blur-[8px] backdrop-saturate-150',
            'dark:bg-black/40',
            'px-6 py-8 sm:px-9 sm:py-10',
            'lg:w-[min(32rem,42vw)] xl:w-[34rem]',
          )}
        >
          <div className="gestia-auth-shell__body mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center gap-6">
            <div className="gestia-auth-shell__brand flex flex-col items-center gap-3 text-center">
              <BrandLogo className="gestia-auth-shell__logo h-12 w-auto object-contain drop-shadow-sm sm:h-14" />
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
                  {title}
                </h1>
                {subtitle && (
                  <p className="gestia-auth-shell__subtitle text-sm text-muted-foreground sm:text-[15px]">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="w-full">{children}</div>
          </div>

          <p className="gestia-auth-shell__legal mx-auto mt-8 w-full max-w-[26rem] text-center text-xs text-muted-foreground">
            {footer || (
              <>
                <Link to="/terminos" className="transition-colors hover:text-foreground hover:underline">
                  Términos
                </Link>
                <span className="mx-2">·</span>
                <Link to="/privacidad" className="transition-colors hover:text-foreground hover:underline">
                  Privacidad
                </Link>
              </>
            )}
          </p>
        </section>
      </div>
    </div>
  )
}
