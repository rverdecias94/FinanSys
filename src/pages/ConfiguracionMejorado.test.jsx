import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/context/SubscriptionContext', () => ({ useSubscription: vi.fn() }))
vi.mock('@/components/common/PermissionGuard', () => ({ usePermissionCheck: vi.fn() }))
vi.mock('@/components/dashboard/DashboardPermissions', () => ({ PermissionSummary: () => <div /> }))
vi.mock('@/components/config/TeamManagement', () => ({ TeamManagement: () => <div>TEAM_MGMT</div> }))
vi.mock('@/components/config/RoleManagement', () => ({ RoleManagement: () => <div>ROLE_MGMT</div> }))
vi.mock('@/components/config/PlansPanel', () => ({ PlansPanel: () => <div>PLANS</div> }))
vi.mock('@/components/config/CurrenciesPanel', () => ({ CurrenciesPanel: () => <div>CURRENCIES</div> }))
vi.mock('@/components/config/GeneralSettingsPanel', () => ({ GeneralSettingsPanel: () => <div>GENERAL</div> }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

import ConfiguracionMejorado from './ConfiguracionMejorado'
import { useSubscription } from '@/context/SubscriptionContext'
import { usePermissionCheck } from '@/components/common/PermissionGuard'

describe('ConfiguracionMejorado · Equipo/Roles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePermissionCheck.mockReturnValue({ canView: () => true, isOwner: true, hasPermission: () => false })
  })

  it('cuenta free: las pestañas Equipo y Roles son visibles', () => {
    useSubscription.mockReturnValue({ subscription: { plan_id: 'free' } })
    render(<ConfiguracionMejorado />)
    expect(screen.getByRole('tab', { name: /Equipo/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Roles/i })).toBeInTheDocument()
  })

  it('cuenta free: al abrir Equipo muestra la pantalla Premium (no la gestión real)', async () => {
    const user = userEvent.setup()
    useSubscription.mockReturnValue({ subscription: { plan_id: 'free' } })
    render(<ConfiguracionMejorado />)

    await user.click(screen.getByRole('tab', { name: /Equipo/i }))
    expect(screen.getByText('La Gestión de Equipo es Premium')).toBeInTheDocument()
    expect(screen.queryByText('TEAM_MGMT')).toBeNull()
  })

  it('cuenta premium: al abrir Equipo muestra la gestión real', async () => {
    const user = userEvent.setup()
    useSubscription.mockReturnValue({ subscription: { plan_id: 'premium' } })
    render(<ConfiguracionMejorado />)

    await user.click(screen.getByRole('tab', { name: /Equipo/i }))
    expect(screen.getByText('TEAM_MGMT')).toBeInTheDocument()
    expect(screen.queryByText('La Gestión de Equipo es Premium')).toBeNull()
  })
})
