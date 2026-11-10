import { supabase } from '@/config/supabase'
import { withCrud } from '@/services/notifyWrap'
import { logAction } from '@/services/auditLogger'
import { getEffectiveUserId } from '@/services/team'
import { getRateForDate } from '@/services/exchangeRates'
// `exportUtils` (jspdf/xlsx) se importa dinámicamente dentro de exportTransactions
// para no arrastrar las librerías pesadas de exportación en la carga de Finanzas (P3.5).

/**
 * Sube adjuntos al bucket `transaction-images`.
 * `userId` DEBE ser el businessId/owner del negocio (getEffectiveUserId),
 * no el auth.uid() de un miembro: la carpeta `{businessId}/…` es lo que
 * aíslan las policies Storage (P0-001 → get_current_business_id()).
 */
export async function uploadAttachments(files, userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('uploadAttachments: falta businessId/userId de carpeta')
  }
  const urls = [];
  for (const file of files) {
    if (typeof file === 'string') {
      urls.push(file); // Already a URL
      continue;
    }
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const { error } = await supabase.storage
      .from('transaction-images')
      .upload(fileName, file);

    if (error) {
      throw error
    }

    const { data: { publicUrl } } = supabase.storage
      .from('transaction-images')
      .getPublicUrl(fileName);

    urls.push(publicUrl);
  }
  return urls;
}

/**
 * Borra objetos por URL pública. La autorización real la hace RLS Storage
 * (carpeta = get_current_business_id). Defensa en cliente: solo intenta
 * borrar rutas bajo `businessFolder` cuando se pasa.
 */
export async function deleteAttachments(urls, businessFolder) {
  if (!urls || urls.length === 0) return;

  const paths = urls.map(url => {
    if (typeof url !== 'string') return null;
    const parts = url.split('/transaction-images/');
    return parts.length > 1 ? parts[1] : null;
  }).filter(Boolean);

  const scoped = businessFolder
    ? paths.filter((p) => p === businessFolder || p.startsWith(`${businessFolder}/`))
    : paths;

  if (scoped.length > 0) {
    const { error } = await supabase.storage
      .from('transaction-images')
      .remove(scoped);

    if (error) {
      return
    }
  }
}

export async function getFinanceCategories() {
  const { data, error } = await supabase
    .from('finance_categories')
    .select('name, type')
    .eq('is_active', true)
    .order('name')

  if (error || !data || data.length === 0) {
    return {
      income: [
        'Ventas', 'Servicios Profesionales', 'Inversiones', 'Reembolsos',
        'Consultoría', 'Licencias', 'Dividendos', 'Alquileres',
        'Comisiones', 'Subvenciones', 'Intereses', 'Otros'
      ],
      expense: [
        'Servicios', 'Suministros', 'Transporte', 'Alimentación',
        'Tecnología', 'Marketing', 'Nómina', 'Impuestos',
        'Mantenimiento', 'Seguros', 'Alquiler', 'Capacitación',
        'Software', 'Mobiliario', 'Otros'
      ]
    }
  }

  const categories = { income: [], expense: [] }
  data?.forEach(cat => {
    if (categories[cat.type]) {
      categories[cat.type].push(cat.name)
    }
  })

  return categories
}

export async function getPaymentMethods() {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('name')
    .eq('is_active', true)
    .order('name')

  if (error || !data || data.length === 0) {
    return [
      'Efectivo', 'Transferencia Bancaria', 'Tarjeta de Débito',
      'Tarjeta de Crédito', 'Cheque', 'Depósito Bancario',
      'PayPal', 'Zelle', 'Otro'
    ]
  }

  return data?.map(method => method.name) || []
}

