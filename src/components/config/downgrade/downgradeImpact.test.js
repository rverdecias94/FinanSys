import { describe, it, expect } from 'vitest'
import { buildDowngradeImpact, canDowngradeToFree } from './downgradeImpact'

describe('canDowngradeToFree', () => {
  it('permite Negocio y Élite', () => {
    expect(canDowngradeToFree('premium')).toBe(true)
    expect(canDowngradeToFree('ultra')).toBe(true)
  })

  it('bloquea Inicial y valores inválidos', () => {
    expect(canDowngradeToFree('free')).toBe(false)
    expect(canDowngradeToFree(null)).toBe(false)
    expect(canDowngradeToFree('')).toBe(false)
  })
})

describe('buildDowngradeImpact', () => {
  const freeLimits = {
    currencies: 1,
    areas: 1,
    monthly_transactions: 150,
    products: 50,
    partners: 0,
  }

  it('marca pérdida de equipo y funciones AI al bajar desde Élite con uso alto', () => {
    const impact = buildDowngradeImpact({
      usage: {
        active_currencies: 3,
        partners: 4,
        areas: 8,
        products: 80,
        monthly_transactions: 20,
      },
      freeLimits,
      featuresLost: ['ai_tools', 'audit_logs', 'reports_export'],
    })

    expect(impact.lossesCount).toBeGreaterThanOrEqual(3)
    const partners = impact.items.find((i) => i.id === 'partners')
    expect(partners.severity).toBe('loss')
    expect(partners.detail).toMatch(/4 miembros/)

    const currencies = impact.items.find((i) => i.id === 'currencies')
    expect(currencies.severity).toBe('restrict')

    const areas = impact.items.find((i) => i.id === 'areas')
    expect(areas.severity).toBe('restrict')
    expect(areas.detail).toMatch(/solo lectura/i)

    const products = impact.items.find((i) => i.id === 'products')
    expect(products.severity).toBe('restrict')
    expect(products.detail).toMatch(/80/)

    const features = impact.items.find((i) => i.id === 'features')
    expect(features.severity).toBe('loss')
    expect(features.badges.join(' ')).toMatch(/Copiloto|Auditoría|Exportación/i)
  })

  it('marca OK cuando el uso cabe en Inicial', () => {
    const impact = buildDowngradeImpact({
      usage: {
        active_currencies: 1,
        partners: 0,
        areas: 1,
        products: 10,
        monthly_transactions: 5,
      },
      freeLimits,
      featuresLost: [],
    })

    expect(impact.items.filter((i) => i.id !== 'features').every((i) => i.severity === 'ok')).toBe(true)
  })

  it('alerta transacciones si ya está en el tope de Inicial', () => {
    const impact = buildDowngradeImpact({
      usage: {
        active_currencies: 1,
        partners: 0,
        areas: 1,
        products: 10,
        monthly_transactions: 150,
      },
      freeLimits,
      featuresLost: [],
    })
    const tx = impact.items.find((i) => i.id === 'monthly_transactions')
    expect(tx.severity).toBe('restrict')
  })
})
