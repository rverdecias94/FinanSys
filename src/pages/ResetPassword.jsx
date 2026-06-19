import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, EyeOff, Loader2, Check, X, ShieldCheck, ShieldAlert, Shield, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export default function ResetPassword() {
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tokenValid, setTokenValid] = useState(true)

  // UI States
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Validation States
  const [strength, setStrength] = useState({ score: 0, label: 'Débil', color: 'bg-muted' })
  const [passMatch, setPassMatch] = useState(false)
  const [isTouched, setIsTouched] = useState(false)

  // Password Requirements
  const requirements = {
    length: password.length >= 8,
    alphanumeric: /[a-zA-Z]/.test(password) && /\d/.test(password)
  }

  // Calculate Password Strength
  useEffect(() => {
    if (!password) {
      setStrength({ score: 0, label: 'Débil', color: 'bg-muted' })
      return
    }

    let score = 0
    if (password.length >= 8) score += 1
    if (/[A-Za-z]/.test(password) && /[0-9]/.test(password)) score += 1
    if (/[^A-Za-z0-9]/.test(password)) score += 1
    if (password.length >= 12) score += 1

    let label = 'Débil'
    let color = 'bg-destructive'

    if (score >= 4) {
      label = 'Fuerte'
      color = 'bg-success'
    } else if (score >= 2) {
      label = 'Normal'
      color = 'bg-warning'
    }

    setStrength({ score, label, color })
  }, [password])

  // Check Password Match
  useEffect(() => {
    setPassMatch(password === confirmPassword && password !== '')
  }, [password, confirmPassword])

  // Verificar y escuchar evento de recuperación (hash: #type=recovery&access_token=...)
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const type = hashParams.get('type')
    const accessToken = hashParams.get('access_token')

    if (type === 'recovery' && accessToken) {
      setTokenValid(true)
    } else {
      setTokenValid(false)
      setError('Enlace de recuperación inválido o expirado.')
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setTokenValid(true)
        setError(null)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  // Form Validity
  const isFormValid =
    password &&
    confirmPassword &&
    requirements.length &&
    requirements.alphanumeric &&
    (strength.label === 'Normal' || strength.label === 'Fuerte') &&
    passMatch

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!isFormValid) return

    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      toast.success('Contraseña actualizada exitosamente', {
        description: 'Tu contraseña ha sido restablecida. Ahora puedes iniciar sesión con tu nueva contraseña.'
      })

      // Redirigir al login después de un breve delay
      setTimeout(() => {
        navigate('/login')
      }, 2000)

    } catch (error) {
      setError(error.message === 'Token has expired or is invalid'
        ? 'El enlace de recuperación ha expirado. Por favor, solicita uno nuevo.'
        : error.message === 'New password should be different from the old password'
          ? 'La nueva contraseña debe ser diferente a la contraseña anterior.'
          : 'Error al restablecer la contraseña. Por favor, intenta nuevamente.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8 bg-card text-card-foreground p-8 sm:p-10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border">

          {/* Header Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Enlace inválido
              </h1>
              <p className="text-sm text-muted-foreground">
                {error || 'El enlace de recuperación no es válido o ha expirado.'}
              </p>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="space-y-3">
            <Button
              onClick={() => navigate('/forgot-password')}
              className="w-full h-11 text-base font-medium"
            >
              <Mail className="h-4 w-4 mr-2" />
              Solicitar nuevo enlace
            </Button>

            <Button
              onClick={() => navigate('/login')}
              variant="outline"
              className="w-full h-11 text-base font-medium"
            >
              Volver al inicio de sesión
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-card text-card-foreground p-8 sm:p-10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border">

        {/* Header Section */}
        <div className="flex flex-col items-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <img src="/logo.png" alt="Logo" className="h-10 w-10 object-contain" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Nueva contraseña
            </h1>
            <p className="text-sm text-muted-foreground">
              Ingresa tu nueva contraseña segura
            </p>
          </div>
        </div>

        {/* Form Section */}
        <form className="space-y-6" onSubmit={handleResetPassword}>
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center animate-in fade-in slide-in-from-top-1">
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Nueva Contraseña */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground">
                Nueva Contraseña
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsTouched(true)}
                  className="h-11 bg-background border-input focus:bg-background transition-all duration-200 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {isTouched && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Fortaleza:</span>
                    <span className={cn(
                      'font-medium',
                      strength.label === 'Fuerte' ? 'text-success' :
                        strength.label === 'Normal' ? 'text-warning' : 'text-destructive'
                    )}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={cn('h-2 rounded-full transition-all duration-300', strength.color)}
                      style={{ width: `${(strength.score / 4) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Requirements */}
              {isTouched && (
                <div className="space-y-1 text-xs">
                  <div className={cn('flex items-center gap-2', requirements.length ? 'text-success' : 'text-muted-foreground')}>
                    {requirements.length ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    <span>Mínimo 8 caracteres</span>
                  </div>
                  <div className={cn('flex items-center gap-2', requirements.alphanumeric ? 'text-success' : 'text-muted-foreground')}>
                    {requirements.alphanumeric ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    <span>Letras y números</span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirmar Contraseña */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground">
                Confirmar Nueva Contraseña
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 bg-background border-input focus:bg-background transition-all duration-200 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Password Match Indicator */}
              {confirmPassword && (
                <div className={cn('flex items-center gap-2 text-xs', passMatch ? 'text-success' : 'text-destructive')}>
                  {passMatch ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                  <span>
                    {passMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || !isFormValid}
            className="w-full h-11 text-base font-medium shadow-md hover:shadow-lg transition-all duration-200"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Actualizando...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span>Restablecer contraseña</span>
              </div>
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
