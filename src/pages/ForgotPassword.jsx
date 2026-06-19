import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Mail, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [emailSent, setEmailSent] = useState(false)

  const handlePasswordReset = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Obtener la URL base del frontend
      const baseUrl = window.location.origin
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${baseUrl}/reset-password`
      })
      
      if (error) throw error

      setEmailSent(true)
      toast.success('Correo enviado exitosamente', {
        description: 'Revisa tu bandeja de entrada para recuperar tu contraseña.'
      })
    } catch (error) {
      setError(error.message === 'Email not confirmed'
        ? 'El correo electrónico no está confirmado. Por favor, verifica tu cuenta primero.'
        : error.message === 'User not found'
        ? 'No existe una cuenta con este correo electrónico.'
        : 'Error al enviar el correo. Por favor, intenta nuevamente.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8 bg-card text-card-foreground p-8 sm:p-10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border">
          
          {/* Header Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mb-2">
              <Mail className="h-8 w-8 text-success" />
            </div>
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Correo enviado
              </h1>
              <p className="text-sm text-muted-foreground">
                Hemos enviado un enlace de recuperación a tu correo electrónico
              </p>
            </div>
          </div>

          {/* Mensaje informativo */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border text-muted-foreground text-sm">
            <p className="font-medium mb-2 text-foreground">¿No ves el correo?</p>
            <ul className="text-xs space-y-1">
              <li>• Revisa tu carpeta de spam o correo no deseado</li>
              <li>• Asegúrate de usar la dirección correcta</li>
              <li>• El enlace expirará en 1 hora por seguridad</li>
            </ul>
          </div>

          {/* Botones de acción */}
          <div className="space-y-3">
            <Button
              onClick={() => {
                setEmailSent(false)
                setEmail('')
              }}
              variant="outline"
              className="w-full h-11 text-base font-medium"
            >
              <Mail className="h-4 w-4 mr-2" />
              Reenviar correo
            </Button>

            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full h-11 px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 hover:underline transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al inicio de sesión
            </Link>
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
              Recuperar contraseña
            </h1>
            <p className="text-sm text-muted-foreground">
              Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña
            </p>
          </div>
        </div>

        {/* Form Section */}
        <form className="space-y-6" onSubmit={handlePasswordReset}>
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center animate-in fade-in slide-in-from-top-1">
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground">
                Correo Electrónico
              </label>
              <Input
                type="email"
                placeholder="nombre@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-background border-input focus:bg-background transition-all duration-200"
                required
              />
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
                <span>Enviando...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>Enviar enlace de recuperación</span>
              </div>
            )}
          </Button>

          <div className="text-center text-sm text-gray-500">
            ¿Recuerdas tu contraseña?{' '}
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