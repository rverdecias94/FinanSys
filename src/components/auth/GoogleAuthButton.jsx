import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { supabase } from '@/config/supabase'
import { getSupabaseErrorMessage } from '@/services/notifications'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/**
 * Login / registro con Google vía Supabase Auth (OAuth).
 * Requiere el proveedor Google habilitado en el Dashboard de Supabase
 * (Client ID + Secret de Google Cloud) y las Redirect URLs del sitio en Auth → URL Configuration.
 */
export function GoogleAuthButton({ mode = 'login', className }) {
  const online = useOnlineStatus()
  const [loading, setLoading] = useState(false)
  const label = mode === 'signup' ? 'Registrarse con Google' : 'Continuar con Google'

  const handleClick = async () => {
    if (!online || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      toast.error('Sin conexión', {
        description: 'Para entrar con Google necesitas internet.',
      })
      return
    }

    setLoading(true)
    try {
      const redirectTo = `${window.location.origin}/login`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            // Fuerza selector de cuenta (útil si hay varias en el navegador).
            prompt: 'select_account',
          },
        },
      })
      if (error) throw error
      // Si no hay error, el navegador redirige a Google; no hace falta setLoading(false).
    } catch (err) {
      setLoading(false)
      toast.error('No se pudo abrir Google', {
        description: getSupabaseErrorMessage(err) || 'Revisa que el proveedor Google esté activo en Supabase.',
      })
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={loading}
      loading={loading}
      className={`h-11 w-full gap-2.5 border-border/50 bg-background/40 text-sm font-medium text-muted-foreground shadow-none hover:bg-accent/50 hover:text-foreground ${className || ''}`}
    >
      {!loading && <GoogleGlyph className="h-5 w-5 shrink-0" />}
      <span>{loading ? 'Conectando con Google…' : label}</span>
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
    <div className="relative my-0.5">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-border/40" />
      </div>
      <div className="relative flex justify-center text-[10px] uppercase tracking-[0.14em]">
        <span className="bg-white/80 px-2.5 font-medium text-muted-foreground/80 dark:bg-black/50">
          {label}
        </span>
      </div>
    </div>
  )
}
