/* eslint-disable react/prop-types */
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { LEGAL } from '@/config/legal'
import { cn } from '@/lib/utils'

// Estilos tipográficos aplicados a los elementos nativos del contenido legal.
// Mantiene el contenido (Terminos/Privacidad) limpio y consistente, y respeta
// el modo claro/oscuro usando tokens de color (foreground / muted-foreground).
const prose = cn(
  'text-[15px] leading-relaxed text-muted-foreground',
  '[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:scroll-mt-24',
  '[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground',
  '[&_p]:mb-4',
  '[&_ul]:mb-4 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1.5',
  '[&_ol]:mb-4 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1.5',
  '[&_li]:pl-1',
  '[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
  '[&_strong]:font-semibold [&_strong]:text-foreground'
)

// Recuadro destacado para resúmenes o avisos importantes.
export function Callout({ children, className }) {
  return (
    <div
      className={cn(
        'my-6 rounded-xl border border-border bg-muted/40 p-4 sm:p-5',
        '[&_p]:mb-2 [&_p:last-child]:mb-0',
        className
      )}
    >
      {children}
    </div>
  )
}

export default function LegalLayout({ title, children }) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Cabecera */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/login" className="flex items-center gap-2">
            <img src="/logo.png" alt={LEGAL.producto} className="h-7 w-7 object-contain" />
            <span className="font-semibold tracking-tight">{LEGAL.producto}</span>
          </Link>
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Última actualización: {LEGAL.ultimaActualizacion}
          </p>
        </div>

        <div className={prose}>{children}</div>
      </main>

      {/* Pie */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <span className="text-center sm:text-left">
            © {new Date().getFullYear()} {LEGAL.responsable} · {LEGAL.producto}
          </span>
          <nav className="flex items-center gap-4">
            <Link to="/terminos" className="transition-colors hover:text-foreground">
              Términos
            </Link>
            <Link to="/privacidad" className="transition-colors hover:text-foreground">
              Privacidad
            </Link>
            <Link to="/login" className="transition-colors hover:text-foreground">
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
