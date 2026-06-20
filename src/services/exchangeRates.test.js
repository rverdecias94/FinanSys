import { describe, it, expect } from 'vitest'
import { convertToBase, consolidatePerCurrency } from './exchangeRates'

describe('exchangeRates helpers', () => {
  const base = 'USD'
  // CUP válida (1 USD = 420 CUP); MLC con tasa inválida (<=0) para probar el guard.
  const rates = { CUP: { units_per_base: 420 }, MLC: { units_per_base: 0 } }

  it('la moneda base se devuelve sin convertir', () => {
    expect(convertToBase(100, 'USD', base, rates)).toBe(100)
  })

  it('otra moneda se divide por units_per_base', () => {
    expect(convertToBase(4200, 'CUP', base, rates)).toBeCloseTo(10, 6)
  })

  it('sin tasa (o tasa <= 0) devuelve null', () => {
    expect(convertToBase(100, 'EUR', base, rates)).toBeNull()
    expect(convertToBase(100, 'MLC', base, rates)).toBeNull()
  })

  it('consolida a la base y reporta las monedas sin tasa', () => {
    const r = consolidatePerCurrency({ USD: 50, CUP: 4200, EUR: 30 }, base, rates)
    expect(r.total).toBeCloseTo(60, 6) // 50 (USD) + 4200/420 = 10  → 60; EUR sin tasa
    expect(r.missing).toEqual(['EUR'])
  })

  it('ignora montos en cero (no los cuenta como faltantes)', () => {
    const r = consolidatePerCurrency({ USD: 100, EUR: 0 }, base, rates)
    expect(r.total).toBe(100)
    expect(r.missing).toEqual([])
  })
})
