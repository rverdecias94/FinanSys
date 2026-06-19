import { notify, getSupabaseErrorMessage } from '@/services/notifications'

const LABELS = {
  products: 'Producto',
  movements: 'Movimiento',
  transactions: 'Transacción',
  inventory_items: 'Producto',
  configuracion_balance: 'Configuración',
  contacts: 'Contacto'
}

const SUCCESS_BY_ACTION = {
  create: (label) => `${label} agregado satisfactoriamente`,
  update: (label) => `${label} actualizado correctamente`,
  delete: (label) => `${label} eliminado exitosamente`,
  register: (label) => `${label} registrado correctamente`
}

export async function withCrud({ action, table }, fn) {
  const label = LABELS[table] || 'Operación'
  try {
    const result = await fn()
    const successMessage = (SUCCESS_BY_ACTION[action] || (() => 'Operación realizada correctamente'))(label)
    notify.success(successMessage)
    return result
  } catch (error) {
    const msg = getSupabaseErrorMessage(error)
    notify.error(msg)
    throw error
  }
}
