import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/hooks/useSession', () => ({ useSession: vi.fn() }))
vi.mock('@/context/BusinessContext', () => ({ useBusiness: vi.fn() }))
vi.mock('@/context/SubscriptionContext', () => ({ useSubscription: vi.fn() }))
vi.mock('@/context/CurrencyContext', () => ({ useCurrency: vi.fn() }))

import { AppInitializer } from './AppInitializer'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { useCurrency } from '@/context/CurrencyContext'

const Child = () => <div>CONTENIDO_APP</div>

const setContexts = ({ businessLoading = false, subscriptionLoading = false, currencyLoading = false } = {}) => {
  useBusiness.mockReturnValue({ loading: businessLoading })
  useSubscription.mockReturnValue({ loading: subscriptionLoading })
  useCurrency.mockReturnValue({ loading: currencyLoading })
}

describe('AppInitializer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('muestra el loader de marca mientras se comprueba la sesión', () => {
    useSession.mockReturnValue({ session: null, loading: true })
    setContexts()
    render(<AppInitializer><Child /></AppInitializer>)
    expect(screen.getByText('Gestia')).toBeInTheDocument()
    expect(screen.queryByText('CONTENIDO_APP')).toBeNull()
  })

  it('con sesión y contextos cargando → loader', () => {
    useSession.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false })
    setContexts({ businessLoading: true })
    render(<AppInitializer><Child /></AppInitializer>)
    expect(screen.getByText('Gestia')).toBeInTheDocument()
    expect(screen.queryByText('CONTENIDO_APP')).toBeNull()
  })

  it('sin sesión (login) → renderiza children, no bloquea', () => {
    useSession.mockReturnValue({ session: null, loading: false })
    setContexts({ businessLoading: true }) // aunque un contexto "cargue", sin sesión no bloquea
    render(<AppInitializer><Child /></AppInitializer>)
    expect(screen.getByText('CONTENIDO_APP')).toBeInTheDocument()
  })

  it('con sesión y todo cargado → renderiza children', () => {
    useSession.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false })
    setContexts()
    render(<AppInitializer><Child /></AppInitializer>)
    expect(screen.getByText('CONTENIDO_APP')).toBeInTheDocument()
  })
})
