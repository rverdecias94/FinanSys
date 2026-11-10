import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/context/BusinessContext', () => ({ useBusiness: () => ({ businessId: 'b1' }) }))
vi.mock('@/services/billing', () => ({ getMyPayments: vi.fn() }))

import { getMyPayments } from '@/services/billing'
import { PaymentHistory } from './PaymentHistory'

beforeEach(() => {
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

afterEach(() => cleanup())

function renderWithClient(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const payment = {
  id: 1,
  amount: 102,
  currency_code: 'USD',
  billing_cycle: 'annual',
  method: 'transferencia',
  reference: 'ABC-1',
  period_start: '2026-06-01T00:00:00Z',
  period_end: '2027-06-01T00:00:00Z',
  paid_at: '2026-06-01T00:00:00Z',
  status: 'paid'
}

describe('PaymentHistory', () => {
  it('muestra el historial con ciclo, importe y estado pagado', async () => {
    getMyPayments.mockImplementation(async () => ({ data: [payment], count: 1 }))
    renderWithClient(<PaymentHistory />)

    expect(await screen.findByText('Historial de pagos')).toBeInTheDocument()
    expect(await screen.findByText('Anual')).toBeInTheDocument()
    expect(await screen.findByText('Pagado')).toBeInTheDocument()
    expect(await screen.findByText('$102')).toBeInTheDocument()
    expect(await screen.findByText(/Ref: ABC-1/)).toBeInTheDocument()
  })

  it('se auto-oculta cuando no hay pagos y no es Premium', async () => {
    getMyPayments.mockResolvedValue({ data: [], count: 0 })
    renderWithClient(<PaymentHistory alwaysShow={false} />)
    await waitFor(() => expect(screen.queryByText('Historial de pagos')).not.toBeInTheDocument())
  })

  it('muestra estado vacío informativo cuando es Premium sin pagos', async () => {
    getMyPayments.mockResolvedValue({ data: [], count: 0 })
    renderWithClient(<PaymentHistory alwaysShow />)
    expect(await screen.findByText('Historial de pagos')).toBeInTheDocument()
    expect(await screen.findByText(/Aún no hay pagos registrados/)).toBeInTheDocument()
  })
})
