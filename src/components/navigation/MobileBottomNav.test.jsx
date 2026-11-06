import { describe, it, expect } from 'vitest'
import { isMobilePrimaryRoute } from './MobileBottomNav'

describe('isMobilePrimaryRoute', () => {
  it('marca rutas del tab bar', () => {
    expect(isMobilePrimaryRoute('/')).toBe(true)
    expect(isMobilePrimaryRoute('/finanzas')).toBe(true)
    expect(isMobilePrimaryRoute('/almacen/entrada')).toBe(true)
    expect(isMobilePrimaryRoute('/reportes')).toBe(true)
  })

  it('deja el resto para Más', () => {
    expect(isMobilePrimaryRoute('/configuracion')).toBe(false)
    expect(isMobilePrimaryRoute('/contactos')).toBe(false)
    expect(isMobilePrimaryRoute('/cuentas')).toBe(false)
    expect(isMobilePrimaryRoute('/inventario')).toBe(false)
  })
})
