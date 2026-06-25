import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ShieldCheck, Loader2, ExternalLink } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { supabase } from '@/config/supabase'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  hasAcceptedCurrentLegal,
  recordLegalAcceptance,
  CURRENT_LEGAL_VERSION,
} from '@/services/legal'

// Candado de consentimiento legal. Tras iniciar sesión, si el usuario NO ha
// aceptado la VERSIÓN vigente de los Términos y la Privacidad, muestra un modal
// bloqueante (no descartable) que obliga a aceptar. La aceptación se registra a
// nivel de cuenta en Supabase (tabla append-only `legal_acceptances`), por lo que
// es independiente del dispositivo y queda como evidencia.
//
// Falla ABIERTO: mientras carga o si la consulta falla, no bloquea (igual que
// AccountGate), para no dejar fuera al usuario por un fallo transitorio.
export function LegalConsentGate() {
  const { session } = useSession()
  const userId = session?.user?.id
  const queryClient = useQueryClient()

  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const { data: hasAccepted, isLoading, isError } = useQuery({
    queryKey: ['legalAcceptance', userId, CURRENT_LEGAL_VERSION],
    queryFn: () => hasAcceptedCurrentLegal(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  if (!userId || isLoading || isError || hasAccepted) return null

  const handleAccept = async () => {
    if (!accepted || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await recordLegalAcceptance('login_gate')
      await queryClient.invalidateQueries({ queryKey: ['legalAcceptance', userId] })
      // Al invalidarse la consulta, hasAccepted pasa a true y el gate se cierra.
    } catch {
      setError('No se pudo registrar tu aceptación. Revisa tu conexión e inténtalo de nuevo.')
      setSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-consent-title"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 sm:p-7">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h2 id="legal-consent-title" className="text-lg font-semibold text-foreground">
            Términos y Privacidad
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Para continuar usando la plataforma necesitas leer y aceptar nuestros documentos
            legales. Tu aceptación queda registrada en tu cuenta.
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            to="/terminos"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Términos de Servicio
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Política de Privacidad
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        <label
          htmlFor="legal-consent-check"
          className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3 select-none"
        >
          <Checkbox
            id="legal-consent-check"
            checked={accepted}
            onCheckedChange={(value) => setAccepted(value === true)}
            className="mt-0.5"
            disabled={submitting}
          />
          <span className="text-sm leading-snug text-foreground">
            He leído y acepto los Términos de Servicio y la Política de Privacidad.
          </span>
        </label>

        {error && (
          <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          type="button"
          onClick={handleAccept}
          disabled={!accepted || submitting}
          className="mt-5 h-11 w-full text-base font-medium"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Registrando...
            </span>
          ) : (
            'Aceptar y continuar'
          )}
        </Button>

        <button
          type="button"
          onClick={handleLogout}
          disabled={submitting}
          className="mt-3 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          Prefiero no aceptar — Cerrar sesión
        </button>
      </div>
    </div>
  )
}
