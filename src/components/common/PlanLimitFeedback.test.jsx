import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/context/SubscriptionContext', () => ({ useSubscription: vi.fn() }))

import { PlanLimitFeedback } from './PlanLimitFeedback'
import { useSubscription } from '@/context/SubscriptionContext'

const PLAN_LIMITS = {
  free: { monthly_transactions: 40, products: 40, areas: 5 },
  premium: { monthly_transactions: Infinity, products: Infinity, areas: Infinity }
}

describe('PlanLimitFeedback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cuenta free: muestra "restantes / límite" usando el usage del contexto', () => {
    useSubscription.mockReturnValue({
      subscription: { plan_id: 'free' },
      PLAN_LIMITS,
      getRemainingUsage: () => 30
    })
    render(<PlanLimitFeedback metric="monthly_transactions" label="Transacciones" />)
    expect(screen.getByText('Transacciones restantes: 30 / 40')).toBeInTheDocument()
  })

  it('usa currentCount cuando se provee (conteo exacto en pantalla)', () => {
    useSubscription.mockReturnValue({
      subscription: { plan_id: 'free' },
      PLAN_LIMITS,
      getRemainingUsage: () => 999
    })
    render(<PlanLimitFeedback metric="areas" label="Áreas" currentCount={2} />)
    expect(screen.getByText('Áreas restantes: 3 / 5')).toBeInTheDocument()
  })

  it('cuenta premium: no renderiza nada', () => {
    useSubscription.mockReturnValue({
      subscription: { plan_id: 'premium' },
      PLAN_LIMITS,
      getRemainingUsage: () => Infinity
    })
    const { container } = render(<PlanLimitFeedback metric="products" label="Productos" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('si el límite es Infinity/no definido: no renderiza', () => {
    useSubscription.mockReturnValue({
      subscription: { plan_id: 'free' },
      PLAN_LIMITS: { free: { products: Infinity } },
      getRemainingUsage: () => Infinity
    })
    const { container } = render(<PlanLimitFeedback metric="products" label="Productos" />)
    expect(container).toBeEmptyDOMElement()
  })
})
