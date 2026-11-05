import { describe, it, expect } from 'vitest'
import {
  buildSaleStockPaymentRows,
  summarizeReconcile,
  describeFxReportingStatus,
  RECONCILE_STATUS,
} from './reconcileMetrics'

describe('reconcileMetrics E7', () => {
  it('clasifica venta entregada y cobrada como conciliado', () => {
    const rows = buildSaleStockPaymentRows({
      transactions: [
        { id: 1, type: 'income', amount: 100, currency: 'USD', paid_amount: 100, date: '2026-01-10' },
      ],
      movements: [
        { id: 9, type: 'out', qty: 2, unit_cost: 20, transaction_id: 1 },
      ],
      payments: [{ transaction_id: 1, amount: 100 }],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe(RECONCILE_STATUS.CONCILIADO)
    expect(rows[0].inventoryCost).toBe(40)
    expect(rows[0].receivable).toBe(0)
    expect(rows[0].paymentSource).toBe('ledger')
  })

  it('detecta parcial, sin entrega y cobrado sin stock', () => {
    const rows = buildSaleStockPaymentRows({
      transactions: [
        { id: 1, type: 'income', amount: 80, currency: 'CUP', paid_amount: 50 },
        { id: 2, type: 'income', amount: 30, currency: 'CUP', paid_amount: 0 },
        { id: 3, type: 'income', amount: 40, currency: 'CUP', paid_amount: 40 },
      ],
      movements: [{ id: 1, type: 'out', qty: 1, unit_cost: 10, transaction_id: 1 }],
      payments: [{ transaction_id: 1, amount: 50 }],
    })
    expect(rows.find((r) => r.transactionId === 1).status).toBe(RECONCILE_STATUS.PARCIAL)
    expect(rows.find((r) => r.transactionId === 2).status).toBe(RECONCILE_STATUS.SIN_ENTREGA)
    expect(rows.find((r) => r.transactionId === 3).status).toBe(RECONCILE_STATUS.COBRADO_SIN_ENTREGA)
  })

  it('inventoryCost N/D si falta unit_cost', () => {
    const [row] = buildSaleStockPaymentRows({
      transactions: [{ id: 5, type: 'income', amount: 10, currency: 'USD', paid_amount: 0 }],
      movements: [{ id: 1, type: 'out', qty: 1, unit_cost: null, transaction_id: 5 }],
      payments: [],
    })
    expect(row.inventoryCost).toBeNull()
    expect(row.inventoryCostAvailable).toBe(false)
    expect(row.status).toBe(RECONCILE_STATUS.SIN_COBRO)
  })

  it('summarize y FX no consolidable', () => {
    const rows = buildSaleStockPaymentRows({
      transactions: [
        { id: 1, type: 'income', amount: 10, currency: 'USD', paid_amount: 10 },
        { id: 2, type: 'income', amount: 5, currency: 'CUP', paid_amount: 0 },
      ],
      movements: [{ type: 'out', qty: 1, unit_cost: 1, transaction_id: 1 }],
      payments: [{ transaction_id: 1, amount: 10 }],
    })
    const sum = summarizeReconcile(rows)
    expect(sum.total).toBe(2)
    expect(sum.fullyCollected).toBe(1)

    const fx = describeFxReportingStatus([
      { currency: 'USD', fx_units_per_base: 24 },
      { currency: 'CUP', fx_units_per_base: null },
    ])
    expect(fx.consolidatable).toBe(false)
    expect(fx.distinctCurrencies).toEqual(expect.arrayContaining(['USD', 'CUP']))
    expect(fx.note).toMatch(/no|N\/A|consolid/i)
  })
})
