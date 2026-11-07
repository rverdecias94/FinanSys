import { describe, expect, it } from 'vitest'
import {
  normalizeStockUnit,
  normalizeUnitsPerBox,
  perPieceFromBox,
  stockUnitShort,
} from './stockUnit'

describe('stockUnit', () => {
  it('normaliza unidad por defecto', () => {
    expect(normalizeStockUnit(null)).toBe('unit')
    expect(normalizeStockUnit('box')).toBe('box')
  })

  it('units_per_box solo aplica a caja', () => {
    expect(normalizeUnitsPerBox('unit', 24)).toBe(null)
    expect(normalizeUnitsPerBox('box', 24)).toBe(24)
    expect(normalizeUnitsPerBox('box', '')).toBe(null)
  })

  it('equivale caja → por pieza', () => {
    expect(perPieceFromBox(28, 24)).toBe(1.17)
    expect(stockUnitShort('box')).toBe('caja')
  })
})