export async function createTransaction(payload, userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId);

  const {
    date, amount, currency, category, description, type,
    payment_method, bank_account_id, reference_number, notes, attachments,
    contact_id, status, due_date, paid_amount, client_uuid
  } = payload

  // Offline outbox: nunca subir File/Blob aquí; solo URLs string ya existentes.
  const safeAttachments = Array.isArray(attachments)
    ? attachments.filter((a) => typeof a === 'string' && a.trim() !== '')
    : []

  let finalAttachments = [];
  if (safeAttachments.length > 0) {
    finalAttachments = await uploadAttachments(safeAttachments, effectiveUserId);
  }

  // CxC/CxP (Fase 1): por defecto 'paid' (efectivo, realidad cubana). Si queda
  // pendiente, paid_amount arranca en 0 (o el abono parcial recibido).
  const finalStatus = status || 'paid'
  const finalPaid = finalStatus === 'paid' ? Number(amount) : Number(paid_amount || 0)

  // Nivel 2 (devaluación): sella la tasa vigente el día de la operación. Defensivo:
  // si no hay tasa o falla la consulta, queda null y NUNCA bloquea la transacción.
  let fxUnitsPerBase = null
  try { fxUnitsPerBase = await getRateForDate(currency, date, userId, businessId) } catch { fxUnitsPerBase = null }

  const dbPayload = {
    date,
    amount,
    currency,
    category,
    description,
    type,
    user_id: effectiveUserId, // Usar ID efectivo
    contact_id: contact_id || null,
    fx_units_per_base: fxUnitsPerBase,
    status: finalStatus,
    due_date: finalStatus === 'paid' ? null : (due_date || null),
    paid_amount: finalPaid,
    image_url: finalAttachments.length > 0 ? finalAttachments[0] : null,
    client_uuid: client_uuid || null,
    details: {
      payment_method: payment_method || null,
      bank_account_id: bank_account_id || null,
      reference_number: reference_number || null,
      notes: notes || null,
      attachments: finalAttachments
    }
  }

  return await withCrud({ action: 'create', table: 'transactions' }, async () => {
    const { data, error } = await supabase.from('transactions').insert(dbPayload).select().single()
    // Idempotencia (outbox): reintento con el mismo client_uuid → devolver la fila existente.
    if (error) {
      if (error.code === '23505' && client_uuid) {
        const { data: existing, error: fetchErr } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', effectiveUserId)
          .eq('client_uuid', client_uuid)
          .maybeSingle()
        if (fetchErr) throw fetchErr
        if (existing) return { ...existing, idempotent: true }
      }
      throw error
    }
    // S4: la auditoría (incl. antes/después) la registra el trigger de BD audit_row_change.
    return data
  })
}

export async function updateTransaction(transactionId, payload, userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId);

  const {
    date, amount, currency, category, description, type,
    payment_method, bank_account_id, reference_number, notes, attachments, deleted_attachments,
    contact_id, status, due_date, paid_amount
  } = payload

  if (deleted_attachments && deleted_attachments.length > 0) {
    await deleteAttachments(deleted_attachments, effectiveUserId);
    await logAction({
      action: 'Eliminar',
      resource: `Adjunto(s) de Transacción: ${description || 'Sin descripción'}`,
      details: { deleted_urls: deleted_attachments, transaction_id: transactionId },
      area: 'Finanzas'
    })
  }

  let finalAttachments = [];
  if (attachments && attachments.length > 0) {
    finalAttachments = await uploadAttachments(attachments, effectiveUserId);
  }

  // Si se marca pagada -> total; si queda pendiente, conserva lo ya abonado
  // (no pierde pagos parciales) y recalcula a 'partial' cuando corresponda.
  const reqStatus = status || 'paid'
  let finalStatus, finalPaid
  if (reqStatus === 'paid') {
    finalStatus = 'paid'
    finalPaid = Number(amount)
  } else {
    finalPaid = Number(paid_amount || 0)
    finalStatus = finalPaid > 0 && finalPaid < Number(amount) ? 'partial' : 'pending'
  }

  // Nivel 2 (devaluación): re-sella la tasa vigente para la fecha/moneda de la
  // transacción. Defensivo: si falla queda null y no bloquea la edición.
  let fxUnitsPerBase = null
  try { fxUnitsPerBase = await getRateForDate(currency, date, userId, businessId) } catch { fxUnitsPerBase = null }

  const dbPayload = {
    date,
    amount,
    currency,
    category,
    description,
    type,
    contact_id: contact_id || null,
    fx_units_per_base: fxUnitsPerBase,
    status: finalStatus,
    due_date: finalStatus === 'paid' ? null : (due_date || null),
    paid_amount: finalPaid,
    image_url: finalAttachments.length > 0 ? finalAttachments[0] : null,
    details: {
      payment_method: payment_method || null,
      bank_account_id: bank_account_id || null,
      reference_number: reference_number || null,
      notes: notes || null,
      attachments: finalAttachments
    }
  }

  let q = supabase.from('transactions').update(dbPayload).eq('id', transactionId).eq('user_id', effectiveUserId) // Usar ID efectivo

  return await withCrud({ action: 'update', table: 'transactions' }, async () => {
    const { data, error } = await q.select().single()
    if (error) throw error
    // S4: la auditoría (incl. antes/después) la registra el trigger de BD audit_row_change.
    return data
  })
}

