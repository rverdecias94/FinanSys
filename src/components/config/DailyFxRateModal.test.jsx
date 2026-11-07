import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DailyFxRateModal } from './DailyFxRateModal'

vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } } }),
}))
vi.mock('@/context/BusinessContext', () => ({
  useBusiness: () => ({ businessId: 'b1', isOwner: true }),
}))
vi.mock('@/context/CurrencyContext', () => ({
  useCurrency: () => ({
    businessCurrencies: [
      { code: 'USD', is_default: true },
      { code: 'CUP', is_default: false },
    ],
  }),
}))
vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}))
vi.mock('@/services/businessSettings', () => ({
  getBusinessSettings: vi.fn().mockResolvedValue({
    fx: { daily_fx_reminder: true, last_fx_prompt_date: null },
  }),
  patchBusinessFxSettings: vi.fn().mockResolvedValue({}),
}))
vi.mock('@/services/exchangeRates', () => ({
  getExchangeRates: vi.fn().mockResolvedValue({
    CUP: { units_per_base: 800, effective_date: '2026-01-01' },
  }),
  upsertExchangeRate: vi.fn().mockResolvedValue({}),
}))
vi.mock('@/services/informalFxRates', () => ({
  fetchInformalFxSuggestions: vi.fn().mockResolvedValue({
    ok: true,
    suggestions: { CUP: 930 },
    missing: [],
    attribution: 'elTOQUE (TRMI · mercado informal)',
    sourceUrl: 'https://eltoque.com/tasas-de-cambio-cuba/mercado-informal',
    asOf: '2026-11-07T08:00:00',
    cached: false,
  }),
}))
vi.mock('@/utils/dailyFxReminder', async () => {
  const actual = await vi.importActual('@/utils/dailyFxReminder')
  return {
    ...actual,
    todayLocalIso: () => '2026-11-07',
  }
})

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <DailyFxRateModal />
    </QueryClientProvider>
  )
}

describe('DailyFxRateModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('muestra el modal, sugiere tasa y exige confirmación para guardar', async () => {
    const user = userEvent.setup()
    renderModal()
    expect(await screen.findByText(/A cuánto está el dólar hoy/i)).toBeInTheDocument()

    expect(await screen.findByText(/Sugerencia automática/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('930')).toBeInTheDocument()

    const save = screen.getByRole('button', { name: /Guardar tasa de hoy/i })
    expect(save).toBeDisabled()

    await user.click(screen.getByLabelText(/Confirmo que estas cifras/i))
    expect(save).toBeEnabled()
  })

  it('si falla la consulta automática, pide tasa manual', async () => {
    const { fetchInformalFxSuggestions } = await import('@/services/informalFxRates')
    fetchInformalFxSuggestions.mockResolvedValueOnce({
      ok: false,
      error: 'Sin clave de elTOQUE',
    })
    renderModal()
    expect(await screen.findByText(/No pudimos obtener la tasa automática/i)).toBeInTheDocument()
    expect(screen.getByText(/Sin clave de elTOQUE/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guardar tasa de hoy/i })).toBeDisabled()
  })

  it('no muestra el modal si la tasa de hoy ya existe', async () => {
    const { getExchangeRates } = await import('@/services/exchangeRates')
    getExchangeRates.mockResolvedValueOnce({
      CUP: { units_per_base: 800, effective_date: '2026-11-07' },
    })
    renderModal()
    await waitFor(() => {
      expect(screen.queryByText(/A cuánto está el dólar hoy/i)).not.toBeInTheDocument()
    })
  })
})
