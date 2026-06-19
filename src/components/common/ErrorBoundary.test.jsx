import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Boom() {
  throw new Error('Boom de prueba')
}

describe('ErrorBoundary', () => {
  // El proyecto no tiene auto-cleanup global de Testing Library; limpiamos el DOM
  // entre casos para que el fallback de un test no contamine al siguiente.
  afterEach(() => cleanup())

  it('muestra el fallback amigable cuando un hijo lanza un error', () => {
    // React imprime el error en consola al propagarlo al boundary; lo silenciamos.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )

    expect(screen.getByText('Algo salió mal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Recargar la página/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Volver al inicio/i })).toBeInTheDocument()

    spy.mockRestore()
  })

  it('renderiza los hijos normalmente cuando no hay error', () => {
    render(
      <ErrorBoundary>
        <p>Contenido normal</p>
      </ErrorBoundary>
    )

    expect(screen.getByText('Contenido normal')).toBeInTheDocument()
    expect(screen.queryByText('Algo salió mal')).not.toBeInTheDocument()
  })
})
