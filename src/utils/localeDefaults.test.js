import { describe, expect, it, vi } from 'vitest'
import {
  getClientDateFormat,
  getClientNumberFormat,
  getClientRegionDefaults,
  getClientTimeZone,
} from './localeDefaults'

describe('localeDefaults', () => {
  it('getClientTimeZone devuelve string no vacío', () => {
    expect(typeof getClientTimeZone()).toBe('string')
    expect(getClientTimeZone().length).toBeGreaterThan(0)
  })

  it('getClientDateFormat es una de las opciones de UI', () => {
    expect(['DD/MM/AAAA', 'MM/DD/AAAA', 'AAAA-MM-DD']).toContain(getClientDateFormat())
  })

  it('getClientNumberFormat es en-US o es-ES', () => {
    expect(['en-US', 'es-ES']).toContain(getClientNumberFormat())
  })

  it('getClientRegionDefaults agrupa tz + fecha + número', () => {
    const r = getClientRegionDefaults()
    expect(r.timeZone).toBe(getClientTimeZone())
    expect(r.dateFormat).toBe(getClientDateFormat())
    expect(r.numberFormat).toBe(getClientNumberFormat())
  })

  it('detecta MM/DD/AAAA cuando el locale pone el mes primero', () => {
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockReturnValue([
      { type: 'month', value: '01' },
      { type: 'literal', value: '/' },
      { type: 'day', value: '15' },
      { type: 'literal', value: '/' },
      { type: 'year', value: '2024' },
    ])
    expect(getClientDateFormat()).toBe('MM/DD/AAAA')
    spy.mockRestore()
  })

  it('detecta AAAA-MM-DD cuando el locale pone el año primero', () => {
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockReturnValue([
      { type: 'year', value: '2024' },
      { type: 'literal', value: '-' },
      { type: 'month', value: '01' },
      { type: 'literal', value: '-' },
      { type: 'day', value: '15' },
    ])
    expect(getClientDateFormat()).toBe('AAAA-MM-DD')
    spy.mockRestore()
  })
})
