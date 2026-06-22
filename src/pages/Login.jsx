import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import { acceptPendingInvitations, getBusinessContext } from '@/services/team'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, EyeOff, Loader2, Wallet, Package, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email)
    }
    if (location.state?.notice) {
      toast.info(location.state.notice, { duration: 8000 })
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, navigate])

  const ensureOwnerSubscription = async (userId) => {
    const { data: existingSubscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (fetchError) {
      return
    }

    if (!existingSubscription) {
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
        return
      }
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

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
            : 'Has iniciado sesión correctamente.'
        }
      )

      navigate('/')
    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Credenciales incorrectas. Por favor verifica tu correo y contraseña.'
        : err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-full flex bg-background overflow-hidden">
      <div className="hidden lg:flex flex-1 flex-col justify-center bg-primary text-primary-foreground p-8 lg:p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent"></div>

        <div className="relative z-10 max-w-lg space-y-6 mx-auto">
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
            Bienvenido a tu gestor de caja e inventario
          </h2>
          <p className="text-base text-primary-foreground/80 leading-relaxed">
            Gestiona tus finanzas, controla tu inventario y analiza reportes detallados en una plataforma unificada diseñada para el crecimiento de tu negocio.
          </p>

          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Finanzas Claras</h3>
                <p className="text-primary-foreground/70 text-xs">Monitorea ingresos y gastos al instante.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Inventario Inteligente</h3>
                <p className="text-primary-foreground/70 text-xs">Control total sobre tus productos y almacenes.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Reportes Avanzados</h3>
                <p className="text-primary-foreground/70 text-xs">Exporta datos y toma decisiones informadas.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-md space-y-6">

          <div className="flex flex-col items-center space-y-2">
            <div className="h-24 w-auto flex items-center justify-center mb-2">
              <img src="/logo.png" alt="Logo" className="h-20 w-auto object-contain" />
            </div>
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Iniciar Sesión
              </h1>
              <p className="text-sm text-muted-foreground">
                Ingresa tus credenciales para acceder a tu cuenta
              </p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleLogin}>
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center animate-in fade-in slide-in-from-top-1">
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground">
                  Correo Electrónico
                </label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="nombre@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 bg-background border-input focus:bg-background transition-all duration-200"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground">
                    Contraseña
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-primary hover:text-primary/80 hover:underline transition-all duration-200"
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
                    className="h-10 bg-background border-input focus:bg-background transition-all duration-200 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPassword}
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
              className="w-full h-10 text-base font-medium shadow-md hover:shadow-lg transition-all duration-200 mt-2"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Iniciando sesión...</span>
                </div>
              ) : 'Iniciar Sesión'}
            </Button>

            <div className="text-center text-sm text-muted-foreground pt-2">
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
    </div>
  )
}