export async function listTransactions({ from, to, category, type, currency, userId, businessId, limit, page, pageSize }) {
  const effectiveUserId = getEffectiveUserId(userId, businessId);

  let q = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', effectiveUserId) // Usar ID efectivo
    // Fecha de negocio primero; id (bigserial) desempata: lo recién guardado sale arriba
    // aunque varias txs compartan la misma fecha. (La tabla no tiene created_at.)
    .order('date', { ascending: false })
    .order('id', { ascending: false })

  if (limit) {
    q = q.limit(limit)
  } else if (page && pageSize) {
    const fromRange = (page - 1) * pageSize
    const toRange = fromRange + pageSize - 1
    q = q.range(fromRange, toRange)
  }

  if (from) q = q.gte('date', from)
  if (to) q = q.lte('date', to)
  if (category) q = q.eq('category', category)
  if (type) q = q.eq('type', type)
  if (currency) q = q.eq('currency', currency)

  const { data, error, count } = await q
  if (error) throw error

  if (page && pageSize) {
    return { data, count }
  }
  return data
}

// Cuentas por cobrar/pagar (Fase 1): transacciones con saldo pendiente.
// direction 'receivable' = ingresos pendientes (te deben); 'payable' = gastos pendientes (debes).
export async function listOpenAccounts({ direction = 'receivable', page = 1, pageSize = 5, userId, businessId } = {}) {
  if (!userId) throw new Error('User ID is required')
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const type = direction === 'payable' ? 'expense' : 'income'

  let q = supabase
    .from('transactions')
    .select('*, contact:contacts(name)', { count: 'exact' })
    .eq('user_id', effectiveUserId)
    .eq('type', type)
    .in('status', ['pending', 'partial'])
    .order('due_date', { ascending: true, nullsFirst: false })

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  q = q.range(from, to)

  const { data, count, error } = await q
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

// Registrar un abono (parcial o total) sobre una cuenta pendiente.
// S2: delega en la RPC atómica register_account_payment, que inserta el abono en
// el libro `account_payments` y recalcula paid_amount=SUM(abonos)+status en una sola
// transacción (sin lost-update; rechaza sobrepago). El negocio se resuelve
// server-side con get_current_business_id().
export async function registerPayment(transactionId, abono, userId, businessId, options = {}) {
  if (!userId) throw new Error('User ID is required')
  const add = Number(abono)
  if (!Number.isFinite(add) || add <= 0) throw new Error('El monto del pago debe ser mayor que cero.')

  const { data, error } = await supabase.rpc('register_account_payment', {
    p_transaction_id: transactionId,
    p_amount: add,
    p_method: options.method || null,
    p_note: options.note || null,
    p_client_uuid: options.clientUuid || null,
  })
  if (error) throw error
  // S4: la actualización de la cuenta (paid_amount/status) la audita el trigger de BD.
  return data
}

// Historial de abonos (libro account_payments) de una cuenta. RLS por negocio.
export async function listAccountPayments(transactionId) {
  if (!transactionId) return []
  const { data, error } = await supabase
    .from('account_payments')
    .select('id, amount, paid_at, method, note')
    .eq('transaction_id', transactionId)
    .order('paid_at', { ascending: true })
  if (error) throw error
  return data || []
}

// Antigüedad de saldos (Q10): clasifica las cuentas pendientes (pending/partial)
// por tramos de vencimiento respecto a hoy — por vencer / 1-30 / 31-60 / 61-90 / +90
// días — con saldo = amount - paid_amount, AGREGADO POR MONEDA (1 fila por moneda).
// direction 'receivable' = por cobrar (income); 'payable' = por pagar (expense).
// La RPC get_aging_report ancla el negocio en get_current_business_id() y exige
// finanzas.view (es SECURITY DEFINER → valida el permiso server-side).
export async function getAgingReport(direction = 'receivable') {
  const { data, error } = await supabase.rpc('get_aging_report', { p_direction: direction })
  if (error) throw error
  return data || []
}

// Venta conectada (S7): registra la venta de un producto en UNA operación atómica
// (RPC register_sale). Crea el ingreso (en la moneda del producto, monto = qty*precio
// calculado server-side), descuenta stock y sella el COGS = avg_cost. El payload lleva
// los datos de la transacción (date, category, description, contact_id, status,
// due_date, payment_method); la moneda y el monto los resuelve la RPC. Devuelve
// { transaction_id, amount, currency, cogs, margin, new_stock }. clientUuid (opcional) da
// idempotencia: un reintento con el mismo UUID no duplica la venta (devuelve idempotent:true).
export async function registerSale(payload, productId, qty, unitPrice, clientUuid) {
  const { data, error } = await supabase.rpc('register_sale', {
    p_payload: payload || {},
    p_product_id: Number(productId),
    p_qty: Number(qty),
    p_unit_price: Number(unitPrice),
    p_client_uuid: clientUuid || null
  })
  if (error) throw error
  return data
}

// Cierre de período (S5): fecha (inclusive) hasta la cual los movimientos están
// bloqueados. getPeriodLock lee el candado; setPeriodLock cierra (date) o reabre (null).
export async function getPeriodLock(userId, businessId) {
  if (!userId) return null
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const { data, error } = await supabase
    .from('period_locks')
    .select('closed_through, updated_at')
    .eq('user_id', effectiveUserId)
    .maybeSingle()
  if (error) throw error
  return data || null
}

export async function setPeriodLock(through, userId) {
  if (!userId) throw new Error('User ID is required')
  let p = null
  if (through instanceof Date) {
    // Fecha de calendario LOCAL (no toISOString: en zonas UTC+ puede restar un día).
    const y = through.getFullYear()
    const m = String(through.getMonth() + 1).padStart(2, '0')
    const d = String(through.getDate()).padStart(2, '0')
    p = `${y}-${m}-${d}`
  } else if (typeof through === 'string' && through) {
    p = through.slice(0, 10)
  }
  const { data, error } = await supabase.rpc('set_period_lock', { p_through: p })
  if (error) throw error
  return data
}

export async function fetchTransactionsForExport({ from, to, category, type, currency, userId, businessId }) {
  const pageSize = 1000
  const first = await listTransactions({ from, to, category, type, currency, userId, businessId, page: 1, pageSize })
  const initialRows = first?.data || []
  const count = Number(first?.count || 0)

  if (!count || initialRows.length === 0) return []

  const totalPages = Math.ceil(count / pageSize)
  if (totalPages <= 1) return initialRows

  const rows = [...initialRows]
  for (let page = 2; page <= totalPages; page++) {
    const res = await listTransactions({ from, to, category, type, currency, userId, businessId, page, pageSize })
    rows.push(...(res?.data || []))
  }

  return rows
}

export async function exportTransactions({ from, to, category, type, currency, userId, businessId, format = 'xlsx' }) {
  const { exportToExcel, exportToPDF } = await import('@/utils/exportUtils')
  const rows = await fetchTransactionsForExport({ from, to, category, type, currency, userId, businessId })

  const filename = `finanzas_${new Date().toISOString().slice(0, 10)}`

  if (format === 'pdf') {
    const headers = ['Fecha', 'Tipo', 'Categoría', 'Monto', 'Moneda', 'Descripción']
    const body = rows.map(r => [
      r.date ? new Date(r.date).toLocaleString() : '',
      r.type === 'income' ? 'Ingreso' : r.type === 'expense' ? 'Gasto' : (r.type || ''),
      r.category || '',
      r.amount ?? '',
      r.currency || '',
      r.description || ''
    ])
    exportToPDF('Finanzas (Filtrado)', headers, body, filename)
    return { count: rows.length }
  }

  const excelRows = rows.map(r => ({
    Fecha: r.date ? new Date(r.date).toLocaleString() : '',
    Tipo: r.type === 'income' ? 'Ingreso' : r.type === 'expense' ? 'Gasto' : (r.type || ''),
    Categoría: r.category || '',
    Monto: r.amount ?? '',
    Moneda: r.currency || '',
    Descripción: r.description || '',
    'Método de Pago': r.details?.payment_method || '',
    Referencia: r.details?.reference_number || '',
    Notas: r.details?.notes || '',
  }))

  exportToExcel('Finanzas', excelRows, filename)
  return { count: rows.length }
}

export async function getFilteredTotals({ from, to, category, type, currency, userId, businessId }) {
  const effectiveUserId = getEffectiveUserId(userId, businessId);

  let q = supabase
    .from('transactions')
    .select('amount, type, currency')
    .eq('user_id', effectiveUserId) // Usar ID efectivo

  if (from) q = q.gte('date', from)
  if (to) q = q.lte('date', to)
  if (category) q = q.eq('category', category)
  if (type) q = q.eq('type', type)
  if (currency) q = q.eq('currency', currency)

  const { data, error } = await q
  if (error) throw error

  return computeTotals(data)
}

export function computeTotals(rows) {
  // Dynamic totals: { income: { USD: 0, CUP: 0, ... }, expense: { USD: 0, ... } }
  // To keep backward compatibility or easy usage, we might flatten it or return structured object
  // Let's return structured object

  const totals = {
    income: {},
    expense: {}
  }

  for (const r of rows) {
    // E2: type=transfer no es ingreso/gasto (evita contaminar flujo registrado).
    if (r.type !== 'income' && r.type !== 'expense') continue
    if (!totals[r.type][r.currency]) {
      totals[r.type][r.currency] = 0
    }
    totals[r.type][r.currency] += Number(r.amount)
  }

  return totals
}

/**
 * E2 — Fuentes para flujo liquidado (settled) en un período.
 * Abonos por paid_at + candidatos a alta al contado (paid sin ledger).
 * No usa paid_amount como movimiento de caja (es caché).
 */
export async function fetchSettledCashSources({ from, to, userId, businessId } = {}) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)

  let payQ = supabase
    .from('account_payments')
    .select('id, amount, paid_at, transaction_id, transactions!inner(id, type, currency, status, amount, paid_amount, date)')
    .eq('user_id', effectiveUserId)
  if (from) payQ = payQ.gte('paid_at', from)
  if (to) payQ = payQ.lte('paid_at', to)

  const { data: payRows, error: payErr } = await payQ
  if (payErr) throw payErr

  const payments = (payRows || []).map((p) => ({
    id: p.id,
    amount: p.amount,
    paid_at: p.paid_at,
    transaction_id: p.transaction_id,
  }))

  let txQ = supabase
    .from('transactions')
    .select('id, type, currency, status, amount, paid_amount, date')
    .eq('user_id', effectiveUserId)
    .eq('status', 'paid')
    .in('type', ['income', 'expense'])
  if (from) txQ = txQ.gte('date', from)
  if (to) txQ = txQ.lte('date', to)

  const { data: paidTxs, error: txErr } = await txQ
  if (txErr) throw txErr

  const paymentCountsByTx = {}
  for (const p of payments) {
    const id = Number(p.transaction_id)
    paymentCountsByTx[id] = (paymentCountsByTx[id] || 0) + 1
  }

  const candidateIds = (paidTxs || []).map((t) => Number(t.id))
  const needCount = candidateIds.filter((id) => paymentCountsByTx[id] == null)
  if (needCount.length) {
    const { data: allPays, error: cntErr } = await supabase
      .from('account_payments')
      .select('transaction_id')
      .eq('user_id', effectiveUserId)
      .in('transaction_id', needCount)
    if (cntErr) throw cntErr
    for (const id of needCount) paymentCountsByTx[id] = 0
    for (const p of allPays || []) {
      const id = Number(p.transaction_id)
      paymentCountsByTx[id] = (paymentCountsByTx[id] || 0) + 1
    }
  }

  const byId = new Map()
  for (const p of payRows || []) {
    if (p.transactions) byId.set(Number(p.transactions.id), p.transactions)
  }
  for (const t of paidTxs || []) byId.set(Number(t.id), t)

  return {
    transactions: [...byId.values()],
    payments,
    paymentCountsByTx,
    period: { from, to },
  }
}

