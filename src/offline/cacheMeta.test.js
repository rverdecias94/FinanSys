import { describe, it, expect } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  buildFinanceDateKey,
  formatCacheAgeLabel,
  getCriticalCacheMeta,
} from './cacheMeta'

describe('cacheMeta', () => {
  it('buildFinanceDateKey es estable y sin label', () => {
    expect(buildFinanceDateKey({
      type: 'month',
      startDate: '2026-11-01T04:00:00.000Z',
      endDate: '2026-12-01T03:59:59.999Z',
      label: 'noviembre 2026',
    })).toBe('month:2026-11-01T04:00:00.000Z:2026-12-01T03:59:59.999Z')
    expect(buildFinanceDateKey(null)).toBeNull()
  })

  it('formatCacheAgeLabel cubre minutos y días', () => {
    const now = Date.parse('2026-11-06T18:00:00.000Z')
    expect(formatCacheAgeLabel(now - 30_000, now)).toBe('hace un momento')
    expect(formatCacheAgeLabel(now - 5 * 60_000, now)).toBe('hace 5 min')
    expect(formatCacheAgeLabel(now - 3 * 3600_000, now)).toBe('hace 3 h')
    expect(formatCacheAgeLabel(now - 2 * 86400_000, now)).toBe('hace 2 días')
  })

  it('getCriticalCacheMeta solo mira queries críticas con éxito', () => {
    const qc = new QueryClient()
    expect(getCriticalCacheMeta(qc).hasData).toBe(false)

    qc.setQueryData(['ai-usage', 'x'], { used: 1 })
    expect(getCriticalCacheMeta(qc).hasData).toBe(false)

    qc.setQueryData(['transactions', { x: 1 }], { data: [{ id: 1 }], count: 1 })
    const meta = getCriticalCacheMeta(qc)
    expect(meta.hasData).toBe(true)
    expect(meta.updatedAt).toEqual(expect.any(Number))
  })
})
