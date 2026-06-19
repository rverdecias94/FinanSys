import { describe, it, expect } from 'vitest'
import { getSupabaseErrorMessage } from './notifications'

// Cobertura del mapeo de errores de Postgres a mensajes amigables (notifications.jsx).
// Cubre el código de stock negativo 23514 (P1.6/P1.7) y el límite de plan 53400 (P1.11),
// que antes en producción quedaban ocultos tras un mensaje genérico.

describe('getSupabaseErrorMessage', () => {
  it('mapea 23514 (CHECK stock >= 0) al mensaje de stock negativo', () => {
    expect(getSupabaseErrorMessage({ code: '23514' })).toMatch(/stock no puede quedar en negativo/i)
  })

  it('para 53400 (límite de plan) usa el mensaje del servidor cuando viene', () => {
    const msg = 'Tu plan permite hasta 1 moneda(s) activa(s).'
    expect(getSupabaseErrorMessage({ code: '53400', message: msg })).toBe(msg)
  })

  it('para 53400 sin mensaje del servidor usa el fallback de plan', () => {
    expect(getSupabaseErrorMessage({ code: '53400' })).toMatch(/límite de tu plan/i)
  })

  it('mapea 23505 (duplicado), 23503 (FK) y 42501 (permisos)', () => {
    expect(getSupabaseErrorMessage({ code: '23505' })).toMatch(/ya existe/i)
    expect(getSupabaseErrorMessage({ code: '23503' })).toMatch(/relacionado con otros datos/i)
    expect(getSupabaseErrorMessage({ code: '42501' })).toMatch(/no tienes permisos/i)
  })

  it('devuelve un texto por defecto cuando el error es nulo', () => {
    expect(getSupabaseErrorMessage(null)).toBe('Error desconocido')
  })

  it('traduce "Failed to fetch" a un error de conexión', () => {
    expect(getSupabaseErrorMessage({ message: 'Failed to fetch' })).toMatch(/error de conexión/i)
  })
})
