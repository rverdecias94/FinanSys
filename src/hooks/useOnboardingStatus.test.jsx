import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/hooks/useSession', () => ({ useSession: vi.fn() }))
vi.mock('@/context/BusinessContext', () => ({ useBusiness: vi.fn() }))
vi.mock('@/context/CurrencyContext', () => ({ useCurrency: vi.fn() }))
vi.mock('@/services/businessSettings', () => ({ getBusinessSettings: vi.fn() }))

import { useOnboardingStatus } from './useOnboardingStatus'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { getBusinessSettings } from '@/services/businessSettings'
import { writeLocalCache } from '@/offline/localCache'

function Probe() {
  const { needsOnboarding, loading } = useOnboardingStatus()
  return <div>{loading ? 'loading' : `needs:${needsOnboarding}`}</div>
}

const renderProbe = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><Probe /></QueryClientProvider>)
}

describe('useOnboardingStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useSession.mockReturnValue({ session: { user: { id: 'u1' } } })
  })

  it('owner sin nombre comercial ni moneda → needsOnboarding true', async () => {
    useBusiness.mockReturnValue({ businessId: 'u1', isOwner: true })
    useCurrency.mockReturnValue({ businessCurrencies: [], loading: false })
    getBusinessSettings.mockResolvedValue(null)

    renderProbe()
    await waitFor(() => expect(screen.getByText('needs:true')).toBeInTheDocument())
  })

  it('owner con nombre comercial y moneda principal → needsOnboarding false', async () => {
    useBusiness.mockReturnValue({ businessId: 'u1', isOwner: true })
    useCurrency.mockReturnValue({ businessCurrencies: [{ code: 'USD', is_default: true }], loading: false })
    getBusinessSettings.mockResolvedValue({ company: { tradeName: 'Mi Negocio' }, region: {} })

    renderProbe()
    await waitFor(() => expect(screen.getByText('needs:false')).toBeInTheDocument())
  })

  it('owner con nombre pero sin moneda principal → needsOnboarding true', async () => {
    useBusiness.mockReturnValue({ businessId: 'u1', isOwner: true })
    useCurrency.mockReturnValue({ businessCurrencies: [{ code: 'USD', is_default: false }], loading: false })
    getBusinessSettings.mockResolvedValue({ company: { tradeName: 'Mi Negocio' } })

    renderProbe()
    await waitFor(() => expect(screen.getByText('needs:true')).toBeInTheDocument())
  })

  it('miembro (no owner) nunca necesita onboarding y no consulta settings', () => {
    useBusiness.mockReturnValue({ businessId: 'owner-1', isOwner: false })
    useCurrency.mockReturnValue({ businessCurrencies: [], loading: false })
    getBusinessSettings.mockResolvedValue(null)

    renderProbe()
    expect(screen.getByText('needs:false')).toBeInTheDocument()
    expect(getBusinessSettings).not.toHaveBeenCalled()
  })

  it('usa el flag de localStorage mientras la BD aún verifica (sin parpadeo)', () => {
    useBusiness.mockReturnValue({ businessId: 'u1', isOwner: true })
    useCurrency.mockReturnValue({ businessCurrencies: [], loading: false })
    // BD que nunca resuelve → la query queda en "loading"
    getBusinessSettings.mockReturnValue(new Promise(() => {}))
    // Flag local previo: este dispositivo ya completó el onboarding
    writeLocalCache('onboarding:done:u1', true)

    renderProbe()
    // Inmediatamente needs:false por el flag local (no espera a la BD)
    expect(screen.getByText('needs:false')).toBeInTheDocument()
  })
})
