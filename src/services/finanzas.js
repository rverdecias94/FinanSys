import { supabase } from '@/config/supabase'

export async function getFinanceCategories() {
  // Obtener categorías de la base de datos
  const { data, error } = await supabase
    .from('finance_categories')
    .select('name, type')
    .eq('is_active', true)
    .order('name')

  // Fallback a datos mock si hay error o no hay datos
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

  // Organizar categorías por tipo
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

  // Fallback a métodos mock si hay error o no hay datos
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

export async function getBankAccounts(userId) {
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('account_name')

  if (error) {
    console.error('Error al obtener cuentas bancarias:', error)
    return []
  }

  return data || []
}

export async function createBankAccount(accountData) {
  const { data, error } = await supabase
    .from('bank_accounts')
    .insert(accountData)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function createTransaction(payload) {
  // Separate core columns from extra details
  const { 
    date, amount, currency, category, description, type, user_id, 
    payment_method, bank_account_id, reference_number, notes, attachments
  } = payload

  // Prepare DB payload
  const dbPayload = {
    date,
    amount,
    currency,
    category,
    description,
    type,
    user_id,
    details: {
      payment_method: payment_method || null,
      bank_account_id: bank_account_id || null,
      reference_number: reference_number || null,
      notes: notes || null,
      attachments: attachments || []
    }
  }

  const { data, error } = await supabase.from('transactions').insert(dbPayload).select().single()
  if (error) throw error
  return data
}

export async function updateTransaction(transactionId, payload) {
  const { 
    date, amount, currency, category, description, type, user_id, 
    payment_method, bank_account_id, reference_number, notes, attachments
  } = payload

  const dbPayload = {
    date,
    amount,
    currency,
    category,
    description,
    type,
    details: {
      payment_method: payment_method || null,
      bank_account_id: bank_account_id || null,
      reference_number: reference_number || null,
      notes: notes || null,
      attachments: attachments || []
    }
  }

  let q = supabase.from('transactions').update(dbPayload).eq('id', transactionId)
  if (user_id) q = q.eq('user_id', user_id)

  const { data, error } = await q.select().single()
  if (error) throw error
  return data
}

export async function listTransactions({ from, to, category, type, currency, userId, limit, page, pageSize }) {
  let q = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
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

export function computeTotals(rows) {
  const totals = { income_usd: 0, income_cup: 0, expense_usd: 0, expense_cup: 0 }
  for (const r of rows) {
    if (r.type === 'income') {
      if (r.currency === 'USD') totals.income_usd += Number(r.amount)
      else totals.income_cup += Number(r.amount)
    } else {
      if (r.currency === 'USD') totals.expense_usd += Number(r.amount)
      else totals.expense_cup += Number(r.amount)
    }
  }
  return totals
}

// Funciones adicionales para reportes y estadísticas
export async function getMonthlySummary(userId, year, month) {
  const startDate = new Date(year, month - 1, 1).toISOString()
  const endDate = new Date(year, month, 1).toISOString()

  const { data, error } = await supabase
    .from('transactions')
    .select('type, currency, amount, category')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lt('date', endDate)

  if (error) throw error

  const summary = {
    income: { USD: 0, CUP: 0, byCategory: {} },
    expense: { USD: 0, CUP: 0, byCategory: {} }
  }

  data?.forEach(transaction => {
    const { type, currency, amount, category } = transaction
    summary[type][currency] += Number(amount)
    
    if (!summary[type].byCategory[category]) {
      summary[type].byCategory[category] = { USD: 0, CUP: 0 }
    }
    summary[type].byCategory[category][currency] += Number(amount)
  })

  return summary
}

/**
 * Obtiene el resumen anual con opción de filtrar por moneda
 * @param {string} userId - ID del usuario
 * @param {number} year - Año a consultar
 * @param {string} currency - 'USD' | 'CUP' | 'all' (por defecto 'all')
 * @returns {Promise<Object>} Datos mensuales por moneda
 */
export async function getYearlySummary(userId, year, currency = 'all') {
  const startDate = new Date(year, 0, 1).toISOString()
  const endDate = new Date(year + 1, 0, 1).toISOString()

  let query = supabase
    .from('transactions')
    .select('type, currency, amount, date')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lt('date', endDate)

  // Filtrar por moneda si no es 'all'
  if (currency !== 'all') {
    query = query.eq('currency', currency)
  }

  const { data, error } = await query

  if (error) throw error

  const monthlyData = {}
  
  // Inicializar todos los meses
  for (let month = 1; month <= 12; month++) {
    monthlyData[month] = {
      income: { USD: 0, CUP: 0 },
      expense: { USD: 0, CUP: 0 }
    }
  }

  data?.forEach(transaction => {
    const date = new Date(transaction.date)
    const month = date.getMonth() + 1
    const { type, currency, amount } = transaction
    
    if (monthlyData[month]) {
      monthlyData[month][type][currency] += Number(amount)
    }
  })

  return monthlyData
}

export async function getBalanceConfig(userId) {
  const { data, error } = await supabase
    .from('configuracion_balance')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 is "The result contains 0 rows"
    console.error('Error fetching balance config:', error)
    return null
  }
  
  return data
}

export async function updateBalanceConfig(userId, balanceUsd, balanceCup) {
  const { data, error } = await supabase
    .from('configuracion_balance')
    .upsert({ 
      user_id: userId, 
      balance_total_usd: balanceUsd,
      balance_total_cup: balanceCup,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getDashboardStats(userId) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-indexed
  
  // Dates for current month
  const startCurrentMonth = new Date(currentYear, currentMonth, 1).toISOString()
  const endCurrentMonth = new Date(currentYear, currentMonth + 1, 1).toISOString()
  
  // Dates for previous month
  const startPrevMonth = new Date(currentYear, currentMonth - 1, 1).toISOString()
  const endPrevMonth = new Date(currentYear, currentMonth, 1).toISOString()

  // Fetch balance
  const balanceConfig = await getBalanceConfig(userId)
  
  // Fetch transactions for current and previous month
  const { data: currentMonthData, error: currentError } = await supabase
    .from('transactions')
    .select('amount, type, currency')
    .eq('user_id', userId)
    .gte('date', startCurrentMonth)
    .lt('date', endCurrentMonth)

  const { data: prevMonthData, error: prevError } = await supabase
    .from('transactions')
    .select('amount, type, currency')
    .eq('user_id', userId)
    .gte('date', startPrevMonth)
    .lt('date', endPrevMonth)

  if (currentError || prevError) {
    console.error('Error fetching dashboard stats:', currentError || prevError)
    throw currentError || prevError
  }

  const sumAmounts = (transactions, type, currency) => {
    return transactions
      .filter(t => t.type === type && t.currency === currency)
      .reduce((acc, t) => acc + Number(t.amount), 0)
  }

  const currentIncomeUsd = sumAmounts(currentMonthData, 'income', 'USD')
  const currentIncomeCup = sumAmounts(currentMonthData, 'income', 'CUP')
  const currentExpenseUsd = sumAmounts(currentMonthData, 'expense', 'USD')
  const currentExpenseCup = sumAmounts(currentMonthData, 'expense', 'CUP')

  const prevIncomeUsd = sumAmounts(prevMonthData, 'income', 'USD')
  const prevIncomeCup = sumAmounts(prevMonthData, 'income', 'CUP')
  const prevExpenseUsd = sumAmounts(prevMonthData, 'expense', 'USD')
  const prevExpenseCup = sumAmounts(prevMonthData, 'expense', 'CUP')

  const calculateChange = (current, prev) => {
    if (prev === 0) return null // Hide percentage if no previous data
    return ((current - prev) / prev) * 100
  }

  return {
    balance: {
      usd: balanceConfig?.balance_total_usd || 0,
      cup: balanceConfig?.balance_total_cup || 0
    },
    income: {
      current: { usd: currentIncomeUsd, cup: currentIncomeCup },
      change: { 
        usd: calculateChange(currentIncomeUsd, prevIncomeUsd),
        cup: calculateChange(currentIncomeCup, prevIncomeCup)
      }
    },
    expense: {
      current: { usd: currentExpenseUsd, cup: currentExpenseCup },
      change: { 
        usd: calculateChange(currentExpenseUsd, prevExpenseUsd),
        cup: calculateChange(currentExpenseCup, prevExpenseCup)
      }
    }
  }
}

export async function getRecentActivity(userId) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('date', thirtyDaysAgo.toISOString())
    .order('date', { ascending: false })
  
  if (error) throw error
  
  return data
}

/**
 * Obtiene la distribución financiera por categoría, moneda y tipo de transacción
 * @param {string} userId - ID del usuario
 * @param {string} type - 'income' | 'expense' | 'all' 
 * @param {string} currency - 'USD' | 'CUP' | 'all'
 * @returns {Promise<Array>} Array de objetos { name, value, type, currency }
 */
export async function getFinancialDistribution(userId, type = 'all', currency = 'all') {
  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

  let query = supabase
    .from('transactions')
    .select('category, amount, currency, type')
    .eq('user_id', userId)
    .gte('date', startMonth)
    .lt('date', endMonth)

  // Filtrar por tipo si no es 'all'
  if (type !== 'all') {
    query = query.eq('type', type)
  }

  // Filtrar por moneda si no es 'all'
  if (currency !== 'all') {
    query = query.eq('currency', currency)
  }

  const { data, error } = await query

  if (error) throw error

  // Agrupar por categoría, tipo y moneda
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
