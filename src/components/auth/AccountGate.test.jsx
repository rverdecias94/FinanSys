import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/hooks/useSession'
import { useSubscription } from '@/context/SubscriptionContext'
import { useBusiness } from '@/context/BusinessContext'
import { useAccountStatus } from '@/hooks/useAccountStatus'
import { AccountGate } from './AccountGate'

vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn() }))
vi.mock('@/hooks/useSession', () => ({ useSession: vi.fn() }))
vi.mock('@/context/SubscriptionContext', () => ({ useSubscription: vi.fn() }))
vi.mock('@/context/BusinessContext', () => ({ useBusiness: vi.fn() }))
vi.mock('@/hooks/useAccountStatus', () => ({ useAccountStatus: vi.fn() }))
vi.mock('@/services/planRequests', () => ({ isSystemAdmin: vi.fn() }))
vi.mock('./AccountBlockedDialog', () => ({
  AccountBlockedDialog: ({ mode, accountStatus }) => (
    <div data-testid="blocked" data-mode={mode} data-account={accountStatus || ''} />
  )
}))

describe('AccountGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSession.mockReturnValue({ session: { user: { id: 'u1' } } })
    useSubscription.mockReturnValue({ paymentState: 'ok' })
    useBusiness.mockReturnValue({ isOwner: true })
    useAccountStatus.mockReturnValue('active')
    useQuery.mockReturnValue({ data: false }) // isSystemAdmin = false
  })

  afterEach(() => cleanup())

  it('no bloquea en estado ok', () => {
    render(<AccountGate />)
    expect(screen.queryByTestId('blocked')).toBeNull()
  })

  it('exime a system admins aunque el pago esté bloqueado', () => {
    useQuery.mockReturnValue({ data: true })
    useSubscription.mockReturnValue({ paymentState: 'blocked' })
    render(<AccountGate />)
    expect(screen.queryByTestId('blocked')).toBeNull()
  })

  it('bloquea cuenta suspendida (modo account)', () => {
    useAccountStatus.mockReturnValue('suspended')
    render(<AccountGate />)
    expect(screen.getByTestId('blocked').dataset.mode).toBe('account')
  })

  it('owner con pago bloqueado usa modo owner', () => {
    useSubscription.mockReturnValue({ paymentState: 'blocked' })
    useBusiness.mockReturnValue({ isOwner: true })
    render(<AccountGate />)
    expect(screen.getByTestId('blocked').dataset.mode).toBe('owner')
  })

  it('miembro con pago del negocio bloqueado usa modo member', () => {
    useSubscription.mockReturnValue({ paymentState: 'blocked' })
    useBusiness.mockReturnValue({ isOwner: false })
    render(<AccountGate />)
    expect(screen.getByTestId('blocked').dataset.mode).toBe('member')
  })

  it('falla abierto: estado desconocido no bloquea', () => {
    useAccountStatus.mockReturnValue(null)
    useSubscription.mockReturnValue({ paymentState: null })
    render(<AccountGate />)
    expect(screen.queryByTestId('blocked')).toBeNull()
  })
})
