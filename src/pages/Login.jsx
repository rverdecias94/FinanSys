import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const validateAndCreateSubscription = async (userId) => {
    try {
      // Verificar si existe suscripción
      const { data: existingSubscription, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error al verificar suscripción:', fetchError)
        throw fetchError
      }

      if (!existingSubscription) {
        // Crear suscripción free si no existe
        const { error: createError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            plan_id: 'free',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (createError) {
          console.error('Error al crear suscripción free:', createError)
          throw createError
        }

        toast.success('Cuenta configurada exitosamente', {
          description: 'Se ha asignado un plan gratuito a tu cuenta.'
        })
      }

      return existingSubscription?.plan_id || 'free'
    } catch (error) {
      console.error('Error en validación de suscripción:', error)
      // No lanzar error para permitir login, pero mostrar advertencia
      toast.warning('Error al verificar suscripción', {
        description: 'Tu cuenta se ha creado con plan gratuito por defecto.'
      })
      return 'free'
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      // Validar y crear suscripción si no existe
      const planId = await validateAndCreateSubscription(data.user.id)

      // Mostrar mensaje según el tipo de plan
      if (planId === 'premium') {
        toast.success('Bienvenido a tu cuenta Premium', {
          description: 'Tienes acceso completo a todas las funcionalidades.'
        })
      } else {
        toast.success('Bienvenido a tu cuenta Gratuita', {
          description: 'Disfruta de las funcionalidades básicas. Actualiza a Premium cuando quieras.'
        })
      }

      navigate('/')
    } catch (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Credenciales incorrectas. Por favor verifica tu correo y contraseña.'
        : error.message)
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
              Bienvenido de nuevo
            </h1>
            <p className="text-sm text-gray-500">
              Ingresa tus credenciales para acceder a tu cuenta
            </p>
          </div>
        </div>

        {/* Form Section */}
        <form className="space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm flex items-center animate-in fade-in slide-in-from-top-1">
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-700">
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-700">
                  Contraseña
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary hover:text-primary/80 hover:underline transition-all duration-200"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white transition-all duration-200 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 text-base font-medium shadow-md hover:shadow-lg transition-all duration-200"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Iniciando sesión...</span>
              </div>
            ) : 'Iniciar Sesión'}
          </Button>

          <div className="text-center text-sm text-gray-500">
            ¿No tienes una cuenta?{' '}
            <Link
              to="/signup"
              className="font-medium text-primary hover:text-primary/80 hover:underline transition-all duration-200"
            >
              Regístrate aquí
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
