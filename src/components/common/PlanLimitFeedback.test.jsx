import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/context/SubscriptionContext', () => ({ useSubscription: vi.fn() }))

import { PlanLimitFeedback } from './PlanLimitFeedback'
import { useSubscription } from '@/context/SubscriptionContext'

const PLAN_LIMITS = {
  free: { monthly_transactions: 150, products: 50, areas: 1 },
  premium: { monthly_transactions: 1500, products: 200, areas: 3 },
  ultra: { monthly_transactions: Infinity, products: Infinity, areas: Infinity },
}

describe('PlanLimitFeedback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cuenta free: muestra usado / límite', () => {
    useSubscription.mockReturnValue({
      subscription: { plan_id: 'free' },
      PLAN_LIMITS,
      usage: { monthly_transactions: 85 },
    })
    render(<PlanLimitFeedback metric="monthly_transactions" label="Transacciones" />)
    expect(screen.getByText('Transacciones: 85 / 150')).toBeInTheDocument()
  })

  it('usa currentCount cuando se provee', () => {
    useSubscription.mockReturnValue({
      subscription: { plan_id: 'free' },
      PLAN_LIMITS,
      usage: { areas: 0 },
    })
    render(<PlanLimitFeedback metric="areas" label="Áreas" currentCount={1} />)
    expect(screen.getByText('Áreas: 1 / 1')).toBeInTheDocument()
  })

  it('cuenta Negocio con tope finito: muestra consumo', () => {
    useSubscription.mockReturnValue({
      subscription: { plan_id: 'premium' },
      PLAN_LIMITS,
      usage: { products: 32 },
    })
    render(<PlanLimitFeedback metric="products" label="Productos" />)
    expect(screen.getByText('Productos: 32 / 200')).toBeInTheDocument()
  })

  it('cuenta Élite ilimitada: muestra Ilimitado', () => {
    useSubscription.mockReturnValue({
      subscription: { plan_id: 'ultra' },
      PLAN_LIMITS,
      usage: { products: 500 },
    })
    render(<PlanLimitFeedback metric="products" label="Productos" />)
    expect(screen.getByText('Productos: Ilimitado')).toBeInTheDocument()
  })
})
