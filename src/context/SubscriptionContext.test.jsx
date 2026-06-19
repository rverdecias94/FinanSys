import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// Simula OFFLINE: cualquier consulta a supabase (thenable) rechaza al hacer await.
vi.mock('@/config/supabase', () => {
  const makeThenable = () => {
    const b = {}
    const methods = ['select', 'eq', 'neq', 'gte', 'lt', 'order', 'single', 'maybeSingle', 'insert', 'update', 'delete', 'upsert']
    methods.forEach((m) => { b[m] = () => b })
    b.then = (_resolve, reject) => { reject(new Error('offline')) }
    return b
  }
  return {
    supabase: {
      from: () => makeThenable(),
      rpc: () => Promise.reject(new Error('offline')),
      auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    },
  }
})

vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, loading: false }),
}))
vi.mock('@/context/BusinessContext', () => ({
  useBusiness: () => ({ businessId: 'u1', isOwner: true, loading: false }),
}))
vi.mock('@/services/planRequests', () => ({
  getPendingPlanRequest: vi.fn().mockResolvedValue(null),
  cancelMyPendingPlanChangeRequest: vi.fn(),
  requestPlanChange: vi.fn(),
}))
vi.mock('@/services/auditLogger', () => ({ logAction: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))

import { SubscriptionProvider, useSubscription } from './SubscriptionContext'
import { writeLocalCache } from '@/offline/localCache'

function Probe() {
  const { getPlanType, loading } = useSubscription()
  return <div>plan:{loading ? 'loading' : getPlanType()}</div>
}

describe('SubscriptionContext (offline)', () => {
  beforeEach(() => localStorage.clear())

  it('mantiene Premium guardado cuando el fetch falla (offline)', async () => {
    writeLocalCache('subscription:u1', { plan_id: 'premium', status: 'active' })
    render(<SubscriptionProvider><Probe /></SubscriptionProvider>)
    await waitFor(() => expect(screen.getByText('plan:premium')).toBeInTheDocument())
  })

  it('cae a free si el fetch falla y no hay nada cacheado', async () => {
    render(<SubscriptionProvider><Probe /></SubscriptionProvider>)
    await waitFor(() => expect(screen.getByText('plan:free')).toBeInTheDocument())
  })
})
