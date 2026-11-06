import { describe, it, expect } from 'vitest'
import { isNetworkError, shouldTreatAsOffline } from './isNetworkError'

describe('isNetworkError', () => {
  it('detecta TypeError Failed to fetch', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
  })

  it('detecta ERR_NAME_NOT_RESOLVED en el mensaje', () => {
    expect(isNetworkError({ message: 'net::ERR_NAME_NOT_RESOLVED' })).toBe(true)
  })

  it('no marca errores de negocio', () => {
    expect(isNetworkError({ message: 'Stock insuficiente' })).toBe(false)
    expect(isNetworkError({ code: '23505', message: 'duplicate' })).toBe(false)
  })

  it('shouldTreatAsOffline con navigator offline', () => {
    const prev = navigator.onLine
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    expect(shouldTreatAsOffline(null)).toBe(true)
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: prev })
  })
})
