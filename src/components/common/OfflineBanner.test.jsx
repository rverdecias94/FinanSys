import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { OfflineBanner, SYNC_TOAST_ID } from './OfflineBanner'

vi.mock('@/services/notifications', () => ({
  notify: {
    loading: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  },
}))

import { notify } from '@/services/notifications'

function setOnline(value) {
  act(() => {
    onlineManager.setOnline(value)
  })
}

function renderBanner(queryClient = new QueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <OfflineBanner />
    </QueryClientProvider>,
  )
}

describe('OfflineBanner', () => {
  beforeEach(() => {
    setOnline(true)
    vi.clearAllMocks()
  })

  afterEach(() => {
    setOnline(true)
  })

  it('no renderiza nada cuando hay conexión y no hay pendientes', () => {
    setOnline(true)
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
  })

  it('muestra el aviso de datos guardados cuando no hay conexión', () => {
    setOnline(false)
    renderBanner()
    const banner = screen.getByRole('status')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveTextContent(/sin conexión/i)
    expect(banner).toHaveTextContent(/datos guardados/i)
  })

  it('muestra el contador de pendientes cuando hay mutaciones en cola offline', () => {
    setOnline(false)
    const queryClient = new QueryClient()
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: ['transactions', 'create'],
      mutationFn: vi.fn(),
    })
    mutation.state.status = 'pending'
    mutation.state.isPaused = true

    renderBanner(queryClient)
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent(/1 pendiente/i)
  })

  it('al reconectar muestra banner verde y toast de sincronización si hay cola', () => {
    setOnline(false)
    const queryClient = new QueryClient()
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: ['transactions', 'create'],
      mutationFn: vi.fn(),
    })
    mutation.state.status = 'pending'
    mutation.state.isPaused = true

    renderBanner(queryClient)
    setOnline(true)

    expect(screen.getByRole('status')).toHaveTextContent(/vuelves a tener conexión/i)
    expect(notify.loading).toHaveBeenCalledWith(
      expect.stringMatching(/sincronizando/i),
      expect.objectContaining({ id: SYNC_TOAST_ID }),
    )
  })

  it('al vaciar la cola cierra el toast loading y muestra success con duración finita', () => {
    setOnline(false)
    const queryClient = new QueryClient()
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: ['transactions', 'create'],
      mutationFn: vi.fn(),
    })
    mutation.state.status = 'pending'
    mutation.state.isPaused = true

    const { rerender } = renderBanner(queryClient)
    setOnline(true)
    expect(notify.loading).toHaveBeenCalled()

    // Simula fin de sync: mutación ya no pending
    mutation.state.status = 'success'
    mutation.state.isPaused = false
    act(() => {
      queryClient.getMutationCache().notify({ type: 'updated', mutation })
    })
    rerender(
      <QueryClientProvider client={queryClient}>
        <OfflineBanner />
      </QueryClientProvider>,
    )

    // El efecto reacciona al contador 0
    act(() => {
      queryClient.getMutationCache().notify({ type: 'updated', mutation })
    })

    expect(notify.dismiss).toHaveBeenCalledWith(SYNC_TOAST_ID)
    expect(notify.success).toHaveBeenCalledWith(
      expect.stringMatching(/sincronizados/i),
      expect.objectContaining({ duration: 3200 }),
    )
  })
})