export async function getMonthlySummary(userId, businessId, year, month) {
  const effectiveUserId = getEffectiveUserId(userId, businessId);

  const startDate = new Date(year, month - 1, 1).toISOString()
  const endDate = new Date(year, month, 1).toISOString()

  const { data, error } = await supabase
    .from('transactions')
    .select('type, currency, amount, category')
    .eq('user_id', effectiveUserId) // Usar ID efectivo
    .gte('date', startDate)
    .lt('date', endDate)

  if (error) throw error

  const summary = {
    income: { byCurrency: {}, byCategory: {} },
    expense: { byCurrency: {}, byCategory: {} }
  }

  data?.forEach(transaction => {
    const { type, currency, amount, category } = transaction

    // By Currency
    if (!summary[type].byCurrency[currency]) summary[type].byCurrency[currency] = 0
    summary[type].byCurrency[currency] += Number(amount)

    // By Category
    if (!summary[type].byCategory[category]) {
      summary[type].byCategory[category] = {}
    }
    if (!summary[type].byCategory[category][currency]) summary[type].byCategory[category][currency] = 0
    summary[type].byCategory[category][currency] += Number(amount)
  })

  return summary
}

export async function getYearlySummary(userId, businessId, year, currency = 'all') {
  const effectiveUserId = getEffectiveUserId(userId, businessId);

  const startDate = new Date(year, 0, 1).toISOString()
  const endDate = new Date(year + 1, 0, 1).toISOString()

  let query = supabase
    .from('transactions')
    .select('type, currency, amount, date')
    .eq('user_id', effectiveUserId) // Usar ID efectivo
    .gte('date', startDate)
    .lt('date', endDate)

  if (currency !== 'all') {
    query = query.eq('currency', currency)
  }

  const { data, error } = await query
  if (error) throw error

  const monthlyData = {}

  for (let month = 1; month <= 12; month++) {
    monthlyData[month] = {
      income: {},
      expense: {}
    }
  }

  data?.forEach(transaction => {
    const date = new Date(transaction.date)
    const month = date.getMonth() + 1
    const { type, currency, amount } = transaction

    if (monthlyData[month]) {
      if (!monthlyData[month][type][currency]) monthlyData[month][type][currency] = 0
      monthlyData[month][type][currency] += Number(amount)
    }
  })

  return monthlyData
}

