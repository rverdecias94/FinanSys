import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Eye, EyeOff, Loader2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSupabaseErrorMessage } from '@/services/notifications'
import { AuthShell } from '@/components/auth/AuthShell'
import { AuthDivider, GoogleAuthButton } from '@/components/auth/GoogleAuthButton'

export default function Signup() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [strength, setStrength] = useState({ score: 0, label: 'Débil', color: 'bg-gray-200' })
  const [passMatch, setPassMatch] = useState(false)

  const requirements = {
    length: password.length >= 8,
    alphanumeric: /[a-zA-Z]/.test(password) && /\d/.test(password)
  }

  useEffect(() => {
    if (!password) {
      setStrength({ score: 0, label: 'Débil', color: 'bg-gray-200' })
      return
    }

    let score = 0
    if (password.length >= 8) score += 1
    if (/[A-Za-z]/.test(password) && /[0-9]/.test(password)) score += 1
    if (/[^A-Za-z0-9]/.test(password)) score += 1
    if (password.length >= 12) score += 1

    let label = 'Débil'
    let color = 'bg-red-500'

    if (score >= 4) {
      label = 'Fuerte'
      color = 'bg-green-500'
    } else if (score >= 2) {
      label = 'Normal'
      color = 'bg-yellow-500'
    }

    setStrength({ score, label, color })
  }, [password])

  useEffect(() => {
    setPassMatch(password === confirmPassword && password !== '')
  }, [password, confirmPassword])

  const isFormValid =
    email &&
    password &&
    confirmPassword &&
    requirements.length &&
    requirements.alphanumeric &&
    (strength.label === 'Normal' || strength.label === 'Fuerte') &&
    passMatch &&
    acceptedTerms

  const handleSignup = async (e) => {
    e.preventDefault()
    if (!isFormValid) return

    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error

      await supabase.auth.signOut()

      navigate('/login', {
        replace: true,
        state: {
          email,
          notice:
            'Cuenta creada correctamente. Revisa tu correo y haz clic en el enlace de confirmación. Después, inicia sesión para acceder al sistema.'
        }
      })
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Crear cuenta"
      subtitle="Regístrate con Google o con tu correo para empezar en Gestia."
    >
      <div className="space-y-5">
        <form className="space-y-5" onSubmit={handleSignup}>
          {error && (
            <div className="flex items-center rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="signup-email" className="text-sm font-medium leading-none text-foreground">
                Correo Electrónico
              </label>
              <Input
                id="signup-email"
                type="email"
                placeholder="nombre@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-background transition-all duration-200"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="signup-password" className="text-sm font-medium leading-none text-foreground">
                Contraseña
              </label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Crear contraseña"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                  }}
                  className="h-11 bg-background transition-all duration-200 pr-10"
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

              {password && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <div className="flex gap-1 h-1.5 mt-2">
                    <div className={cn('h-full rounded-full flex-1 transition-all duration-500',
                      strength.score >= 0 ? strength.color : 'bg-gray-100')} />
                    <div className={cn('h-full rounded-full flex-1 transition-all duration-500',
                      strength.score >= 2 ? strength.color : 'bg-gray-100')} />
                    <div className={cn('h-full rounded-full flex-1 transition-all duration-500',
                      strength.score >= 4 ? strength.color : 'bg-gray-100')} />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className={cn('font-medium transition-colors duration-300',
                      strength.label === 'Débil' ? 'text-red-500' :
                        strength.label === 'Normal' ? 'text-yellow-600' : 'text-green-600'
                    )}>
                      Fortaleza: {strength.label}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li className={cn('flex items-center gap-1.5 transition-colors', requirements.length ? 'text-green-600' : '')}>
                      {requirements.length ? <Check className="h-3 w-3" /> : <div className="h-1 w-1 rounded-full bg-muted-foreground" />}
                      Mínimo 8 caracteres
                    </li>
                    <li className={cn('flex items-center gap-1.5 transition-colors', requirements.alphanumeric ? 'text-green-600' : '')}>
                      {requirements.alphanumeric ? <Check className="h-3 w-3" /> : <div className="h-1 w-1 rounded-full bg-muted-foreground" />}
                      Incluir letras y números
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="signup-confirm-password" className="text-sm font-medium leading-none text-foreground">
                Repetir Contraseña
              </label>
              <div className="relative">
                <Input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repetir contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={cn(
                    'h-11 bg-background transition-all duration-200 pr-10',
                    confirmPassword && !passMatch ? 'border-red-200 focus:border-red-500 focus:ring-red-500' :
                      confirmPassword && passMatch ? 'border-green-200 focus:border-green-500 focus:ring-green-500' : ''
                  )}
                  required
                  disabled={!password}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {confirmPassword && (
                    <div className="animate-in zoom-in duration-200">
                      {passMatch ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={showConfirmPassword ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
                    aria-pressed={showConfirmPassword}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {confirmPassword && !passMatch && (
                <p className="text-xs text-red-500 animate-in fade-in slide-in-from-top-1">
                  Las contraseñas no coinciden
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Checkbox
              id="accept-terms"
              checked={acceptedTerms}
              onCheckedChange={(value) => setAcceptedTerms(value === true)}
              className="mt-0.5"
              aria-label="Aceptar Términos de Servicio y Política de Privacidad"
            />
            <label
              htmlFor="accept-terms"
              className="text-sm leading-snug text-muted-foreground cursor-pointer select-none"
            >
              He leído y acepto los{' '}
              <Link
                to="/terminos"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Términos de Servicio
              </Link>{' '}
              y la{' '}
              <Link
                to="/privacidad"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Política de Privacidad
              </Link>
              .
            </label>
          </div>

          <Button
            type="submit"
            disabled={loading || !isFormValid}
            className="h-11 w-full text-base font-semibold shadow-md shadow-primary/20"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Registrando...
              </span>
            ) : (
              'Crear cuenta'
            )}
          </Button>
        </form>

        <AuthDivider label="o regístrate con" />
        <GoogleAuthButton mode="signup" />

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes una cuenta?{' '}
          <Link
            to="/login"
            className="font-semibold text-primary transition-colors hover:text-primary/80 hover:underline"
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
