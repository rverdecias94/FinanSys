import { toast } from "sonner"
import { CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react"

/**
 * Servicio centralizado de notificaciones
 */
export const notify = {
  success: (message, options = {}) => {
    toast.success(message, {
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      className: "border-green-500/20 bg-card",
      ...options,
    })
  },
  error: (message, options = {}) => {
    toast.error(message, {
      icon: <XCircle className="h-4 w-4 text-red-500" />,
      className: "border-red-500/20 bg-card",
      duration: 5000,
      ...options,
    })
  },
  warning: (message, options = {}) => {
    toast.warning(message, {
      icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
      className: "border-amber-500/20 bg-card",
      ...options,
    })
  },
  info: (message, options = {}) => {
    toast.info(message, {
      icon: <Info className="h-4 w-4 text-blue-500" />,
      className: "border-blue-500/20 bg-card",
      ...options,
    })
  },
  promise: (promise, messages = {}) => {
    return toast.promise(promise, {
      loading: messages.loading || 'Procesando...',
      success: messages.success || 'Operación exitosa',
      error: messages.error || 'Ocurrió un error',
    })
  }
}

// Errores de autenticación (Supabase Auth / GoTrue). En supabase-js v2 llegan con
// `code` en snake_case (versiones recientes) y/o un `message` en inglés. Traducimos
// por ambas vías para que el usuario nunca vea texto crudo en inglés (hallazgo UX:
// el alta de cuenta mostraba "Invalid login credentials"/"Email not confirmed").
const AUTH_ERROR_MESSAGES = {
  invalid_credentials: 'Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.',
  email_not_confirmed: 'Tu correo aún no está confirmado. Revisa tu bandeja de entrada (y la carpeta de spam) y abre el enlace que te enviamos.',
  user_already_exists: 'Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.',
  email_exists: 'Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.',
  weak_password: 'La contraseña es demasiado débil. Usa al menos 8 caracteres, con letras y números.',
  same_password: 'La nueva contraseña debe ser diferente a la anterior.',
  over_email_send_rate_limit: 'Enviamos demasiados correos en poco tiempo. Espera unos minutos e inténtalo de nuevo.',
  over_request_rate_limit: 'Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.',
  validation_failed: 'Revisa los datos ingresados: hay un campo con formato inválido.',
  email_address_invalid: 'El correo electrónico no tiene un formato válido.',
  user_not_found: 'No existe una cuenta con este correo electrónico.',
  signup_disabled: 'El registro de nuevas cuentas está deshabilitado temporalmente.',
}

// Respaldo por el texto en inglés, para versiones/errores que no traen `code`.
const AUTH_MESSAGE_FALLBACKS = [
  [/invalid login credentials/i, AUTH_ERROR_MESSAGES.invalid_credentials],
  [/email not confirmed/i, AUTH_ERROR_MESSAGES.email_not_confirmed],
  [/already registered|already been registered|user already exists/i, AUTH_ERROR_MESSAGES.user_already_exists],
  [/new password should be different/i, AUTH_ERROR_MESSAGES.same_password],
  [/password should be at least|weak password/i, AUTH_ERROR_MESSAGES.weak_password],
  [/email rate limit exceeded|over_email_send_rate_limit/i, AUTH_ERROR_MESSAGES.over_email_send_rate_limit],
  [/for security purposes|rate limit|too many requests/i, AUTH_ERROR_MESSAGES.over_request_rate_limit],
  [/unable to validate email address|invalid format/i, AUTH_ERROR_MESSAGES.email_address_invalid],
  [/user not found/i, AUTH_ERROR_MESSAGES.user_not_found],
]

// Devuelve el mensaje traducido de un error de autenticación, o null si no aplica.
const getAuthErrorMessage = (error) => {
  if (!error) return null
  if (error.code && Object.prototype.hasOwnProperty.call(AUTH_ERROR_MESSAGES, error.code)) {
    return AUTH_ERROR_MESSAGES[error.code]
  }
  if (typeof error.message === 'string') {
    for (const [pattern, message] of AUTH_MESSAGE_FALLBACKS) {
      if (pattern.test(error.message)) return message
    }
  }
  // Red de seguridad: si es un error de autenticación no catalogado (GoTrue marca
  // sus errores con __isAuthError / name 'AuthApiError'), no dejamos pasar el texto
  // en inglés crudo. Supabase desaconseja depender del message, así que damos un
  // genérico en español. Los errores de Postgres/red NO son AuthError → no entran aquí.
  const isAuthError = error.__isAuthError === true ||
    (typeof error.name === 'string' && error.name.startsWith('Auth'))
  if (isAuthError) {
    return 'No se pudo completar la operación. Revisa tus datos e inténtalo de nuevo.'
  }
  return null
}

/**
 * Parsea errores de Supabase y devuelve un mensaje amigable
 */
export const getSupabaseErrorMessage = (error) => {
  if (!error) return "Error desconocido"

  // Errores de autenticación (por code snake_case o por texto en inglés).
  // Se resuelven antes del switch de Postgres porque el `code` de Auth no es numérico.
  const authMessage = getAuthErrorMessage(error)
  if (authMessage) return authMessage

  // Código de error PostgreSQL
  if (error.code) {
    switch (error.code) {
      case '23505': // unique_violation
        return "Este registro ya existe (valor duplicado)."
      case '23503': // foreign_key_violation
        return "No se puede realizar esta acción porque el registro está relacionado con otros datos."
      case '42P01': // undefined_table
        return "Error de configuración: Tabla no encontrada."
      case '42501': // insufficient_privilege
        return "No tienes permisos para realizar esta acción."
      case '23514': // check_violation — CHECK stock>=0 (mensaje crudo de PG) o RAISE de sobrepago de abonos (S2, mensaje propio)
        return (error.message && !/check constraint|violates/i.test(error.message))
          ? error.message
          : "El stock no puede quedar en negativo. Revisa la cantidad disponible."
      case '53400': // configuration_limit_exceeded — límite del plan server-side (P1.11)
        return error.message || "Has alcanzado un límite de tu plan. Actualiza a Premium para ampliarlo."
      case 'P0010': // período cerrado (S5)
        return error.message || "Ese período está cerrado. No puedes registrar ni editar movimientos con esa fecha."
      default:
        // Mensaje técnico en desarrollo, genérico en producción
        return import.meta.env.DEV
          ? `Error técnico (${error.code}): ${error.message}`
          : "Ocurrió un error al procesar la solicitud."
    }
  }

  // Errores de red o cliente
  if (error.message === 'Failed to fetch') return "Error de conexión. Verifica tu internet."

  return error.message || "Error inesperado"
}

/**
 * ¿El error indica que el correo aún no está confirmado? Se usa en Login para
 * ofrecer reenviar el enlace de confirmación (supabase.auth.resend).
 */
export const isEmailNotConfirmedError = (error) => {
  if (!error) return false
  if (error.code === 'email_not_confirmed') return true
  return typeof error.message === 'string' && /email not confirmed/i.test(error.message)
}
