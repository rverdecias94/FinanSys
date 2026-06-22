import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/config/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }))
vi.mock('@/hooks/useSession', () => ({ useSession: vi.fn(() => ({ session: { user: { id: 'u1' } } })) }))
vi.mock('@/context/BusinessContext', () => ({ useBusiness: vi.fn(() => ({ businessId: 'u1', isOwner: true })) }))
vi.mock('@/context/SubscriptionContext', () => ({ useSubscription: vi.fn(() => ({ paymentState: 'ok' })) }))
vi.mock('@/hooks/useAccountStatus', () => ({ useAccountStatus: vi.fn(() => 'active') }))
vi.mock('@/hooks/useOnboardingStatus', () => ({ useOnboardingStatus: vi.fn(() => ({ needsOnboarding: true, loading: false })) }))
vi.mock('@/services/planRequests', () => ({ isSystemAdmin: vi.fn().mockResolvedValue(false) }))
vi.mock('@/services/finanzas', () => ({ updateBalanceConfig: vi.fn().mockResolvedValue(null) }))
vi.mock('@/services/businessSettings', () => ({
  getBusinessSettings: vi.fn().mockResolvedValue(null),
  upsertBusinessSettings: vi.fn().mockResolvedValue({})
}))
vi.mock('@/context/CurrencyContext', () => ({ useCurrency: vi.fn() }))

import { OnboardingWizard } from './OnboardingWizard'
import { useCurrency } from '@/context/CurrencyContext'
import { useAccountStatus } from '@/hooks/useAccountStatus'
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus'
import { upsertBusinessSettings } from '@/services/businessSettings'

const renderWizard = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><OnboardingWizard /></QueryClientProvider>)
}

const baseCurrency = () => ({
  availableCurrencies: [{ code: 'USD', name: 'Dólar' }, { code: 'MXN', name: 'Peso' }],
  businessCurrencies: [],
  toggleCurrency: vi.fn().mockResolvedValue(undefined),
  setMainCurrency: vi.fn().mockResolvedValue(undefined),
  refreshCurrencies: vi.fn().mockResolvedValue(undefined)
})

describe('OnboardingWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAccountStatus.mockReturnValue('active')
    useOnboardingStatus.mockReturnValue({ needsOnboarding: true, loading: false })
    useCurrency.mockReturnValue(baseCurrency())
  })

  it('no se renderiza si no hace falta onboarding', () => {
    useOnboardingStatus.mockReturnValue({ needsOnboarding: false, loading: false })
    const { container } = renderWizard()
    expect(container).toBeEmptyDOMElement()
  })

  it('cede la prioridad a AccountGate cuando la cuenta está suspendida', () => {
    useAccountStatus.mockReturnValue('suspended')
    const { container } = renderWizard()
    expect(container).toBeEmptyDOMElement()
  })

  it('el botón Siguiente está deshabilitado hasta escribir el nombre comercial', async () => {
    const user = userEvent.setup()
    renderWizard()

    const next = screen.getByRole('button', { name: /Siguiente/i })
    expect(next).toBeDisabled()

    await user.type(screen.getByPlaceholderText('Mi Negocio S.A.'), 'Acme')
    expect(next).toBeEnabled()
  })

  it('al finalizar guarda el perfil y fija la moneda principal', async () => {
    const user = userEvent.setup()
    // Con una moneda por defecto ya existente, el wizard prefija currencyCode
    // y evita interactuar con el Select de Radix.
    const currency = { ...baseCurrency(), businessCurrencies: [{ code: 'USD', is_default: true }] }
    useCurrency.mockReturnValue(currency)

    renderWizard()

    await user.type(screen.getByPlaceholderText('Mi Negocio S.A.'), 'Acme')
    await user.click(screen.getByRole('button', { name: /Siguiente/i })) // -> paso 2 Región
    await user.click(screen.getByRole('button', { name: /Siguiente/i })) // -> paso 3 Moneda

    const finish = screen.getByRole('button', { name: /Finalizar/i })
    expect(finish).toBeEnabled()
    await user.click(finish)

    await waitFor(() => expect(upsertBusinessSettings).toHaveBeenCalledTimes(1))
    expect(upsertBusinessSettings).toHaveBeenCalledWith(
      'u1', 'u1',
      expect.objectContaining({ company: expect.objectContaining({ tradeName: 'Acme' }) })
    )
    expect(currency.setMainCurrency).toHaveBeenCalledWith('USD')
  })
})
