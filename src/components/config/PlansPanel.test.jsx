import { describe, it, expect, vi, beforeEach } from 'vitest'
import { afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSubscription } from '@/context/SubscriptionContext'
import { useBusiness } from '@/context/BusinessContext'

vi.mock('@/context/SubscriptionContext', () => ({
  useSubscription: vi.fn()
}))

vi.mock('@/context/BusinessContext', () => ({
  useBusiness: vi.fn()
}))

describe('PlansPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows pending request banner and allows cancel', async () => {
    const user = userEvent.setup()
    const cancelPendingPremiumRequest = vi.fn().mockResolvedValue({ status: 'cancelled' })

    useBusiness.mockReturnValue({ isOwner: true })
    useSubscription.mockReturnValue({
      subscription: { plan_id: 'free' },
      loading: false,
      updatePlan: vi.fn(),
      requestPremium: vi.fn(),
      cancelPendingPremiumRequest,
      pendingPlanRequest: { id: 'p1', created_at: new Date().toISOString() },
      PLAN_LIMITS: {
        free: { monthly_transactions: 40, products: 40, areas: 5, partners: 0 },
        premium: { partners: 5 }
      }
    })

    const { PlansPanel } = await import('./PlansPanel')
    render(<PlansPanel />)
    expect(screen.getByText(/Solicitud Premium pendiente/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByText('Cancelar solicitud Premium')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar solicitud' }))
    expect(cancelPendingPremiumRequest).toHaveBeenCalledTimes(1)
  })

  it('opens request dialog and submits requestPremium', async () => {
    const user = userEvent.setup()
    const requestPremium = vi.fn().mockResolvedValue({ request_id: 'r1', status: 'pending' })

    useBusiness.mockReturnValue({ isOwner: true })
    useSubscription.mockReturnValue({
      subscription: { plan_id: 'free' },
      loading: false,
      updatePlan: vi.fn(),
      requestPremium,
      cancelPendingPremiumRequest: vi.fn(),
      pendingPlanRequest: null,
      PLAN_LIMITS: {
        free: { monthly_transactions: 40, products: 40, areas: 5, partners: 0 },
        premium: { partners: 5 }
      }
    })

    const { PlansPanel } = await import('./PlansPanel')
    render(<PlansPanel />)

    await user.click(screen.getByRole('button', { name: 'Solicitar Premium' }))
    expect(screen.getByRole('heading', { name: 'Solicitar Premium' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(requestPremium).toHaveBeenCalledWith(expect.objectContaining({
      requestedMonths: 1,
      contactPhone: '',
      paymentMethod: 'transferencia',
      paymentReference: '',
      userNotes: ''
    }))
  })
})
