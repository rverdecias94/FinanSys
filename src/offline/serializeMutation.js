// Variables de mutación deben ser 100% serializables (JSON → IndexedDB) para
// poder reanudar tras recargar. Nada de File/Blob/Date en el payload final.

function toIso(value) {
  if (value instanceof Date) return value.toISOString()
  return value ?? null
}

/** Quita File/Blob de adjuntos; deja solo URLs string ya subidas. */
export function stripBinaryAttachments(payload = {}) {
  const attachments = Array.isArray(payload.attachments)
    ? payload.attachments.filter((a) => typeof a === 'string' && a.trim() !== '')
    : []
  const deleted = Array.isArray(payload.deleted_attachments)
    ? payload.deleted_attachments.filter((a) => typeof a === 'string' && a.trim() !== '')
    : []
  return {
    ...payload,
    attachments,
    deleted_attachments: deleted,
  }
}

/** Serializa un payload de transacción para el outbox (create/update). */
export function serializeTransactionPayload(payload = {}) {
  const clean = stripBinaryAttachments(payload)
  return {
    ...clean,
    date: toIso(clean.date),
    due_date: toIso(clean.due_date),
    amount: clean.amount != null ? Number(clean.amount) : clean.amount,
    contact_id: clean.contact_id != null && clean.contact_id !== ''
      ? Number(clean.contact_id)
      : null,
    product_id: clean.product_id != null ? Number(clean.product_id) : clean.product_id,
    qty: clean.qty != null ? Number(clean.qty) : clean.qty,
    unit_price: clean.unit_price != null ? Number(clean.unit_price) : clean.unit_price,
  }
}

/** ¿Hay algún File/Blob en adjuntos? (bloqueo offline de adjuntos). */
export function payloadHasBinaryAttachments(payload = {}) {
  const list = [
    ...(Array.isArray(payload.attachments) ? payload.attachments : []),
    ...(Array.isArray(payload.deleted_attachments) ? payload.deleted_attachments : []),
  ]
  return list.some(
    (a) => typeof File !== 'undefined' && a instanceof File
  ) || list.some(
    (a) => typeof Blob !== 'undefined' && a instanceof Blob && typeof a !== 'string'
  )
}
