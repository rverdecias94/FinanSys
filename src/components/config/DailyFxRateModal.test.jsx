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
const currencyState = {
  businessCurrencies: [
    { code: 'USD', is_default: true },
    { code: 'CUP', is_default: false },
  ],
}

vi.mock('@/context/CurrencyContext', () => ({
  useCurrency: () => currencyState,
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
vi.mock('@/utils/dailyFxReminder', async () => {
  const actual = await vi.importActual('@/utils/dailyFxReminder')
  return {
    ...actual,
    todayLocalIso: () => '2026-11-07',
  }
})

function renderModal(props = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <DailyFxRateModal {...props} />
    </QueryClientProvider>
  )
}

describe('DailyFxRateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currencyState.businessCurrencies = [
      { code: 'USD', is_default: true },
      { code: 'CUP', is_default: false },
    ]
  })

  it('muestra el modal soft con Más tarde y exige confirmación', async () => {
    const user = userEvent.setup()
    renderModal()
    expect(await screen.findByText(/A cuánto está el CUP hoy/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Más tarde/i })).toBeInTheDocument()

    const save = screen.getByRole('button', { name: /Guardar tasa de hoy/i })
    expect(save).toBeDisabled()

    const input = screen.getByLabelText(/1 USD = ¿cuántos CUP\?/i)
    await user.clear(input)
    await user.type(input, '930')
    await user.click(screen.getByLabelText(/Confirmo que estas cifras/i))
    expect(save).toBeEnabled()
  })

  it('con MLC pregunta 1 MLC = CUP, nunca 1 USD = MLC', async () => {
    currencyState.businessCurrencies = [
      { code: 'USD', is_default: true },
      { code: 'CUP', is_default: false },
      { code: 'MLC', is_default: false },
    ]
    renderModal()
    expect(await screen.findByLabelText(/1 USD = ¿cuántos CUP\?/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/1 MLC = ¿cuántos CUP\?/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/1 USD = ¿cuántos MLC\?/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/respecto a USD/i)).not.toBeInTheDocument()
  })

  it('en modo obligatorio no ofrece Más tarde', async () => {
    renderModal({
      requiredGate: { reason: 'Para registrar esta entrada necesitamos la tasa de hoy.' },
    })
    expect(await screen.findByRole('heading', { name: /Necesitamos la tasa de hoy/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Más tarde/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancelar operación/i })).toBeInTheDocument()
  })

  it('no muestra el modal soft si la tasa de hoy ya existe', async () => {
    const { getExchangeRates } = await import('@/services/exchangeRates')
    getExchangeRates.mockResolvedValueOnce({
      CUP: { units_per_base: 800, effective_date: '2026-11-07' },
    })
    renderModal()
    await waitFor(() => {
      expect(screen.queryByText(/A cuánto está el CUP hoy/i)).not.toBeInTheDocument()
    })
  })
})
