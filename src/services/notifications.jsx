import { toast } from "sonner"
import { CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react"

/**
 * Servicio centralizado de notificaciones
 */
export const notify = {
  success: (message, options = {}) => {
    toast.success(message, {
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      className: "border-green-500/20 bg-green-50/50",
      ...options,
    })
  },
  error: (message, options = {}) => {
    toast.error(message, {
      icon: <XCircle className="h-4 w-4 text-red-500" />,
      className: "border-red-500/20 bg-red-50/50",
      duration: 5000,
      ...options,
    })
  },
  warning: (message, options = {}) => {
    toast.warning(message, {
      icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
      className: "border-amber-500/20 bg-amber-50/50",
      ...options,
    })
  },
  info: (message, options = {}) => {
    toast.info(message, {
      icon: <Info className="h-4 w-4 text-blue-500" />,
      className: "border-blue-500/20 bg-blue-50/50",
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

/**
 * Parsea errores de Supabase y devuelve un mensaje amigable
 */
export const getSupabaseErrorMessage = (error) => {
  if (!error) return "Error desconocido"

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
