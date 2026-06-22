import { describe, it, expect } from 'vitest'
import { buildCashFlow, buildPosition, cashFlowToExportRows, positionToExportRows } from './financials'

describe('utils/financials — Flujo de Efectivo (Q5)', () => {
  it('arma entradas/salidas/neto por moneda y ordena', () => {
    const totals = { income: { USD: 250, CUP: 13000 }, expense: { USD: 145, CUP: 52365 } }
    expect(buildCashFlow(totals)).toEqual([
      { currency: 'CUP', inflow: 13000, outflow: 52365, net: 13000 - 52365 },
      { currency: 'USD', inflow: 250, outflow: 145, net: 105 },
    ])
  })

  it('incluye monedas que solo tienen entradas o solo salidas', () => {
    const rows = buildCashFlow({ income: { EUR: 100 }, expense: { MXN: 50 } })
    expect(rows.map((r) => r.currency)).toEqual(['EUR', 'MXN'])
    expect(rows.find((r) => r.currency === 'EUR')).toMatchObject({ inflow: 100, outflow: 0, net: 100 })
    expect(rows.find((r) => r.currency === 'MXN')).toMatchObject({ inflow: 0, outflow: 50, net: -50 })
  })

  it('totales vacíos o nulos -> []', () => {
    expect(buildCashFlow({})).toEqual([])
    expect(buildCashFlow(null)).toEqual([])
  })
})

describe('utils/financials — Posición (Q5)', () => {
  it('caja real = saldo - por cobrar + por pagar (saldo devengado, datos reales del owner)', () => {
    const balances = [{ currency_code: 'CUP', current_balance: 236135 }, { currency_code: 'USD', current_balance: 1225 }]
    const receivable = [{ currency: 'CUP', total: 5000 }]
    const payable = [{ currency: 'CUP', total: 15000 }]
    const pos = buildPosition(balances, receivable, payable)
    expect(pos.find((p) => p.currency === 'CUP')).toEqual({ currency: 'CUP', saldo: 236135, porCobrar: 5000, porPagar: 15000, caja: 246135 })
    expect(pos.find((p) => p.currency === 'USD')).toMatchObject({ saldo: 1225, porCobrar: 0, porPagar: 0, caja: 1225 })
  })

  it('maneja numeric como string y monedas sin saldo', () => {
    const pos = buildPosition([{ currency_code: 'CUP', current_balance: '100.00' }], [{ currency: 'EUR', total: '30' }], [])
    expect(pos.find((p) => p.currency === 'CUP')).toMatchObject({ saldo: 100, caja: 100 })
    expect(pos.find((p) => p.currency === 'EUR')).toMatchObject({ saldo: 0, porCobrar: 30, caja: -30 })
  })

  it('omite monedas sin nada (saldo, por cobrar y por pagar en 0)', () => {
    const balances = [
      { currency_code: 'CUP', current_balance: 100 },
      { currency_code: 'EUR', current_balance: 0 },
      { currency_code: 'MXN', current_balance: 0 },
    ]
    expect(buildPosition(balances, [], []).map((p) => p.currency)).toEqual(['CUP'])
  })

  it('sin datos -> []', () => {
    expect(buildPosition([], [], [])).toEqual([])
    expect(buildPosition(null, null, null)).toEqual([])
  })
})

describe('utils/financials — export', () => {
  it('cashFlowToExportRows aplana', () => {
    expect(cashFlowToExportRows([{ currency: 'USD', inflow: 250, outflow: 145, net: 105 }])[0])
      .toEqual({ Moneda: 'USD', Entradas: 250, Salidas: 145, 'Flujo neto': 105 })
  })

  it('positionToExportRows aplana', () => {
    expect(positionToExportRows([{ currency: 'CUP', saldo: 236135, porCobrar: 5000, porPagar: 15000, caja: 246135 }])[0])
      .toEqual({ Moneda: 'CUP', 'Saldo registrado': 236135, 'Por cobrar': 5000, 'Por pagar': 15000, 'Caja real hoy': 246135 })
  })
})
