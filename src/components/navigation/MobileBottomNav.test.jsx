import { describe, it, expect } from 'vitest'
import { isMobilePrimaryRoute } from './MobileBottomNav'

describe('isMobilePrimaryRoute', () => {
  it('reconoce categorías del bottom nav', () => {
    expect(isMobilePrimaryRoute('/')).toBe(true)
    expect(isMobilePrimaryRoute('/finanzas')).toBe(true)
    expect(isMobilePrimaryRoute('/contactos')).toBe(true)
    expect(isMobilePrimaryRoute('/almacen')).toBe(true)
    expect(isMobilePrimaryRoute('/inventario')).toBe(true)
    expect(isMobilePrimaryRoute('/reportes')).toBe(true)
    expect(isMobilePrimaryRoute('/logs')).toBe(true)
    expect(isMobilePrimaryRoute('/cuenta/negocio')).toBe(true)
  })

  it('no marca admin como primario', () => {
    expect(isMobilePrimaryRoute('/admin/planes')).toBe(false)
  })
})
