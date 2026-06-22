import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const navigateMock = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }))

import { PremiumFeatureScreen } from './PremiumFeatureScreen'

describe('PremiumFeatureScreen', () => {
  beforeEach(() => vi.clearAllMocks())

  it('muestra el título y descripción provistos', () => {
    render(<PremiumFeatureScreen title="La Auditoría es una función Premium" description="Desbloquéala con Premium." />)
    expect(screen.getByText('La Auditoría es una función Premium')).toBeInTheDocument()
    expect(screen.getByText('Desbloquéala con Premium.')).toBeInTheDocument()
  })

  it('el botón "Mejorar Plan" navega a /configuracion', async () => {
    const user = userEvent.setup()
    render(<PremiumFeatureScreen />)
    await user.click(screen.getByRole('button', { name: /Mejorar Plan/i }))
    expect(navigateMock).toHaveBeenCalledWith('/configuracion')
  })
})
