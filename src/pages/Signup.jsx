import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Eye, EyeOff, Loader2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

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
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl border bg-card p-8 shadow-sm sm:p-10">

        <div className="flex flex-col items-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <img src="/logo.png" alt="Logo" className="h-10 w-10 object-contain" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Crear una cuenta
            </h1>
            <p className="text-sm text-muted-foreground">
              Completa tus datos para registrarte en el sistema
            </p>
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleSignup}>
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm flex items-center animate-in fade-in slide-in-from-top-1">
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
            className="w-full h-11 text-base font-medium shadow-md hover:shadow-lg transition-all duration-200"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Registrando...</span>
              </div>
            ) : 'Crear Cuenta'}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            ¿Ya tienes una cuenta?{' '}
            <Link
              to="/login"
              className="font-medium text-primary hover:text-primary/80 hover:underline transition-all duration-200"
            >
              Inicia sesión aquí
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
