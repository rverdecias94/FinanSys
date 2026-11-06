// UUID de idempotencia para mutaciones offline (Capa C / outbox).
// Identifica un intento de create: reenviar la misma operación no duplica filas.
// crypto.randomUUID en navegadores modernos; fallback v4 con Math.random (basta
// con unicidad, no con seguridad criptográfica).

export function genClientUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
