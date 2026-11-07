import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ReplacementMarginPanel } from './ReplacementMarginPanel'

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
    formatCurrency: (n, c) => `${n} ${c}`,
  }),
}))
vi.mock('@/context/SubscriptionContext', () => ({
  useSubscription: () => ({ subscription: { plan_id: 'premium' } }),
}))
vi.mock('@/services/businessSettings', () => ({
  getBusinessSettings: vi.fn().mockResolvedValue({ fx: { target_margin_pct: 25 } }),
}))
vi.mock('@/services/exchangeRates', () => ({
  getExchangeRates: vi.fn().mockResolvedValue({
    CUP: { units_per_base: 1000, effective_date: '2026-11-07' },
  }),
}))
vi.mock('@/services/almacen', () => ({
  listProductsForSelection: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: 'Refresco lata',
      currency: 'CUP',
      unit_price: 1000,
      avg_cost: 800,
      target_margin_pct: null,
      is_for_sale: true,
    },
    {
      id: 2,
      name: 'Pomo de ajo',
      currency: 'USD',
      unit_price: 800,
      avg_cost: 800,
      is_for_sale: false,
    },
  ]),
  getLatestInboundFxByProduct: vi.fn().mockResolvedValue({ 1: 800 }),
  applySuggestedPrices: vi.fn().mockResolvedValue([]),
}))

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ReplacementMarginPanel />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ReplacementMarginPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra producto en riesgo con sugerido 1250 y excluye uso interno', async () => {
    renderPanel()
    expect(await screen.findByText(/para venta bajo reposición/i)).toBeInTheDocument()
    expect(screen.getByText(/Refresco lata/)).toBeInTheDocument()
    expect(screen.queryByText(/Pomo de ajo/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Aplicar 1250 CUP/i })).toBeInTheDocument()
  })
})
