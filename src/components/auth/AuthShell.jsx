import BrandLogo from '@/components/BrandLogo'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/**
 * Login/Signup minimal: portada + hero corto a la izquierda;
 * formulario centrado en tarjeta de cristal (no muro full-height).
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
        'gestia-auth-shell relative flex h-dvh max-h-dvh w-full overflow-x-hidden overflow-y-auto',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[#071a14] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/portada.webp)' }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/25 to-black/45 lg:to-black/55" />
      </div>

      <div className="relative z-10 flex min-h-full w-full flex-col lg:flex-row">
        {/* Hero: titular + línea (desktop). Logo solo en la tarjeta → sin doble marca. */}
        <aside className="gestia-auth-shell__hero hidden flex-1 items-center justify-center px-10 py-12 lg:flex xl:px-16">
          <div className="gestia-auth-shell__hero-inner w-full max-w-lg text-white">
            <h2 className="text-balance text-4xl font-semibold leading-[1.12] tracking-tight xl:text-[2.75rem]">
              Gestiona tu negocio en un solo lugar.
            </h2>
            <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-white/75 xl:text-[1.05rem]">
              Finanzas, inventario y reportes — simple y confiable.
            </p>
          </div>
        </aside>

        {/* Formulario: tarjeta centrada, aire, cristal ligero */}
        <section className="gestia-auth-shell__stage flex w-full flex-1 items-center justify-center px-5 py-8 sm:px-8 lg:max-w-[34rem] lg:px-10 xl:max-w-[36rem]">
          <div className="gestia-auth-shell__panel w-full max-w-[24rem]">
            <div
              className={cn(
                'gestia-auth-shell__glass relative overflow-hidden rounded-2xl p-7 sm:p-8',
                'border border-white/15 shadow-[0_24px_64px_-28px_rgba(0,0,0,0.55)]',
                'bg-white/55 backdrop-blur-xl backdrop-saturate-150',
                'dark:border-white/10 dark:bg-black/45',
              )}
            >
              <div className="gestia-auth-shell__body flex flex-col gap-6">
                <div className="gestia-auth-shell__brand flex flex-col items-center gap-2.5 text-center">
                  <BrandLogo className="gestia-auth-shell__logo h-11 w-auto object-contain drop-shadow-sm" />
                  <div className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                      {title}
                    </h1>
                    {subtitle && (
                      <p className="gestia-auth-shell__subtitle text-sm text-muted-foreground">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="w-full">{children}</div>
              </div>
            </div>

            <p className="gestia-auth-shell__legal mt-5 text-center text-[11px] text-white/55 dark:text-white/45">
              {footer || (
                <>
                  <Link
                    to="/terminos"
                    className="transition-colors hover:text-white/85 hover:underline"
                  >
                    Términos
                  </Link>
                  <span className="mx-2 opacity-50">·</span>
                  <Link
                    to="/privacidad"
                    className="transition-colors hover:text-white/85 hover:underline"
                  >
                    Privacidad
                  </Link>
                </>
              )}
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
