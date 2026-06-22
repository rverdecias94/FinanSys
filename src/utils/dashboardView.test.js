import { describe, it, expect } from 'vitest'
import { deriveDashboardView } from './dashboardView'

describe('deriveDashboardView', () => {
  it('mientras no está listo, no muestra nada especial', () => {
    expect(deriveDashboardView({ isConfigured: false, hasActivity: false, ready: false }))
      .toEqual({ showOnboarding: false, showPanel: false, showFirstMovementHint: false })
  })

  it('sin moneda principal configurada → muestra el asistente "3 pasos"', () => {
    expect(deriveDashboardView({ isConfigured: false, hasActivity: false, ready: true }))
      .toEqual({ showOnboarding: true, showPanel: false, showFirstMovementHint: false })
  })

  it('con moneda configurada y sin movimientos → panel + aviso de primer movimiento', () => {
    expect(deriveDashboardView({ isConfigured: true, hasActivity: false, ready: true }))
      .toEqual({ showOnboarding: false, showPanel: true, showFirstMovementHint: true })
  })

  it('con moneda configurada y con movimientos → solo panel (sin aviso)', () => {
    expect(deriveDashboardView({ isConfigured: true, hasActivity: true, ready: true }))
      .toEqual({ showOnboarding: false, showPanel: true, showFirstMovementHint: false })
  })
})
