import { describe, it, expect } from 'vitest'
import {
  buildRecordedCashFlow,
  buildRecordedFlowFromTotals,
  buildSettledCashFlow,
  cashFlowRowsToExport,
} from './cashMetrics'
import { classifyTransaction, isCashAtCreation, openBalance } from './cashRules'
import { expensesByCategoryPerCurrency, topExpensesRowsPerCurrency } from './categoryMetrics'
import { buildOpenAccountRows } from './openAccountsMetrics'

describe('cashRules — clasificación', () => {
  it('pending/partial usan saldo abierto amount - paid_amount', () => {
    expect(openBalance({ amount: 100, paid_amount: 30 })).toBe(70)
    expect(classifyTransaction({ type: 'income', status: 'pending', amount: 100, paid_amount: 0 }).kind).toBe('pending')
    expect(classifyTransaction({ type: 'expense', status: 'partial', amount: 100, paid_amount: 40 }).kind).toBe('partial')
  })

  it('paid sin ledger = cash_at_creation; paid con ledger = paid_via_ledger', () => {
    const tx = { type: 'income', status: 'paid', amount: 50, paid_amount: 50, id: 1 }
    expect(isCashAtCreation(tx, 0)).toBe(true)
    expect(classifyTransaction(tx, 0).kind).toBe('cash_at_creation')
    expect(isCashAtCreation(tx, 1)).toBe(false)
    expect(classifyTransaction(tx, 1).kind).toBe('paid_via_ledger')
  })

  it('transfer no es flujo de caja', () => {
    expect(classifyTransaction({ type: 'transfer', amount: 999, status: 'paid' }).kind).toBe('transfer')
  })
})

describe('buildRecordedCashFlow', () => {
  it('suma amount completo (incl. pendientes) por moneda e ignora transfer', () => {
    const rows = buildRecordedCashFlow([
      { type: 'income', amount: 100, currency: 'USD', status: 'pending', paid_amount: 0 },
      { type: 'income', amount: 50, currency: 'USD', status: 'paid', paid_amount: 50 },
      { type: 'expense', amount: 20, currency: 'USD', status: 'paid', paid_amount: 20 },
      { type: 'income', amount: 1000, currency: 'CUP', status: 'paid', paid_amount: 1000 },
      { type: 'transfer', amount: 999, currency: 'USD', status: 'paid' },
    ])
    expect(rows.find((r) => r.currency === 'USD')).toEqual({
      currency: 'USD', inflow: 150, outflow: 20, net: 130,
    })
    expect(rows.find((r) => r.currency === 'CUP')).toEqual({
      currency: 'CUP', inflow: 1000, outflow: 0, net: 1000,
    })
  })

  it('buildRecordedFlowFromTotals preserva contrato de buildCashFlow', () => {
    expect(buildRecordedFlowFromTotals({ income: { USD: 250, CUP: 10 }, expense: { USD: 145 } })).toEqual([
      { currency: 'CUP', inflow: 10, outflow: 0, net: 10 },
      { currency: 'USD', inflow: 250, outflow: 145, net: 105 },
    ])
  })
})

