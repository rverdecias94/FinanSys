import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import { acceptPendingInvitations, getBusinessContext } from '@/services/team'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, EyeOff, Loader2, Mail, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { emailSchema, validateForm } from '@/utils/formSchemas'
import { getSupabaseErrorMessage, isEmailNotConfirmedError } from '@/services/notifications'
import { AuthShell } from '@/components/auth/AuthShell'
import { AuthDivider, GoogleAuthButton } from '@/components/auth/GoogleAuthButton'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [emailError, setEmailError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email)
    }
    if (location.state?.notice) {
      toast.info(location.state.notice, { duration: 8000 })
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, navigate])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const ensureOwnerSubscription = async (userId) => {
    const { data: existingSubscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (fetchError || existingSubscription) return

    await supabase.from('subscriptions').insert({
      user_id: userId,
      plan_id: 'free',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    const emailCheck = validateForm(emailSchema, { email })
    if (!emailCheck.success) {
      setEmailError(emailCheck.errors.email)
      return
    }
    setEmailError('')
    setLoading(true)
    setError(null)
    setNeedsConfirmation(false)

    try {
      const { data, error: signError } = await supabase.auth.signInWithPassword({ email, password })
      if (signError) throw signError

      await acceptPendingInvitations(email)

      const context = await getBusinessContext(data.user.id)
      const isTeamMember = context && !context.isOwner

      if (!isTeamMember) {
        await ensureOwnerSubscription(data.user.id)
      }

      toast.success(
        isTeamMember ? 'Bienvenido al equipo' : 'Bienvenido de nuevo',
        {
          description: isTeamMember
            ? 'Has accedido a la cuenta del negocio con tu rol asignado.'
            : 'Has iniciado sesión correctamente.',
        },
      )

      navigate('/')
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
      setNeedsConfirmation(isEmailNotConfirmedError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    if (!email || resending || resendCooldown > 0) return
    setResending(true)
    try {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email })
      if (resendError) throw resendError
      toast.success('Correo de confirmación reenviado', {
        description: 'Te enviamos otra vez el enlace. Revisa tu bandeja de entrada y la carpeta de spam.',
      })
      setResendCooldown(60)
    } catch (err) {
      toast.error(getSupabaseErrorMessage(err))
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthShell
      title="Iniciar sesión"
      subtitle="Entra con tu correo o, si prefieres, con Google."
    >
      <div className="space-y-5">
        <form className="space-y-4" onSubmit={handleLogin}>
          {error && (
            <div className="flex items-center rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
              <span className="font-medium">{error}</span>
            </div>
          )}

          {needsConfirmation && (
            <div className="space-y-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 animate-in fade-in slide-in-from-top-1">
              <p className="text-xs leading-relaxed text-muted-foreground">
                ¿No te llegó el correo? Revisa spam o pide que te enviemos otra vez el enlace.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={handleResendConfirmation}
                disabled={resending || resendCooldown > 0}
                className="h-10 w-full text-sm font-medium"
              >
                {resending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </span>
                ) : resendCooldown > 0 ? (
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Podrás reenviar en {resendCooldown} s
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Reenviar correo de confirmación
                  </span>
                )}
              </Button>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-sm font-medium text-foreground">
                Correo electrónico
              </label>
              <Input
                id="login-email"
                type="email"
                placeholder="nombre@ejemplo.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailError) setEmailError('')
                  if (needsConfirmation) setNeedsConfirmation(false)
                }}
                className="h-11 border-input bg-background/80 transition-all"
                aria-invalid={!!emailError}
                required
              />
              {emailError && <p className="text-xs text-destructive">{emailError}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="login-password" className="text-sm font-medium text-foreground">
                  Contraseña
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 border-input bg-background/80 pr-10 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="mt-1 h-11 w-full text-base font-semibold shadow-md shadow-primary/20"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Iniciando sesión...
              </span>
            ) : (
              'Iniciar sesión'
            )}
          </Button>
        </form>

        <AuthDivider label="o continúa con" />
        <GoogleAuthButton mode="login" />

        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes una cuenta?{' '}
          <Link
            to="/signup"
            className="font-semibold text-primary transition-colors hover:text-primary/80 hover:underline"
          >
            Regístrate
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