// Replaced getBalanceConfig with dynamic version
export async function getBalanceConfig(userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId);

  const { data, error } = await supabase
    .from('business_balances')
    .select('*')
    .eq('user_id', effectiveUserId) // Usar ID efectivo

  if (error) {
    return []
  }

  return data || []
}

// Replaced updateBalanceConfig with dynamic version
export async function updateBalanceConfig(userId, businessId, balances) {
  // balances: [{ currency_code, initial_balance }]

  if (!balances || !Array.isArray(balances) || balances.length === 0) return null

  const effectiveUserId = getEffectiveUserId(userId, businessId);
  const results = []

  // Update each balance individually
  // Ideally we should recalculate current balance here or trigger a recalc
  // For now we just update initial balance. 
  // We need to fetch current total transactions to update current_balance properly
  // Or we can assume the caller will trigger a recalc or we rely on the previous logic
  // The previous logic used a secure RPC. We should probably create a new RPC or handle it here.

  // Let's implement a simple update loop for now. 
  // For production, a batch RPC would be better.

  for (const bal of balances) {
    const { currency_code, initial_balance } = bal

    // Calculate total transactions for this currency to update current_balance
    // Or we can fetch the current one and adjust.
    // Better: Calculate fresh from transactions.

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('user_id', effectiveUserId) // Usar ID efectivo
      .eq('currency', currency_code)

    let totalIncome = 0
    let totalExpense = 0

    if (!txError && transactions) {
      transactions.forEach(t => {
        // P1.12: sumar como gasto SOLO 'expense' (antes el `else` contaba cualquier
        // tipo no-income como gasto, distorsionando el balance). Coherente con
        // computeTotals/getDashboardStats, que filtran por tipo explícito.
        if (t.type === 'income') totalIncome += Number(t.amount)
        else if (t.type === 'expense') totalExpense += Number(t.amount)
      })
    }

    const current_balance = Number(initial_balance) + totalIncome - totalExpense

    const { data, error } = await supabase
      .from('business_balances')
      .upsert({
        user_id: effectiveUserId, // Usar ID efectivo
        currency_code,
        initial_balance: Number(initial_balance),
        current_balance,
        last_updated: new Date()
      }, { onConflict: 'user_id, currency_code' })
      .select()
      .single()

    if (!error && data) results.push(data)
  }

  await logAction({
    action: 'Actualizar',
    resource: 'Configuración de Balance',
    details: balances,
    area: 'Configuración'
  })

  return results
}

