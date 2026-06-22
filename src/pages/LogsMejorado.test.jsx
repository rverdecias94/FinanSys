import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/hooks/useSession', () => ({ useSession: () => ({ session: { user: { id: 'u1' } } }) }))
vi.mock('@/context/BusinessContext', () => ({ useBusiness: () => ({ businessId: 'u1' }) }))
vi.mock('@/components/common/PermissionGuard', () => ({
  usePermissionCheck: () => ({ canView: () => true, isOwner: true })
}))
vi.mock('@/context/SubscriptionContext', () => ({ useSubscription: vi.fn() }))
vi.mock('@/services/auditLogs', () => ({ listAuditLogs: vi.fn(), listAllAuditLogs: vi.fn() }))
vi.mock('@/components/common/ResponsiveListing', () => ({
  ResponsiveListing: () => <div>LISTADO_AUDITORIA</div>
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

import LogsMejorado from './LogsMejorado'
import { useSubscription } from '@/context/SubscriptionContext'

describe('LogsMejorado · gating Premium', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cuenta free → muestra la pantalla Premium y NO el listado', () => {
    useSubscription.mockReturnValue({ canAccessFeature: () => false, loading: false })
    render(<LogsMejorado />)

    expect(screen.getByText('La Bitácora de actividad es una función Premium')).toBeInTheDocument()
    expect(screen.queryByText('LISTADO_AUDITORIA')).toBeNull()
  })

  it('cuenta premium → muestra el listado de auditoría', () => {
    useSubscription.mockReturnValue({ canAccessFeature: () => true, loading: false })
    render(<LogsMejorado />)

    expect(screen.getByText('LISTADO_AUDITORIA')).toBeInTheDocument()
    expect(screen.queryByText('La Bitácora de actividad es una función Premium')).toBeNull()
  })

  it('mientras carga el plan no bloquea (fail-open): muestra el listado', () => {
    useSubscription.mockReturnValue({ canAccessFeature: () => false, loading: true })
    render(<LogsMejorado />)

    expect(screen.getByText('LISTADO_AUDITORIA')).toBeInTheDocument()
  })
})
