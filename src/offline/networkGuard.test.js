import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { onlineManager } from '@tanstack/react-query'

describe('networkGuard', () => {
  let originalFetch

  beforeEach(() => {
    originalFetch = window.fetch
    onlineManager.setOnline(true)
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.resetModules()
  })

  afterEach(() => {
    window.fetch = originalFetch
    onlineManager.setOnline(true)
    vi.unstubAllEnvs()
  })

  it('marca offline cuando fetch lanza Failed to fetch', async () => {
    window.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const { setupNetworkGuard, markOnline } = await import('./networkGuard')
    setupNetworkGuard()
    markOnline()

    await expect(window.fetch('https://example.test')).rejects.toThrow(/Failed to fetch/)
    expect(onlineManager.isOnline()).toBe(false)
  })

  it('marca online cuando fetch responde', async () => {
    window.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    const { setupNetworkGuard, markOffline } = await import('./networkGuard')
    setupNetworkGuard()
    markOffline()
    expect(onlineManager.isOnline()).toBe(false)

    await window.fetch('https://example.test')
    expect(onlineManager.isOnline()).toBe(true)
  })
})
