import BrandLogo from '@/components/BrandLogo'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/**
 * Envoltorio visual de Login/Signup: atmósfera con acento primary + card.
 * Mobile-first, padding generoso, respeta claro/oscuro.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  className,
}) {
  return (
    <div
      className={cn(
        'relative flex min-h-dvh w-full items-center justify-center overflow-x-hidden',
        'bg-background px-5 py-10 sm:px-8',
        className,
      )}
    >
      {/* Atmósfera (no flat): glow de marca + velo */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 top-[-10%] h-[55%] w-[80%] rounded-full bg-primary/20 blur-3xl dark:bg-primary/25" />
        <div className="absolute -right-1/4 bottom-[-5%] h-[45%] w-[70%] rounded-full bg-primary/10 blur-3xl dark:bg-emerald-500/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_transparent_0%,_hsl(var(--background))_70%)]" />
      </div>

      <div className="relative z-10 w-full max-w-[400px]">
        <div className="mb-7 flex flex-col items-center space-y-3 text-center">
          <BrandLogo className="h-16 w-auto object-contain sm:h-[4.5rem]" />
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.65rem]">
              {title}
            </h1>
            {subtitle && (
              <p className="mx-auto max-w-[280px] text-sm leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div
          className={cn(
            'rounded-2xl border border-border/70 bg-card/90 p-5 shadow-lg shadow-black/5',
            'backdrop-blur-md sm:p-7',
            'dark:border-white/10 dark:bg-card/80 dark:shadow-black/40',
          )}
        >
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
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
      </div>
    </div>
  )
}
