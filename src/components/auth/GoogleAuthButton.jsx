import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

/** Botón Google (UI lista). OAuth real pendiente de configurar en Supabase. */
export function GoogleAuthButton({ mode = 'login', className }) {
  const label = mode === 'signup' ? 'Registrarse con Google' : 'Continuar con Google'

  const handleClick = () => {
    toast.info('Google estará disponible pronto', {
      description: 'Estamos habilitando el acceso con Google. Mientras tanto usa correo y contraseña.',
      duration: 5000,
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      className={`h-12 w-full gap-3 border-border/80 bg-background/70 text-[15px] font-medium shadow-sm hover:bg-accent/60 ${className || ''}`}
    >
      <GoogleGlyph className="h-6 w-6 shrink-0" />
      <span>{label}</span>
    </Button>
  )
}

function GoogleGlyph({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12z"
      />
      <path
        fill="#34A853"
        d="M5.3 14.3 4.4 15l-2.7 2.1C3.5 20.5 7.4 23 12 23c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 1-3.6 1-2.8 0-5.1-1.9-6-4.4z"
      />
      <path
        fill="#4A90E2"
        d="M1.7 6.9C1 8.3.6 10 .6 11.8s.4 3.4 1.1 4.9l3.6-2.8c-.2-.6-.4-1.3-.4-2.1 0-.8.1-1.5.4-2.1L1.7 6.9z"
      />
      <path
        fill="#FBBC05"
        d="M12 4.8c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 1.8 14.7.8 12 .8 7.4.8 3.5 3.3 1.7 6.9l3.6 2.8c.9-2.5 3.2-4.4 6.7-4.4z"
      />
    </svg>
  )
}

export function AuthDivider({ label = 'o continúa con' }) {
  return (
    <div className="relative my-1">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-border/70" />
      </div>
      <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
        <span className="rounded-full bg-white/70 px-3 font-medium text-muted-foreground backdrop-blur-sm dark:bg-[hsl(0_0%_12%/0.9)]">
          {label}
        </span>
      </div>
    </div>
  )
}