export async function getDashboardStats(userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId);

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-indexed

  const startCurrentMonth = new Date(currentYear, currentMonth, 1).toISOString()
  const endCurrentMonth = new Date(currentYear, currentMonth + 1, 1).toISOString()

  const startPrevMonth = new Date(currentYear, currentMonth - 1, 1).toISOString()
  const endPrevMonth = new Date(currentYear, currentMonth, 1).toISOString()

  // Fetch balance
  const balanceConfig = await getBalanceConfig(userId, businessId)
  // balanceConfig is now array of { currency_code, current_balance, ... }

  // Fetch transactions
  const { data: currentMonthData, error: currentError } = await supabase
    .from('transactions')
    .select('amount, type, currency')
    .eq('user_id', effectiveUserId) // Usar ID efectivo
    .gte('date', startCurrentMonth)
    .lt('date', endCurrentMonth)

  const { data: prevMonthData, error: prevError } = await supabase
    .from('transactions')
    .select('amount, type, currency')
    .eq('user_id', effectiveUserId) // Usar ID efectivo
    .gte('date', startPrevMonth)
    .lt('date', endPrevMonth)

  if (currentError || prevError) {
    throw currentError || prevError
  }

  const sumAmounts = (transactions, type, currency) => {
    return transactions
      .filter(t => t.type === type && t.currency === currency)
      .reduce((acc, t) => acc + Number(t.amount), 0)
  }

  // Get all unique currencies involved
  const allCurrencies = new Set([
    ...balanceConfig.map(b => b.currency_code),
    ...currentMonthData.map(t => t.currency),
    ...prevMonthData.map(t => t.currency)
  ])

  const stats = {
    balance: {},
    income: { current: {}, change: {} },
    expense: { current: {}, change: {} }
  }

  // Initialize balances
  balanceConfig.forEach(b => {
    stats.balance[b.currency_code] = b.current_balance
  })

  allCurrencies.forEach(currency => {
    // Current
    const curIncome = sumAmounts(currentMonthData, 'income', currency)
    const curExpense = sumAmounts(currentMonthData, 'expense', currency)

    stats.income.current[currency] = curIncome
    stats.expense.current[currency] = curExpense

    // Previous
    const prevIncome = sumAmounts(prevMonthData, 'income', currency)
    const prevExpense = sumAmounts(prevMonthData, 'expense', currency)

    // Change
    const calcChange = (cur, prev) => {
      if (prev === 0) return null
      return ((cur - prev) / prev) * 100
    }

    stats.income.change[currency] = calcChange(curIncome, prevIncome)
    stats.expense.change[currency] = calcChange(curExpense, prevExpense)

    // Ensure balance exists (defaults to 0 if not in config but in txs)
    if (stats.balance[currency] === undefined) stats.balance[currency] = 0
  })

  return stats
}

