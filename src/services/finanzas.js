import { supabase } from '@/config/supabase'
import { withCrud } from '@/services/notifyWrap'
import { logAction } from '@/services/auditLogger'
import { getEffectiveUserId } from '@/services/team'
import { exportToExcel, exportToPDF } from '@/utils/exportUtils'

export async function uploadAttachments(files, userId) {
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
      console.error('Error uploading file:', error);
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('transaction-images')
      .getPublicUrl(fileName);

    urls.push(publicUrl);
  }
  return urls;
}

export async function deleteAttachments(urls) {
  if (!urls || urls.length === 0) return;

  const paths = urls.map(url => {
    if (typeof url !== 'string') return null;
    const parts = url.split('/transaction-images/');
    return parts.length > 1 ? parts[1] : null;
  }).filter(Boolean);

  if (paths.length > 0) {
    const { error } = await supabase.storage
      .from('transaction-images')
      .remove(paths);

    if (error) {
      console.error('Error deleting files from bucket:', error);
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
    if (error) console.error('Error al obtener categorías:', error)
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
    if (error) console.error('Error al obtener métodos de pago:', error)
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
    payment_method, bank_account_id, reference_number, notes, attachments
  } = payload

  let finalAttachments = [];
  if (attachments && attachments.length > 0) {
    finalAttachments = await uploadAttachments(attachments, effectiveUserId);
  }

  const dbPayload = {
    date,
    amount,
    currency,
    category,
    description,
    type,
    user_id: effectiveUserId, // Usar ID efectivo
    image_url: finalAttachments.length > 0 ? finalAttachments[0] : null,
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
    if (error) throw error
    await logAction({
      action: 'Crear',
      resource: `Transacción: ${data.description || 'Sin descripción'}`,
      details: data,
      area: 'Finanzas'
    })
    return data
  })
}

export async function updateTransaction(transactionId, payload, userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId);

  const {
    date, amount, currency, category, description, type,
    payment_method, bank_account_id, reference_number, notes, attachments, deleted_attachments
  } = payload

  if (deleted_attachments && deleted_attachments.length > 0) {
    await deleteAttachments(deleted_attachments);
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

  const dbPayload = {
    date,
    amount,
    currency,
    category,
    description,
    type,
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
    await logAction({
      action: 'Actualizar',
      resource: `Transacción: ${data.description || 'Sin descripción'}`,
      details: data,
      area: 'Finanzas'
    })
    return data
  })
}

export async function listTransactions({ from, to, category, type, currency, userId, businessId, limit, page, pageSize }) {
  const effectiveUserId = getEffectiveUserId(userId, businessId);

  let q = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', effectiveUserId) // Usar ID efectivo
    .order('date', { ascending: false })

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
    if (!totals[r.type][r.currency]) {
      totals[r.type][r.currency] = 0
    }
    totals[r.type][r.currency] += Number(r.amount)
  }

  return totals
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
    console.error('Error fetching balance config:', error)
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
        if (t.type === 'income') totalIncome += Number(t.amount)
        else totalExpense += Number(t.amount)
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

  if (error) throw error

  return data
}

export async function getFinancialDistribution(userId, businessId, type = 'all', currency = 'all') {
  const effectiveUserId = getEffectiveUserId(userId, businessId);

  const endMonth = new Date().toISOString()
  const startMonth = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('transactions')
    .select('category, amount, currency, type')
    .eq('user_id', effectiveUserId) // Usar ID efectivo
    .gte('date', startMonth)
    .lt('date', endMonth)

  if (type !== 'all') {
    query = query.eq('type', type)
  }

  if (currency !== 'all') {
    query = query.eq('currency', currency)
  }

  let { data, error } = await query

  if (error) throw error

  if (!data || data.length === 0) {
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
    const yearEnd = new Date(new Date().getFullYear() + 1, 0, 1).toISOString()
    let yearQuery = supabase
      .from('transactions')
      .select('category, amount, currency, type')
      .eq('user_id', effectiveUserId)
      .gte('date', yearStart)
      .lt('date', yearEnd)
    if (type !== 'all') yearQuery = yearQuery.eq('type', type)
    if (currency !== 'all') yearQuery = yearQuery.eq('currency', currency)
    const yearRes = await yearQuery
    if (!yearRes.error) data = yearRes.data || []
  }

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
