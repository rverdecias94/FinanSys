import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/hooks/useSession'
import { useSubscription } from '@/context/SubscriptionContext'
import { useAccountStatus } from '@/hooks/useAccountStatus'
import { AccountGate } from './AccountGate'

vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn() }))
vi.mock('@/hooks/useSession', () => ({ useSession: vi.fn() }))
vi.mock('@/context/SubscriptionContext', () => ({ useSubscription: vi.fn() }))
vi.mock('@/hooks/useAccountStatus', () => ({ useAccountStatus: vi.fn() }))
vi.mock('@/services/planRequests', () => ({ isSystemAdmin: vi.fn() }))
vi.mock('react-router-dom', () => ({
  Navigate: ({ to }) => <div data-testid="nav" data-to={to} />,
}))

describe('AccountGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSession.mockReturnValue({ session: { user: { id: 'u1' } } })
    useSubscription.mockReturnValue({ paymentState: 'ok' })
    useAccountStatus.mockReturnValue('active')
    useQuery.mockReturnValue({ data: false })
  })

  afterEach(() => cleanup())

  it('no redirige en estado ok', () => {
    render(<AccountGate />)
    expect(screen.queryByTestId('nav')).toBeNull()
  })

  it('exime a system admins aunque el pago esté bloqueado', () => {
    useQuery.mockReturnValue({ data: true })
    useSubscription.mockReturnValue({ paymentState: 'blocked' })
    render(<AccountGate />)
    expect(screen.queryByTestId('nav')).toBeNull()
  })

  it('cuenta suspendida → /pago-atrasado', () => {
    useAccountStatus.mockReturnValue('suspended')
    render(<AccountGate />)
    expect(screen.getByTestId('nav').dataset.to).toBe('/pago-atrasado')
  })

  it('pago bloqueado → /pago-atrasado', () => {
    useSubscription.mockReturnValue({ paymentState: 'blocked' })
    render(<AccountGate />)
    expect(screen.getByTestId('nav').dataset.to).toBe('/pago-atrasado')
  })

  it('falla abierto: estado desconocido no redirige', () => {
    useAccountStatus.mockReturnValue(null)
    useSubscription.mockReturnValue({ paymentState: null })
    render(<AccountGate />)
    expect(screen.queryByTestId('nav')).toBeNull()
  })
})
