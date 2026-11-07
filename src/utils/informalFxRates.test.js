import { describe, it, expect } from 'vitest'
import {
  cupPerForeignToUnitsPerBase,
  cupPerUnit,
  normalizeCupPerForeign,
  roundRate,
  suggestUnitsPerBaseForCurrencies,
} from './informalFxRates'

describe('informalFxRates', () => {
  const cupMap = normalizeCupPerForeign({ USD: 930, ECU: 1015, MLC: 260 })

  it('normaliza ECU → EUR', () => {
    expect(cupMap.EUR).toBe(1015)
    expect(cupMap.ECU).toBe(1015)
  })

  it('resuelve cup por unidad con alias EUR/ECU', () => {
    expect(cupPerUnit(cupMap, 'EUR')).toBe(1015)
    expect(cupPerUnit(cupMap, 'ECU')).toBe(1015)
    expect(cupPerUnit(cupMap, 'CUP')).toBe(1)
  })

  it('1 USD = N CUP cuando la base es USD', () => {
    expect(cupPerForeignToUnitsPerBase('USD', 'CUP', cupMap)).toBe(930)
  })

  it('1 CUP = fracción de USD cuando la base es CUP', () => {
    expect(cupPerForeignToUnitsPerBase('CUP', 'USD', cupMap)).toBeCloseTo(1 / 930, 6)
  })

  it('cruza USD→EUR vía CUP', () => {
    expect(cupPerForeignToUnitsPerBase('USD', 'EUR', cupMap)).toBeCloseTo(930 / 1015, 4)
  })

  it('sugiere monedas y marca las faltantes', () => {
    const { suggestions, missing } = suggestUnitsPerBaseForCurrencies({
      baseCode: 'USD',
      currencyCodes: ['CUP', 'EUR', 'XYZ'],
      cupPerForeign: cupMap,
    })
    expect(suggestions.CUP).toBe(930)
    expect(suggestions.EUR).toBe(roundRate(930 / 1015))
    expect(missing).toEqual(['XYZ'])
  })
})
