import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, onlineManager } from '@tanstack/react-query'
import { countQueuedMutations, setupSyncEngine, isMutationQueued } from './syncEngine'

describe('syncEngine', () => {
  let queryClient
  let unsubOnline

  beforeEach(() => {
    queryClient = new QueryClient()
    vi.clearAllMocks()
  })

  afterEach(() => {
    unsubOnline?.()
    queryClient.clear()
  })

  it('countQueuedMutations cuenta mutaciones pausadas por prefijo de key', () => {
    const m = queryClient.getMutationCache().build(queryClient, {
      mutationKey: ['transactions', 'create'],
      mutationFn: vi.fn(),
    })
    m.state.isPaused = true
    m.state.status = 'pending'

    expect(countQueuedMutations(queryClient)).toBe(1)
    expect(countQueuedMutations(queryClient, ['transactions', 'create'])).toBe(1)
    expect(countQueuedMutations(queryClient, ['transactions', 'update'])).toBe(0)
    expect(isMutationQueued(m)).toBe(true)
  })

  it('setupSyncEngine llama resumePausedMutations al estar online', () => {
    const resume = vi.spyOn(queryClient, 'resumePausedMutations').mockResolvedValue(undefined)
    vi.spyOn(onlineManager, 'isOnline').mockReturnValue(true)

    unsubOnline = setupSyncEngine(queryClient)
    expect(resume).toHaveBeenCalled()
  })
})
