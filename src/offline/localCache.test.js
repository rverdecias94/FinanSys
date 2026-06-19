import { describe, it, expect, beforeEach } from 'vitest'
import { readLocalCache, writeLocalCache, clearLocalCache } from './localCache'

describe('localCache', () => {
  beforeEach(() => localStorage.clear())

  it('escribe y lee con el prefijo de namespace', () => {
    writeLocalCache('subscription:u1', { plan_id: 'premium' })
    expect(readLocalCache('subscription:u1')).toEqual({ plan_id: 'premium' })
    expect(localStorage.getItem('gestia:cache:subscription:u1')).toBeTruthy()
  })

  it('devuelve null cuando la clave no existe', () => {
    expect(readLocalCache('inexistente')).toBeNull()
  })

  it('clearLocalCache borra solo las claves del prefijo (no toca otras)', () => {
    writeLocalCache('a', 1)
    localStorage.setItem('otra-app', 'x')
    clearLocalCache()
    expect(readLocalCache('a')).toBeNull()
    expect(localStorage.getItem('otra-app')).toBe('x')
  })
})
