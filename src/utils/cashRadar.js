/**
 * Proyección de caja determinista (sin IA / sin APIs de pago).
 * Combina: saldo actual + recurrentes activas + CxC/CxP por vencimiento.
 */

export function roundMoney(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.round(v * 100) / 100
}

function toDateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateOnly(iso) {
  if (!iso) return null
  const s = String(iso).slice(0, 10)
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + n)
  return d
}

function advanceRecurring(date, frequency) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'biweekly') d.setDate(d.getDate() + 14)
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1)
  return d
}

function openBalance(row) {
  const amount = Number(row?.amount || 0)
  const paid = Number(row?.paid_amount || 0)
  return roundMoney(Math.max(0, amount - paid))
}

/**
 * Genera ocurrencias de una plantilla recurrente dentro de [start, end] inclusive.
 */
export function expandRecurringOccurrences(recurring, startDate, endDate) {
  const out = []
  if (!recurring?.is_active) return out
  let cursor = parseDateOnly(recurring.next_run)
  if (!cursor) return out
  const endLimit = parseDateOnly(recurring.end_date)
  const horizonEnd = endDate
  // Evitar bucles infinitos
  let guard = 0
  while (cursor <= horizonEnd && guard < 400) {
    guard += 1
    if (endLimit && cursor > endLimit) break
    if (cursor >= startDate) {
      out.push({
        date: toDateKey(cursor),
        type: recurring.type,
        amount: roundMoney(recurring.amount),
        currency: String(recurring.currency || 'USD').toUpperCase(),
        label: recurring.description || recurring.category || 'Recurrente',
        source: 'recurring',
        id: recurring.id,
      })
    }
    cursor = advanceRecurring(cursor, recurring.frequency)
  }
  return out
}

/**
 * Agenda CxC/CxP abiertas. Vencidas o sin fecha → día de inicio (hoy).
 */
export function scheduleOpenAccounts(accounts, startDate, direction) {
  const startKey = toDateKey(startDate)
  return (accounts || [])
    .map((row) => {
      const remaining = openBalance(row)
      if (remaining <= 0) return null
      const due = parseDateOnly(row.due_date)
      let dateKey = startKey
      if (due && due >= startDate) dateKey = toDateKey(due)
      const contact = row.contact?.name || row.description || 'Cuenta'
      return {
        date: dateKey,
        type: direction === 'receivable' ? 'income' : 'expense',
        amount: remaining,
        currency: String(row.currency || 'USD').toUpperCase(),
        label: contact,
        source: direction,
        id: row.id,
        overdue: !due || due < startDate,
      }
    })
    .filter(Boolean)
}

/**
 * @param {object} input
 * @param {Record<string, number>} input.balances
 * @param {string} input.baseCurrency
 * @param {number} input.horizonDays - 15 | 30 | 60 | 90
 * @param {Array} input.recurring
 * @param {Array} input.receivables
 * @param {Array} input.payables
 * @param {Array} [input.lowStock]
 * @param {Date} [input.today]
 */
