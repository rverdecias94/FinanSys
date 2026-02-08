import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, EyeOff, Loader2, Check, X, ShieldCheck, ShieldAlert, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // UI States
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Validation States
  const [strength, setStrength] = useState({ score: 0, label: 'Débil', color: 'bg-gray-200' })
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

  // Check Password Match
  useEffect(() => {
    setPassMatch(password === confirmPassword && password !== '')
  }, [password, confirmPassword])

  // Form Validity
  const isFormValid =
    email &&
    password &&
    confirmPassword &&
    requirements.length &&
    requirements.alphanumeric &&
    (strength.label === 'Normal' || strength.label === 'Fuerte') &&
    passMatch

  const handleSignup = async (e) => {
    e.preventDefault()
    if (!isFormValid) return

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error

      const userId = data?.user?.id || null
      if (userId) {
        await supabase.from('profiles').insert({ id: userId, role: 'employee' })
      }

      navigate('/')
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 sm:p-10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">

        {/* Header Section */}
        <div className="flex flex-col items-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <img src="/logo.png" alt="Logo" className="h-10 w-10 object-contain" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Crear una cuenta
            </h1>
            <p className="text-sm text-gray-500">
              Completa tus datos para registrarte en el sistema
            </p>
          </div>
        </div>

        {/* Form Section */}
        <form className="space-y-6" onSubmit={handleSignup}>
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm flex items-center animate-in fade-in slide-in-from-top-1">
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-gray-700">
                Correo Electrónico
              </label>
              <Input
                type="email"
                placeholder="nombre@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white transition-all duration-200"
                required
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-gray-700">
                Contraseña
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Crear contraseña"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setIsTouched(true)
                  }}
                  className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white transition-all duration-200 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Strength Meter */}
              {password && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <div className="flex gap-1 h-1.5 mt-2">
                    <div className={cn("h-full rounded-full flex-1 transition-all duration-500",
                      strength.score >= 0 ? strength.color : "bg-gray-100")} />
                    <div className={cn("h-full rounded-full flex-1 transition-all duration-500",
                      strength.score >= 2 ? strength.color : "bg-gray-100")} />
                    <div className={cn("h-full rounded-full flex-1 transition-all duration-500",
                      strength.score >= 4 ? strength.color : "bg-gray-100")} />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className={cn("font-medium transition-colors duration-300",
                      strength.label === 'Débil' ? 'text-red-500' :
                        strength.label === 'Normal' ? 'text-yellow-600' : 'text-green-600'
                    )}>
                      Fortaleza: {strength.label}
                    </span>
                  </div>
                  <ul className="text-xs space-y-1 text-gray-500 mt-2">
                    <li className={cn("flex items-center gap-1.5 transition-colors", requirements.length ? "text-green-600" : "")}>
                      {requirements.length ? <Check className="h-3 w-3" /> : <div className="h-1 w-1 rounded-full bg-gray-400" />}
                      Mínimo 8 caracteres
                    </li>
                    <li className={cn("flex items-center gap-1.5 transition-colors", requirements.alphanumeric ? "text-green-600" : "")}>
                      {requirements.alphanumeric ? <Check className="h-3 w-3" /> : <div className="h-1 w-1 rounded-full bg-gray-400" />}
                      Incluir letras y números
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-gray-700">
                Repetir Contraseña
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repetir contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={cn(
                    "h-11 bg-gray-50/50 border-gray-200 focus:bg-white transition-all duration-200 pr-10",
                    confirmPassword && !passMatch ? "border-red-200 focus:border-red-500 focus:ring-red-500" :
                      confirmPassword && passMatch ? "border-green-200 focus:border-green-500 focus:ring-green-500" : ""
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
                    className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
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

          <div className="text-center text-sm text-gray-500">
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
