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

  // Errores de autenticación (Supabase Auth): antes se mostraban crudos en inglés
  // en Login/Signup. Se traducen por `code` snake_case y por el texto del mensaje.
  it('traduce errores de Auth por code (snake_case)', () => {
    expect(getSupabaseErrorMessage({ code: 'invalid_credentials' })).toMatch(/incorrectos/i)
    expect(getSupabaseErrorMessage({ code: 'email_not_confirmed' })).toMatch(/aún no está confirmado/i)
    expect(getSupabaseErrorMessage({ code: 'user_already_exists' })).toMatch(/ya existe una cuenta/i)
    expect(getSupabaseErrorMessage({ code: 'over_email_send_rate_limit' })).toMatch(/demasiados correos/i)
  })

  it('traduce errores de Auth por el texto en inglés cuando no viene code', () => {
    expect(getSupabaseErrorMessage({ message: 'Invalid login credentials' })).toMatch(/incorrectos/i)
    expect(getSupabaseErrorMessage({ message: 'Email not confirmed' })).toMatch(/aún no está confirmado/i)
    expect(getSupabaseErrorMessage({ message: 'User already registered' })).toMatch(/ya existe una cuenta/i)
    expect(getSupabaseErrorMessage({ message: 'New password should be different from the old password' }))
      .toMatch(/diferente a la anterior/i)
  })

  it('no confunde los códigos de Postgres con errores de Auth', () => {
    // 23514 debe seguir dando el mensaje de stock, no un mensaje de Auth.
    expect(getSupabaseErrorMessage({ code: '23514' })).toMatch(/stock no puede quedar en negativo/i)
    // Un mensaje neutro sin patrón de Auth conserva su comportamiento previo.
    const plano = 'Tu plan permite hasta 1 moneda(s) activa(s).'
    expect(getSupabaseErrorMessage({ code: '53400', message: plano })).toBe(plano)
  })

  it('red de seguridad: un AuthError no catalogado no sale en inglés', () => {
    // GoTrue marca sus errores como AuthApiError / __isAuthError.
    const auth = { name: 'AuthApiError', message: 'Something obscure from gotrue', status: 500 }
    expect(getSupabaseErrorMessage(auth)).toMatch(/no se pudo completar la operación/i)
    expect(getSupabaseErrorMessage({ __isAuthError: true, message: 'weird' })).toMatch(/no se pudo completar/i)
    // Un error genérico (sin code y sin marca de Auth) NO cae en la red de Auth:
    // conserva su propio mensaje, como antes.
    expect(getSupabaseErrorMessage({ message: 'Mensaje de negocio en español' }))
      .toBe('Mensaje de negocio en español')
  })
})
