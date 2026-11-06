import { describe, it, expect } from 'vitest'
import { isChunkLoadError } from './lazyRetry'

describe('isChunkLoadError', () => {
  it('detecta el fallo típico de chunk tras deploy / mala red', () => {
    expect(
      isChunkLoadError(
        new Error('Failed to fetch dynamically imported module: https://x/assets/CuentasMejorado--oGkRQYY.js'),
      ),
    ).toBe(true)
  })

  it('no marca errores de negocio', () => {
    expect(isChunkLoadError(new Error('Row level security'))).toBe(false)
  })
})
