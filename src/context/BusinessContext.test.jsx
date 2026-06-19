import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// getBusinessContext devuelve null cuando la RPC falla offline (captura el error internamente).
vi.mock('@/services/team', () => ({
  getBusinessContext: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({ session: { user: { id: 'u1', email: 'miembro@x.com' } }, loading: false }),
}))

import { BusinessProvider, useBusiness } from './BusinessContext'
import { writeLocalCache } from '@/offline/localCache'

function Probe() {
  const { businessId, isOwner, roleName, loading } = useBusiness()
  return <div>{loading ? 'loading' : `biz:${businessId};owner:${String(isOwner)};role:${roleName}`}</div>
}

describe('BusinessContext (offline)', () => {
  beforeEach(() => {
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
})
