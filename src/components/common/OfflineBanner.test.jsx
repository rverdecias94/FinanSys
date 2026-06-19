import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OfflineBanner } from './OfflineBanner'

// Capa B: el banner solo aparece SIN conexión. useOnlineStatus lee navigator.onLine,
// así que lo forzamos por test.
function setOnLine(value) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })
}

describe('OfflineBanner', () => {
  afterEach(() => {
    setOnLine(true) // restaurar para no contaminar otros tests
  })

  it('no renderiza nada cuando hay conexión', () => {
    setOnLine(true)
    const { container } = render(<OfflineBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('muestra el aviso de datos guardados cuando no hay conexión', () => {
    setOnLine(false)
    render(<OfflineBanner />)
    const banner = screen.getByRole('status')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveTextContent(/sin conexión/i)
    expect(banner).toHaveTextContent(/datos guardados/i)
  })
})
