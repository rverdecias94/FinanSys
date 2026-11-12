import { describe, it, expect } from 'vitest'
import {
  fxCupLabel,
  fxCupDisplayFromRates,
  fxCupStoredFromDisplay,
  fxCupNeedsBaseCupRate,
  fxCupPromptCurrencies,
  fxCupStorageCodesForCheck,
} from './fxPrompt'

describe('fx CUP-centric', () => {
  it('labels siempre vs CUP', () => {
    expect(fxCupLabel('USD')).toBe('1 USD = ¿cuántos CUP?')
    expect(fxCupLabel('EUR')).toBe('1 EUR = ¿cuántos CUP?')
    expect(fxCupLabel('MLC')).toBe('1 MLC = ¿cuántos CUP?')
  })

  it('lista monedas a preguntar (sin CUP)', () => {
    expect(fxCupPromptCurrencies('USD', ['USD', 'CUP', 'EUR'])).toEqual(['USD', 'EUR'])
    expect(fxCupPromptCurrencies('CUP', ['CUP', 'USD'])).toEqual(['USD'])
  })

  it('base CUP: 1 USD = 400 CUP ↔ units USD = 0.0025', () => {
    expect(fxCupDisplayFromRates('USD', 'CUP', { USD: { units_per_base: 0.0025 } })).toBe('400')
    expect(fxCupStoredFromDisplay('USD', 'CUP', '400', {})).toEqual({
      currency_code: 'USD',
      units_per_base: 0.0025,
    })
  })

  it('base USD: 1 USD = 800 CUP se guarda en fila CUP', () => {
    expect(fxCupDisplayFromRates('USD', 'USD', { CUP: { units_per_base: 800 } })).toBe('800')
    expect(fxCupStoredFromDisplay('USD', 'USD', '800', {})).toEqual({
      currency_code: 'CUP',
      units_per_base: 800,
    })
  })

  it('base USD + EUR: cruza por CUP', () => {
    const rates = { CUP: { units_per_base: 400 }, EUR: { units_per_base: 0.9 } }
    // CUP/EUR = 400 / 0.9 ≈ 444.444…
    expect(Number(fxCupDisplayFromRates('EUR', 'USD', rates))).toBeCloseTo(400 / 0.9, 5)
    // 1 EUR = 450 CUP → EUR por USD = 400/450
    expect(fxCupStoredFromDisplay('EUR', 'USD', '450', rates)).toEqual({
      currency_code: 'EUR',
      units_per_base: Math.round((400 / 450) * 1e12) / 1e12,
    })
  })

  it('EUR sin tasa CUP/base requiere primero USD→CUP', () => {
    expect(fxCupNeedsBaseCupRate('EUR', 'USD', {})).toBe(true)
    expect(fxCupNeedsBaseCupRate('EUR', 'USD', { CUP: { units_per_base: 400 } })).toBe(false)
    expect(fxCupNeedsBaseCupRate('USD', 'USD', {})).toBe(false)
  })

  it('códigos de BD a verificar hoy', () => {
    expect(fxCupStorageCodesForCheck(['USD'], 'CUP')).toEqual(['USD'])
    expect(fxCupStorageCodesForCheck(['USD'], 'USD')).toEqual(['CUP'])
    expect(fxCupStorageCodesForCheck(['USD', 'EUR'], 'USD').sort()).toEqual(['CUP', 'EUR'])
  })
})
