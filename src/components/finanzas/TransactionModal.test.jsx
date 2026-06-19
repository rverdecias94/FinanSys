import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransactionModal } from './TransactionModal'

// Cobertura de P1.1 (cableado de la prop `currencies`) y P1.2 (modo solo-lectura).
// El modal es autocontenido (recibe todo por props, usa react-hook-form interno),
// así que se renderiza sin providers. El cleanup global vive en setupTests.js.

const baseProps = {
  open: true,
  onOpenChange: () => {},
  onSubmit: vi.fn(),
}

describe('TransactionModal — solo lectura (P1.2)', () => {
  it('en readonly muestra "Ver Movimiento", solo el botón Cerrar y los campos deshabilitados', () => {
    render(
      <TransactionModal
        {...baseProps}
        currencies={[{ code: 'USD', is_default: true }]}
        readonly
      />
    )

    expect(screen.getByText('Ver Movimiento')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
    // No debe existir vía para guardar/editar desde "Ver".
    expect(screen.queryByRole('button', { name: 'Revisar Datos' })).not.toBeInTheDocument()
    // El <fieldset disabled> deshabilita los controles (toBeDisabled mira el fieldset ancestro).
    expect(screen.getByPlaceholderText('0.00')).toBeDisabled()
  })

  it('en modo editable muestra "Revisar Datos" y los campos habilitados', () => {
    render(
      <TransactionModal
        {...baseProps}
        currencies={[{ code: 'USD', is_default: true }]}
      />
    )

    expect(screen.getByRole('button', { name: 'Revisar Datos' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('0.00')).toBeEnabled()
  })
})

describe('TransactionModal — moneda (P1.1)', () => {
  it('usa la moneda por defecto del negocio (no el USD fijo) cuando se pasa `currencies`', () => {
    render(
      <TransactionModal
        {...baseProps}
        currencies={[{ code: 'EUR', is_default: true }, { code: 'USD' }]}
      />
    )

    // El "Total Estimado" refleja la moneda activa = EUR, demostrando que la prop
    // `currencies` gobierna el valor por defecto (antes caía a USD por el bug de prop).
    expect(screen.getByText(/0\.00\s+EUR/)).toBeInTheDocument()
  })
})
