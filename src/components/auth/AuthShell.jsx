import BrandLogo from '@/components/BrandLogo'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/**
 * Login/Signup: portada + hero a la izquierda; formulario en tarjeta de cristal.
 * Caben en viewport (sin scroll habitual): padding vertical moderado + densidades
 * reducidas; overflow solo de respaldo (teclado móvil / pantallas muy bajas).
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
        className="pointer-events-none fixed inset-0 bg-[#071a14] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/portada.webp)' }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/25 to-black/45 lg:to-black/55" />
      </div>

      <div className="relative z-10 flex h-full min-h-0 w-full flex-col lg:flex-row">
        <aside className="gestia-auth-shell__hero hidden min-h-0 flex-1 items-center justify-center px-10 py-8 lg:flex xl:px-16">
          <div className="gestia-auth-shell__hero-inner w-full max-w-lg text-white">
            <h2 className="text-balance text-4xl font-semibold leading-[1.12] tracking-tight xl:text-[2.75rem]">
              Gestiona tu negocio en un solo lugar.
            </h2>
            <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-white/75 xl:text-[1.05rem]">
              Finanzas, inventario y reportes — simple y confiable.
            </p>
          </div>
        </aside>

        {/* Aire vertical sin forzar scroll: ~16–20px + safe-area */}
        <section
          className={cn(
            'gestia-auth-shell__stage flex min-h-0 w-full flex-1 items-center justify-center overflow-y-auto',
            'px-4 py-5 sm:px-6 sm:py-6',
            'lg:max-w-[34rem] lg:px-8 lg:py-8 xl:max-w-[36rem]',
          )}
          style={{
            paddingTop: 'max(1.25rem, env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="gestia-auth-shell__panel my-auto w-full max-w-[22.5rem]">
            <div
              className={cn(
                'gestia-auth-shell__glass relative overflow-hidden rounded-2xl p-5 sm:p-6',
                'border border-white/15 shadow-[0_24px_64px_-28px_rgba(0,0,0,0.55)]',
                'bg-white/55 backdrop-blur-xl backdrop-saturate-150',
                'dark:border-white/10 dark:bg-black/45',
              )}
            >
              <div className="gestia-auth-shell__body flex flex-col gap-4">
                <div className="gestia-auth-shell__brand flex flex-col items-center gap-1.5 text-center">
                  <BrandLogo className="gestia-auth-shell__logo h-9 w-auto object-contain drop-shadow-sm" />
                  <div className="space-y-0.5">
                    <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-[1.35rem]">
                      {title}
                    </h1>
                    {subtitle && (
                      <p className="gestia-auth-shell__subtitle text-xs text-muted-foreground sm:text-sm">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="w-full">{children}</div>

                <p className="gestia-auth-shell__legal border-t border-border/40 pt-3 text-center text-[11px] text-muted-foreground">
                  {footer || (
                    <>
                      <Link
                        to="/terminos"
                        className="font-medium transition-colors hover:text-foreground hover:underline"
                      >
                        Términos
                      </Link>
                      <span className="mx-2 opacity-50" aria-hidden="true">·</span>
                      <Link
                        to="/privacidad"
                        className="font-medium transition-colors hover:text-foreground hover:underline"
                      >
                        Privacidad
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
