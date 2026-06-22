/**
 * Decide qué vista mostrar en el Dashboard según el estado de configuración del
 * negocio y la actividad real. Es una función pura para poder testearla sin
 * montar la página completa.
 *
 * Reglas:
 * - Hasta que las consultas no están listas (`ready=false`) no se muestra nada
 *   especial (evita parpadeos).
 * - Si NO hay moneda principal configurada → asistente "Empieza en 3 pasos".
 * - Si ya hay moneda principal → se muestra el panel (con el saldo, incluido el
 *   saldo inicial). Si además no hay movimientos todavía, se muestra un aviso
 *   suave (no bloqueante) para registrar el primer movimiento.
 *
 * @param {object} args
 * @param {boolean} args.isConfigured - hay una moneda principal (is_default).
 * @param {boolean} args.hasActivity - hay al menos un movimiento registrado.
 * @param {boolean} args.ready - las consultas base ya resolvieron.
 * @returns {{ showOnboarding: boolean, showPanel: boolean, showFirstMovementHint: boolean }}
 */
export function deriveDashboardView({ isConfigured, hasActivity, ready }) {
  if (!ready) {
    return { showOnboarding: false, showPanel: false, showFirstMovementHint: false }
  }
  if (!isConfigured) {
    return { showOnboarding: true, showPanel: false, showFirstMovementHint: false }
  }
  return { showOnboarding: false, showPanel: true, showFirstMovementHint: !hasActivity }
}
