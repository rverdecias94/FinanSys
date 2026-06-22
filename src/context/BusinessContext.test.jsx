import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// getBusinessContext devuelve null cuando la RPC falla offline (captura el error internamente).
vi.mock('@/services/team', () => ({
  getBusinessContext: vi.fn(),
  acceptPendingInvitations: vi.fn(),
}))
vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({ session: { user: { id: 'u1', email: 'miembro@x.com' } }, loading: false }),
}))

import { BusinessProvider, useBusiness } from './BusinessContext'
import { getBusinessContext, acceptPendingInvitations } from '@/services/team'
import { writeLocalCache } from '@/offline/localCache'

function Probe() {
  const { businessId, isOwner, roleName, loading } = useBusiness()
  return <div>{loading ? 'loading' : `biz:${businessId};owner:${String(isOwner)};role:${roleName}`}</div>
}

describe('BusinessContext (offline)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getBusinessContext.mockResolvedValue(null)
    acceptPendingInvitations.mockResolvedValue(null)
    localStorage.clear()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
  })
  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  it('restaura el contexto real del MIEMBRO desde caché (no cae a owner-default)', async () => {
    writeLocalCache('business:u1', {
      businessId: 'owner-7', isOwner: false, roleId: 'r1', roleName: 'Editor', permissions: ['finanzas.view'],
    })
    render(<BusinessProvider><Probe /></BusinessProvider>)
    await waitFor(() =>
      expect(screen.getByText('biz:owner-7;owner:false;role:Editor')).toBeInTheDocument()
    )
  })

  it('sin caché, cae a owner-default (degradado aceptable)', async () => {
    render(<BusinessProvider><Probe /></BusinessProvider>)
    await waitFor(() =>
      expect(screen.getByText('biz:u1;owner:true;role:null')).toBeInTheDocument()
    )
  })

  it('offline NO intenta aceptar invitaciones (evita ruido sin conexión)', async () => {
    render(<BusinessProvider><Probe /></BusinessProvider>)
    await waitFor(() => expect(screen.getByText(/owner:true/)).toBeInTheDocument())
    expect(acceptPendingInvitations).not.toHaveBeenCalled()
  })
})

describe('BusinessContext (online · miembro de equipo)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  // Guard de regresión: la aceptación de invitaciones DEBE ocurrir al resolver el
  // contexto (no solo en Login.jsx). Si no, un miembro que entra por confirmación
  // de email / recarga se trataría como owner y vería el asistente de titular.
  it('acepta invitaciones pendientes ANTES de resolver y expone contexto de miembro', async () => {
    acceptPendingInvitations.mockResolvedValue(null)
    getBusinessContext.mockResolvedValue({
      businessId: 'owner-7', isOwner: false, roleId: 'r1', roleName: 'Consultor', permissions: ['finanzas.view'],
    })

    render(<BusinessProvider><Probe /></BusinessProvider>)

    await waitFor(() =>
      expect(screen.getByText('biz:owner-7;owner:false;role:Consultor')).toBeInTheDocument()
    )
    expect(acceptPendingInvitations).toHaveBeenCalledWith('miembro@x.com')
  })
})
