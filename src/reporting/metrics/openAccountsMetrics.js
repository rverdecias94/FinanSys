/**
 * E2 — Cuentas abiertas (CxC/CxP) a partir de transactions.
 * Saldo abierto = amount - paid_amount (paid_amount es caché; no se suma como caja).
 */
import { isPendingOpen, openBalance, toNum } from './cashRules'

/**
 * @param {Array} transactions — preferiblemente ya filtradas a pending/partial
 * @param {'receivable'|'payable'} direction
 */
export function buildOpenAccountRows(transactions = [], direction = 'receivable') {
  const wantType = direction === 'payable' ? 'expense' : 'income'
  return (transactions || [])
    .filter((tx) => tx?.type === wantType && isPendingOpen(tx))
    .map((tx) => {
      const amount = toNum(tx.amount)
      const paid = toNum(tx.paid_amount)
      const saldo = openBalance(tx)
      return {
        id: tx.id,
        currency: tx.currency || 'USD',
        contactName: tx.contact?.name || tx.contact_name || '—',
        category: tx.category || 'Sin categoría',
        description: tx.description || '',
        date: tx.date || null,
        dueDate: tx.due_date || null,
        status: tx.status,
        amount,
        paidAmount: paid,
        openBalance: saldo,
      }
    })
    .sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY
      return da - db
    })
}

export function openAccountsToExportRows(rows) {
  return (rows || []).map((r) => ({
    Moneda: r.currency,
    Contacto: r.contactName,
    Categoría: r.category,
    Descripción: r.description,
    Fecha: r.date ? new Date(r.date).toLocaleDateString() : '',
    Vencimiento: r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '',
    Estado: r.status,
    Importe: r.amount,
    CobradoPagado: r.paidAmount,
    'Saldo abierto': r.openBalance,
  }))
}

/** Totales de saldo abierto por moneda (no mezclar monedas). */
export function openBalanceByCurrency(rows = []) {
  const out = {}
  for (const r of rows) {
    const cur = r.currency || 'USD'
    out[cur] = (out[cur] || 0) + toNum(r.openBalance)
  }
  return out
}