describe('buildSettledCashFlow — anti doble conteo', () => {
  const period = { from: '2026-01-01T00:00:00.000Z', to: '2026-01-31T23:59:59.999Z' }

  it('contado sin ledger cuenta por date; pendiente no cuenta', () => {
    const transactions = [
      { id: 1, type: 'income', amount: 100, currency: 'USD', status: 'paid', paid_amount: 100, date: '2026-01-10' },
      { id: 2, type: 'income', amount: 80, currency: 'USD', status: 'pending', paid_amount: 0, date: '2026-01-11' },
      { id: 3, type: 'expense', amount: 30, currency: 'USD', status: 'paid', paid_amount: 30, date: '2026-01-12' },
    ]
    const rows = buildSettledCashFlow({
      transactions,
      payments: [],
      paymentCountsByTx: { 1: 0, 2: 0, 3: 0 },
      period,
    })
    expect(rows).toEqual([{ currency: 'USD', inflow: 100, outflow: 30, net: 70 }])
  })

  it('parcial: solo abonos del período; no suma amount ni paid_amount', () => {
    const transactions = [
      { id: 10, type: 'income', amount: 500, currency: 'USD', status: 'partial', paid_amount: 200, date: '2026-01-01' },
    ]
    const payments = [
      { transaction_id: 10, amount: 150, paid_at: '2026-01-15' },
      { transaction_id: 10, amount: 50, paid_at: '2026-01-20' },
    ]
    const rows = buildSettledCashFlow({
      transactions,
      payments,
      paymentCountsByTx: { 10: 2 },
      period,
    })
    // 200 liquidados vía abonos; NUNCA 500 ni 200+200
    expect(rows).toEqual([{ currency: 'USD', inflow: 200, outflow: 0, net: 200 }])
  })

  it('paid vía ledger: no vuelve a sumar amount aunque status=paid', () => {
    const transactions = [
      { id: 7, type: 'expense', amount: 100, currency: 'CUP', status: 'paid', paid_amount: 100, date: '2026-01-05' },
    ]
    const payments = [
      { transaction_id: 7, amount: 40, paid_at: '2026-01-10' },
      { transaction_id: 7, amount: 60, paid_at: '2026-01-18' },
    ]
    const rows = buildSettledCashFlow({
      transactions,
      payments,
      paymentCountsByTx: { 7: 2 },
      period,
    })
    expect(rows).toEqual([{ currency: 'CUP', inflow: 0, outflow: 100, net: -100 }])
  })

  it('cobro en marzo de venta de enero: settled solo en marzo', () => {
    const tx = { id: 9, type: 'income', amount: 100, currency: 'USD', status: 'partial', paid_amount: 100, date: '2026-01-05' }
    const pay = { transaction_id: 9, amount: 100, paid_at: '2026-03-10' }
    const jan = buildSettledCashFlow({
      transactions: [tx],
      payments: [], // abono fuera de enero
      paymentCountsByTx: { 9: 1 },
      period: { from: '2026-01-01', to: '2026-01-31T23:59:59.999Z' },
    })
    const mar = buildSettledCashFlow({
      transactions: [tx],
      payments: [pay],
      paymentCountsByTx: { 9: 1 },
      period: { from: '2026-03-01', to: '2026-03-31T23:59:59.999Z' },
    })
    expect(jan).toEqual([])
    expect(mar).toEqual([{ currency: 'USD', inflow: 100, outflow: 0, net: 100 }])
  })

  it('no mezcla monedas', () => {
    const rows = buildSettledCashFlow({
      transactions: [
        { id: 1, type: 'income', amount: 10, currency: 'USD', status: 'paid', paid_amount: 10, date: '2026-01-02' },
        { id: 2, type: 'income', amount: 500, currency: 'CUP', status: 'paid', paid_amount: 500, date: '2026-01-03' },
      ],
      payments: [],
      paymentCountsByTx: { 1: 0, 2: 0 },
      period,
    })
    expect(rows.map((r) => r.currency)).toEqual(['CUP', 'USD'])
    expect(rows.find((r) => r.currency === 'USD').inflow).toBe(10)
    expect(rows.find((r) => r.currency === 'CUP').inflow).toBe(500)
  })
})

describe('categoryMetrics', () => {
  it('top gastos por moneda (CUP 500 no “gana” a USD 10 en ranking global)', () => {
    const txs = [
      { type: 'expense', amount: 10, currency: 'USD', category: 'Software' },
      { type: 'expense', amount: 500, currency: 'CUP', category: 'Transporte' },
      { type: 'expense', amount: 5, currency: 'USD', category: 'Cafe' },
    ]
    const byCur = expensesByCategoryPerCurrency(txs, { topN: 5 })
    expect(byCur.USD[0]).toEqual({ category: 'Software', amount: 10 })
    expect(byCur.CUP[0]).toEqual({ category: 'Transporte', amount: 500 })
    const flat = topExpensesRowsPerCurrency(txs, 5)
    expect(flat.filter((r) => r.currency === 'USD').map((r) => r.category)).toEqual(['Software', 'Cafe'])
  })
})

describe('openAccountsMetrics', () => {
  it('arma filas CxC con saldo abierto', () => {
    const rows = buildOpenAccountRows([
      { id: 1, type: 'income', status: 'partial', amount: 100, paid_amount: 25, currency: 'USD', contact: { name: 'Ana' }, category: 'Ventas' },
      { id: 2, type: 'income', status: 'paid', amount: 50, paid_amount: 50, currency: 'USD' },
      { id: 3, type: 'expense', status: 'pending', amount: 40, paid_amount: 0, currency: 'USD' },
    ], 'receivable')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ contactName: 'Ana', openBalance: 75, paidAmount: 25 })
  })
})

describe('cashFlowRowsToExport', () => {
  it('etiquetas según base', () => {
    const row = { currency: 'USD', inflow: 1, outflow: 2, net: -1 }
    expect(cashFlowRowsToExport([row], 'recorded')[0]['Flujo neto registrado']).toBe(-1)
    expect(cashFlowRowsToExport([row], 'settled')[0]['Flujo neto liquidado']).toBe(-1)
  })
})