export function buildCashRadar(input) {
  const today = input.today
    ? new Date(input.today.getFullYear(), input.today.getMonth(), input.today.getDate())
    : (() => {
        const n = new Date()
        return new Date(n.getFullYear(), n.getMonth(), n.getDate())
      })()

  const horizonDays = [15, 30, 60, 90].includes(Number(input.horizonDays))
    ? Number(input.horizonDays)
    : 30
  const endDate = addDays(today, horizonDays)
  const baseCurrency = String(input.baseCurrency || 'USD').toUpperCase()

  const recvEvents = scheduleOpenAccounts(input.receivables || [], today, 'receivable')
    .filter((e) => e.currency === baseCurrency)
  const payEvents = scheduleOpenAccounts(input.payables || [], today, 'payable')
    .filter((e) => e.currency === baseCurrency)
  const events = [
    ...expandRecurringOccurrencesList(input.recurring || [], today, endDate),
    ...recvEvents,
    ...payEvents,
  ].filter((e) => e.currency === baseCurrency)

  // Agregar por día
  const byDay = new Map()
  for (let i = 0; i <= horizonDays; i++) {
    const d = addDays(today, i)
    byDay.set(toDateKey(d), { inflow: 0, outflow: 0, events: [] })
  }
  for (const ev of events) {
    const bucket = byDay.get(ev.date)
    if (!bucket) continue
    if (ev.type === 'income') bucket.inflow = roundMoney(bucket.inflow + ev.amount)
    else bucket.outflow = roundMoney(bucket.outflow + ev.amount)
    bucket.events.push(ev)
  }

  // En GESTIA el trigger de saldo mueve business_balances también con pending/partial.
  // Para el Radar, la "caja usable hoy" resta CxC abiertas y suma CxP abiertas,
  // y esas mismas cuentas se proyectan en su fecha de vencimiento (sin doble conteo).
  const openRecvTotal = roundMoney(recvEvents.reduce((s, e) => s + e.amount, 0))
  const openPayTotal = roundMoney(payEvents.reduce((s, e) => s + e.amount, 0))
  const ledgerBalance = roundMoney(Number(input.balances?.[baseCurrency] || 0))
  let balance = roundMoney(ledgerBalance - openRecvTotal + openPayTotal)
  const startBalance = balance
  const ledgerBalanceRaw = ledgerBalance
  const series = []
  let minBalance = balance
  let minBalanceDay = toDateKey(today)
  let firstNegativeDay = null
  let totalIn = 0
  let totalOut = 0

  for (let i = 0; i <= horizonDays; i++) {
    const d = addDays(today, i)
    const key = toDateKey(d)
    const bucket = byDay.get(key) || { inflow: 0, outflow: 0, events: [] }
    balance = roundMoney(balance + bucket.inflow - bucket.outflow)
    totalIn = roundMoney(totalIn + bucket.inflow)
    totalOut = roundMoney(totalOut + bucket.outflow)
    if (balance < minBalance) {
      minBalance = balance
      minBalanceDay = key
    }
    if (firstNegativeDay == null && balance < 0) firstNegativeDay = key
    series.push({
      date: key,
      label: i === 0 ? 'Hoy' : `${d.getDate()}/${d.getMonth() + 1}`,
      balance,
      inflow: bucket.inflow,
      outflow: bucket.outflow,
      dayIndex: i,
    })
  }

  const endBalance = series[series.length - 1]?.balance ?? startBalance

  // Acciones priorizadas
  const actions = []
  const overdueRecv = (input.receivables || [])
    .map((r) => ({ ...r, remaining: openBalance(r), due: parseDateOnly(r.due_date) }))
    .filter((r) => r.remaining > 0 && String(r.currency || '').toUpperCase() === baseCurrency)
    .filter((r) => !r.due || r.due < today)
    .sort((a, b) => b.remaining - a.remaining)
    .slice(0, 5)

  for (const r of overdueRecv) {
    actions.push({
      id: `cxc-${r.id}`,
      kind: 'collect',
      severity: 'high',
      title: `Cobrar ${r.contact?.name || r.description || 'cliente'}`,
      detail: `Vencido · ${roundMoney(r.remaining)} ${baseCurrency}`,
      href: '/cuentas',
      amount: r.remaining,
    })
  }

  const upcomingPay = (input.payables || [])
    .map((r) => ({ ...r, remaining: openBalance(r), due: parseDateOnly(r.due_date) }))
    .filter((r) => r.remaining > 0 && String(r.currency || '').toUpperCase() === baseCurrency)
    .filter((r) => r.due && r.due >= today && r.due <= endDate)
    .sort((a, b) => (a.due - b.due) || b.remaining - a.remaining)
    .slice(0, 5)

  for (const r of upcomingPay) {
    actions.push({
      id: `cxp-${r.id}`,
      kind: 'pay',
      severity: 'medium',
      title: `Pagar ${r.contact?.name || r.description || 'proveedor'}`,
      detail: `Vence ${toDateKey(r.due)} · ${roundMoney(r.remaining)} ${baseCurrency}`,
      href: '/cuentas',
      amount: r.remaining,
    })
  }

  for (const p of (input.lowStock || []).slice(0, 5)) {
    actions.push({
      id: `stock-${p.id || p.name}`,
      kind: 'stock',
      severity: 'medium',
      title: `Reponer ${p.name}`,
      detail: `Stock ${Number(p.stock)} · mínimo ${Number(p.min_stock ?? 5)}`,
      href: '/almacen',
    })
  }

  if (firstNegativeDay) {
    actions.unshift({
      id: 'cash-dip',
      kind: 'cash',
      severity: 'critical',
      title: 'Caja proyectada en negativo',
      detail: `Primera fecha crítica: ${firstNegativeDay}. Revisa cobros o aplaza pagos.`,
      href: '/finanzas',
    })
  }

  return {
    baseCurrency,
    horizonDays,
    startBalance,
    endBalance,
    minBalance,
    minBalanceDay,
    firstNegativeDay,
    totalIn,
    totalOut,
    series,
    actions,
    eventCount: events.length,
    openRecvTotal,
    openPayTotal,
    ledgerBalance: ledgerBalanceRaw,
    generatedAt: new Date().toISOString(),
  }
}

function expandRecurringOccurrencesList(list, startDate, endDate) {
  const all = []
  for (const r of list) {
    all.push(...expandRecurringOccurrences(r, startDate, endDate))
  }
  return all
}
