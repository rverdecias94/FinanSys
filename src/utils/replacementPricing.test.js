import { describe, expect, it } from 'vitest'
import { computeReplacementPricing, sodaFixture } from './replacementPricing'

describe('computeReplacementPricing — caso refrescos (venta en CUP)', () => {
  const f = sodaFixture()

  it('a R0=800 sugiere 1000 CUP con margen 25%', () => {
    const r = computeReplacementPricing({
      avgCost: f.unitCostCupAtR0,
      productCurrency: 'CUP',
      baseCurrency: 'USD',
      purchaseRate: f.r0,
      currentRate: f.r0,
      marginPct: f.marginPct,
      unitPrice: f.suggestedAtR0,
      isForSale: true,
    })
    expect(r.ok).toBe(true)
    expect(r.currency).toBe('CUP')
    expect(r.replacement).toBe(800)
    expect(r.suggested).toBe(1000)
    expect(r.atRisk).toBe(false)
  })

  it('a R1=1000 con precio 1000 queda en riesgo; sugerido 1250 CUP', () => {
    const r = computeReplacementPricing({
      avgCost: f.unitCostCupAtR0,
      productCurrency: 'CUP',
      baseCurrency: 'USD',
      purchaseRate: f.r0,
      currentRate: f.r1,
      marginPct: f.marginPct,
      unitPrice: 1000,
    })
    expect(r.replacement).toBe(1000)
    expect(r.suggested).toBe(1250)
    expect(r.currency).toBe('CUP')
    expect(r.atRisk).toBe(true)
    expect(r.gap).toBe(250)
  })
})

describe('computeReplacementPricing — producto en USD', () => {
  it('NO compara USD contra CUP ni sugiere millones de CUP', () => {
    const r = computeReplacementPricing({
      avgCost: 5,
      productCurrency: 'USD',
      baseCurrency: 'USD',
      quoteCurrency: 'CUP',
      purchaseRate: 800,
      currentRate: 467.5,
      marginPct: 25,
      unitPrice: 5,
    })
    expect(r.ok).toBe(true)
    expect(r.currency).toBe('USD')
    expect(r.replacement).toBe(5)
    expect(r.suggested).toBe(6.25)
    expect(r.atRisk).toBe(true)
    // Equivalencia informativa, no es el precio a aplicar
    expect(r.cupEquivalent).toBe(roundCup(6.25 * 467.5))
  })

  it('si el precio USD ya cubre costo+margen, no está en riesgo', () => {
    const r = computeReplacementPricing({
      avgCost: 5,
      productCurrency: 'USD',
      baseCurrency: 'USD',
      currentRate: 1000,
      quoteCurrency: 'CUP',
      marginPct: 25,
      unitPrice: 10,
    })
    expect(r.atRisk).toBe(false)
    expect(r.suggested).toBe(6.25)
  })
})

describe('computeReplacementPricing — uso interno', () => {
  it('no sugiere venta si isForSale=false', () => {
    const r = computeReplacementPricing({
      avgCost: 800,
      productCurrency: 'CUP',
      baseCurrency: 'USD',
      purchaseRate: 800,
      currentRate: 1000,
      marginPct: 25,
      unitPrice: 1000,
      isForSale: false,
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('not_for_sale')
    expect(r.atRisk).toBe(false)
  })

  it('sin precio de venta (>0) no inventa riesgo', () => {
    const r = computeReplacementPricing({
      avgCost: 800,
      productCurrency: 'CUP',
      baseCurrency: 'USD',
      purchaseRate: 800,
      currentRate: 1000,
      unitPrice: 0,
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('no_sale_price')
  })
})

function roundCup(n) {
  return Math.round(n * 100) / 100
}
