import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { isNetworkError } from '@/offline/isNetworkError'

const LABELS = {
  products: 'Producto',
  movements: 'Movimiento',
  transactions: 'Transacción',
  inventory_items: 'Producto',
  configuracion_balance: 'Configuración',
  contacts: 'Contacto',
  exchange_rates: 'Tipo de cambio'
}

const SUCCESS_BY_ACTION = {
  create: (label) => `${label} agregado satisfactoriamente`,
  update: (label) => `${label} actualizado correctamente`,
  delete: (label) => `${label} eliminado exitosamente`,
  register: (label) => `${label} registrado correctamente`
}

/** Toast honesto cuando la mutación queda en cola offline (outbox). */
export function notifyOfflineQueued(label = 'Operación') {
  notify.info(`${label} guardada. Se sincronizará al reconectar.`)
}

export async function withCrud({ action, table }, fn) {
  const label = LABELS[table] || 'Operación'
  try {
    const result = await fn()
    // Reintento idempotente (mismo client_uuid): no celebrar un "alta" nueva.
    if (result?.idempotent) return result
    const successMessage = (SUCCESS_BY_ACTION[action] || (() => 'Operación realizada correctamente'))(label)
    notify.success(successMessage)
    return result
  } catch (error) {
    // Fallo de red: lo maneja el outbox (sin toast rojo engañoso).
    if (isNetworkError(error)) throw error
    const msg = getSupabaseErrorMessage(error)
    notify.error(msg)
    throw error
  }
}