export async function getRecentActivity(userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId);

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', effectiveUserId) // Usar ID efectivo
    .gte('date', thirtyDaysAgo.toISOString())
    .order('date', { ascending: false })
    .order('id', { ascending: false })

  if (error) throw error

  return data
}

export async function getFinancialDistribution(userId, businessId, type = 'all', currency = 'all', period = 'ALL') {
  const effectiveUserId = getEffectiveUserId(userId, businessId);

  // La distribución "Por categoría" usa el MISMO periodo que la gráfica de barras
  // (Año completo / trimestres del año actual), seleccionable desde su propio filtro.
  const now = new Date()
  const year = now.getFullYear()
  const [fromMonth, toMonth] = { Q1: [0, 3], Q2: [3, 6], Q3: [6, 9], Q4: [9, 12] }[period] || [0, 12]
  const startDate = new Date(year, fromMonth, 1).toISOString()
  const endDate = new Date(year, toMonth, 1).toISOString()

  let query = supabase
    .from('transactions')
    .select('category, amount, currency, type')
    .eq('user_id', effectiveUserId) // Usar ID efectivo
    .gte('date', startDate)
    .lt('date', endDate)

  if (type !== 'all') {
    query = query.eq('type', type)
  }

  if (currency !== 'all') {
    query = query.eq('currency', currency)
  }

  const { data, error } = await query

  if (error) throw error

  const distribution = {}
  data.forEach(t => {
    const key = `${t.type}_${t.category}_${t.currency}`
    if (!distribution[key]) {
      distribution[key] = {
        name: t.category,
        value: 0,
        type: t.type,
        currency: t.currency
      }
    }
    distribution[key].value += Number(t.amount)
  })

  return Object.values(distribution)
}
