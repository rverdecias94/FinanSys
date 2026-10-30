import { describe, it, expect, vi, beforeEach } from 'vitest'
import { afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSubscription } from '@/context/SubscriptionContext'
import { useBusiness } from '@/context/BusinessContext'

vi.mock('@/context/SubscriptionContext', () => ({
  useSubscription: vi.fn(),
  isPaidPlanId: (planId) => planId === 'premium' || planId === 'ultra'
}))

vi.mock('@/context/BusinessContext', () => ({
  useBusiness: vi.fn()
}))

vi.mock('@/components/config/PaymentHistory', () => ({ PaymentHistory: () => null }))
vi.mock('@/components/config/DowngradeToFreeDialog', () => ({ DowngradeToFreeDialog: () => null }))

const renderPanel = (ui) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const baseLimits = {
  free: { monthly_transactions: 150, products: 50, areas: 1, partners: 0, currencies: 1 },
  premium: {
    monthly_transactions: 1500,
    products: 200,
    areas: 10,
    partners: 5,
    currencies: Infinity,
    ai_doc_pages: 20,
    ai_calc_queries: 15,
  },
  ultra: {
    partners: 10,
    ai_doc_pages: 100,
    ai_calc_queries: 50,
  },
}

describe('PlansPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows pending request banner and allows cancel', async () => {
    const user = userEvent.setup({ delay: null })
    const cancelPendingPremiumRequest = vi.fn().mockResolvedValue({ status: 'cancelled' })

    useBusiness.mockReturnValue({ isOwner: true })
    useSubscription.mockReturnValue({
      subscription: { plan_id: 'free' },
      loading: false,
      updatePlan: vi.fn(),
      requestPremium: vi.fn(),
      cancelPendingPremiumRequest,
      pendingPlanRequest: { id: 'p1', created_at: new Date().toISOString(), requested_plan_id: 'premium' },
      PLAN_LIMITS: baseLimits,
      pricing: {},
    })

    const { PlansPanel } = await import('./PlansPanel')
    renderPanel(<PlansPanel />)
    expect(screen.getByText(/Solicitud Negocio pendiente/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByText('Cancelar solicitud de plan')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar solicitud' }))
    expect(cancelPendingPremiumRequest).toHaveBeenCalledTimes(1)
  })

  it('opens request dialog and submits with name, phone and payment method', async () => {
    const user = userEvent.setup({ delay: null })
    const requestPremium = vi.fn().mockResolvedValue({ request_id: 'r1', status: 'pending' })

    useBusiness.mockReturnValue({ isOwner: true })
    useSubscription.mockReturnValue({
      subscription: { plan_id: 'free' },
      loading: false,
      updatePlan: vi.fn(),
      requestPremium,
      cancelPendingPremiumRequest: vi.fn(),
      pendingPlanRequest: null,
      PLAN_LIMITS: baseLimits,
      pricing: { premium: { monthly: 10, annual: 96, annual_discount_pct: 20, currency: 'USD' } },
    })

    const { PlansPanel } = await import('./PlansPanel')
    renderPanel(<PlansPanel />)

    expect(screen.getByText(/1[.,]?500 transacciones/i)).toBeInTheDocument()
    expect(screen.getByText(/^150 transacciones/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Solicitar Negocio' }))
    expect(screen.getByRole('heading', { name: 'Solicitar Negocio' })).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Nombre del cliente/i), 'Roberto Demo')
    await user.type(screen.getByLabelText(/Teléfono o WhatsApp/i), '+5355512345')
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(requestPremium).toHaveBeenCalledWith(expect.objectContaining({
      targetPlanId: 'premium',
      billingCycle: 'monthly',
      contactName: 'Roberto Demo',
      contactPhone: '+5355512345',
      paymentMethod: 'transferencia',
    }))
  })

  it('toggles annual pricing display with USD currency', async () => {
    const user = userEvent.setup({ delay: null })
    useBusiness.mockReturnValue({ isOwner: true })
    useSubscription.mockReturnValue({
      subscription: { plan_id: 'free' },
      loading: false,
      requestPremium: vi.fn(),
      cancelPendingPremiumRequest: vi.fn(),
      pendingPlanRequest: null,
      PLAN_LIMITS: baseLimits,
      pricing: {
        premium: { monthly: 10, annual: 96, currency: 'USD' },
        ultra: { monthly: 20, annual: 192, currency: 'USD' },
      },
    })

    const { PlansPanel } = await import('./PlansPanel')
    renderPanel(<PlansPanel />)

    expect(screen.getByText('Ahorra 20%')).toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: /Alternar pago anual/i }))
    expect(screen.getByText(/\$96 USD/i)).toBeInTheDocument()
    expect(screen.getByText(/\$192 USD/i)).toBeInTheDocument()
  })

  it('keeps fixed plan order Inicial → Negocio → Élite', async () => {
    useBusiness.mockReturnValue({ isOwner: true })
    useSubscription.mockReturnValue({
      subscription: { plan_id: 'ultra' },
      loading: false,
      requestPremium: vi.fn(),
      cancelPendingPremiumRequest: vi.fn(),
      pendingPlanRequest: null,
      PLAN_LIMITS: baseLimits,
      pricing: {},
    })

    const { PlansPanel } = await import('./PlansPanel')
    renderPanel(<PlansPanel />)
    const titles = screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)
    // CardTitle may not be h3 depending on CardTitle component — fall back to titles text
    const planTitles = ['Plan Inicial', 'Plan Negocio', 'Plan Élite']
    const joined = document.body.textContent
    const positions = planTitles.map((t) => joined.indexOf(t))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect(positions[0]).toBeLessThan(positions[1])
    expect(positions[1]).toBeLessThan(positions[2])
  })
})
