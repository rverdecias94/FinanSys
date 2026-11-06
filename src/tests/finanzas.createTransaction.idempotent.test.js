import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTransaction } from '../services/finanzas'

vi.mock('@/services/auditLogger', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/services/exchangeRates', () => ({
  getRateForDate: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/services/notifyWrap', () => ({
  withCrud: async (_meta, fn) => fn(),
  notifyOfflineQueued: vi.fn(),
}))
vi.mock('@/services/team', () => ({
  getEffectiveUserId: (userId, businessId) => businessId || userId,
}))

const mockState = vi.hoisted(() => ({
  insertResult: { data: { id: 1, client_uuid: 'u-1' }, error: null },
  selectResult: { data: null, error: null },
}))

vi.mock('@/config/supabase', () => {
  const chain = {
    insert: vi.fn(() => chain),
    select: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(mockState.insertResult)),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(mockState.selectResult)),
  }
  return {
    supabase: {
      from: vi.fn(() => chain),
    },
  }
})

describe('createTransaction idempotencia (client_uuid)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.insertResult = { data: { id: 1, client_uuid: 'u-1', description: 'Nueva' }, error: null }
    mockState.selectResult = { data: null, error: null }
  })

  it('incluye client_uuid en el insert', async () => {
    const { supabase } = await import('@/config/supabase')
    await createTransaction(
      {
        date: '2026-11-05',
        amount: 10,
        currency: 'USD',
        category: 'Ventas',
        description: 'Test',
        type: 'income',
        client_uuid: 'u-1',
      },
      'user-a',
      'biz-a',
    )
    expect(supabase.from).toHaveBeenCalledWith('transactions')
    const insertArg = supabase.from.mock.results[0].value.insert.mock.calls[0][0]
    expect(insertArg.client_uuid).toBe('u-1')
  })

  it('ante 23505 devuelve la fila existente con idempotent:true', async () => {
    mockState.insertResult = { data: null, error: { code: '23505', message: 'duplicate' } }
    mockState.selectResult = {
      data: { id: 99, client_uuid: 'u-dup', description: 'Ya existía' },
      error: null,
    }

    const result = await createTransaction(
      {
        date: '2026-11-05',
        amount: 10,
        currency: 'USD',
        category: 'Ventas',
        description: 'Test',
        type: 'income',
        client_uuid: 'u-dup',
      },
      'user-a',
      'biz-a',
    )

    expect(result).toMatchObject({ id: 99, idempotent: true })
  })
})
