import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}))

describe('pushNotifications helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('isPushSupported refleja APIs del navegador', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {})
    const { isPushSupported } = await import('./pushNotifications')
    expect(isPushSupported()).toBe(false)
  })

  it('getVapidPublicKey lee VITE_VAPID_PUBLIC_KEY', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '  test-key  ')
    const { getVapidPublicKey } = await import('./pushNotifications')
    expect(getVapidPublicKey()).toBe('test-key')
  })

  it('notifyAdminsNewFreeUser no lanza si invoke falla', async () => {
    const { supabase } = await import('@/config/supabase')
    supabase.functions.invoke.mockRejectedValueOnce(new Error('network'))
    const { notifyAdminsNewFreeUser } = await import('./pushNotifications')
    await expect(notifyAdminsNewFreeUser({ userId: 'u1', email: 'a@b.com' })).resolves.toBeNull()
  })
})
