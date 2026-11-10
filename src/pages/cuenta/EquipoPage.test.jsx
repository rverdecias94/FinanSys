import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/context/SubscriptionContext', () => ({ useSubscription: vi.fn() }))
vi.mock('@/components/common/PermissionGuard', () => ({ usePermissionCheck: vi.fn() }))
vi.mock('@/components/common/PlanRoleSummary', () => ({ PlanRoleSummary: () => <div>PLAN_ROLE</div> }))
vi.mock('@/components/config/TeamManagement', () => ({ TeamManagement: () => <div>TEAM_MGMT</div> }))
vi.mock('@/components/config/RoleManagement', () => ({ RoleManagement: () => <div>ROLE_MGMT</div> }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

import EquipoPage from './EquipoPage'
import { useSubscription } from '@/context/SubscriptionContext'
import { usePermissionCheck } from '@/components/common/PermissionGuard'

describe('EquipoPage · Miembros/Roles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePermissionCheck.mockReturnValue({
      canView: () => true,
      isOwner: true,
      hasPermission: () => true,
    })
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('cuenta free: las secciones Miembros y Roles son visibles', () => {
    useSubscription.mockReturnValue({ subscription: { plan_id: 'free' } })
    render(<EquipoPage />)
    expect(screen.getByRole('tab', { name: /Miembros/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Roles/i })).toBeInTheDocument()
  })

  it('con 2 secciones usa grid de una fila (sin wrap)', () => {
    useSubscription.mockReturnValue({ subscription: { plan_id: 'free' } })
    render(<EquipoPage />)
    const tablist = screen.getByRole('tablist')
    expect(tablist.className).toMatch(/\bgrid\b/)
    expect(tablist.className).not.toMatch(/flex-wrap/)
    expect(screen.getByRole('tab', { name: /Miembros/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Roles/i })).toBeInTheDocument()
  })

  it('cuenta free: Miembros muestra pantalla de mejora (no la gestión real)', () => {
    useSubscription.mockReturnValue({ subscription: { plan_id: 'free' } })
    render(<EquipoPage />)
    expect(screen.getByText('La gestión de equipo está en Negocio y Élite')).toBeInTheDocument()
    expect(screen.queryByText('TEAM_MGMT')).toBeNull()
  })

  it('cuenta Negocio: Miembros muestra la gestión real', () => {
    useSubscription.mockReturnValue({ subscription: { plan_id: 'premium' } })
    render(<EquipoPage />)
    expect(screen.getByText('TEAM_MGMT')).toBeInTheDocument()
    expect(screen.queryByText('La gestión de equipo está en Negocio y Élite')).toBeNull()
  })

  it('cuenta Negocio: Roles muestra la gestión real al cambiar de sección', async () => {
    const user = userEvent.setup()
    useSubscription.mockReturnValue({ subscription: { plan_id: 'premium' } })
    render(<EquipoPage />)
    await user.click(screen.getByRole('tab', { name: /Roles/i }))
    expect(screen.getByText('ROLE_MGMT')).toBeInTheDocument()
  })
})
